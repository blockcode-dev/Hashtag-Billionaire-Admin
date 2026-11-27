/** @format */

import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Copy, KeyRound, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Callout } from "@/components/common/ImportBlocks";
import { PageHeader } from "@/components/common/PageHeader";
import { SetPasswordDialog } from "@/components/common/SetPasswordDialog";
import { Spinner } from "@/components/common/Spinner";
import { apiErrorMessage } from "@/lib/api-errors";
import { GetUserDetailsAPI, SendLoginDetailsAPI, SetUserPasswordAPI } from "@/services/Api/UserApi";
import OrdersPage from "../Order/OrdersPage";
import { copyText, formatPhone } from "./loginDetails";

// One client (Users › View): their details, and every order they've placed, with the Orders page's
// list and order window. Old orders from a CSV file will be uploaded from here too.

interface Client {
  id: number;
  email: string;
  status: string;
  created_at?: string;
  created_by?: number | null;
  user_profile?: { name?: string | null; mobile?: string | null; created_at?: string } | null;
}

const STATUS: Record<string, { label: string; className: string; hint: string }> = {
  ACCEPTED: {
    label: "Active",
    className: "border-success-border bg-success-soft text-success-soft-foreground",
    hint: "Can sign in on the website.",
  },
  PENDING: {
    label: "Email not verified",
    className: "border-warning-border bg-warning-soft text-warning-soft-foreground",
    hint: "Signed up but hasn't used the link in the verification email yet.",
  },
  REJECTED: {
    label: "Blocked",
    className: "border-destructive-border bg-destructive-soft text-destructive-soft-foreground",
    hint: "Can't sign in.",
  },
};

const formatDate = (value?: string) =>
  value
    ? new Date(value).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : null;

function Detail({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <div className="text-sm text-foreground">{children}</div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

const ClientPage = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const clientId = /^\d+$/.test(id ?? "") ? Number(id) : null;

  // The last answer, for the client it was about: another client's id shows the spinner until its
  // own answer comes.
  const [loaded, setLoaded] = useState<{ id: number; client?: Client; error?: string } | null>(null);
  const [settingPassword, setSettingPassword] = useState(false);

  useEffect(() => {
    if (!clientId) return;
    let active = true;
    GetUserDetailsAPI(clientId)
      .then((res) => active && setLoaded({ id: clientId, client: res.data.data }))
      .catch((err) => active && setLoaded({ id: clientId, error: apiErrorMessage(err, "Check your connection and try again.") }));
    return () => {
      active = false;
    };
  }, [clientId]);

  const current = loaded?.id === clientId ? loaded : null;
  const client = current?.client ?? null;
  const error = clientId ? (current?.error ?? null) : "Client not found.";

  const back = (
    <Button variant="outline" onClick={() => navigate("/users")}>
      <ArrowLeft aria-hidden />
      Users
    </Button>
  );

  if (error || !clientId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Client" actions={back} />
        <Callout tone="bad" icon={TriangleAlert} title="This client couldn't be shown">
          {error}
        </Callout>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex justify-center py-16">
        <Spinner size="large" label="Loading the client" />
      </div>
    );
  }

  const name = client.user_profile?.name || "Unnamed client";
  const status = STATUS[client.status] ?? { label: client.status, className: "", hint: "" };
  const mobile = formatPhone(client.user_profile?.mobile);
  const joined = formatDate(client.user_profile?.created_at ?? client.created_at);

  return (
    <div className="space-y-6">
      <PageHeader
        title={name}
        description={client.email}
        actions={
          <>
            {back}
            <Button variant="outline" onClick={() => setSettingPassword(true)}>
              <KeyRound aria-hidden />
              Set password
            </Button>
          </>
        }
      />

      <Card>
        <CardContent className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <Detail label="Email">
            <span className="flex items-center gap-1.5">
              <span className="truncate" title={client.email}>
                {client.email}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                aria-label="Copy the email"
                onClick={() => copyText(client.email, "Email")}
              >
                <Copy aria-hidden />
              </Button>
            </span>
          </Detail>
          <Detail label="Mobile">{mobile ?? <span className="text-muted-foreground">Not given</span>}</Detail>
          <Detail label="Account" hint={status.hint}>
            <Badge variant="outline" className={status.className}>
              {status.label}
            </Badge>
          </Detail>
          {/* Only accounts added since 27 Nov 2026 record who added them. */}
          <Detail label="Joined" hint={client.created_by ? "Added from the admin panel." : undefined}>
            {joined ?? "—"}
          </Detail>
        </CardContent>
      </Card>

      <OrdersPage userId={client.id} />

      <SetPasswordDialog
        account={settingPassword ? { name, email: client.email } : null}
        effect="They're signed out on every device, and any emailed reset link stops working."
        onClose={() => setSettingPassword(false)}
        onSubmit={(password) => SetUserPasswordAPI(client.id, { password, confirm_password: password })}
        onEmail={(password) => SendLoginDetailsAPI(client.id, password)}
      />
    </div>
  );
};

export default ClientPage;
