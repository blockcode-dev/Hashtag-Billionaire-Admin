/** @format */

import { Fragment, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { ChevronDown, KeyRound, LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { GetAdminProfileAPI } from "@/services/Api/AuthApi";
import { clearSession, setRoleName, useSession } from "@/lib/session";
import { findNavLocation } from "./navigation";

const initialsOf = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

export function AdminHeader() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { roleName } = useSession();
  const [profile, setProfile] = useState<{ name: string; email: string } | null>(null);

  // Also refreshes the stored role, since a Super Admin can change it at any time.
  // A 401 here (expired or revoked session) is handled by the axios interceptor.
  useEffect(() => {
    GetAdminProfileAPI()
      .then((res) => {
        if (!res?.data?.success) return;
        setProfile({ name: res.data.data.name || "Admin", email: res.data.data.email || "" });
        setRoleName(res.data.data.admin_role?.name);
      })
      .catch(() => {});
  }, []);

  const location = findNavLocation(pathname);
  const crumbs = [location?.group, location?.parent].filter(Boolean) as string[];
  const name = profile?.name ?? "";

  const signOut = () => {
    clearSession();
    navigate("/", { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-sm sm:px-6">
      <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
      <Separator orientation="vertical" className="data-[orientation=vertical]:h-5" />

      <nav aria-label="Breadcrumb" className="min-w-0 flex-1">
        <ol className="flex items-center gap-1.5 text-sm">
          {crumbs.map((crumb) => (
            <Fragment key={crumb}>
              <li className="hidden text-muted-foreground sm:block">{crumb}</li>
              <li aria-hidden className="hidden text-placeholder sm:block">
                /
              </li>
            </Fragment>
          ))}
          <li className="truncate font-medium text-foreground" aria-current="page">
            {location?.title ?? ""}
          </li>
        </ol>
      </nav>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="group flex items-center gap-2.5 rounded-full py-1 pr-2 pl-1 transition-colors hover:bg-muted"
            aria-label="Account menu"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-xs font-semibold text-primary-soft-foreground ring-1 ring-primary-border">
              {name ? initialsOf(name) : <UserRound className="size-4" />}
            </span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-medium text-foreground">{name || "Loading…"}</span>
              {roleName && <span className="block text-xs text-muted-foreground">{roleName}</span>}
            </span>
            <ChevronDown className="size-3.5 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-180" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuLabel className="font-normal">
            <span className="block truncate text-sm font-medium text-foreground">{name}</span>
            {profile?.email && <span className="block truncate text-xs text-muted-foreground">{profile.email}</span>}
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => navigate("/admin/profile")}>
            <UserRound />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => navigate("/change-password")}>
            <KeyRound />
            Change password
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem variant="destructive" onSelect={signOut}>
            <LogOut />
            Log out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
