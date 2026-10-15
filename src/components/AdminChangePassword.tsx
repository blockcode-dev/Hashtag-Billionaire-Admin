/** @format */
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/common/PageHeader";
import { PasswordInput } from "@/components/common/PasswordInput";
import { Spinner } from "@/components/common/Spinner";
import { ChangePasswordAPI } from "@/services/Api/AuthApi";
import { PASSWORD_RULE_HINT, checkPasswordRule, setToken } from "@/lib/session";

export default function AdminChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ruleError = checkPasswordRule(newPassword);
    if (ruleError) return setError(ruleError);
    if (newPassword !== confirmPassword) return setError("The new passwords don't match.");

    setError(null);
    try {
      setLoading(true);
      const res = await ChangePasswordAPI({
        old_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });

      if (!res.data?.success) {
        setError(res.data?.message || "We couldn't change your password. Try again.");
        return;
      }
      // Older tokens stop working once the password changes; keep this one.
      const newToken = res.data?.data?.token;
      if (newToken) setToken(newToken);

      toast.success("Password changed", { description: "You've been signed out on other devices." });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err.response?.data?.message || "We couldn't change your password. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Change password" description="Changing your password signs you out on every other device." />

      <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border bg-card p-6 shadow-xs">
        {error && (
          <p role="alert" className="rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
            {error}
          </p>
        )}

        <div className="space-y-2">
          <Label htmlFor="current-password">Current password</Label>
          <PasswordInput
            id="current-password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-password">New password</Label>
            <PasswordInput
              id="new-password"
              autoComplete="new-password"
              required
              aria-describedby="password-rule"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
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
            />
          </div>
        </div>
        <p id="password-rule" className="text-xs text-muted-foreground">
          {PASSWORD_RULE_HINT}
        </p>

        <div className="flex justify-end border-t pt-5">
          <Button type="submit" disabled={loading}>
            {loading && <Spinner size="small" className="text-current" />}
            {loading ? "Saving…" : "Change password"}
          </Button>
        </div>
      </form>
    </div>
  );
}
