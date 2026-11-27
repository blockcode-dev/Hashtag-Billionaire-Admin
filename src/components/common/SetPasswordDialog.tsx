import { useState, type FormEvent, type ReactNode } from "react";
import { CheckCircle2, Copy, Mail, RefreshCw } from "lucide-react";
import { toast } from "sonner";
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
import { apiErrorMessage } from "@/lib/api-errors";
import { PASSWORD_RULE_HINT, checkPasswordRule, generatePassword } from "@/lib/session";
import { Spinner } from "./Spinner";

export interface PasswordAccount {
  name?: string | null;
  email?: string | null;
}

interface SetPasswordDialogProps {
  // The account the password is for; null closes the dialog.
  account: PasswordAccount | null;
  onClose: () => void;
  // What setting the password does to the account, shown under the title.
  effect: ReactNode;
  // Sends the password. A rejected promise keeps the form open with the server's message.
  onSubmit: (password: string) => Promise<unknown>;
  // Customers: emails them their login details with the password just set ("Email it to them",
  // after saving). A rejected promise shows the server's message.
  onEmail?: (password: string) => Promise<unknown>;
}

// Sets a password for an admin to share with its owner (client decision Q45).
// Passwords are stored one-way, so the password is shown in full before and
// after saving, and never again.
export function SetPasswordDialog({ account, onClose, effect, onSubmit, onEmail }: SetPasswordDialogProps) {
  const open = account !== null;
  const [wasOpen, setWasOpen] = useState(open);
  const [shown, setShown] = useState(account);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [emailing, setEmailing] = useState(false);
  const [emailed, setEmailed] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Each opening starts a fresh form; while the dialog closes, the last account stays on screen.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPassword("");
      setError(null);
      setSaved(false);
      setEmailed(false);
      setEmailError(null);
    }
  }
  // Compared by value: callers may pass a new object on every render.
  if (account && (account.name !== shown?.name || account.email !== shown?.email)) setShown(account);

  const who = shown?.name || shown?.email || "this account";
  const whoDetail = shown?.name && shown?.email ? ` (${shown.email})` : "";

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const ruleError = checkPasswordRule(password);
    if (ruleError) return setError(ruleError);

    setError(null);
    try {
      setSaving(true);
      await onSubmit(password);
      setSaved(true);
    } catch (err: any) {
      setError(err?.response?.data?.message || "We couldn't set the password. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const email = async () => {
    if (!onEmail) return;
    setEmailError(null);
    try {
      setEmailing(true);
      await onEmail(password);
      setEmailed(true);
      toast.success(`Login details sent to ${shown?.email ?? "the client"}`);
    } catch (err) {
      setEmailError(apiErrorMessage(err, "Check your connection and try again."));
    } finally {
      setEmailing(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied");
    } catch {
      toast.error("Couldn't copy it. Select the password and copy it by hand.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && !emailing && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving && !emailing}>
        <DialogHeader>
          <DialogTitle>{saved ? "Password set" : "Set a password"}</DialogTitle>
          <DialogDescription>
            {saved ? (
              <>
                {onEmail ? "Email it to" : "Share it with"} <strong className="text-foreground">{who}</strong> now
                {onEmail ? ", or copy it to send yourself" : ""}. It can't be shown again.
              </>
            ) : (
              <>
                For <strong className="text-foreground">{who}</strong>
                {whoDetail}. {effect}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        {saved ? (
          <>
            <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
              <code className="flex-1 font-mono text-sm break-all select-all">{password}</code>
              <Button type="button" variant="outline" size="sm" onClick={copy}>
                <Copy />
                Copy
              </Button>
            </div>
            {onEmail && emailed && (
              <p className="flex items-center gap-2 text-sm font-medium text-success" role="status">
                <CheckCircle2 className="size-4" aria-hidden />
                Login details emailed to {shown?.email}
              </p>
            )}
            {emailError && (
              <p
                role="alert"
                className="rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground"
              >
                Not sent: {emailError}
              </p>
            )}
            <DialogFooter>
              {onEmail && !emailed && (
                <Button type="button" variant="outline" onClick={email} disabled={emailing}>
                  {emailing ? <Spinner size="small" className="text-current" label="Sending" /> : <Mail />}
                  {emailing ? "Sending…" : emailError ? "Try again" : "Email it to them"}
                </Button>
              )}
              <Button type="button" onClick={onClose} disabled={emailing}>
                Done
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            {error && (
              <p
                role="alert"
                className="rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground"
              >
                {error}
              </p>
            )}

            <div className="space-y-2">
              <Label htmlFor="set-password">New password</Label>
              <div className="flex gap-2">
                {/* Shown in full: the admin has to read it out or copy it to share it. */}
                <Input
                  id="set-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                  aria-describedby="set-password-rule"
                  autoFocus
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setPassword(generatePassword());
                    setError(null);
                  }}
                >
                  <RefreshCw />
                  Generate
                </Button>
              </div>
              <p id="set-password-rule" className="text-xs text-muted-foreground">
                {PASSWORD_RULE_HINT}
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving || !password}>
                {saving && <Spinner size="small" className="text-current" />}
                Set password
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
