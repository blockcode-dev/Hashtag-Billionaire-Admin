import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { SendOtpApi, VerifyOtpApi, ForgotPasswordApi } from "@/services/Api/AuthApi";

export default function AdminForgotPassword() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);

  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Password visibility
  const [showPass, setShowPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);

  const { toast } = useToast();

  // Animation variants
  const stepAnim = {
    initial: { opacity: 0, x: 40 },
    animate: { opacity: 1, x: 0 },
    exit: { opacity: 0, x: -40 },
    transition: { duration: 0.35, ease: "easeOut" },
  };

  // STEP 1 → SEND OTP
  const handleSendOtp = async () => {
    if (!email) {
      toast({ title: "Email required", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);

      const res = await SendOtpApi({
        email,
        otp_type: "forgot_password",
      });

      if (res.data?.success) {
        toast({ title: "OTP sent!" });
        setStep(2);
      }
    } catch (err: any) {
      toast({
        title: "Failed to send OTP",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // STEP 2 → VERIFY OTP
  const handleVerifyOtp = async () => {
    if (!otp) {
      toast({ title: "Enter OTP", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);

      const res = await VerifyOtpApi({
        email,
        otp,
        otp_type: "forgot_password",
      });

      if (res.data?.success) {
setToken(res.data.data.token);

        toast({ title: "OTP verified!" });
        setStep(3);
      }
    } catch (err: any) {
      toast({
        title: "Invalid OTP",
        description: err.response?.data?.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // STEP 3 → RESET PASSWORD
  const handleChangePassword = async () => {
    if (!password || !confirmPassword) {
      toast({ title: "All fields required", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", variant: "destructive" });
      return;
    }

    try {
      setLoading(true);

      const res = await ForgotPasswordApi({
        email,
        password,
        confirm_password: confirmPassword,
        token,
      });

      if (res.data?.success) {
        toast({ title: "Password changed successfully!" });
        window.location.href = "/";
      }
    } catch (err: any) {
      toast({
        title: "Failed to change password",
        description: err.response?.data?.message,
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
            {step === 1 && "Forgot Password"}
            {step === 2 && "Verify OTP"}
            {step === 3 && "Reset Password"}
          </CardTitle>
        </CardHeader>

        <CardContent>
          <AnimatePresence mode="wait">

            {/* STEP 1 */}
            {step === 1 && (
              <motion.div key="step1" {...stepAnim} className="space-y-4">
                <Input
                  placeholder="Enter your email"
                  value={email}
                  type="email"
                  onChange={(e) => setEmail(e.target.value)}
                />

                <Button
                  className="w-full"
                  disabled={loading}
                  onClick={handleSendOtp}
                >
                  {loading ? "Sending..." : "Send OTP"}
                </Button>

                {/* Back to login */}
                <Button
                  variant="ghost"
                  className="w-full text-primary"
                  onClick={() => (window.location.href = "/")}
                >
                  Back to Login
                </Button>
              </motion.div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <motion.div key="step2" {...stepAnim} className="space-y-4">
                <Input
                  placeholder="Enter OTP"
                  value={otp}
                  maxLength={6}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                />

                <p className="text-sm text-muted-foreground text-right">
                  Didn’t receive OTP?{" "}
                  <button
                    onClick={handleSendOtp}
                    className="text-primary underline font-medium"
                  >
                    Resend
                  </button>
                </p>

                <Button
                  className="w-full"
                  disabled={loading}
                  onClick={handleVerifyOtp}
                >
                  {loading ? "Verifying..." : "Verify OTP"}
                </Button>
              </motion.div>
            )}

            {/* STEP 3 — RESET PASSWORD WITH EYE TOGGLE */}
            {step === 3 && (
              <motion.div key="step3" {...stepAnim} className="space-y-4">

                {/* Password with eye icon */}
                <div className="relative">
                  <Input
                    type={showPass ? "text" : "password"}
                    placeholder="New Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pr-10"
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

                {/* Confirm password with eye icon */}
                <div className="relative">
                  <Input
                    type={showConfirmPass ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pr-10"
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

                <Button
                  className="w-full"
                  disabled={loading}
                  onClick={handleChangePassword}
                >
                  {loading ? "Updating..." : "Change Password"}
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
