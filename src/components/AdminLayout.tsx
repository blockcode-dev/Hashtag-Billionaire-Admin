import { useEffect } from "react";
import { useLocation } from "react-router";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { forgetProductsList, isProductsPage } from "@/lib/productsListState";
import { useProfileSync } from "@/hooks/use-profile-sync";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import ProtectedRoute from "./ProtectedRoute";

interface AdminLayoutProps {
  children: React.ReactNode;
  superAdminOnly?: boolean;
}

// App shell: sidebar, header and the page area. Pages render inside a padded
// column on the app background and don't set their own page background.
export function AdminLayout({ children, superAdminOnly = false }: AdminLayoutProps) {
  // Keeps the role, and so the menu and Super Admin pages, current.
  useProfileSync();

  // Anywhere but Products and the pages its buttons open, the Products list's search and filters
  // are forgotten, so coming back shows every product (lib/productsListState.ts).
  const { pathname } = useLocation();
  useEffect(() => {
    if (!isProductsPage(pathname)) forgetProductsList();
  }, [pathname]);

  return (
    <ProtectedRoute>
      <SidebarProvider>
        <AdminSidebar />
        <SidebarInset className="min-w-0 bg-app-bg">
          <AdminHeader />
          <div data-slot="page" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
            <ProtectedRoute superAdminOnly={superAdminOnly}>{children}</ProtectedRoute>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
