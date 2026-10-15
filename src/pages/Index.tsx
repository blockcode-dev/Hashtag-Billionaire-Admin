import { Navigate } from "react-router-dom";
import AdminLogin from "@/components/AdminLogin";

const Index = () => {
  const token = localStorage.getItem("token");

  if (token && token !== "undefined" && token !== "null") {
    return <Navigate to="/dashboard" replace />;
  }

  return <AdminLogin />;
};

export default Index;