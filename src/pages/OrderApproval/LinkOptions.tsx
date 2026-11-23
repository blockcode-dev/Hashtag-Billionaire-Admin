import { useState, type ReactNode } from "react";
import {
  ChevronDown,
  Copy,
  ExternalLink,
  Eye,
  Link2,
  Link2Off,
  Lock,
  LockOpen,
  Mail,
  RotateCcw,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ApprovalView } from "@/services/Api/ApprovalApi";

// Characters kept at the end of the link when it's shortened in the middle.
const LINK_TAIL = 8;

interface LinkOptionsProps {
  view: ApprovalView;
  busy: string | null;
  // Why a reminder can't go out now, or null.
  remindBlock: string | null;
  onCopy: () => void;
  onPreview: () => void;
  onRemind: () => void;
  onReplace: () => void;
  onSwitchOff: () => void;
  onSwitchOn: () => void;
  onLock: () => void;
  onUnlock: () => void;
}

// "Customer link & options": the customer's link and the things done now and then, kept out of
// the way of the work on the items.
export function LinkOptions({
  view,
  busy,
  remindBlock,
  onCopy,
  onPreview,
  onRemind,
  onReplace,
  onSwitchOff,
  onSwitchOn,
  onLock,
  onUnlock,
}: LinkOptionsProps) {
  const [open, setOpen] = useState(false);
  const approval = view.approval;
  if (!approval) return null;

  const url = approval.link.url;
  const off = approval.link.disabled;
  const locked = Boolean(approval.locked_at);
  const waiting = busy !== null;
  const noLink = url ? null : "There's no link yet. It's made the first time you press Send to customer.";
  // Closes the panel first, so a confirmation opens on its own.
  const pick = (action: () => void) => () => {
    setOpen(false);
    action();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Link2 />
          Customer link &amp; options
          <ChevronDown className="opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[27rem] max-w-[calc(100vw-2rem)] p-0">
        <div className="space-y-2.5 p-4">
          <p className="text-sm font-semibold text-foreground">Customer link</p>
          {!url ? (
            <p className="text-sm text-muted-foreground">{noLink}</p>
          ) : off ? (
            <div className="space-y-2.5">
              <p className="text-sm text-muted-foreground">
                The link is switched off. The customer sees “This link isn't valid any more” until you switch it back
                on.
              </p>
              <Button size="sm" variant="outline" disabled={waiting} onClick={pick(onSwitchOn)}>
                <Link2 />
                Switch link on
              </Button>
            </div>
          ) : (
            <>
              {/* One click selects all of it. When it doesn't fit, the middle gives way and the end stays. */}
              <code
                title={url}
                className="block overflow-hidden rounded-md border bg-muted px-2.5 py-1.5 font-mono text-xs whitespace-nowrap text-foreground select-all"
              >
                <span className="inline-block truncate align-bottom" style={{ maxWidth: `calc(100% - ${LINK_TAIL}ch)` }}>
                  {url.slice(0, -LINK_TAIL)}
                </span>
                {url.slice(-LINK_TAIL)}
              </code>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={onCopy}>
                  <Copy />
                  Copy link
                </Button>
                <Button size="sm" variant="outline" asChild>
                  <a href={url} target="_blank" rel="noopener noreferrer">
                    <ExternalLink />
                    Open customer page
                  </a>
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Anything you do on that page is recorded as the customer's.</p>
            </>
          )}
        </div>

        <div className="border-t p-1.5">
          <Option
            icon={<Mail />}
            title="Send a reminder email"
            hint={remindBlock ?? "Emails the customer the same link again."}
            disabled={waiting || remindBlock !== null}
            onClick={pick(onRemind)}
          />
          <Option
            icon={<Eye />}
            title="Preview what the customer sees"
            hint="A quick look at their page. Nothing in it can be clicked."
            onClick={pick(onPreview)}
          />
          <Option
            icon={<RotateCcw />}
            title="Replace link"
            hint={noLink ?? "Makes a new link. The old one stops working."}
            disabled={waiting || !url}
            onClick={pick(onReplace)}
          />
          {!off && (
            <Option
              icon={<Link2Off />}
              title="Switch link off"
              hint={noLink ?? "The customer can't open it until you switch it back on."}
              disabled={waiting || !url}
              onClick={pick(onSwitchOff)}
            />
          )}
          {locked ? (
            <Option
              icon={<LockOpen />}
              title="Unlock"
              hint="The customer can approve and ask for changes again."
              disabled={waiting}
              onClick={pick(onUnlock)}
            />
          ) : (
            <Option
              icon={<Lock />}
              title="Lock for production"
              hint="The customer can still look but can't change anything."
              disabled={waiting}
              onClick={pick(onLock)}
            />
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface OptionProps {
  icon: ReactNode;
  title: string;
  // What it does, or why it can't be used now.
  hint: string;
  disabled?: boolean;
  onClick: () => void;
}

function Option({ icon, title, hint, disabled, onClick }: OptionProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-start gap-3 rounded-md px-2.5 py-2 text-left transition-colors hover:bg-accent focus-visible:bg-accent focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50",
        "[&_svg]:mt-0.5 [&_svg]:size-4 [&_svg]:shrink-0 [&_svg]:text-muted-foreground",
      )}
    >
      {icon}
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{hint}</span>
      </span>
    </button>
  );
}
