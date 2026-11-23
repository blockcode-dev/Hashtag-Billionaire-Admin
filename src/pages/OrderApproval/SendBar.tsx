import { useEffect, useRef, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, Send } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/Spinner";
import { Tip } from "@/components/common/Tip";
import type { ApprovalView } from "@/services/Api/ApprovalApi";
import type { Flow } from "./flow";
import { centralTime, count, lineName } from "./format";

type Tone = "ready" | "good" | "attention" | "quiet";

const TONE_ICON: Record<Tone, ReactNode> = {
  ready: <Send className="text-primary" />,
  good: <CircleCheck className="text-success" />,
  attention: <CircleAlert className="text-warning" />,
  quiet: <Info className="text-muted-foreground" />,
};

interface Bar {
  tone: Tone;
  text: ReactNode;
  // Why Send can't be pressed, or null when it can.
  block: string | null;
  // False when nothing is left to send (locked, shipped, cancelled, everything approved, or
  // nothing for the customer to check): the bar only says where things stand, so the step
  // guide's Lock for production stays the page's one main button.
  offer: boolean;
}

// What the bar says, and whether and when Send can be pressed.
function barState(view: ApprovalView, flow: Flow): Bar {
  const approval = view.approval;
  const lastEmail = view.history.find((event) => event.type === "EMAIL_SENT" || event.type === "EMAIL_FAILED");
  const to = lastEmail?.meta?.to || view.order.customer_email || "the customer";
  // One item by name, more as a count: the bar has one line to say it.
  const items = (lines: typeof flow.ready) => (lines.length === 1 ? lineName(lines[0]) : count(lines.length, "item"));

  switch (approval?.read_only_reason) {
    case "LOCKED":
      return {
        tone: "quiet",
        text: "Locked for production, so nothing more is sent. Unlock it under Customer link & options to change something.",
        block: null,
        offer: false,
      };
    case "SHIPPED":
      return { tone: "quiet", text: "This order has shipped, so nothing more is sent.", block: null, offer: false };
    case "CANCELLED":
      return { tone: "quiet", text: "This order is cancelled, so nothing is sent.", block: null, offer: false };
  }

  if (flow.readyFiles) {
    if (approval?.link.disabled) {
      return {
        tone: "attention",
        text: "The customer link is switched off. Switch it on under Customer link & options, then send.",
        block: "The customer link is switched off.",
        offer: true,
      };
    }
    return {
      tone: "ready",
      text: (
        <>
          <strong className="font-semibold">{count(flow.readyFiles, "new artwork preview")}</strong> ready to send, for{" "}
          {items(flow.ready)}.
        </>
      ),
      block: null,
      offer: true,
    };
  }

  if (flow.situation === "nothing-to-check") {
    return {
      tone: "quiet",
      text: "Nothing for the customer to check. Lock for production when you're ready.",
      block: null,
      offer: false,
    };
  }
  if (!flow.sentBefore) {
    return {
      tone: "quiet",
      text: "Nothing to send yet. Add an artwork preview to an item first.",
      block: "Add an artwork preview to an item first.",
      offer: true,
    };
  }
  if (flow.changes.length) {
    return {
      tone: "attention",
      text:
        flow.changes.length === 1
          ? `The customer asked for changes to ${items(flow.changes)}. Upload a new version on the item, then send it from here.`
          : `The customer asked for changes to ${items(flow.changes)}. Upload a new version on each, then send them from here.`,
      block: "Upload a new version first.",
      offer: true,
    };
  }
  if (flow.missing.length) {
    return {
      tone: "attention",
      text:
        flow.missing.length === 1
          ? `${items(flow.missing)} has no artwork preview yet. Add one, then send it from here.`
          : `${items(flow.missing)} have no artwork preview yet. Add them, then send them from here.`,
      block: "Add an artwork preview first.",
      offer: true,
    };
  }
  if (approval?.status === "APPROVED") {
    return {
      tone: "good",
      text: `The customer approved everything · ${centralTime(approval.approved_at)}`,
      block: null,
      offer: false,
    };
  }
  if (approval?.link.disabled) {
    return {
      tone: "attention",
      text: "The customer link is switched off, so the customer can't open it. Switch it on under Customer link & options.",
      block: "The customer link is switched off.",
      offer: true,
    };
  }
  if (lastEmail?.type === "EMAIL_FAILED") {
    return {
      tone: "attention",
      text: `The last email to ${to} didn't go out. Send a reminder under Customer link & options, or copy the link there and send it yourself.`,
      block: "Nothing new to send.",
      offer: true,
    };
  }
  return {
    tone: "good",
    text: (
      <>
        Sent to <strong className="font-semibold">{to}</strong> · waiting for the customer
        <span className="text-muted-foreground"> · {centralTime(approval?.last_sent_at)}</span>
      </>
    ),
    block: "Nothing new to send. Upload a new version on an item to send it.",
    offer: true,
  };
}

interface SendBarProps {
  view: ApprovalView;
  flow: Flow;
  busy: string | null;
  onSend: () => void;
}

// The page's one main button, kept in sight at the bottom of the screen: Send to customer, with
// how many new artwork previews go out, or the reason there's nothing to send.
export function SendBar({ view, flow, busy, onSend }: SendBarProps) {
  const { tone, text, block, offer } = barState(view, flow);
  const label = flow.readyFiles ? `Send ${count(flow.readyFiles, "new preview")} to customer` : "Send to customer";
  const bar = useRef<HTMLDivElement>(null);

  // Toasts appear at the bottom right, right where Send is (after every upload, say). While the
  // bar is on the page they rise above it: the toaster (components/ui/sonner.tsx) adds its height.
  useEffect(() => {
    const node = bar.current;
    if (!node) return;
    const root = document.documentElement;
    const observer = new ResizeObserver(() => root.style.setProperty("--sticky-bar-height", `${node.offsetHeight}px`));
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty("--sticky-bar-height");
    };
  }, []);

  return (
    <div
      ref={bar}
      className="sticky bottom-0 z-10 -mx-4 mt-6 border-t bg-background/95 px-4 py-3 shadow-[0_-6px_16px_-10px_rgb(28_25_23/0.25)] backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p role="status" className="flex min-w-0 flex-1 basis-80 items-center gap-2 text-sm text-foreground">
          <span className="shrink-0 [&_svg]:size-4.5">{TONE_ICON[tone]}</span>
          <span className={cn("min-w-0", tone === "quiet" && "text-muted-foreground")}>{text}</span>
        </p>
        {offer && (
          <Tip content={block}>
            <Button size="lg" disabled={block !== null || busy !== null} onClick={onSend}>
              {busy === "send" ? <Spinner size="small" className="text-current" /> : <Send />}
              {label}
            </Button>
          </Tip>
        )}
      </div>
    </div>
  );
}
