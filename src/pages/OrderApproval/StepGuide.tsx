import { Fragment, type ReactNode } from "react";
import { Check, ChevronRight, Lock } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/Spinner";
import type { ApprovalLine, ApprovalView } from "@/services/Api/ApprovalApi";
import type { Flow } from "./flow";
import { centralTime, count, lineName } from "./format";

const STEPS = ["Add artwork previews", "Send to customer", "Customer reviews", "Lock for production"];

const HOW_IT_WORKS = [
  { title: "Add artwork previews", text: "Upload an image of each item with the customer's design on it." },
  { title: "Send to customer", text: "We email the customer a private link to check the artwork previews." },
  {
    title: "The customer reviews",
    text: "They approve each item or ask for changes. Their answers show up on this page.",
  },
];

// Bold words in the guide's sentence: the names of buttons and steps.
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

// The one sentence under the steps: where things stand and what to do next.
function nextText(view: ApprovalView, flow: Flow, onShow: (lineId: number) => void): ReactNode {
  const { order, approval } = view;
  const customer = order.customer_name || "the customer";
  const items = (subset: ApprovalLine[]) => <ItemLinks lines={subset} onShow={onShow} />;
  switch (flow.situation) {
    case "add-first":
      return (
        <>
          <B>Next:</B> add an artwork preview to each item below, then press <B>Send to customer</B> at the bottom of
          the page.
        </>
      );
    case "add-rest":
      return (
        <>
          <B>Next:</B> add an artwork preview to {items(flow.missing)} too (or switch on “No preview needed”), then
          press <B>Send to customer</B>.
        </>
      );
    case "send-first":
      return (
        <>
          <B>Next:</B> press <B>Send to customer</B> at the bottom of the page. We'll email {customer} a link to check{" "}
          {count(flow.readyFiles, "artwork preview")}.
        </>
      );
    case "changes":
      return (
        <>
          The customer asked for changes to {items(flow.changes)}. <B>Next:</B> upload a new version, then press{" "}
          <B>Send to customer</B>.
        </>
      );
    case "add-new-items":
      return (
        <>
          <B>Next:</B> add an artwork preview to {items(flow.missing)}, then press <B>Send to customer</B>. The customer
          is already checking the rest.
        </>
      );
    case "send-new":
      return (
        <>
          <B>Next:</B> press <B>Send to customer</B> at the bottom of the page to send the new{" "}
          {flow.readyFiles === 1 ? "artwork preview" : "artwork previews"} for {items(flow.ready)}.
        </>
      );
    case "waiting":
      return (
        <>
          Waiting for the customer: <B>{flow.approved.length} of {count(flow.toCheck.length, "item")}</B> approved so
          far. Their answers show up here by themselves.{" "}
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
      );
    case "approved":
      return (
        <>
          The customer approved everything{approval?.approved_at ? ` on ${centralTime(approval.approved_at)}` : ""}.{" "}
          <B>Next:</B> lock it for production, so nothing changes while it's being made.
        </>
      );
    case "nothing-to-check":
      return (
        <>
          Every item is marked “No preview needed”, so there's nothing for the customer to check. Lock it for production
          when you're ready.
        </>
      );
    case "locked":
      return (
        <>
          <B>Locked for production</B>
          {approval?.locked_by?.name ? ` by ${approval.locked_by.name}` : ""} on {centralTime(approval?.locked_at)}. The
          customer can still look at their artwork but can't change it. To change something, unlock it under{" "}
          <B>Customer link &amp; options</B>.
        </>
      );
    case "shipped":
      return <>This order has shipped. The customer can still look at their artwork, but nothing can change now.</>;
    case "cancelled":
      return <>This order is cancelled, so nothing can be sent or changed.</>;
  }
}

interface StepGuideProps {
  view: ApprovalView;
  flow: Flow;
  // Opens Send to customer.
  onSend: () => void;
  // Lock for production, offered here once there's nothing left for the customer to do.
  onLock: () => void;
  // Scrolls to an item's card.
  onShowItem: (lineId: number) => void;
  busy: string | null;
}

// The four steps across the top of a started approval: the current one highlighted, and one
// plain sentence of what to do next. The current step is a button that does it, so it never
// looks like a button that does nothing.
export function StepGuide({ view, flow, onSend, onLock, onShowItem, busy }: StepGuideProps) {
  const lockNow = flow.situation === "approved" || flow.situation === "nothing-to-check";
  // The first item that needs the team: changes asked for, or no artwork preview yet.
  const firstToDo = flow.changes[0] ?? flow.missing[0];
  // What pressing the current step does (`hint` is its tooltip; `write` waits for other writes);
  // null while waiting for the customer (step 3) or once every step is done.
  const action: { run: () => void; hint: string; write: boolean } | null =
    flow.step === 1 && firstToDo && firstToDo.id !== null
      ? { run: () => onShowItem(firstToDo.id as number), hint: `Go to ${lineName(firstToDo)}`, write: false }
      : flow.step === 2
        ? { run: onSend, hint: "Open Send to customer", write: true }
        : flow.step === 4 && lockNow
          ? { run: onLock, hint: "Lock for production", write: true }
          : null;

  return (
    <section aria-label="Artwork approval steps" className="@container rounded-xl border bg-card shadow-xs">
      {/* Four across when there's room for the names on one line, otherwise two by two. */}
      <ol className="grid gap-1 p-2 @md:grid-cols-2 @3xl:grid-cols-4">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const state = flow.step === 0 ? "todo" : n < flow.step ? "done" : n === flow.step ? "current" : "todo";
          const content = (
            <>
              <span
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-semibold tabular-nums",
                  state === "done" && "bg-success text-success-foreground",
                  state === "current" && "bg-primary text-primary-foreground",
                  state === "todo" && "bg-muted text-muted-foreground",
                )}
              >
                {state === "done" ? <Check className="size-4" aria-hidden /> : n}
              </span>
              <span
                className={cn(
                  "min-w-0 text-left text-sm font-medium",
                  state === "todo" ? "text-muted-foreground" : "text-foreground",
                  state === "current" && "font-semibold",
                )}
              >
                <span className="sr-only">{state === "done" ? "Done: " : state === "current" ? "Now: " : "Later: "}</span>
                {label}
              </span>
            </>
          );
          const pill = "flex items-center gap-3 rounded-lg px-3 py-2.5";
          return (
            <li key={label} aria-current={state === "current" ? "step" : undefined} className="flex items-center gap-1">
              {state === "current" && action ? (
                <button
                  type="button"
                  title={action.hint}
                  disabled={action.write && busy !== null}
                  onClick={action.run}
                  className={cn(
                    pill,
                    "flex-1 cursor-pointer bg-primary-soft ring-1 ring-primary-border transition-colors hover:ring-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none disabled:cursor-default disabled:opacity-60",
                  )}
                >
                  {content}
                </button>
              ) : (
                <div className={cn(pill, "flex-1", state === "current" && "bg-primary-soft ring-1 ring-primary-border")}>
                  {content}
                </div>
              )}
              {n < STEPS.length && (
                <ChevronRight className="ml-auto hidden size-4 shrink-0 text-placeholder @3xl:block" aria-hidden />
              )}
            </li>
          );
        })}
      </ol>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t px-4 py-3">
        <p className="min-w-0 flex-1 basis-80 text-sm text-foreground" aria-live="polite">
          {nextText(view, flow, onShowItem)}
        </p>
        {lockNow && (
          <Button disabled={busy !== null} onClick={onLock}>
            {busy === "lock" ? <Spinner size="small" className="text-current" /> : <Lock />}
            Lock for production
          </Button>
        )}
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
