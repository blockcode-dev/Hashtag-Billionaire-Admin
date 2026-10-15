import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MailCheck } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { ForgotPasswordApi } from "@/services/Api/AuthApi";

// Step 1 of forgot password: the backend emails a link to /reset-password.
export default function AdminForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  // The backend answers the same way whether or not the email exists.
  const [sentMessage, setSentMessage] = useState("");

  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);
      const res = await ForgotPasswordApi({ email: email.trim() });
      setSentMessage(
        res.data?.message ||
          "If an account matches that email, we've sent a link to it.",
      );
    } catch (err: any) {
      // 400 for an invalid email, 429 after too many requests.
      toast({
        title: "Couldn't send the link",
        description: err.response?.data?.message || "Something went wrong.",
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
            Forgot Password
          </CardTitle>
        </CardHeader>

        <CardContent>
          {sentMessage ? (
            <div className="space-y-4 text-center">
              <MailCheck className="h-10 w-10 mx-auto text-[#E7BA01]" />
              <p className="text-sm text-muted-foreground">{sentMessage}</p>
              <p className="text-xs text-muted-foreground">
                The link is valid for 60 minutes and can be used once.
              </p>
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
              <p className="text-sm text-muted-foreground text-center">
                Enter your email and we'll send you a link to reset your
                password.
              </p>
              <Input
                placeholder="Enter your email"
                value={email}
                type="email"
                onChange={(e) => setEmail(e.target.value)}
                required
              />

              <Button
                type="submit"
                className="w-full"
                disabled={loading}
                style={{ backgroundColor: "#E7BA01" }}
              >
                {loading ? "Sending..." : "Send Reset Link"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-primary"
                onClick={() => (window.location.href = "/")}
              >
                Back to Login
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
