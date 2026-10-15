/** @format */

import { useEffect, useState } from "react";
import { User, LogOut, Key, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GetAdminProfileAPI } from "@/services/Api/AuthApi";

export function AdminHeader() {
  const [adminName, setAdminName] = useState("Admin User");
  const [menuOpen, setMenuOpen] = useState(false);

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
    } catch (err: any) {
      const errorMessage =
        err?.response?.data?.message ||
        err?.response?.data?.data?.message ||
        "";

      if (
        errorMessage.toLowerCase().includes("jwt expired") ||
        errorMessage.toLowerCase().includes("token expired")
      ) {
        // Clear session
        localStorage.removeItem("token");
        localStorage.removeItem("isAdmin");
        localStorage.removeItem("role_id");
        localStorage.removeItem("admin_id");

        sessionStorage.clear();

        // Redirect to login with session expired flag
        window.location.href = "/?sessionExpired=true";

        return;
      }

      console.log("Failed to load profile");
    }
  };

  const initials = adminName
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  return (
    <header className="h-16 sticky top-0 z-10 border-b bg-background/95 backdrop-blur px-6 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="rounded-md p-1.5 text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors" />
      </div>

      <DropdownMenu onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger asChild>
          <button className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-full transition-colors hover:bg-muted/60 outline-none">
            <div className="w-8 h-8 rounded-full bg-[#F5C518]/15 ring-1 ring-[#F5C518]/30 flex items-center justify-center text-[#B08900] text-xs font-semibold">
              {initials || <User className="h-4 w-4" />}
            </div>
            <span className="text-sm font-medium text-foreground">
              {adminName}
            </span>
            <ChevronDown
              className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
                menuOpen ? "rotate-180" : ""
              }`}
            />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52 border shadow-lg">
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => (window.location.href = "/admin/profile")}
          >
            <User className="h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer"
            onClick={() => (window.location.href = "/change-password")}
          >
            <Key className="h-4 w-4" />
            Change Password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="flex items-center gap-2 cursor-pointer text-destructive focus:text-destructive"
            onClick={() => {
              localStorage.removeItem("token");
              localStorage.removeItem("isAdmin");
              localStorage.removeItem("role_id");
              localStorage.removeItem("admin_id");
              window.location.href = "/";
            }}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
