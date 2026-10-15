import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";
import ProtectedRoute from "./ProtectedRoute";

interface AdminLayoutProps {
  children: React.ReactNode;
  superAdminOnly?: boolean;
}

export function AdminLayout({ children, superAdminOnly = false }: AdminLayoutProps) {
  return (
    <ProtectedRoute>
      <SidebarProvider>
        <div className="min-h-screen flex w-full bg-admin-bg">
          <AdminSidebar />
          <div className="flex-1 flex flex-col">
            <AdminHeader />
            <main className="flex-1 p-6">
              <ProtectedRoute superAdminOnly={superAdminOnly}>{children}</ProtectedRoute>
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
