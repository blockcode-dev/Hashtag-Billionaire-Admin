/** @format */

import { useState, type FormEvent } from "react";
import { toast } from "sonner";

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
import { getPricingError } from "@/utils/variantPricing";
import { QuantityPricingEditor } from "./QuantityPricingEditor";
import {
  PRICING_TEMPLATE_NAME_MAX,
  draftFromTemplate,
  emptyQuantityPricingDraft,
  pricingFromDraft,
  templateErrorMessage,
  type PricingTemplate,
  type PricingTemplatesState,
  type QuantityPricingDraft,
} from "./usePricingTemplates";

const ERROR_BOX =
  "rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground";

interface Props {
  // "new" adds a template, a template edits it, null closes the dialog.
  target: PricingTemplate | "new" | null;
  state: PricingTemplatesState;
  onClose: () => void;
}

export function PricingTemplateFormDialog({ target, state, onClose }: Props) {
  const open = target !== null;
  const [wasOpen, setWasOpen] = useState(open);
  const [shown, setShown] = useState(target);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<QuantityPricingDraft>(emptyQuantityPricingDraft);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Each opening starts from the template being edited, or a blank one.
  // While the dialog closes, the last template stays on screen.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (target) {
      setName(target === "new" ? "" : target.name);
      setDraft(target === "new" ? emptyQuantityPricingDraft() : draftFromTemplate(target));
      setError(null);
    }
  }
  if (target && target !== shown) setShown(target);

  const editing = shown && shown !== "new" ? shown : null;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return setError("Give the template a name.");

    const clash = state.templates.find(
      (t) => t.id !== editing?.id && t.name.toLowerCase() === trimmed.toLowerCase(),
    );
    if (clash) {
      return setError(`A template called "${clash.name}" already exists. Use another name.`);
    }

    const pricing = pricingFromDraft(draft);
    const pricingError = getPricingError(pricing, "Pricing");
    if (pricingError) return setError(pricingError);

    setError(null);
    try {
      setSaving(true);
      await state.save(trimmed, pricing, editing?.id);
      toast.success(editing ? `Saved changes to "${trimmed}"` : `Added "${trimmed}"`);
      onClose();
    } catch (err) {
      setError(templateErrorMessage(err, "Couldn't save the template. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent
        className="max-h-[90vh] overflow-y-auto sm:max-w-2xl"
        showCloseButton={!saving}
      >
        <DialogHeader>
          <DialogTitle>{editing ? "Edit pricing template" : "Add pricing template"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Changes apply the next time it's loaded. Products that already used it keep their prices."
              : "Any admin can load this quantity pricing into a product while creating it."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          {error && (
            <p role="alert" className={ERROR_BOX}>
              {error}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="template-form-name">Template name</Label>
            <Input
              id="template-form-name"
              value={name}
              maxLength={PRICING_TEMPLATE_NAME_MAX}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError(null);
              }}
              placeholder="e.g. Standard mug pricing"
              autoComplete="off"
              autoFocus
            />
          </div>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium">Quantity pricing</legend>
            <QuantityPricingEditor
              value={draft}
              onChange={(next) => {
                setDraft(next);
                if (error) setError(null);
              }}
            />
          </fieldset>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving && <Spinner size="small" className="text-current" />}
              {editing ? "Save changes" : "Add template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
