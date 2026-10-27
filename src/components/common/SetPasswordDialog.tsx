import { useState, type FormEvent, type ReactNode } from "react";
import { Copy, RefreshCw } from "lucide-react";
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
}

// Sets a password for an admin to share with its owner (client decision Q45).
// Passwords are stored one-way, so the password is shown in full before and
// after saving, and never again.
export function SetPasswordDialog({ account, onClose, effect, onSubmit }: SetPasswordDialogProps) {
  const open = account !== null;
  const [wasOpen, setWasOpen] = useState(open);
  const [shown, setShown] = useState(account);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Each opening starts a fresh form; while the dialog closes, the last account stays on screen.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setPassword("");
      setError(null);
      setSaved(false);
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

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      toast.success("Password copied");
    } catch {
      toast.error("Couldn't copy it. Select the password and copy it by hand.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{saved ? "Password set" : "Set a password"}</DialogTitle>
          <DialogDescription>
            {saved ? (
              <>
                Share it with <strong className="text-foreground">{who}</strong> now. It can't be shown again.
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
            <DialogFooter>
              <Button type="button" onClick={onClose}>
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
