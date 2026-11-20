import { useState, type FormEvent } from "react";
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
import { Spinner } from "@/components/common/Spinner";
import type { Setting } from "@/services/Api/SettingsApi";

// The last "Send to" address, kept for this browser tab only: sign-out clears sessionStorage
// (lib/session.ts).
const LAST_TO_KEY = "settings_test_email_to";

const readLastTo = () => {
  try {
    return sessionStorage.getItem(LAST_TO_KEY) ?? "";
  } catch {
    return "";
  }
};

const rememberTo = (to: string) => {
  try {
    if (to) sessionStorage.setItem(LAST_TO_KEY, to);
    else sessionStorage.removeItem(LAST_TO_KEY);
  } catch {
    // Storage blocked: the field just starts empty next time.
  }
};

interface TestEmailDialogProps {
  // The sender setting to test ("Order emails come from"…); null closes the dialog.
  setting: Setting | null;
  // Sends the test to `to` ("" = the signed-in admin). A rejection shows its message here.
  onSubmit: (to: string) => Promise<void>;
  onClose: () => void;
}

// "Send test email" beside a sender on the Settings page: one email from that sender, so the
// inbox shows whether the mail account may send as it.
export function TestEmailDialog({ setting, onSubmit, onClose }: TestEmailDialogProps) {
  const open = setting !== null;
  const [wasOpen, setWasOpen] = useState(open);
  const [to, setTo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    setTo(open ? readLastTo() : "");
    setError(null);
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setBusy(true);
      await onSubmit(to.trim());
      rememberTo(to.trim());
    } catch (err: any) {
      setError(err?.response?.data?.message || "The test email wasn't sent. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>Send a test email</DialogTitle>
          <DialogDescription>
            From {setting?.label}:{" "}
            <span className="break-words font-medium text-foreground">{setting?.value || setting?.default}</span>. If it
            arrives from a different address, the mail account can't send as this one yet: add it under Send mail as in
            Gmail.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} noValidate className="space-y-4">
          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground"
            >
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="test-email-to">Send to</Label>
            <Input
              id="test-email-to"
              type="email"
              inputMode="email"
              autoComplete="email"
              spellCheck={false}
              autoCapitalize="off"
              placeholder="Your admin email"
              value={to}
              onChange={(e) => {
                setTo(e.target.value);
                setError(null);
              }}
              autoFocus
            />
            <p className="text-xs text-muted-foreground">Leave it empty to send the test to your own admin email.</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Spinner size="small" className="text-current" />}
              Send
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
