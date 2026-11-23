import { useRef, useState, type FormEvent } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/common/Spinner";
import { apiErrorMessage } from "@/lib/api-errors";
import type { ApprovalView, EmailKind } from "@/services/Api/ApprovalApi";
import { count, emailSubject, lineName, listNames } from "./format";

const MESSAGE_MAX = 1000;

interface SendDialogProps {
  open: boolean;
  view: ApprovalView;
  // Sends; a rejection shows its message here.
  onSend: (body: { to: string; message?: string }) => Promise<void>;
  onClose: () => void;
}

const NOTICE = "rounded-md border px-3 py-2 text-sm";

// "Send to customer" (new artwork previews) and "Send a reminder email" (nothing new): each
// item's previews that aren't sent yet become its next version, and order@ emails the customer
// the link. The backend picks the kind of email the same way as this dialog does.
export function SendDialog({ open, view, onSend, onClose }: SendDialogProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [to, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const messageRef = useRef<HTMLTextAreaElement>(null);

  // A fresh form whenever it opens.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setTo(view.order.customer_email ?? "");
      setMessage("");
      setError(null);
    }
  }

  // As the page counts them (flow.ts): an item marked "No preview needed" isn't sent.
  const ready = view.lines.filter((line) => !line.no_proof && line.drafts.length > 0);
  const emailedBefore = view.history.some((event) => event.type === "EMAIL_SENT");
  const kind: EmailKind = !emailedBefore ? "first" : ready.length ? "updated" : "reminder";
  const reminder = !ready.length;
  const nothingSent = !view.approval?.first_sent_at && !ready.length;
  const linkOff = Boolean(view.approval?.link.disabled);
  const blocked = nothingSent || linkOff;
  const notIncluded = view.lines.filter((line) => !line.no_proof && !line.current_version && !line.drafts.length);
  const approvedAgain = ready.filter((line) => line.status === "APPROVED");

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (blocked || busy || !to.trim()) return;
    setError(null);
    try {
      setBusy(true);
      await onSend({ to: to.trim(), ...(message.trim() && { message: message.trim() }) });
    } catch (err) {
      setError(apiErrorMessage(err, "Nothing was sent. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent
        className="sm:max-w-lg"
        showCloseButton={!busy}
        // Into the message, not the address: the dialog would select the whole address, and
        // typing a message straight away would replace it. With no address, it starts there.
        onOpenAutoFocus={(event) => {
          if (!view.order.customer_email) return;
          event.preventDefault();
          messageRef.current?.focus();
        }}
      >
        <DialogHeader>
          <DialogTitle>{reminder ? "Send a reminder email" : "Send to customer"}</DialogTitle>
          <DialogDescription>
            {reminder
              ? "The customer gets the same link again, to check their artwork."
              : "The customer gets an email with a private link to check their artwork."}{" "}
            Subject: “{emailSubject(kind, view.order.order_number)}”
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          {error && (
            <p role="alert" className={`${NOTICE} border-destructive-border bg-destructive-soft text-destructive-soft-foreground`}>
              {error}
            </p>
          )}

          {ready.length > 0 && (
            <div className="space-y-1.5 text-sm">
              <p className="font-medium">What the customer gets:</p>
              <ul className="list-disc space-y-0.5 pl-5">
                {ready.map((line) => (
                  <li key={line.id}>
                    {lineName(line)}: Version {line.current_version + 1} ({count(line.drafts.length, "image")})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {nothingSent && (
            <p role="alert" className={`${NOTICE} border-warning-border bg-warning-soft text-warning-soft-foreground`}>
              Add an artwork preview to at least one item first.
            </p>
          )}
          {linkOff && (
            <p role="alert" className={`${NOTICE} border-warning-border bg-warning-soft text-warning-soft-foreground`}>
              The customer link is switched off, so it wouldn't open. Switch it on under Customer link &amp; options
              first.
            </p>
          )}
          {!nothingSent && notIncluded.length > 0 && (
            <p className={`${NOTICE} border-info-border bg-info-soft text-info-soft-foreground`}>
              No artwork preview yet for {listNames(notIncluded.map(lineName))}. The customer sees “Artwork preview
              coming soon” there.
            </p>
          )}
          {approvedAgain.length > 0 && (
            <p className={`${NOTICE} border-info-border bg-info-soft text-info-soft-foreground`}>
              {listNames(approvedAgain.map(lineName))} {approvedAgain.length === 1 ? "is" : "are"} already approved.
              The customer will be asked to approve the new version again.
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="approval-send-to">Customer's email</Label>
            <Input
              id="approval-send-to"
              type="email"
              inputMode="email"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              placeholder="customer@example.com"
              value={to}
              disabled={busy}
              onChange={(e) => {
                setTo(e.target.value);
                setError(null);
              }}
              aria-describedby="approval-send-to-help"
            />
            <p id="approval-send-to-help" className="text-xs text-muted-foreground">
              {view.order.customer_email
                ? "From the customer's account. Anyone with the link can approve, so check the address."
                : view.approval?.link.url
                  ? "The customer's account has no email. Type one, or copy the link under Customer link & options and send it yourself."
                  : "The customer's account has no email. Type the address to send it to."}
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="approval-send-message">Message to the customer (optional)</Label>
            <Textarea
              ref={messageRef}
              id="approval-send-message"
              value={message}
              maxLength={MESSAGE_MAX}
              rows={4}
              disabled={busy}
              placeholder="For example: the logo is 10 inches wide on the front."
              aria-describedby="approval-send-message-help"
              onChange={(e) => setMessage(e.target.value)}
            />
            <p id="approval-send-message-help" className="flex justify-between gap-3 text-xs text-muted-foreground">
              <span>
                {reminder
                  ? "Shown in the email."
                  : "Shown in the email, and next to the new artwork previews on the customer's page."}
              </span>
              <span className="tabular-nums">
                {message.length}/{MESSAGE_MAX}
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy || blocked || !to.trim()}>
              {busy && <Spinner size="small" className="text-current" />}
              {busy ? "Sending…" : reminder ? "Send reminder" : "Send to customer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
