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
import VariantPage from "./pages/Product/Variant/Variant";
import ProductView from "./pages/Product/View/ProductView";
import ProductsPage from "./pages/Product/Product/Product";
import ProductDetails from "./pages/Product/ProductDetails/ProductDetails";
import PricingMarkupPage from "./pages/PricingMarkup/PricingMarkupPage";
import AddUserPage from "./pages/User/AddUser/AddUserPage";
import PaymentsPage from "./pages/Payment/PaymentsPage";
import OrdersPage from "./pages/Order/OrdersPage";
import ParentCategoryPage from "./pages/ParentCategory/ParentCategoryPage";
import AddEditParentCategory from "./pages/ParentCategory/AddParentCategoryPage";
import AddParentCategoryPage from "./pages/ParentCategory/AddParentCategoryPage";
import EditParentCategoryPage from "./pages/ParentCategory/EditParentCategoryPage";
import CreateProductPage from "./pages/Product/Create/CreateProductPage";
import AdminsPage from "./pages/Admin/AdminsPage";
import AddEditAdmin from "./pages/Admin/AddEditAdmin";
import BrandManagement from "./pages/BrandManagement";
import CreateBrandPage from "./pages/BrandManagement/CreateBrand";
import GrandCategoryPage from "./pages/GrandCategory/GrandCategoryPage";
import AddGrandCategoryPage from "./pages/GrandCategory/AddGrandCategoryPage";
import EditGrandCategoryPage from "./pages/GrandCategory/EditGrandCategoryPage";
import ContactUsPage from "./pages/ContactUs/ContactUs";
import IndustryList from "./pages/Industry/IndustryList";
import UseCaseList from "./pages/UseCase/Usecaselist";

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
            path="/users/add"
            element={
              <AdminLayout>
                <AddUserPage />
              </AdminLayout>
            }
          />

          <Route
            path="/payments"
            element={
              <AdminLayout>
                <PaymentsPage />
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
            path="/admins"
            element={
              <AdminLayout>
                <AdminsPage />
              </AdminLayout>
            }
          />

          <Route
            path="/admins/add"
            element={
              <AdminLayout>
                <AddEditAdmin />
              </AdminLayout>
            }
          />
          <Route
            path="/admins/edit/:id"
            element={
              <AdminLayout>
                <AddEditAdmin />
              </AdminLayout>
            }
          />

          <Route
            path="/orders"
            element={
              <AdminLayout>
                <OrdersPage />
              </AdminLayout>
            }
          />

          <Route
            path="/parent-category"
            element={
              <AdminLayout>
                <ParentCategoryPage />
              </AdminLayout>
            }
          />

          <Route
            path="/parent-category/create"
            element={
              <AdminLayout>
                <AddParentCategoryPage />
              </AdminLayout>
            }
          />

          <Route
            path="/parent-category/edit/:id"
            element={
              <AdminLayout>
                <EditParentCategoryPage />
              </AdminLayout>
            }
          />

          <Route
            path="/create-product"
            element={
              <AdminLayout>
                <CreateProductPage />
              </AdminLayout>
            }
          />

          <Route
            path="/brand-management"
            element={
              <AdminLayout>
                <BrandManagement />
              </AdminLayout>
            }
          />

          <Route
            path="/create-brand"
            element={
              <AdminLayout>
                <CreateBrandPage />
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
            path="/variants"
            element={
              <AdminLayout>
                <VariantPage />
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
                <ProductDetails />
              </AdminLayout>
            }
          />

          <Route
            path="/variant/:id"
            element={
              <AdminLayout>
                <ProductView />
              </AdminLayout>
            }
          />

          <Route
            path="/pricing-markup"
            element={
              <AdminLayout>
                <PricingMarkupPage />
              </AdminLayout>
            }
          />

          <Route
            path="/grand-category"
            element={
              <AdminLayout>
                <GrandCategoryPage />
              </AdminLayout>
            }
          />

          <Route
            path="/grand-category/create"
            element={
              <AdminLayout>
                <AddGrandCategoryPage />
              </AdminLayout>
            }
          />

          <Route
            path="/grand-category/edit/:id"
            element={
              <AdminLayout>
                <EditGrandCategoryPage />
              </AdminLayout>
            }
          />

           <Route
            path="/contact-us"
            element={
              <AdminLayout>
                <ContactUsPage />
              </AdminLayout>
            }
          />

            <Route
            path="/industries"
            element={
              <AdminLayout>
                <IndustryList />
              </AdminLayout>
            }
          />


            <Route
            path="/use-cases"
            element={
              <AdminLayout>
                <UseCaseList />
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
