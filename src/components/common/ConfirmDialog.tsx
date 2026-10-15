import { useEffect, useState, type ReactNode } from "react";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Spinner } from "./Spinner";

export interface ConfirmOptions {
  title: ReactNode;
  content?: ReactNode;
  okText?: string;
  cancelText?: string;
  // "danger" styles the confirm button as destructive.
  okType?: "primary" | "danger";
  // May be async; the dialog stays open with a spinner until it settles.
  // If it throws, the dialog stays open so the person can retry or cancel.
  onOk?: () => unknown | Promise<unknown>;
  onCancel?: () => void;
}

type Pending = ConfirmOptions & { id: number };

let showDialog: ((options: Pending) => void) | null = null;
let nextId = 0;

// Opens a confirmation dialog from anywhere (event handlers, async code).
// Requires <ConfirmDialogHost /> to be mounted once, near the app root.
export function confirm(options: ConfirmOptions) {
  if (!showDialog) throw new Error("ConfirmDialogHost is not mounted");
  showDialog({ ...options, id: ++nextId });
}

export function ConfirmDialogHost() {
  const [dialog, setDialog] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    showDialog = (options) => {
      setBusy(false);
      setDialog(options);
    };
    return () => {
      showDialog = null;
    };
  }, []);

  const close = () => setDialog(null);

  const handleOk = async () => {
    if (!dialog) return;
    try {
      setBusy(true);
      await dialog.onOk?.();
      close();
    } catch {
      // Leave the dialog open; the caller reports the error.
    } finally {
      setBusy(false);
    }
  };

  return (
    <AlertDialog
      open={!!dialog}
      onOpenChange={(open) => {
        if (!open && !busy) {
          dialog?.onCancel?.();
          close();
        }
      }}
    >
      {dialog && (
        <AlertDialogContent key={dialog.id}>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
            {dialog.content ? (
              <AlertDialogDescription asChild>
                <div>{dialog.content}</div>
              </AlertDialogDescription>
            ) : (
              <AlertDialogDescription className="sr-only">Confirm this action</AlertDialogDescription>
            )}
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>{dialog.cancelText || "Cancel"}</AlertDialogCancel>
            <Button
              variant={dialog.okType === "danger" ? "destructive" : "default"}
              disabled={busy}
              onClick={handleOk}
            >
              {busy && <Spinner size="small" className="text-current" />}
              {dialog.okText || "OK"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      )}
    </AlertDialog>
  );
}
