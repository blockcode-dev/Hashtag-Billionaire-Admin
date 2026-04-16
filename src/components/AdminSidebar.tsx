/** @format */

import { NavLink, useLocation } from "react-router-dom";
import {
	LayoutDashboard,
	Import,
	Store
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

const navigationItems = [
	{ title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
	// { title: "Users", url: "/users", icon: Users },
	// { title: "Brands", url: "/brands", icon: Ticket },
	// { title: "Categories", url: "/categories", icon: MessageSquare },
	{ title: "Import", url: "/import", icon: Import },
	{ title: "Products", url: "/products", icon: Store },
	// {
	// 	title: "Quotes",
	// 	icon: Quote,
	// 	children: [
	// 		{ title: "Quote", url: "/quotes" },
	// 		{ title: "Quote Tags", url: "/quote-tags" },
	// 	],
	// },
	// { title: "Feed", url: "/feeds", icon: LayoutList },
	// {
	// 	title: "Payments",
	// 	icon: Receipt,
	// 	children: [
	// 		{ title: "Publishing Packages", url: "/payment-history" },
	// 		{ title: "Subscriptions", url: "/subscriptions" },
	// 	],
	// },
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
					<div className="p-4">
						<h2
							className={`font-bold text-lg text-primary ${isCollapsed ? "hidden" : "block"}`}
						>
							Hashtag Billionaire
						</h2>
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
																			? "bg-primary text-white"
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
																? "bg-primary text-primary-foreground font-medium"
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
