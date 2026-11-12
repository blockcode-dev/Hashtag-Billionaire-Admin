/** @format */

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ExternalLink, Search, Trash2 } from "lucide-react";
import { cn } from "cn";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/common/Spinner";
import {
  QUANTITY_MODE_INFO,
  describeQuantityRows,
  type VariantPricing,
} from "@/utils/variantPricing";
import {
  PRICING_TEMPLATE_NAME_MAX,
  formatSavedDate,
  templateErrorMessage,
  type PricingTemplate,
  type PricingTemplatesState,
} from "./usePricingTemplates";

const ERROR_BOX =
  "rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground";

// The list gets a search box once it's longer than this.
const SEARCH_FROM = 6;

// Shown while the backend doesn't have the template routes yet (it answers 404).
export function TemplatesUnavailable({ className }: { className?: string }) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-md border border-warning-border bg-warning-soft px-3 py-2.5 text-sm text-warning-soft-foreground",
        className,
      )}
    >
      <p className="font-medium">Pricing templates aren't available yet</p>
      <p className="mt-0.5">
        The server needs an update before templates can be saved or loaded.
      </p>
    </div>
  );
}

// ─── Save as template ──────────────────────────────────────────────────────

interface SaveDialogProps {
  open: boolean;
  // The variant whose quantity pricing is saved. Validated before opening.
  pricing: VariantPricing | null;
  state: PricingTemplatesState;
  onClose: () => void;
}

export function SavePricingTemplateDialog({
  open,
  pricing,
  state,
  onClose,
}: SaveDialogProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [shown, setShown] = useState(pricing);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts an empty form. While the dialog closes, the last
  // pricing stays on screen.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName("");
      setError(null);
    }
  }
  if (pricing && pricing !== shown) setShown(pricing);

  const mode =
    shown && shown.pricing_mode !== "fixed" ? shown.pricing_mode : null;
  const unavailable = state.status === "unavailable";
  const trimmed = name.trim();
  const existing = trimmed
    ? state.templates.find(
        (t) => t.name.toLowerCase() === trimmed.toLowerCase(),
      )
    : undefined;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!shown || !mode) return;
    if (!trimmed) return setError("Give the template a name.");

    setError(null);
    try {
      setSaving(true);
      await state.save(trimmed, shown, existing?.id);
      toast.success(
        existing
          ? `Updated the "${trimmed}" template`
          : `Saved "${trimmed}" as a pricing template`,
      );
      onClose();
    } catch (err) {
      setError(templateErrorMessage(err, "Couldn't save the template. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-md" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>Save as pricing template</DialogTitle>
          <DialogDescription>
            Save this quantity pricing so you can load it into other products.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {unavailable && <TemplatesUnavailable />}

          {error && (
            <p role="alert" className={ERROR_BOX}>
              {error}
            </p>
          )}

          {shown && mode && (
            <div className="rounded-md border bg-muted px-3 py-2 text-sm">
              <p className="font-medium">{QUANTITY_MODE_INFO[mode].label}</p>
              <p className="mt-0.5 text-muted-foreground">
                {describeQuantityRows(
                  mode,
                  shown.bulk_pricing,
                  shown.quantity_pricing,
                )}
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="pricing-template-name">Template name</Label>
            <Input
              id="pricing-template-name"
              value={name}
              maxLength={PRICING_TEMPLATE_NAME_MAX}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Standard mug pricing"
              autoComplete="off"
              aria-describedby={existing ? "pricing-template-replace" : undefined}
              autoFocus
            />
            {existing && (
              <p
                id="pricing-template-replace"
                className="text-xs text-muted-foreground"
              >
                A template called "{existing.name}" already exists. Saving
                replaces its pricing.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving || !trimmed || unavailable}>
              {saving && <Spinner size="small" className="text-current" />}
              {existing ? "Replace template" : "Save template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Load template ─────────────────────────────────────────────────────────

interface LoadDialogProps {
  open: boolean;
  state: PricingTemplatesState;
  // The variant already has quantity pricing typed in, which loading replaces.
  replacesEntered: boolean;
  // "Use the same price for all variants" is on, so loading fills every variant.
  appliesToAll: boolean;
  onUse: (template: PricingTemplate) => void;
  onClose: () => void;
}

export function LoadPricingTemplateDialog({
  open,
  state,
  replacesEntered,
  appliesToAll,
  onUse,
  onClose,
}: LoadDialogProps) {
  const [wasOpen, setWasOpen] = useState(open);
  const [search, setSearch] = useState("");
  const [confirmingId, setConfirmingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [retrying, setRetrying] = useState(false);

  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setSearch("");
      setConfirmingId(null);
    }
  }

  const { status, templates } = state;
  const target = appliesToAll ? "every variant" : "this variant";
  const term = search.trim().toLowerCase();
  const shown = term
    ? templates.filter((t) => t.name.toLowerCase().includes(term))
    : templates;
  const lastSavedId = templates[0]?.id;

  const remove = async (template: PricingTemplate) => {
    try {
      setDeletingId(template.id);
      await state.remove(template.id);
      toast.success(`Deleted "${template.name}"`);
    } catch (err) {
      toast.error(templateErrorMessage(err, `Couldn't delete "${template.name}".`));
    } finally {
      setDeletingId(null);
      setConfirmingId(null);
    }
  };

  const retry = async () => {
    setRetrying(true);
    await state.reload();
    setRetrying(false);
  };

  let body;
  if (status === "unavailable") {
    body = <TemplatesUnavailable />;
  } else if (status === "error") {
    body = (
      <div className="space-y-3 py-6 text-center text-sm">
        <p>Couldn't load your templates.</p>
        <Button variant="outline" size="sm" onClick={retry} disabled={retrying}>
          {retrying && <Spinner size="small" className="text-current" />}
          Try again
        </Button>
      </div>
    );
  } else if (status !== "ready") {
    body = (
      <div className="flex justify-center py-8">
        <Spinner />
      </div>
    );
  } else if (!templates.length) {
    body = (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No templates yet. Enter quantity pricing on a variant, then choose
        Save as template.
      </p>
    );
  } else if (!shown.length) {
    body = (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No templates match "{search.trim()}".
      </p>
    );
  } else {
    body = (
      <ul
        aria-label="Pricing templates"
        className="-mr-2 max-h-80 space-y-2 overflow-y-auto pr-2"
      >
        {shown.map((t) => {
          const confirming = confirmingId === t.id;
          const deleting = deletingId === t.id;
          const savedOn = formatSavedDate(t.updated_at);

          return (
            <li key={t.id} className="rounded-md border px-3 py-2.5">
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    <span className="break-words">{t.name}</span>
                    {t.id === lastSavedId && (
                      <Badge variant="secondary">Last saved</Badge>
                    )}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {QUANTITY_MODE_INFO[t.pricing_mode].label} ·{" "}
                    {describeQuantityRows(
                      t.pricing_mode,
                      t.bulk_pricing,
                      t.quantity_pricing,
                    )}
                  </p>
                  {savedOn && (
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      Saved {savedOn}
                    </p>
                  )}
                </div>

                {!confirming && (
                  <div className="flex shrink-0 items-center gap-1">
                    <Button size="sm" onClick={() => onUse(t)}>
                      Use
                    </Button>
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label={`Delete ${t.name}`}
                      title="Delete template"
                      onClick={() => setConfirmingId(t.id)}
                    >
                      <Trash2 />
                    </Button>
                  </div>
                )}
              </div>

              {confirming && (
                <div className="mt-2 flex flex-wrap items-center justify-end gap-2 border-t pt-2">
                  <span className="mr-auto text-sm text-muted-foreground">
                    Delete this template for every admin?
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setConfirmingId(null)}
                    disabled={deleting}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => remove(t)}
                    disabled={deleting}
                  >
                    {deleting && <Spinner size="small" className="text-current" />}
                    Delete
                  </Button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !next && deletingId === null && onClose()}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Load a pricing template</DialogTitle>
          <DialogDescription>
            Pick saved quantity pricing to use on {target}.
          </DialogDescription>
        </DialogHeader>

        {replacesEntered && status === "ready" && templates.length > 0 && (
          <p className="rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground">
            Loading a template replaces the quantity pricing already entered on{" "}
            {target}.
          </p>
        )}

        {status === "ready" && templates.length >= SEARCH_FROM && (
          <div className="relative">
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

        {body}

        <DialogFooter className="sm:justify-between">
          {/* A new tab, so the product being created isn't lost. */}
          <Button variant="ghost" asChild>
            <a href="/pricing-templates" target="_blank" rel="noopener noreferrer">
              <ExternalLink />
              Manage templates
            </a>
          </Button>
          <Button
            variant="outline"
            onClick={onClose}
            disabled={deletingId !== null}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
