/** @format */

import { useEffect, useState } from "react";
import { Search, Bell, User, LogOut, Menu, Key } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GetAdminProfileAPI } from "@/services/Api/AuthApi";

export function AdminHeader() {
	const [notificationCount] = useState(3);

	  const [adminName, setAdminName] = useState("Admin User");

  useEffect(() => {
    loadAdminProfile();
  }, []);

  const loadAdminProfile = async () => {
    try {
      const token = localStorage.getItem("token");
      if (!token) return;

      const res = await GetAdminProfileAPI({ token });

      if (res?.data?.success) {
        setAdminName(res.data.data.name || "Admin User");
      }
    } catch (err) {
      console.log("Failed to load profile");
    }
  };

	return (
		<header className="h-16 border-b bg-card px-6 flex items-center justify-between">
			<div className="flex items-center gap-4">
				<SidebarTrigger />
			</div>

			<div className="flex items-center gap-4">
				{/* <div className="relative w-80">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
					<Input
						placeholder="Search manuscripts, editors, projects..."
						className="pl-10"
					/>
				</div> */}

				{/* <div className="relative">
					<Button variant="ghost" size="icon" className="relative">
						<Bell className="h-5 w-5" />
						{notificationCount > 0 && (
							<Badge
								variant="destructive"
								className="absolute -top-1 -right-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs bg-primary"
							>
								{notificationCount}
							</Badge>
						)}
					</Button>
				</div> */}

				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button variant="ghost" className="flex items-center gap-2">
							<div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
								<User className="h-4 w-4 text-primary" />
							</div>
							<span className="font-medium">{adminName}</span>
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="end"
						className="w-56 bg-card border shadow-lg"
					>
						<DropdownMenuItem
							className="flex items-center gap-2"
							onClick={() => (window.location.href = "/admin/profile")}
						>
							<User className="h-4 w-4" />
							Profile
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="flex items-center gap-2 cursor-pointer"
							onClick={() => (window.location.href = "/change-password")}
						>
							<Key className="h-4 w-4" />
							Change Password
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							className="flex items-center gap-2 text-destructive cursor-pointer"
							onClick={() => {
								// Remove auth data
								localStorage.removeItem("token");
								localStorage.removeItem("isAdmin");
								localStorage.removeItem("role_id");
								localStorage.removeItem("admin_id");

								// Redirect to homepage
								window.location.href = "/";
							}}
						>
							<LogOut className="h-4 w-4" />
							Logout
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</header>
	);
}
