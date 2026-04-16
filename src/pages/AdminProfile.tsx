/** @format */

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { User, Mail, Shield, Building2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { GetAdminProfileAPI } from "@/services/Api/AuthApi";

export default function AdminProfile() {
	const [profile, setProfile] = useState<any>(null);
	const { toast } = useToast();

	useEffect(() => {
		fetchProfile();
	}, []);

	const fetchProfile = async () => {
		try {
			const token = localStorage.getItem("token");
			const res = await GetAdminProfileAPI({ token });
			if (res.data?.success) {
				setProfile(res.data.data);
			}
		} catch (err: any) {
			toast({
				title: "Failed to load profile",
				description: err.response?.data?.message,
				variant: "destructive",
			});
		}
	};

	return (
		<div className="p-6 flex justify-center">
			<Card className="w-full max-w-2xl shadow-md rounded-xl">
				<CardHeader className="border-b pb-4">
					<CardTitle className="flex items-center gap-3 text-2xl font-semibold">
						<User className="h-6 w-6 text-primary" />
						Admin Profile
					</CardTitle>
				</CardHeader>

				<CardContent className="space-y-6 mt-4">
					{profile ? (
						<>
							{/* Name */}
							<div className="flex items-center gap-3">
								<User className="h-5 w-5 text-gray-500" />
								<div>
									<p className="text-sm font-medium text-gray-600">Name</p>
									<p className="text-lg font-semibold">{profile.name}</p>
								</div>
							</div>

							<Separator />

							{/* Email */}
							<div className="flex items-center gap-3">
								<Mail className="h-5 w-5 text-gray-500" />
								<div>
									<p className="text-sm font-medium text-gray-600">Email</p>
									<p className="text-lg">{profile.email}</p>
								</div>
							</div>

							<Separator />

							{/* Role */}
							<div className="flex items-center gap-3">
								<Shield className="h-5 w-5 text-gray-500" />
								<div>
									<p className="text-sm font-medium text-gray-600">Role</p>
									<Badge className="px-3 py-1 text-sm">
										{profile.admin_role?.name || "N/A"}
									</Badge>
								</div>
							</div>

			
						</>
					) : (
						<p className="text-center text-gray-500">Loading profile...</p>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
