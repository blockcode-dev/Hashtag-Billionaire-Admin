/** @format */

import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Import,
  Store,
  Users,
  UserCog,
  BadgeDollarSign,
  CreditCard,
  ShoppingBag,
  FolderTree,
  Tags,
  Mail,
  BriefcaseBusiness,
  PackageSearch,
  ChevronRight,
  Link2,
  Globe,
  PackagePlus,
  SlidersHorizontal,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import "./AdminSidebar.module.scss";
import { useState } from "react";
import logoFull from "@/assets/logo_header.webp";
import { useSession } from "@/lib/session";

// Each top-level group has a label + a set of items.
// Items can either link directly (url) or expand into children.
const navigationGroups = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard }],
  },
  {
    label: "People Management",
    items: [
      { title: "Users", url: "/users", icon: Users },
      // Admin accounts are managed by Super Admins only.
      { title: "Admin", url: "/admins", icon: UserCog, superAdminOnly: true },
    ],
  },
  {
    label: "Catalog",
    items: [
      { title: "Products", url: "/products", icon: Store },
      { title: "Variants", url: "/variants", icon: Store },
      {
        title: "Add-on Products",
        url: "/add-ons",
        icon: PackagePlus,
      },
      {
        title: "Customizations",
        url: "/customizations",
        icon: SlidersHorizontal,
      },
      {
        title: "Categories",
        icon: FolderTree,
        children: [
          { title: "Categories", url: "/grand-category" },
          { title: "Sub Categories", url: "/parent-category" },
        ],
      },
    ],
  },
  {
    label: "Commerce",
    items: [
      { title: "Orders", url: "/orders", icon: ShoppingBag },
      { title: "Payments", url: "/payments", icon: CreditCard },
      {
        title: "Pricing Markup",
        url: "/pricing-markup",
        icon: BadgeDollarSign,
      },
    ],
  },
  {
    label: "Operations",
    items: [
      { title: "Import", url: "/import", icon: Import },
      { title: "SAGE Live Catalog", url: "/sage-live-catalog", icon: Globe },
      { title: "Brand Management", url: "/brand-management", icon: Tags },
      { title: "Brand Assignment", url: "/brand-assignment", icon: Link2 },
      {
        title: "Industry Management",
        icon: BriefcaseBusiness,
        children: [
          { title: "Industries", url: "/industries" },
          { title: "Use Cases", url: "/use-cases" },
        ],
      },
      { title: "Contact Us", url: "/contact-us", icon: Mail },
      {
        title: "Sourcing Requests",
        url: "/sourcing-requests",
        icon: PackageSearch,
      },
    ],
  },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const { isSuperAdmin } = useSession();

  const isCollapsed = state === "collapsed";
  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>({});

  const toggleMenu = (title: string) => {
    setOpenMenus((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  const isChildActive = (children: { url: string }[]) =>
    children.some((child) => currentPath === child.url);

  return (
    <div className="AdminSidebar">
      <Sidebar className={isCollapsed ? "w-14" : "w-60"} collapsible="icon">
        <SidebarContent>
          <div className="p-4 flex items-center justify-center">
            {isCollapsed ? (
              <div
                style={{
                  width: 32,
                  height: 32,
                  background: "#F5C518",
                  borderRadius: 6,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 900,
                  fontSize: 18,
                  color: "#000",
                  fontFamily: "serif",
                  flexShrink: 0,
                }}
              >
                H
              </div>
            ) : (
              <img
                src={logoFull}
                alt="Hashtag Billionaire"
                style={{
                  height: 40,
                  width: "auto",
                  objectFit: "contain",
                  maxWidth: "100%",
                }}
              />
            )}
          </div>

          {navigationGroups.map((group) => (
            <SidebarGroup key={group.label} className="px-2 py-0.5">
              <SidebarGroupLabel
                className={
                  isCollapsed
                    ? "hidden"
                    : "px-3 text-[10.5px] font-medium uppercase tracking-wide text-muted-foreground/50"
                }
              >
                {group.label}
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items
                    .filter((item: any) => !item.superAdminOnly || isSuperAdmin)
                    .map((item: any) => {
                    // Item with a dropdown of children
                    if (item.children) {
                      const isOpen = openMenus[item.title];
                      const active = isChildActive(item.children);

                      return (
                        <SidebarMenuItem key={item.title}>
                          <div
                            onClick={() => toggleMenu(item.title)}
                            className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                              active
                                ? "text-foreground font-medium"
                                : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                            }`}
                          >
                            <div className="flex items-center gap-3">
                              <item.icon className="h-4 w-4 flex-shrink-0" />
                              {!isCollapsed && <span>{item.title}</span>}
                            </div>

                            {!isCollapsed && (
                              <ChevronRight
                                className={`h-3.5 w-3.5 text-muted-foreground/60 transition-transform duration-200 ${
                                  isOpen ? "rotate-90" : ""
                                }`}
                              />
                            )}
                          </div>

                          {isOpen && !isCollapsed && (
                            <div className="ml-9 mt-0.5 mb-1 flex flex-col gap-0.5">
                              {item.children.map((child: any) => (
                                <NavLink
                                  key={child.title}
                                  to={child.url}
                                  className={({ isActive }) =>
                                    `block px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                                      isActive
                                        ? "bg-[#F5C518] text-black font-medium"
                                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                                    }`
                                  }
                                >
                                  {child.title}
                                </NavLink>
                              ))}
                            </div>
                          )}
                        </SidebarMenuItem>
                      );
                    }

                    // Plain link item
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink
                            to={item.url}
                            className={({ isActive }) =>
                              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                                isActive
                                  ? "bg-[#F5C518] text-black font-medium"
                                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                              }`
                            }
                          >
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            {!isCollapsed && <span>{item.title}</span>}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>
      </Sidebar>
    </div>
  );
}
