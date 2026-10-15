import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Eye, EyeOff, LinkIcon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ResetPasswordApi } from "@/services/Api/AuthApi";
import {
  PASSWORD_RULE_HINT,
  checkPasswordRule,
  clearSession,
} from "@/lib/session";

// Opened from the emailed link: /reset-password?token=<64 hex characters>.
// Used for "forgot password" (60 minute link) and by new admins setting their
// first password (72 hour link). Each link works once.
const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

export default function AdminResetPassword() {
  const [token] = useState(
    () => new URLSearchParams(window.location.search).get("token") || "",
  );
  const [loading, setLoading] = useState(false);
  const [linkInvalid, setLinkInvalid] = useState(!TOKEN_PATTERN.test(token));

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const ruleError = checkPasswordRule(password);
    if (ruleError) {
      toast({ title: ruleError, variant: "destructive" });
      return;
    }
    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      await ResetPasswordApi({
        token,
        password,
        confirm_password: confirmPassword,
      });

      // The reset signs this admin out everywhere, including this browser.
      clearSession();
      toast({
        title: "Password changed",
        description: "You can now sign in with your new password.",
      });
      setTimeout(() => (window.location.href = "/"), 1200);
    } catch (err: any) {
      const message: string = err.response?.data?.message || "";

      // A rule or mismatch error leaves the link usable, so they can retry.
      // An invalid or expired link needs a new one.
      if (/invalid or has expired/i.test(message)) {
        setLinkInvalid(true);
        return;
      }

      toast({
        title: "Couldn't change password",
        description: message || "Something went wrong.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <Card className="w-full max-w-md shadow-md relative overflow-hidden">
        <CardHeader>
          <CardTitle className="text-center text-2xl font-semibold">
            {linkInvalid ? "Link Expired" : "Set New Password"}
          </CardTitle>
        </CardHeader>

        <CardContent>
          {linkInvalid ? (
            <div className="space-y-4 text-center">
              <LinkIcon className="h-10 w-10 mx-auto text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                This link is invalid or has expired. Request a new one to reset
                your password.
              </p>
              <Button
                className="w-full"
                style={{ backgroundColor: "#E7BA01" }}
                onClick={() => (window.location.href = "/forgot-password")}
              >
                Request a New Link
              </Button>
              <Button
                variant="ghost"
                className="w-full text-primary"
                onClick={() => (window.location.href = "/")}
              >
                Back to Login
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <Input
                  type={showPass ? "text" : "password"}
                  placeholder="New Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showPass ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>

              <div className="relative">
                <Input
                  type={showConfirmPass ? "text" : "password"}
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="pr-10"
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPass(!showConfirmPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  {showConfirmPass ? (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                {PASSWORD_RULE_HINT}
              </p>

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                style={{ backgroundColor: "#E7BA01" }}
              >
                {loading ? "Updating..." : "Change Password"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
