/** @format */

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLoginAPI, GetAdminProfileAPI } from "@/services/Api/AuthApi";
import { clearSession, setRoleName, startSession } from "@/lib/session";
import logoFull from "@/assets/logo_header.webp";

const AdminLogin = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const [loading, setLoading] = useState(false);
	const { toast } = useToast();

	useEffect(() => {
		const params = new URLSearchParams(window.location.search);
		if (params.get("sessionExpired")) {
			toast({ title: "Please sign in again", description: "Your session has ended." });
			window.history.replaceState(null, "", window.location.pathname);
		}
	}, [toast]);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (loading) return;
		setLoading(true);
		try {
			const res = await AdminLoginAPI(email, password);
			const data = res.data?.data;
			if (res.data?.success && data?.token) {
				startSession({ token: data.token, id: data.id, role_id: data.role_id });
				// The role name decides which screens are shown (Super Admin only screens).
				const profile = await GetAdminProfileAPI();
				setRoleName(profile.data?.data?.admin_role?.name);
				toast({ title: "Welcome back!", description: "You've successfully logged in." });
				setTimeout(() => { window.location.href = "/dashboard"; }, 500);
			} else {
				toast({ title: "Login Failed", description: res.data?.message || "Invalid email or password. Please try again.", variant: "destructive" });
				setLoading(false);
			}
		} catch (err: any) {
			clearSession();
			// Covers wrong credentials (400) and too many attempts (429).
			toast({ title: "Login Failed", description: err.response?.data?.message || "Something went wrong.", variant: "destructive" });
			setLoading(false);
		}
	};

	return (
		<div className="min-h-screen bg-muted flex items-center justify-center px-4">
			<Card className="w-full max-w-md shadow-sm">
				<CardHeader className="pb-2 pt-8 px-8">
					<div className="flex flex-col items-center gap-3 mb-2">
						<img src={logoFull} alt="Hashtag Billionaire" className="h-12 w-auto object-contain" />
						{/* <p className="text-xs text-muted-foreground tracking-widest uppercase">Admin Panel</p> */}
					</div>
					<hr className="border-border" />
				</CardHeader>

				<CardContent className="px-8 pb-8 pt-5">
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-1.5">
							<Label htmlFor="email">Email</Label>
							<Input
								id="email"
								type="email"
								placeholder="Enter your email"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								className="h-10"
							/>
						</div>

						<div className="space-y-1.5">
							<Label htmlFor="password">Password</Label>
							<div className="relative">
								<Input
									id="password"
									type={showPassword ? "text" : "password"}
									placeholder="Enter your password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									className="h-10 pr-10"
								/>
								<button
									type="button"
									onClick={() => setShowPassword(!showPassword)}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
								>
									{showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
								</button>
							</div>
						</div>

						<Button type="submit" disabled={loading} className="w-full h-10 bg-[#F5C800] hover:bg-[#e6ba00] text-black font-medium mt-2">
							{loading ? "Signing in..." : "Login"}
						</Button>
					</form>

					<div className="mt-5 text-center">
						<a href="/forgot-password" className="text-sm text-muted-foreground hover:text-foreground">
							Forgot password?
						</a>
					</div>
				</CardContent>
			</Card>
		</div>
	);
};

export default AdminLogin;