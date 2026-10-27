import { useState, type FormEvent, type ReactNode } from "react";
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

interface SettingsKeyDialogProps {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel: string;
  // Shown above the key field, e.g. the settings about to change.
  children?: ReactNode;
  // Sends the key. A rejection shows its message here (wrong key, too many tries).
  onSubmit: (key: string) => Promise<void>;
  onClose: () => void;
}

// Asks for the settings key (SETTINGS_MASTER_KEY on the server). The key lives in
// this dialog's state only and is cleared whenever the dialog opens or closes.
export function SettingsKeyDialog({
  open,
  title,
  description,
  confirmLabel,
  children,
  onSubmit,
  onClose,
}: SettingsKeyDialogProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [key, setKey] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    setKey("");
    setError(null);
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!key) return setError("Enter the settings key.");
    setError(null);
    try {
      setBusy(true);
      await onSubmit(key);
    } catch (err: any) {
      setError(err?.response?.data?.message || "That didn't work. Try again in a moment.");
      setKey("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !busy && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!busy}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {children}

          {error && (
            <p
              role="alert"
              className="rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground"
            >
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="settings-key">Settings key</Label>
            <Input
              id="settings-key"
              type="password"
              autoComplete="new-password"
              spellCheck={false}
              autoCapitalize="off"
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setError(null);
              }}
              autoFocus
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Spinner size="small" className="text-current" />}
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
