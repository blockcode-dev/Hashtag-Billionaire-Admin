/** @format */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AdminLoginAPI } from "@/services/Api/AuthApi";

const AdminLogin = () => {
	const [email, setEmail] = useState("");
	const [password, setPassword] = useState("");
	const [showPassword, setShowPassword] = useState(false);
	const { toast } = useToast();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		try {
			const res = await AdminLoginAPI(email, password);

			if (res.data?.success) {
				const token = res.data?.data?.token || "";
				const roleId = res.data?.data?.role_id || null;
				const adminId = res.data?.data?.id || null;

				// Save token & role
				localStorage.setItem("token", token);
				localStorage.setItem("role_id", roleId);
				localStorage.setItem("admin_id", adminId);

				// Determine admin access
				if (roleId === 1) {
					localStorage.setItem("isAdmin", "true");
				} else {
					localStorage.setItem("isAdmin", "false");
				}

				toast({
					title: "Welcome back!",
					description: "You've successfully logged in.",
				});

				setTimeout(() => {
					window.location.href = "/dashboard";
				}, 500);
			} else {
				toast({
					title: "Login Failed",
					description: res.data?.message || "Invalid credentials.",
					variant: "destructive",
				});
			}
		} catch (err: any) {
			toast({
				title: "Login Failed",
				description: err.response?.data?.message || "Something went wrong.",
				variant: "destructive",
			});
		}
	};

	const togglePasswordVisibility = () => {
		setShowPassword(!showPassword);
	};

	return (
		<div className="min-h-screen bg-background flex items-center justify-center px-4">
			<Card className="w-full max-w-md shadow-lg">
				<CardHeader className="text-center pb-6">
					<CardTitle className="text-2xl font-bold">Admin Login</CardTitle>
				</CardHeader>

				<CardContent>
					<form onSubmit={handleSubmit} className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="email" className="text-sm font-medium">
								Email
							</Label>
							<Input
								id="email"
								type="email"
								placeholder="Enter your email address"
								value={email}
								onChange={(e) => setEmail(e.target.value)}
								required
								className="h-11"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="password" className="text-sm font-medium">
								Password
							</Label>
							<div className="relative">
								<Input
									id="password"
									type={showPassword ? "text" : "password"}
									placeholder="Enter your password"
									value={password}
									onChange={(e) => setPassword(e.target.value)}
									required
									className="h-11 pr-10"
								/>
								<button
									type="button"
									onClick={togglePasswordVisibility}
									className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
								>
									{showPassword ? (
										<EyeOff className="w-4 h-4" />
									) : (
										<Eye className="w-4 h-4" />
									)}
								</button>
							</div>
						</div>

						<Button
							type="submit"
							className="w-full h-11 bg-primary hover:bg-primary-hover text-primary-foreground font-medium transition-colors mt-6"
						>
							Login
						</Button>
					</form>

					<div className="mt-6 text-center">
						<a
							href="/forgot-password"
							className="text-sm text-primary hover:text-primary-hover font-medium transition-colors"
						>
							Forgot Password?
						</a>
					</div>

					{/* <div className="mt-4 text-center">
						<a
							href="/"
							className="text-sm text-muted-foreground hover:text-foreground transition-colors"
						>
							Back to User Login
						</a>
					</div> */}
				</CardContent>
			</Card>
		</div>
	);
};

export default AdminLogin;
