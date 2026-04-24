/** @format */

import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Dashboard from "./pages/Dashboard";
import Users from "./pages/User/Users";
import AdminSettings from "./pages/AdminSettings";
import NotFound from "./pages/NotFound";
import { AdminLayout } from "./components/AdminLayout";
import AdminForgotPassword from "./components/AdminForgotPassword";
import AdminChangePassword from "./components/AdminChangePassword";
import AdminProfile from "./pages/AdminProfile";
import UnauthorizedPage from "./pages/UnauthorizedPage";
import SSImportPage from "./pages/Import/SSImportPage";
import ProductsPage from "./pages/Product/Product";
import ProductView from "./pages/Product/View/ProductView";

const queryClient = new QueryClient();

const App = () => (
	<QueryClientProvider client={queryClient}>
		<TooltipProvider>
			<Toaster />
			<Sonner />
			<BrowserRouter>
				<Routes>
					<Route path="/" element={<Index />} />
					<Route path="/forgot-password" element={<AdminForgotPassword />} />

					<Route
						path="/dashboard"
						element={
							<AdminLayout>
								<Dashboard />
							</AdminLayout>
						}
					/>
					<Route
						path="/change-password"
						element={
							<AdminLayout>
								<AdminChangePassword />
							</AdminLayout>
						}
					/>

					<Route
						path="/admin/profile"
						element={
							<AdminLayout>
								<AdminProfile />
							</AdminLayout>
						}
					/>

					<Route
						path="/users"
						element={
							<AdminLayout>
								<Users />
							</AdminLayout>
						}
					/>

					<Route
						path="/settings"
						element={
							<AdminLayout>
								<AdminSettings />
							</AdminLayout>
						}
					/>

					<Route
						path="/import"
						element={
							<AdminLayout>
								<SSImportPage />
							</AdminLayout>
						}
					/>

					<Route
						path="/products"
						element={
							<AdminLayout>
								<ProductsPage />
							</AdminLayout>
						}
					/>

					<Route
						path="/products/:id"
						element={
							<AdminLayout>
								<ProductView />
							</AdminLayout>
						}
					/>

					{/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
					<Route path="*" element={<NotFound />} />
					<Route path="/unauthorized" element={<UnauthorizedPage />} />
				</Routes>
			</BrowserRouter>
		</TooltipProvider>
	</QueryClientProvider>
);

export default App;
