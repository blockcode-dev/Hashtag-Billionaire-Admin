import { useState } from "react";
import { Link } from "react-router";
import { MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/common/Spinner";
import { AuthLayout } from "./AuthLayout";
import { ForgotPasswordApi } from "@/services/Api/AuthApi";

const backToSignIn = (
  <Link to="/" className="font-medium text-primary hover:text-primary-hover hover:underline">
    Back to sign in
  </Link>
);

// Step 1 of forgot password: the backend emails a link to /reset-password.
export default function AdminForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  // The backend answers the same way whether or not the email exists.
  const [sentMessage, setSentMessage] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      setLoading(true);
      const res = await ForgotPasswordApi({ email: email.trim() });
      setSentMessage(res.data?.message || "If an account matches that email, we've sent a link to it.");
    } catch (err: any) {
      // 400 for an invalid email, 429 after too many requests.
      setError(err.response?.data?.message || "We couldn't send the link. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  };

  if (sentMessage) {
    return (
      <AuthLayout title="Check your email" footer={backToSignIn}>
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
            <MailCheck className="size-6" />
          </span>
          <p className="text-sm text-foreground">{sentMessage}</p>
          <p className="text-sm text-muted-foreground">The link works once and expires after 60 minutes.</p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      description="Enter your account email and we'll send you a link to set a new password."
      footer={backToSignIn}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <p role="alert" className="rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
            {error}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            autoFocus
            required
            placeholder="name@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-10"
          />
        </div>
        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Spinner size="small" className="text-current" />}
          {loading ? "Sending…" : "Send reset link"}
        </Button>
      </form>
    </AuthLayout>
  );
}
