/** @format */

import { useState } from "react";
import { useNavigate } from "react-router";
import { FileUp, Pencil, Plus, RefreshCw, Search, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { confirm } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { QUANTITY_MODE_INFO, describeQuantityRows } from "@/utils/variantPricing";
import { TemplatesUnavailable } from "./PricingTemplateDialogs";
import { PricingTemplateFormDialog } from "./PricingTemplateFormDialog";
import {
  formatSavedDate,
  templateErrorMessage,
  usePricingTemplates,
  type PricingTemplate,
} from "./usePricingTemplates";

// The list gets a search box once it's longer than this.
const SEARCH_FROM = 6;

// Quantity pricing saved ahead of time, to load into products while creating
// them. Templates saved from a product show up here too.
const PricingTemplatesPage = () => {
  const navigate = useNavigate();
  const state = usePricingTemplates();
  const { status, templates } = state;
  const [dialog, setDialog] = useState<PricingTemplate | "new" | null>(null);
  const [search, setSearch] = useState("");
  const [retrying, setRetrying] = useState(false);

  const term = search.trim().toLowerCase();
  const shown = term
    ? templates.filter((t) => t.name.toLowerCase().includes(term))
    : templates;

  const retry = async () => {
    setRetrying(true);
    await state.reload();
    setRetrying(false);
  };

  const remove = (template: PricingTemplate) =>
    confirm({
      title: `Delete "${template.name}"?`,
      content:
        "It's removed for every admin. Products that already used it keep their prices.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await state.remove(template.id);
          toast.success(`Deleted "${template.name}"`);
        } catch (err) {
          toast.error("Couldn't delete the template", {
            description: templateErrorMessage(err, "Try again in a moment."),
          });
          throw err;
        }
      },
    });

  let content;
  if (status === "loading") {
    content = (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  } else if (status === "unavailable") {
    content = <TemplatesUnavailable className="px-4 py-3" />;
  } else if (status === "error") {
    content = (
      <div
        role="alert"
        className="flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center"
      >
        <TriangleAlert className="size-8 text-destructive" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Couldn't load the templates</p>
          <p className="text-sm text-muted-foreground">
            The server returned an error. Try again in a moment.
          </p>
        </div>
        <Button variant="outline" onClick={retry} disabled={retrying}>
          {retrying ? <Spinner size="small" className="text-current" /> : <RefreshCw />}
          Try again
        </Button>
      </div>
    );
  } else if (!templates.length) {
    content = (
      <div className="rounded-xl border">
        <EmptyState description="No templates yet. Add one here, import several from a CSV file, or save one from a product's quantity-based pricing." />
      </div>
    );
  } else {
    content = (
      <div className="space-y-3">
        {templates.length >= SEARCH_FROM && (
          <div className="relative max-w-sm">
            <Search
              aria-hidden
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search templates"
              aria-label="Search templates"
              className="pl-9"
            />
          </div>
        )}

        {shown.length ? (
          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Name</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Prices</TableHead>
                  <TableHead>Last saved</TableHead>
                  <TableHead className="pr-4 text-right">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="pl-4 font-medium whitespace-normal">
                      {t.name}
                    </TableCell>
                    <TableCell>{QUANTITY_MODE_INFO[t.pricing_mode].label}</TableCell>
                    <TableCell className="min-w-56 whitespace-normal text-muted-foreground">
                      {describeQuantityRows(
                        t.pricing_mode,
                        t.bulk_pricing,
                        t.quantity_pricing,
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {formatSavedDate(t.updated_at) ?? "—"}
                    </TableCell>
                    <TableCell className="pr-4 text-right">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${t.name}`}
                        title="Edit"
                        onClick={() => setDialog(t)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete ${t.name}`}
                        title="Delete"
                        onClick={() => remove(t)}
                      >
                        <Trash2 />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No templates match "{search.trim()}".
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Pricing Templates"
        description="Quantity pricing to load into products while creating them. Every admin shares these."
        actions={
          <>
            <Button variant="outline" onClick={() => navigate("/pricing-templates/import")}>
              <FileUp />
              Import from CSV
            </Button>
            <Button onClick={() => setDialog("new")} disabled={status !== "ready"}>
              <Plus />
              Add template
            </Button>
          </>
        }
      />

      {content}

      <PricingTemplateFormDialog
        target={dialog}
        state={state}
        onClose={() => setDialog(null)}
      />
    </div>
  );
};

export default PricingTemplatesPage;
