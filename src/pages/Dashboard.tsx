import React from "react";
import { BarChart3 } from "lucide-react";

const Dashboard = () => {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Welcome back 👋</h1>
        <p className="text-muted-foreground mt-2">
          This is your admin dashboard — your orders, products, and sales insights will live here.
        </p>
      </div>

      <div className="bg-card border rounded-lg p-12 flex flex-col items-center text-center gap-3">
        <div className="w-12 h-12 rounded-full bg-[#F5C518]/15 ring-1 ring-[#F5C518]/30 flex items-center justify-center">
          <BarChart3 className="h-5 w-5 text-[#B08900]" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Insights are on the way</h2>
        <p className="text-muted-foreground text-sm max-w-sm">
          We're building out charts and summaries for orders, revenue, and top products.
          This space will be updated soon.
        </p>
      </div>
    </div>
  );
};

export default Dashboard;