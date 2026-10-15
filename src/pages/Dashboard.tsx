import { BarChart3 } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";

const Dashboard = () => {
  return (
    <div>
      <PageHeader
        title="Welcome back"
        description="Your orders, products and sales insights will live here."
      />

      <section className="flex flex-col items-center gap-3 rounded-xl border bg-card px-6 py-14 text-center shadow-xs">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <BarChart3 className="size-5" />
        </span>
        <h2 className="text-lg font-semibold text-foreground">Insights are on the way</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          We're building charts and summaries for orders, revenue and top products. This space will fill in soon.
        </p>
      </section>
    </div>
  );
};

export default Dashboard;
