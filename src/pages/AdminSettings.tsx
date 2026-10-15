import { PageHeader } from "@/components/common/PageHeader";
import { EmptyState } from "@/components/common/EmptyState";

const AdminSettings = () => (
  <div>
    <PageHeader title="Settings" description="System configuration and preferences." />
    <section className="rounded-xl border bg-card shadow-xs">
      <EmptyState description="Settings are coming soon." />
    </section>
  </div>
);

export default AdminSettings;
