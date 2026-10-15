/** @format */

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/common/PasswordInput";
import { Spinner } from "@/components/common/Spinner";
import { AuthLayout } from "./AuthLayout";
import { AdminLoginAPI, GetAdminProfileAPI } from "@/services/Api/AuthApi";
import { clearSession, setRoleName, startSession } from "@/lib/session";

const AdminLogin = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set by the 401 handler when a session ends (see services/Api/interceptors.ts).
  const [sessionEnded] = useState(() => new URLSearchParams(window.location.search).has("sessionExpired"));

  useEffect(() => {
    if (sessionEnded) window.history.replaceState(null, "", window.location.pathname);
  }, [sessionEnded]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await AdminLoginAPI(email, password);
      const data = res.data?.data;
      if (!res.data?.success || !data?.token) {
        setError(res.data?.message || "That email and password don't match. Check them and try again.");
        return;
      }
      startSession({ token: data.token, id: data.id, role_id: data.role_id });
      // The role name decides which screens are shown (Super Admin only screens).
      const profile = await GetAdminProfileAPI();
      setRoleName(profile.data?.data?.admin_role?.name);
      navigate("/dashboard", { replace: true });
    } catch (err: any) {
      clearSession();
      // Covers wrong credentials (400) and too many attempts (429).
      setError(err.response?.data?.message || "We couldn't sign you in. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout title="Sign in" description="Use your admin account to continue.">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error ? (
          <p role="alert" className="rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground">
            {error}
          </p>
        ) : (
          sessionEnded && (
            <p role="status" className="rounded-md border border-info-border bg-info-soft px-3 py-2 text-sm text-info-soft-foreground">
              Your session has ended. Sign in again to continue.
            </p>
          )
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

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link to="/forgot-password" className="text-sm font-medium text-primary hover:text-primary-hover hover:underline">
              Forgot password?
            </Link>
          </div>
          <PasswordInput
            id="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-10"
          />
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={loading}>
          {loading && <Spinner size="small" className="text-current" />}
          {loading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </AuthLayout>
  );
};

export default AdminLogin;
