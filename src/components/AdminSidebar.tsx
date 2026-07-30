/** @format */

import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Import,
  Store,
  Users,
  BadgeDollarSign,
  CreditCard,
  ShoppingBag,
  FolderTree,
  Tags,
  Mail,
  BriefcaseBusiness,
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

const navigationItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Users", url: "/users", icon: Users },
  { title: "Import", url: "/import", icon: Import },
  { title: "Pricing Markup", url: "/pricing-markup", icon: BadgeDollarSign },
  { title: "Products", url: "/products", icon: Store },
  { title: "Variants", url: "/variants", icon: Store },
  {
    title: "Categories",
    icon: FolderTree,
    children: [
      {
        title: "Categories",
        url: "/grand-category",
      },
      {
        title: "Sub Categories",
        url: "/parent-category",
      },
    ],
  },

  {
    title: "Industry Management",
    icon: BriefcaseBusiness,
    children: [
      {
        title: "Industries",
        url: "/industries",
      },
      {
        title: "Use Cases",
        url: "/use-cases",
      },
    ],
  },

  { title: "Brand Management", url: "/brand-management", icon: Tags },
  { title: "Orders", url: "/orders", icon: ShoppingBag },
  { title: "Contact Us", url: "/contact-us", icon: Mail },
  { title: "Payments", url: "/payments", icon: CreditCard },
  { title: "Admin", url: "/admins", icon: Users },
];

export function AdminSidebar() {
  const { state } = useSidebar();
  const location = useLocation();
  const currentPath = location.pathname;

  const isActive = (path: string) => currentPath === path;
  const isCollapsed = state === "collapsed";
  const [openMenus, setOpenMenus] = useState<any>({});

  const toggleMenu = (title: string) => {
    setOpenMenus((prev: any) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  return (
    <div className="AdminSidebar">
      <Sidebar className={isCollapsed ? "w-14" : "w-60"} collapsible="icon">
        <SidebarContent>
          <div className="p-4 flex items-center justify-center">
            {isCollapsed ? (
              // Show just the "H" icon mark when collapsed
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
              // Show full logo when expanded
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

          <SidebarGroup>
            <SidebarGroupLabel className={isCollapsed ? "hidden" : "block"}>
              Admin Panel
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {navigationItems.map((item: any) => {
                  // 🔽 DROPDOWN (Quotes)
                  if (item.children) {
                    const isOpen = openMenus[item.title];

                    return (
                      <SidebarMenuItem key={item.title}>
                        <div
                          onClick={() => toggleMenu(item.title)}
                          className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer hover:bg-muted"
                        >
                          <div className="flex items-center gap-3">
                            <item.icon className="h-4 w-4 flex-shrink-0" />
                            {!isCollapsed && <span>{item.title}</span>}
                          </div>

                          {!isCollapsed && <span>{isOpen ? "−" : "+"}</span>}
                        </div>

                        {/* CHILDREN */}
                        {isOpen && !isCollapsed && (
                          <div className="ml-7 mt-1 space-y-1">
                            {item.children.map((child: any) => (
                              <NavLink
                                key={child.title}
                                to={child.url}
                                className={({ isActive }) =>
                                  `block px-3 py-2 rounded-md text-sm ${
                                    isActive
                                      ? "bg-[#F5C518] text-black font-medium"
                                      : "text-muted-foreground hover:bg-muted"
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

                  // 🔹 NORMAL ITEM
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton asChild>
                        <NavLink
                          to={item.url}
                          className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                              isActive
                                ? "bg-[#F5C518] text-black font-medium"
                                : "hover:bg-muted text-muted-foreground hover:text-foreground"
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
        </SidebarContent>
      </Sidebar>
    </div>
  );
}
