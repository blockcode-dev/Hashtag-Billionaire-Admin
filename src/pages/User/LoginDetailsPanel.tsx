/** @format */

import { useState } from "react";
import { CheckCircle2, Copy, Mail, MessageSquareText, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/common/Spinner";
import { copyText, loginMessage, sendLoginDetails, sentTime, type ClientLogin, type SendState } from "./loginDetails";

// The pieces that show a client's login details: after Add User, and on the CSV import's results.
// The helpers they use are in loginDetails.ts.

// A value with its own Copy button.
export function CopyField({ label, value, what, mono }: { label: string; value: string; what: string; mono?: boolean }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="flex items-center gap-2 rounded-md border bg-muted px-3 py-2">
        {mono ? (
          <code className="flex-1 font-mono text-sm break-all select-all">{value}</code>
        ) : (
          <span className="flex-1 text-sm break-all select-all">{value}</span>
        )}
        <Button type="button" variant="outline" size="sm" onClick={() => copyText(value, what)}>
          <Copy aria-hidden />
          Copy
        </Button>
      </div>
    </div>
  );
}

// "Email login details" with what happened: sending, sent at…, or why it failed with Try again.
export function EmailLoginButton({
  clientId,
  login,
  size = "default",
}: {
  clientId: number;
  login: ClientLogin;
  size?: "default" | "sm";
}) {
  const [state, setState] = useState<SendState>({ status: "idle" });

  const send = async () => {
    setState({ status: "sending" });
    const next = await sendLoginDetails(clientId, login.password);
    setState(next);
    if (next.status === "sent") toast.success(`Login details sent to ${login.email}`);
  };

  if (state.status === "sent") {
    return (
      <p className="flex items-center gap-2 text-sm font-medium text-success" role="status">
        <CheckCircle2 className="size-4" aria-hidden />
        Emailed to {login.email} at {sentTime(state.at)}
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <Button type="button" size={size} onClick={send} disabled={state.status === "sending"}>
        {state.status === "sending" ? (
          <Spinner size="small" className="text-current" label="Sending" />
        ) : state.status === "failed" ? (
          <RefreshCw aria-hidden />
        ) : (
          <Mail aria-hidden />
        )}
        {state.status === "sending"
          ? "Sending…"
          : state.status === "failed"
            ? "Try again"
            : `Email login details to ${login.email}`}
      </Button>
      {state.status === "failed" && (
        <p role="alert" className="text-sm text-destructive">
          Not sent: {state.error}
        </p>
      )}
    </div>
  );
}

// After Add User: the new client's email and password, to copy or email.
export function LoginDetailsPanel({ clientId, login }: { clientId: number; login: ClientLogin }) {
  return (
    <div className="space-y-5">
      <div className="grid gap-4 md:grid-cols-2">
        <CopyField label="Email" value={login.email} what="Email" />
        <CopyField label="Password" value={login.password} what="Password" mono />
      </div>
      <div className="flex flex-wrap items-start gap-3">
        <EmailLoginButton clientId={clientId} login={login} />
        <Button type="button" variant="outline" onClick={() => copyText(loginMessage(login), "Message")}>
          <MessageSquareText aria-hidden />
          Copy for a message
        </Button>
      </div>
      <p className="text-sm text-muted-foreground">
        “Copy for a message” copies the sign-in link, email and password, ready to paste into a chat or a text.
      </p>
    </div>
  );
}
