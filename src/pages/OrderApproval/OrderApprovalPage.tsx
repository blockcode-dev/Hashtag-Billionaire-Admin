import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { ArrowLeft, Ban, Clock, PauseCircle, Play, RefreshCw, ServerOff, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { confirm } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { Tip } from "@/components/common/Tip";
import { API_BASE_URL } from "@/config/env";
import { toastApiError } from "@/lib/api-errors";
import { ordersLink } from "@/lib/orderStatus";
import { checkProofFiles } from "@/lib/uploads";
import {
  ApprovalLinkAPI,
  CopyApprovalVersionAPI,
  LockApprovalAPI,
  RemoveApprovalFileAPI,
  SendApprovalAPI,
  SetApprovalHoldAPI,
  SetApprovalNoProofAPI,
  StartOrderApprovalAPI,
  UnlockApprovalAPI,
  UploadApprovalProofAPI,
  type ApprovalEmailResult,
  type ApprovalFile,
  type ApprovalLine,
} from "@/services/Api/ApprovalApi";
import { ActivityList } from "./ActivityList";
import { ItemCard, type UploadProgress } from "./ItemCard";
import { LinkOptions } from "./LinkOptions";
import { PreviewDialog } from "./PreviewDialog";
import { SendBar } from "./SendBar";
import { SendDialog } from "./SendDialog";
import { HowItWorks, Summary } from "./Summary";
import { flowOf, wentBackTo } from "./flow";
import { centralTime, count, lineName } from "./format";
import { useApproval } from "./useApproval";

// An order's artwork approval (/orders/:id/approval). The team adds an artwork preview for each
// item and sends them; order@ emails the customer a link to the approval site, where they approve
// or reject each item without signing in. The page says where it stands at the top, keeps its one
// main button (Send to customer, or Lock for production) at the bottom and shows everything the
// customer does; it looks for their answers every minute.

const TONES = {
  info: "border-info-border bg-info-soft text-info-soft-foreground",
  warning: "border-warning-border bg-warning-soft text-warning-soft-foreground",
};

function Notice({ tone, icon, children }: { tone: keyof typeof TONES; icon: ReactNode; children: ReactNode }) {
  return (
    <div role="status" className={cn("flex items-start gap-3 rounded-lg border px-4 py-3 text-sm", TONES[tone])}>
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

function BackToOrders() {
  return (
    <Link
      to="/orders"
      className="mb-3 inline-flex items-center gap-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
    >
      <ArrowLeft className="size-4" aria-hidden />
      Back to Orders
    </Link>
  );
}

function Missing() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
      <p className="font-medium text-foreground">This order doesn't exist</p>
      <p className="text-sm text-muted-foreground">It may have been deleted.</p>
      <Button variant="outline" asChild>
        <Link to="/orders">
          <ArrowLeft />
          Back to Orders
        </Link>
      </Button>
    </div>
  );
}

// The server the panel talks to, named so it's clear which one lacks artwork approval.
const API_HOST = new URL(API_BASE_URL).host;

// The server doesn't know the artwork approval address, or didn't answer: it doesn't run the
// backend with this feature yet. The order itself is fine, so this never says it's missing.
function Unavailable({ answered, onRetry }: { answered: boolean; onRetry: () => void }) {
  const host = <span className="font-medium text-foreground">{API_HOST}</span>;
  return (
    <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
      <ServerOff className="size-8 text-muted-foreground" aria-hidden />
      <div className="max-w-xl space-y-1">
        <p className="font-medium text-foreground">Artwork approval isn't available on the connected server yet</p>
        <p className="text-sm text-muted-foreground">
          {answered ? (
            <>
              The panel is connected to {host}, which doesn't have artwork approval yet. The order itself is fine.
            </>
          ) : (
            <>
              The panel is connected to {host}, which didn't answer. Most likely it doesn't have artwork approval yet.
              If it does, check the connection and try again.
            </>
          )}
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="outline" asChild>
          <Link to="/orders">
            <ArrowLeft />
            Back to Orders
          </Link>
        </Button>
        {!answered && (
          <Button variant="ghost" onClick={onRetry}>
            <RefreshCw />
            Try again
          </Button>
        )}
      </div>
    </div>
  );
}

const OrderApprovalPage = () => {
  const { id } = useParams<{ id: string }>();
  const orderId = Number(id);
  if (!Number.isInteger(orderId) || orderId <= 0) return <Missing />;
  // A fresh page for each order, so nothing carries over from the last one.
  return <ApprovalScreen key={orderId} orderId={orderId} />;
};

function ApprovalScreen({ orderId }: { orderId: number }) {
  const { view, loading, failed, retry, refresh, refreshing, newEventIds, busy, run, write, apply } = useApproval(orderId);
  const [upload, setUpload] = useState<UploadProgress | null>(null);
  const [sendOpen, setSendOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [tab, setTab] = useState("items");

  if (!view) {
    if (loading) {
      return (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      );
    }
    if (failed === "missing") return <Missing />;
    if (failed === "unavailable" || failed === "unanswered") {
      return <Unavailable answered={failed === "unavailable"} onRetry={retry} />;
    }
    return (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-12 text-center">
        <TriangleAlert className="size-8 text-destructive" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Couldn't load the artwork approval</p>
          <p className="text-sm text-muted-foreground">The server returned an error. Try again in a moment.</p>
        </div>
        <Button variant="outline" onClick={retry}>
          <RefreshCw />
          Try again
        </Button>
      </div>
    );
  }

  const { order, approval, lines } = view;
  const flow = approval ? flowOf(view) : null;
  const readOnly = approval?.read_only_reason ?? null;
  // Why nothing on the items can change now, in a sentence for their tooltips.
  const readOnlyText =
    readOnly === "LOCKED"
      ? "It's locked for production. Unlock it under Customer link & options first."
      : readOnly === "SHIPPED"
        ? "The order has shipped."
        : readOnly === "CANCELLED"
          ? "The order is cancelled."
          : null;
  const waiting = busy !== null;
  // The backend starts artwork approval only for a paid order that isn't cancelled. Before that
  // the page still shows the items it would have, and says why it can't start.
  const cancelled = order.status === "CANCELLED";
  const unpaid = order.payment_status !== "SUCCESS";
  const readyFiles = flow?.readyFiles ?? 0;
  // Why "Send a reminder email" can't be used now, or null. It sits under Customer link & options,
  // above Unlock. A reminder tells the customer their artwork is waiting for their approval, so it
  // needs an item that is: with nothing waiting and nothing new to send, unlocking or switching
  // the link on wouldn't help, so that reason comes first.
  const remindBlock = !approval?.first_sent_at
    ? "Nothing has been sent yet. Use Send to customer at the bottom."
    : readOnly === "SHIPPED" || readOnly === "CANCELLED"
      ? readOnlyText
      : flow?.counts.WAITING === 0 && !readyFiles
        ? "Nothing is waiting for the customer to check right now."
        : readOnly === "LOCKED"
          ? "It's locked for production. Unlock it below first."
          : approval.link.disabled
            ? "The customer link is switched off."
            : readyFiles
              ? "New artwork previews are ready: use Send to customer at the bottom."
              : null;

  const start = () => void write("start", () => StartOrderApprovalAPI(orderId), "Artwork approval didn't start");

  // From the summary's item links: the Items tab, scrolled to that item's card.
  const showItem = (lineId: number) => {
    setTab("items");
    requestAnimationFrame(() =>
      document.getElementById(`approval-item-${lineId}`)?.scrollIntoView({ behavior: "smooth", block: "start" }),
    );
  };

  // One request per file, in the order picked; the ones already added stay if a later one fails.
  const uploadPreviews = (line: ApprovalLine, picked: File[]) => {
    const { accepted, error } = checkProofFiles(picked);
    if (error) toast.error(error);
    const lineId = line.id;
    if (!accepted.length || lineId === null) return;
    void run(`upload:${lineId}`, async () => {
      let done = 0;
      try {
        for (const file of accepted) {
          setUpload({ lineId, done, total: accepted.length });
          apply((await UploadApprovalProofAPI(orderId, lineId, file)).data.data);
          done++;
        }
        toast.success(done === 1 ? "Artwork preview added" : `${done} artwork previews added`, {
          description: `${done === 1 ? "It goes" : "They go"} to the customer when you press Send to customer.`,
        });
      } catch (err) {
        const name = accepted[done]?.name ?? "A file";
        toastApiError(done ? `Added ${done} of ${accepted.length}. ${name} wasn't added` : `${name} wasn't added`, err);
        void refresh(true);
      } finally {
        setUpload(null);
      }
    });
  };

  const removePreview = (file: ApprovalFile) =>
    void write(`remove:${file.id}`, () => RemoveApprovalFileAPI(orderId, file.id), `${file.name} wasn't removed`);

  const reuseVersion = async (line: ApprovalLine, version: number) => {
    const done = await write(
      `copy:${line.id}`,
      () => CopyApprovalVersionAPI(orderId, line.id as number, version),
      `Version ${version}'s images weren't reused`,
    );
    if (done) {
      toast.success(`Version ${version}'s images are in the new version`, {
        description: "Remove any you don't need, add new ones, then press Send to customer.",
      });
    }
  };

  const setNoPreview = (line: ApprovalLine, on: boolean) =>
    void write(`no-preview:${line.id}`, () => SetApprovalNoProofAPI(orderId, line.id as number, on), "The item wasn't changed");

  const holdLabel = () =>
    void write("hold", () => SetApprovalHoldAPI(orderId, true), "The shipping label wasn't put on hold");

  const releaseLabel = () =>
    confirm({
      title: "Stop waiting for the artwork approval?",
      content:
        "The shipping label stops waiting. If automatic labels are on, it's bought now; otherwise buy it from the order.",
      okText: "Don't wait",
      onOk: () => write("release", () => SetApprovalHoldAPI(orderId, false), "The shipping label wasn't released"),
    });

  const lock = () =>
    confirm({
      title: "Lock for production?",
      content: (
        <ul className="list-disc space-y-1 pl-5">
          <li>The customer can still look at their artwork, but can't approve, reject or undo anything.</li>
          {/* The version to make, where it isn't the newest one. */}
          {lines.map((line) => {
            const back = wentBackTo(line);
            return (
              back !== null && (
                <li key={line.id}>
                  {lineName(line)}: use Version {back} for production (the customer went back to it), not Version{" "}
                  {line.current_version}.
                </li>
              )
            );
          })}
          {approval?.status !== "APPROVED" && <li>Not every item is approved yet.</li>}
          {(approval?.hold_state === "HOLD" || approval?.hold_state === "PENDING_DECISION") && (
            <li>The shipping label stops waiting. It's bought now if automatic labels are on.</li>
          )}
          <li>You can unlock it again later.</li>
        </ul>
      ),
      okText: "Lock for production",
      onOk: async () => {
        if (await write("lock", () => LockApprovalAPI(orderId), "It wasn't locked")) {
          toast.success("Locked for production");
        }
      },
    });

  const unlock = () =>
    confirm({
      title: "Unlock artwork approval?",
      content: "The customer can approve, reject and undo again. A shipping label that was already bought stays.",
      okText: "Unlock",
      onOk: () => write("unlock", () => UnlockApprovalAPI(orderId), "It wasn't unlocked"),
    });

  const linkUrl = approval?.link.url ?? null;
  const copyLink = async () => {
    if (!linkUrl) return;
    try {
      await navigator.clipboard.writeText(linkUrl);
      toast.success("Link copied", { description: "Anyone with the link can approve, so send it only to the customer." });
    } catch {
      toast.error("Couldn't copy it. Copy the link from here:", { description: linkUrl, duration: 20000 });
    }
  };

  const replaceLink = () =>
    confirm({
      title: "Replace the customer link?",
      // Offers the reminder email only while one can go out.
      content: remindBlock
        ? "The old link stops working straight away. To give the customer the new one, copy it under Customer link & options."
        : "The old link stops working straight away. Send the new one with a reminder email, or copy it.",
      okText: "Replace link",
      okType: "danger",
      onOk: async () => {
        if (await write("link", () => ApprovalLinkAPI(orderId, "replace"), "The link wasn't replaced")) {
          toast.success("New link made", { description: "The old one doesn't open any more." });
        }
      },
    });

  const switchLinkOff = () =>
    confirm({
      title: "Switch the customer link off?",
      content: "The customer sees “This link isn't valid any more” until you switch it back on.",
      okText: "Switch off",
      okType: "danger",
      onOk: () => write("link", () => ApprovalLinkAPI(orderId, "disable"), "The link wasn't switched off"),
    });

  const switchLinkOn = () => void write("link", () => ApprovalLinkAPI(orderId, "enable"), "The link wasn't switched on");

  // From the Send dialog, which shows a failed request itself. New versions whose email failed
  // are still sent, so that's a warning here instead.
  const send = async (body: { to: string; message?: string }) => {
    let email: ApprovalEmailResult | undefined;
    try {
      email = await run("send", async () => {
        const { email: result, ...next } = (await SendApprovalAPI(orderId, body)).data.data;
        apply(next);
        return result;
      });
    } catch (err) {
      void refresh(true);
      throw err;
    }
    if (!email) return;
    setSendOpen(false);
    if (email.sent) {
      toast.success(`Sent to ${email.to}`, {
        description:
          email.kind === "reminder"
            ? "The customer got a reminder with the same link."
            : "The customer got an email with a link to check their artwork.",
      });
    } else {
      const reason = email.error ? `The mail server said: ${email.error.replace(/[\s.]+$/, "")}.` : "";
      toast.error("Saved, but the email didn't go out", {
        description: `${reason} The link works: copy it under Customer link & options and send it yourself, or send a reminder.`.trim(),
        duration: 15000,
      });
    }
  };

  const refreshButton = (
    <Tip content="Check for the customer's answers now">
      <Button variant="outline" size="icon" aria-label="Refresh" disabled={refreshing} onClick={() => refresh()}>
        {refreshing ? <Spinner size="small" /> : <RefreshCw />}
      </Button>
    </Tip>
  );

  const cards = (started: boolean) =>
    lines.length ? (
      lines.map((line, i) => (
        <ItemCard
          key={line.id ?? `proposed-${i}`}
          line={line}
          index={i}
          total={lines.length}
          started={started}
          readOnly={readOnlyText}
          busy={busy}
          upload={upload}
          newEventIds={newEventIds}
          onUpload={uploadPreviews}
          onRemove={removePreview}
          onReuse={reuseVersion}
          onNoPreview={setNoPreview}
        />
      ))
    ) : (
      <div className="rounded-xl border bg-card">
        <EmptyState description="This order has no items to check." />
      </div>
    );

  return (
    <div>
      <BackToOrders />
      <PageHeader
        className="mb-5"
        title={`Artwork approval for ${order.order_number}`}
        description={
          <>
            {order.customer_name || "Customer"}
            {order.customer_email ? ` · ${order.customer_email}` : ""} · Placed {centralTime(order.created_at)} ·{" "}
            {/* Every payment status: the list shows only paid orders unless it's told otherwise. */}
            <Link
              to={ordersLink({ search: order.order_number, open: order.order_number, payment_status: "ALL" })}
              className="font-medium text-foreground underline-offset-4 hover:underline"
            >
              View order
            </Link>
          </>
        }
        actions={
          <>
            {refreshButton}
            {approval && (
              <LinkOptions
                view={view}
                busy={busy}
                remindBlock={remindBlock}
                onCopy={copyLink}
                onPreview={() => setPreviewOpen(true)}
                onRemind={() => setSendOpen(true)}
                onReplace={replaceLink}
                onSwitchOff={switchLinkOff}
                onSwitchOn={switchLinkOn}
                onLock={lock}
                onUnlock={unlock}
              />
            )}
          </>
        }
      />

      {approval && flow ? (
        <div className="space-y-4">
          {approval.hold_state === "PENDING_DECISION" && !readOnly && (
            <section
              aria-labelledby="label-hold-question"
              className="flex gap-3 rounded-xl border border-warning-border bg-warning-soft p-4 sm:p-5"
            >
              <PauseCircle className="mt-0.5 size-5 shrink-0 text-warning" aria-hidden />
              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1">
                  <h2 id="label-hold-question" className="text-base font-semibold text-foreground">
                    Should the shipping label wait for the artwork approval?
                  </h2>
                  <p className="text-sm text-foreground/80">
                    This order was paid with customized items, so its shipping label hasn't been bought yet. If it
                    waits, it's released when you lock for production: bought then if automatic labels are on,
                    otherwise buy it from the order.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button disabled={waiting} onClick={holdLabel}>
                    {busy === "hold" && <Spinner size="small" className="text-current" />}
                    Yes, wait for approval
                  </Button>
                  <Button variant="outline" className="bg-background" disabled={waiting} onClick={releaseLabel}>
                    No, don't wait
                  </Button>
                </div>
              </div>
            </section>
          )}

          <Summary view={view} flow={flow} onShowItem={showItem} />

          {approval.hold_state === "HOLD" && !readOnly && (
            <Notice tone="info" icon={<PauseCircle />}>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <p>
                  The shipping label waits for the artwork approval. It's released when you lock for production: bought
                  then if automatic labels are on, otherwise buy it from the order.
                </p>
                <Button size="sm" variant="outline" className="bg-background" disabled={waiting} onClick={releaseLabel}>
                  Don't wait any more
                </Button>
              </div>
            </Notice>
          )}

          <Tabs value={tab} onValueChange={setTab} className="gap-4 pt-2">
            <TabsList variant="line" className="h-auto w-full justify-start rounded-none border-b">
              <TabsTrigger value="items" className="flex-none px-3 py-2">
                Items ({lines.length})
              </TabsTrigger>
              <TabsTrigger value="activity" className="flex-none px-3 py-2">
                Activity
                {newEventIds.size > 0 && (
                  <span className="size-2 rounded-full bg-primary" role="img" aria-label="New from the customer" />
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="items" className="space-y-4">
              {cards(true)}
            </TabsContent>

            <TabsContent value="activity">
              <ActivityList view={view} newEventIds={newEventIds} />
            </TabsContent>
          </Tabs>

          <SendBar view={view} flow={flow} busy={busy} onSend={() => setSendOpen(true)} onLock={lock} />
        </div>
      ) : (
        <div className="space-y-6">
          <HowItWorks>
            {cancelled ? (
              <Notice tone="warning" icon={<Ban />}>
                <strong>This order is cancelled,</strong> so it doesn't need artwork approval.
              </Notice>
            ) : unpaid ? (
              <Notice tone="info" icon={<Clock />}>
                <strong>This order isn't paid yet.</strong> You can start artwork approval once the customer has paid.
              </Notice>
            ) : (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                <Button size="lg" disabled={waiting} onClick={start}>
                  {busy === "start" ? <Spinner size="small" className="text-current" /> : <Play />}
                  Start artwork approval
                </Button>
                <p className="text-sm text-muted-foreground">
                  Nothing is sent to the customer until you press Send to customer.
                </p>
              </div>
            )}
          </HowItWorks>

          <section aria-labelledby="items-to-check" className="space-y-3">
            <div className="space-y-0.5">
              <h2 id="items-to-check" className="text-base font-semibold text-foreground">
                What the customer will check ({count(lines.length, "item")})
              </h2>
              <p className="text-sm text-muted-foreground">
                One item per product and colour, with all its sizes together.
              </p>
            </div>
            {cards(false)}
          </section>
        </div>
      )}

      <SendDialog open={sendOpen} view={view} onSend={send} onClose={() => setSendOpen(false)} />
      <PreviewDialog open={previewOpen} view={view} onClose={() => setPreviewOpen(false)} />
    </div>
  );
}

export default OrderApprovalPage;
