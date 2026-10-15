/** @format */

import React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/common/PageHeader";
import PublishedBrands from "./PublishedBrands";
import AllBrands from "./AllBrands";

const BrandManagement: React.FC = () => {
  const items = [
    {
      key: "published",
      label: "Published Brands",
      dot: "var(--success)",
      children: <PublishedBrands />,
    },
    {
      key: "all",
      label: "All Brands",
      dot: "var(--primary)",
      children: <AllBrands />,
    },
  ];

  return (
    <div>
      <PageHeader title="Brand Management" description="Manage your brand catalogue and what's shown on the website." />

      <div className="overflow-hidden rounded-xl border bg-card shadow-xs">
        <Tabs defaultValue="published" className="gap-0">
          <TabsList variant="line" className="h-12 w-full justify-start gap-6 rounded-none border-b px-6">
            {items.map((item) => (
              <TabsTrigger key={item.key} value={item.key} className="flex-none px-1">
                <span className="size-2 rounded-full" style={{ background: item.dot }} />
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
          {items.map((item) => (
            <TabsContent key={item.key} value={item.key} className="px-6">
              {item.children}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </div>
  );
};

export default BrandManagement;