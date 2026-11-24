import { Fragment, type ReactNode } from "react";
import { Ban, Check, CircleCheck, CircleX, Clock, ImagePlus, Lock, Send, Truck } from "lucide-react";
import { cn } from "cn";
import { StatusTag } from "@/components/common/StatusTag";
import type { ApprovalLine, ApprovalView, LineStatus } from "@/services/Api/ApprovalApi";
import type { Flow } from "./flow";
import { centralTime, count, lineName } from "./format";

const HOW_IT_WORKS = [
  { title: "Add artwork previews", text: "Upload an image of each item with the customer's design on it." },
  { title: "Send to customer", text: "We email the customer a private link to check the artwork previews." },
  {
    title: "The customer reviews",
    text: "They approve each item, or reject it and say what to change. Their answers show up on this page.",
  },
];

type Tone = "info" | "ready" | "attention" | "waiting" | "good" | "quiet";

// The card's border and the headline icon's circle, in the colour of where things stand.
const TONES: Record<Tone, { card: string; icon: string }> = {
  info: { card: "border-info-border", icon: "bg-info-soft text-info-soft-foreground" },
  ready: { card: "border-primary-border", icon: "bg-primary-soft text-primary-soft-foreground" },
  attention: { card: "border-warning-border", icon: "bg-warning-soft text-warning-soft-foreground" },
  waiting: { card: "border-info-border", icon: "bg-info-soft text-info-soft-foreground" },
  good: { card: "border-success-border", icon: "bg-success-soft text-success-soft-foreground" },
  quiet: { card: "", icon: "bg-muted text-muted-foreground" },
};

// The counts under the sentence, in this order; only the ones above zero show.
const COUNTS: { status: LineStatus; label: string; color: string }[] = [
  { status: "APPROVED", label: "approved", color: "green" },
  { status: "CHANGES_REQUESTED", label: "rejected", color: "orange" },
  { status: "WAITING", label: "waiting for the customer", color: "blue" },
  { status: "NOT_SENT", label: "not sent yet", color: "default" },
  { status: "NO_PROOF_NEEDED", label: "no preview needed", color: "default" },
];

// Bold words in the sentence: the names of buttons and menus.
const B = ({ children }: { children: ReactNode }) => <strong className="font-semibold">{children}</strong>;

interface ItemLinksProps {
  lines: ApprovalLine[];
  onShow: (lineId: number) => void;
}

// The items a sentence is about, as links that scroll to their cards: up to three by name, more
// as a count. Links, not buttons, so a long name wraps with the sentence.
function ItemLinks({ lines, onShow }: ItemLinksProps) {
  if (lines.length > 3) return <>{count(lines.length, "item")}</>;
  return (
    <>
      {lines.map((line, i) => (
        <Fragment key={line.id}>
          {i > 0 && (i === lines.length - 1 ? " and " : ", ")}
          <a
            href={`#approval-item-${line.id}`}
            onClick={(e) => {
              e.preventDefault();
              if (line.id !== null) onShow(line.id);
            }}
            className="rounded font-medium text-foreground underline decoration-from-font underline-offset-2 hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
          >
            {lineName(line)}
          </a>
        </Fragment>
      ))}
    </>
  );
}

interface Standing {
  tone: Tone;
  icon: ReactNode;
  headline: ReactNode;
  // What to do next, or why nothing can be done.
  sentence: ReactNode;
}

function standingOf(view: ApprovalView, flow: Flow, onShow: (lineId: number) => void): Standing {
  const { order, approval } = view;
  const items = (subset: ApprovalLine[]) => <ItemLinks lines={subset} onShow={onShow} />;
  switch (flow.situation) {
    case "add-first":
      return {
        tone: "info",
        icon: <ImagePlus />,
        headline: "Add an artwork preview to each item",
        sentence: (
          <>
            Then press <B>Send to customer</B> at the bottom of the page. Nothing goes to the customer before that.
          </>
        ),
      };
    case "add-rest":
      return {
        tone: "info",
        icon: <ImagePlus />,
        headline: "Add an artwork preview to the rest",
        sentence: (
          <>
            {items(flow.missing)} still {flow.missing.length === 1 ? "needs" : "need"} one, or switch on “No preview
            needed” for an item that doesn't need one. Then press <B>Send to customer</B>.
          </>
        ),
      };
    case "send-first":
      return {
        tone: "ready",
        icon: <Send />,
        headline: "Ready to send",
        sentence: (
          <>
            Press <B>Send to customer</B> at the bottom of the page. We'll email {order.customer_name || "the customer"} a
            link to check {count(flow.readyFiles, "artwork preview")}.
          </>
        ),
      };
    case "rejected":
      return {
        tone: "attention",
        icon: <CircleX />,
        headline: `The customer rejected ${count(flow.rejected.length, "item")}`,
        sentence: (
          <>
            See why on {items(flow.rejected)}, upload a new version, then press <B>Send to customer</B>.
          </>
        ),
      };
    case "add-new-items":
      return {
        tone: "attention",
        icon: <ImagePlus />,
        headline: <>Add an artwork preview to {items(flow.missing)}</>,
        sentence: (
          <>
            Then press <B>Send to customer</B>. The customer is already checking the rest.
          </>
        ),
      };
    case "send-new": {
      // Sending a new version of an approved item asks the customer to check it again.
      const again = flow.readyApproved;
      return {
        tone: "ready",
        icon: <Send />,
        headline: "Ready to send",
        sentence: (
          <>
            Press <B>Send to customer</B> at the bottom of the page to send the new{" "}
            {flow.readyFiles === 1 ? "artwork preview" : "artwork previews"} for {items(flow.ready)}.
            {again.length === 1 && (
              <>
                {" "}
                {items(again)} is already approved: sending asks the customer to check it again. To keep the approval,
                remove its new artwork preview instead.
              </>
            )}
            {again.length > 1 && (
              <>
                {" "}
                {items(again)} are already approved: sending asks the customer to check them again. To keep the
                approvals, remove their new artwork previews instead.
              </>
            )}
          </>
        ),
      };
    }
    case "waiting":
      return {
        tone: "waiting",
        icon: <Clock />,
        headline: "Waiting for the customer",
        sentence: (
          <>
            <B>
              {flow.approved.length} of {count(flow.toCheck.length, "item")}
            </B>{" "}
            approved so far. Their answers show up here by themselves.{" "}
            {approval?.link.disabled ? (
              <>
                The customer link is switched off, so they can't open it: switch it on under{" "}
                <B>Customer link &amp; options</B>.
              </>
            ) : (
              <>
                To remind them, use <B>Send a reminder email</B> under <B>Customer link &amp; options</B>.
              </>
            )}
          </>
        ),
      };
    case "approved":
      return {
        tone: "good",
        icon: <CircleCheck />,
        headline: "Everything is approved",
        sentence: (
          <>
            The customer approved everything{approval?.approved_at ? ` on ${centralTime(approval.approved_at)}` : ""}.
            {flow.wentBack.length > 0 && (
              <>
                {" "}
                On {items(flow.wentBack)} they went back to an earlier version: use the version marked Approved.
              </>
            )}{" "}
            Next: press <B>Lock for production</B> at the bottom of the page, so nothing changes while it's being made.
          </>
        ),
      };
    case "nothing-to-check":
      return {
        tone: "quiet",
        icon: <Check />,
        headline: "Nothing for the customer to check",
        sentence: (
          <>
            Every item is marked “No preview needed”. Press <B>Lock for production</B> when you're ready.
          </>
        ),
      };
    case "locked":
      return {
        tone: "quiet",
        icon: <Lock />,
        headline: "Locked for production",
        sentence: (
          <>
            Locked{approval?.locked_by?.name ? ` by ${approval.locked_by.name}` : ""} on {centralTime(approval?.locked_at)}.
            The customer can still look at their artwork but can't change it. To change something, unlock it under{" "}
            <B>Customer link &amp; options</B>.
          </>
        ),
      };
    case "shipped":
      return {
        tone: "quiet",
        icon: <Truck />,
        headline: "This order has shipped",
        sentence: "The customer can still look at their artwork, but nothing can change now.",
      };
    case "cancelled":
      return {
        tone: "quiet",
        icon: <Ban />,
        headline: "This order is cancelled",
        sentence: "Nothing can be sent or changed.",
      };
  }
}

interface SummaryProps {
  view: ApprovalView;
  flow: Flow;
  // Scrolls to an item's card.
  onShowItem: (lineId: number) => void;
}

// Where a started approval stands, at the top of the page: one headline, one sentence of what to
// do next (item names scroll to their cards) and how many items are where. It has no buttons:
// the one main button is in the bar at the bottom of the page.
export function Summary({ view, flow, onShowItem }: SummaryProps) {
  const { tone, icon, headline, sentence } = standingOf(view, flow, onShowItem);
  // The customer can't approve any more, so nothing is awaited.
  const readOnly = Boolean(view.approval?.read_only_reason);
  const counts = flow.sentBefore ? COUNTS.filter(({ status }) => flow.counts[status] > 0) : [];

  return (
    <section
      aria-label="Where this approval stands"
      className={cn("rounded-xl border bg-card p-4 shadow-xs sm:p-5", TONES[tone].card)}
    >
      <div className="flex gap-3 sm:gap-4">
        <span
          className={cn("flex size-10 shrink-0 items-center justify-center rounded-full [&_svg]:size-5", TONES[tone].icon)}
          aria-hidden
        >
          {icon}
        </span>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="space-y-1" aria-live="polite">
            <h2 className="text-lg leading-snug font-semibold text-foreground">{headline}</h2>
            <p className="text-sm text-foreground/80">{sentence}</p>
          </div>
          {counts.length > 0 && (
            <ul className="flex flex-wrap gap-1.5">
              {counts.map(({ status, label, color }) => {
                const notApproved = readOnly && status === "WAITING";
                return (
                  <li key={status}>
                    <StatusTag color={notApproved ? "default" : color}>
                      {flow.counts[status]} {notApproved ? "not approved" : label}
                    </StatusTag>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}

// Before artwork approval starts: what it is, in three steps, and how to start it (or why it
// can't start yet).
export function HowItWorks({ children }: { children: ReactNode }) {
  return (
    <section
      aria-labelledby="how-artwork-approval-works"
      className="@container rounded-xl border bg-card p-5 shadow-xs sm:p-6"
    >
      <h2 id="how-artwork-approval-works" className="text-lg font-semibold text-foreground">
        How artwork approval works
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Before a customized order is made, the customer checks how each item will look.
      </p>
      <ol className="mt-5 grid gap-4 @2xl:grid-cols-3">
        {HOW_IT_WORKS.map((step, i) => (
          <li key={step.title} className="flex gap-3">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-semibold text-primary-soft-foreground">
              {i + 1}
            </span>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">{step.title}</p>
              <p className="text-sm text-muted-foreground">{step.text}</p>
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-4 text-sm text-muted-foreground">
        When everything is approved, you lock it for production so nothing changes while it's being made.
      </p>
      <div className="mt-5 border-t pt-5">{children}</div>
    </section>
  );
}
