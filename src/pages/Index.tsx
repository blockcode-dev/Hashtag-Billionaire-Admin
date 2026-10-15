import { Navigate } from "react-router";
import AdminLogin from "@/components/AdminLogin";
import { getToken } from "@/lib/session";

const Index = () => {
  if (getToken()) {
    return <Navigate to="/dashboard" replace />;
  }

  return <AdminLogin />;
};

export default Index;