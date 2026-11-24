import { useEffect, useRef, type ReactNode } from "react";
import { CircleAlert, CircleCheck, Info, Lock, Send } from "lucide-react";
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
  // The bar's button: Send to customer, Lock for production once there's nothing left for the
  // customer to do, or none (locked, shipped or cancelled).
  button: "send" | "lock" | null;
  // Why Send can't be pressed, or null when it can.
  block: string | null;
}

// What the bar says, and which button it offers and when it can be pressed.
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
        button: null,
        block: null,
      };
    case "SHIPPED":
      return { tone: "quiet", text: "This order has shipped, so nothing more is sent.", button: null, block: null };
    case "CANCELLED":
      return { tone: "quiet", text: "This order is cancelled, so nothing is sent.", button: null, block: null };
  }

  if (flow.readyFiles) {
    if (approval?.link.disabled) {
      return {
        tone: "attention",
        text: "The customer link is switched off. Switch it on under Customer link & options, then send.",
        button: "send",
        block: "The customer link is switched off.",
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
      button: "send",
      block: null,
    };
  }

  if (flow.situation === "nothing-to-check") {
    return { tone: "quiet", text: "Nothing for the customer to check.", button: "lock", block: null };
  }
  if (!flow.sentBefore) {
    return {
      tone: "quiet",
      text: "Nothing to send yet. Add an artwork preview to an item first.",
      button: "send",
      block: "Add an artwork preview to an item first.",
    };
  }
  if (flow.rejected.length) {
    return {
      tone: "attention",
      text:
        flow.rejected.length === 1
          ? `The customer rejected ${items(flow.rejected)}. Upload a new version on the item, then send it from here.`
          : `The customer rejected ${items(flow.rejected)}. Upload a new version on each, then send them from here.`,
      button: "send",
      block: "Upload a new version first.",
    };
  }
  if (flow.missing.length) {
    return {
      tone: "attention",
      text:
        flow.missing.length === 1
          ? `${items(flow.missing)} has no artwork preview yet. Add one, then send it from here.`
          : `${items(flow.missing)} have no artwork preview yet. Add them, then send them from here.`,
      button: "send",
      block: "Add an artwork preview first.",
    };
  }
  if (approval?.status === "APPROVED") {
    return {
      tone: "good",
      text: `The customer approved everything · ${centralTime(approval.approved_at)}`,
      button: "lock",
      block: null,
    };
  }
  if (approval?.link.disabled) {
    return {
      tone: "attention",
      text: "The customer link is switched off, so the customer can't open it. Switch it on under Customer link & options.",
      button: "send",
      block: "The customer link is switched off.",
    };
  }
  if (lastEmail?.type === "EMAIL_FAILED") {
    return {
      tone: "attention",
      text: `The last email to ${to} didn't go out. Send a reminder under Customer link & options, or copy the link there and send it yourself.`,
      button: "send",
      block: "Nothing new to send.",
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
    button: "send",
    block: "Nothing new to send. Upload a new version on an item to send it.",
  };
}

interface SendBarProps {
  view: ApprovalView;
  flow: Flow;
  busy: string | null;
  onSend: () => void;
  // Opens the Lock for production confirmation.
  onLock: () => void;
}

// The page's one main button, kept in sight at the bottom of the screen: Send to customer, with
// how many new artwork previews go out or the reason there's nothing to send, and Lock for
// production once there's nothing left for the customer to do.
export function SendBar({ view, flow, busy, onSend, onLock }: SendBarProps) {
  const { tone, text, button, block } = barState(view, flow);
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
        {button === "send" && (
          <Tip content={block}>
            <Button size="lg" disabled={block !== null || busy !== null} onClick={onSend}>
              {busy === "send" ? <Spinner size="small" className="text-current" /> : <Send />}
              {label}
            </Button>
          </Tip>
        )}
        {button === "lock" && (
          <Button size="lg" disabled={busy !== null} onClick={onLock}>
            {busy === "lock" ? <Spinner size="small" className="text-current" /> : <Lock />}
            Lock for production
          </Button>
        )}
      </div>
    </div>
  );
}
