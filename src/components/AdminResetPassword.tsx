import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { Link2Off } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/common/PasswordInput";
import { Spinner } from "@/components/common/Spinner";
import { AuthLayout } from "./AuthLayout";
import { ResetPasswordApi } from "@/services/Api/AuthApi";
import { PASSWORD_RULE_HINT, checkPasswordRule, clearSession } from "@/lib/session";

// Opened from the emailed link: /reset-password?token=<64 hex characters>.
// Used for "forgot password" (60 minute link) and by new admins setting their
// first password (72 hour link). Each link works once.
const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

const backToSignIn = (
  <Link to="/" className="font-medium text-primary hover:text-primary-hover hover:underline">
    Back to sign in
  </Link>
);

export default function AdminResetPassword() {
  const navigate = useNavigate();
  const [token] = useState(() => new URLSearchParams(window.location.search).get("token") || "");
  const [loading, setLoading] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(!TOKEN_PATTERN.test(token));
  const [error, setError] = useState<string | null>(null);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ruleError = checkPasswordRule(password);
    if (ruleError) return setError(ruleError);
    if (password !== confirmPassword) return setError("The two passwords don't match.");

    setError(null);
    try {
      setLoading(true);
      await ResetPasswordApi({ token, password, confirm_password: confirmPassword });
      // The reset signs this admin out everywhere, including this browser.
      clearSession();
      toast.success("Password changed", { description: "Sign in with your new password." });
      navigate("/", { replace: true });
    } catch (err: any) {
      const message: string = err.response?.data?.message || "";
      // A rule or mismatch error leaves the link usable, so they can retry.
      // An invalid or expired link needs a new one.
      if (/invalid or has expired/i.test(message)) return setLinkInvalid(true);
      setError(message || "We couldn't change your password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  if (linkInvalid) {
    return (
      <AuthLayout title="This link has expired" footer={backToSignIn}>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Link2Off className="size-6" />
          </span>
          <p className="text-sm text-muted-foreground">
            Reset links work once and expire after a while. Request a new one to set your password.
          </p>
          <Button asChild size="lg" className="w-full">
            <Link to="/forgot-password">Request a new link</Link>
          </Button>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Set a new password" description={PASSWORD_RULE_HINT} footer={backToSignIn}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="new-password">New password</Label>
          <PasswordInput
            id="new-password"
            autoComplete="new-password"
            autoFocus
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">Confirm new password</Label>
          <PasswordInput
            id="confirm-password"
            autoComplete="new-password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="h-10"
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Spinner size="small" className="text-current" />}
          {loading ? "Saving…" : "Set password"}
        </Button>
      </form>
    </AuthLayout>
  );
}
