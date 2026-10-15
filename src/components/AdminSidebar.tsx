/** @format */

import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { ChevronRight } from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import logoFull from "@/assets/logo.webp";
import { useSession } from "@/lib/session";
import { NAV_GROUPS, isNavActive, type NavItem } from "./navigation";

// Active entries use the brand tint; hover stays neutral.
const ACTIVE =
  "data-[active=true]:bg-primary-soft data-[active=true]:text-primary-soft-foreground data-[active=true]:font-semibold";

// An entry with sub-pages: inline list when expanded, a flyout when collapsed.
function NavParent({ item, collapsed, pathname }: { item: NavItem; collapsed: boolean; pathname: string }) {
  const children = item.children ?? [];
  const childActive = children.some((c) => isNavActive(pathname, c.url));
  const [open, setOpen] = useState(childActive);

  // Open the group when navigation lands on one of its pages.
  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  if (collapsed) {
    return (
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton isActive={childActive} className={ACTIVE} aria-label={item.title}>
              <item.icon />
              <span>{item.title}</span>
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent side="right" align="start" className="min-w-44">
            <DropdownMenuLabel>{item.title}</DropdownMenuLabel>
            {children.map((child) => (
              <DropdownMenuItem key={child.url} asChild>
                <Link to={child.url}>{child.title}</Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible asChild open={open} onOpenChange={setOpen} className="group/collapsible">
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton className={childActive ? "font-semibold" : undefined}>
            <item.icon />
            <span>{item.title}</span>
            <ChevronRight className="ml-auto text-muted-foreground transition-transform duration-200 group-data-[state=open]/collapsible:rotate-90" />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {children.map((child) => (
              <SidebarMenuSubItem key={child.url}>
                <SidebarMenuSubButton asChild isActive={isNavActive(pathname, child.url)} className={ACTIVE}>
                  <NavLink to={child.url}>
                    <span>{child.title}</span>
                  </NavLink>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function AdminSidebar() {
  const { pathname } = useLocation();
  const { isSuperAdmin } = useSession();
  const { state, isMobile } = useSidebar();
  const collapsed = state === "collapsed" && !isMobile;

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="h-16 flex-row items-center border-b border-sidebar-border px-4 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
        <Link to="/dashboard" aria-label="Hashtag Billionaire, go to dashboard" className="flex items-center rounded-md">
          {collapsed ? (
            <img src="/favicon.ico" alt="" className="size-8 rounded-md" />
          ) : (
            <img src={logoFull} alt="Hashtag Billionaire" className="h-9 w-auto" />
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="gap-0 py-2">
        {NAV_GROUPS.map((group) => {
          const items = group.items.filter((item) => !item.superAdminOnly || isSuperAdmin);
          if (!items.length) return null;
          return (
            <SidebarGroup key={group.label} className="py-1.5">
              <SidebarGroupLabel className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                {group.label}
              </SidebarGroupLabel>
              <SidebarMenu>
                {items.map((item) =>
                  item.children ? (
                    <NavParent key={item.title} item={item} collapsed={collapsed} pathname={pathname} />
                  ) : (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild isActive={isNavActive(pathname, item.url!)} tooltip={item.title} className={ACTIVE}>
                        <NavLink to={item.url!}>
                          <item.icon />
                          <span>{item.title}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ),
                )}
              </SidebarMenu>
            </SidebarGroup>
          );
        })}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  );
}
