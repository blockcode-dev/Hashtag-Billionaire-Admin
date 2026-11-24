import { Check, Undo2, X } from "lucide-react";
import { cn } from "cn";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ImagePreview } from "@/components/common/ImagePreview";
import { plainText } from "@/pages/Dashboard/format";
import type { ApprovalLine, ApprovalView, ChoiceKind, LineStatus, ReadOnlyReason } from "@/services/Api/ApprovalApi";
import { codeLabel, fileUrl, isDisplayable, newerVersions } from "./format";

// The customer page's own words (the approval site), not the panel's.
const READ_ONLY: Record<ReadOnlyReason, string> = {
  LOCKED: "Your order is in production. Your choices are final now.",
  SHIPPED: "Your order has shipped.",
  CANCELLED: "This order was cancelled.",
};

const NEUTRAL = "border-border bg-muted text-foreground";

const CUSTOMER_STATUS: Record<LineStatus, { label: string; className: string }> = {
  APPROVED: { label: "Approved", className: "border-success-border bg-success-soft text-success-soft-foreground" },
  CHANGES_REQUESTED: { label: "Rejected", className: NEUTRAL },
  WAITING: { label: "Waiting for you", className: "border-primary-border bg-primary-soft text-primary-soft-foreground" },
  NO_PROOF_NEEDED: { label: "No preview needed", className: NEUTRAL },
  NOT_SENT: { label: "Artwork preview coming soon", className: NEUTRAL },
};

// Once the page can't change, an item nobody approved isn't waiting any more.
const READ_ONLY_STATUS: Partial<Record<LineStatus, { label: string; className: string }>> = {
  WAITING: { label: "Not approved", className: NEUTRAL },
  NOT_SENT: { label: "No preview sent", className: NEUTRAL },
};

// "You approved Version 2": the customer's last choice, as their page says it.
const CHOICE_TEXT: Record<ChoiceKind, string> = {
  APPROVED: "You approved Version",
  WENT_BACK: "You went back to Version",
  REJECTED: "You rejected Version",
};

// "Preview what the customer sees": the customer's page drawn from this page's data. It never
// opens their page, where a click would count as the customer's.
export function PreviewDialog({ open, view, onClose }: { open: boolean; view: ApprovalView; onClose: () => void }) {
  const { order, approval, lines } = view;
  const toCheck = lines.filter((line) => !line.no_proof);
  const approved = toCheck.filter((line) => line.status === "APPROVED");
  const noLink = !approval?.link.url || approval.link.disabled;
  const readOnly = approval?.read_only_reason ?? null;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-0 sm:max-w-md">
        <DialogHeader className="border-b px-5 py-4">
          <DialogTitle>What the customer sees</DialogTitle>
          <DialogDescription>
            A simplified view of their page right now, as on a phone: each item's artwork preview as they see it, and
            where it stands. Nothing here can be clicked.
          </DialogDescription>
        </DialogHeader>

        {noLink ? (
          <p className="px-5 py-8 text-center text-sm text-muted-foreground">
            {approval?.link.disabled
              ? "The link is switched off. The customer sees: “This link isn't valid any more. Please ask us for a new one.”"
              : "There's no link yet. It's made the first time you press Send to customer."}
          </p>
        ) : (
          <div className="space-y-3 bg-muted/40 p-4" inert>
            <div className="space-y-2 rounded-lg border bg-background p-3 shadow-xs">
              <p className="text-xs font-medium text-muted-foreground">Order {order.order_number}</p>
              <p className="text-lg font-semibold text-foreground">Review your artwork</p>
              <p className="text-sm text-muted-foreground">
                Check each item. Approve it if it looks right, or reject it and tell us what to change.
              </p>
              <p className="text-sm font-medium text-foreground">
                {approved.length} of {toCheck.length} approved
              </p>
            </div>

            {readOnly && (
              <p className="rounded-lg border border-info-border bg-info-soft px-3 py-2 text-sm text-info-soft-foreground">
                {READ_ONLY[readOnly]}
              </p>
            )}

            {lines.map((line, i) => (
              <PreviewItem key={line.id ?? i} line={line} readOnly={Boolean(readOnly)} />
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function PreviewItem({ line, readOnly }: { line: ApprovalLine; readOnly: boolean }) {
  const latest = line.versions[line.versions.length - 1];
  // The version their page opens on, picked as the approval site does: the approved one while the
  // item is approved (an earlier one after going back), otherwise the newest.
  const shown =
    (line.status === "APPROVED" ? line.versions.find((v) => v.version === line.approved_version) : undefined) ?? latest;
  const artwork = line.detail.customer_artwork.flatMap((file) => fileUrl(file.url) ?? []).filter(isDisplayable);
  const chips = [line.detail.color, line.detail.sizes_text, ...line.detail.print_methods.map(codeLabel)].filter(Boolean);
  const images = shown?.files.map((file) => fileUrl(file.preview_url ?? file.url) ?? "") ?? [];
  const status =
    (readOnly ? READ_ONLY_STATUS[line.status] : undefined) ?? CUSTOMER_STATUS[line.status] ?? CUSTOMER_STATUS.NOT_SENT;
  const choice = line.last_choice;
  const c = line.current_version;

  return (
    <article className="space-y-3 rounded-lg border bg-background p-3 shadow-xs">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 space-y-1.5">
          <h3 className="font-semibold text-foreground">{plainText(line.title)}</h3>
          <div className="flex flex-wrap gap-1.5">
            {chips.map((chip) => (
              <span key={chip} className="rounded-full bg-muted px-2 py-0.5 text-xs">
                {chip}
              </span>
            ))}
          </div>
        </div>
        <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold", status.className)}>
          {status.label}
        </span>
      </div>

      {artwork.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">Your uploaded artwork</p>
          <div className="flex flex-wrap gap-2">
            {artwork.map((src) => (
              <ImagePreview key={src} src={src} alt="" preview={false} className="size-12 rounded-md border object-contain" />
            ))}
          </div>
        </div>
      )}

      {shown && !line.no_proof && (
        <>
          <p className="text-xs font-medium text-muted-foreground">Version {shown.version}</p>
          {shown.message && <p className="text-sm break-words whitespace-pre-wrap">{shown.message}</p>}
          <div className="grid grid-cols-2 gap-2">
            {images.map((src, i) => (
              <ImagePreview
                key={`${src}-${i}`}
                src={src}
                alt={`Image ${i + 1}`}
                preview={false}
                className="aspect-square w-full rounded-md border bg-muted/30 object-contain"
              />
            ))}
          </div>
          {choice ? (
            <div className="space-y-1">
              <p
                className={cn(
                  "flex items-center gap-1.5 text-sm font-medium",
                  choice.kind === "REJECTED" ? "text-foreground" : "text-success-soft-foreground",
                )}
              >
                {choice.kind === "REJECTED" ? (
                  <X className="size-4" aria-hidden />
                ) : choice.kind === "WENT_BACK" ? (
                  <Undo2 className="size-4" aria-hidden />
                ) : (
                  <Check className="size-4" aria-hidden />
                )}
                {CHOICE_TEXT[choice.kind]} {choice.version}
              </p>
              {/* Their page spells out what going back did. */}
              {choice.kind === "WENT_BACK" && (
                <p className="text-sm text-muted-foreground">
                  Version {choice.version} is approved, and {newerVersions(choice.version, c)}{" "}
                  {choice.version + 1 >= c ? "is" : "are"} rejected.
                </p>
              )}
            </div>
          ) : (
            !readOnly && (
              // As on a phone: Reject on the left, Approve on the right, and going back under them.
              <div className="space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="outline" tabIndex={-1}>
                    <X aria-hidden />
                    Reject
                  </Button>
                  <Button type="button" tabIndex={-1}>
                    <Check aria-hidden />
                    Approve
                  </Button>
                </div>
                {c >= 2 && (
                  <Button type="button" variant="outline" tabIndex={-1} className="h-auto w-full flex-col gap-0.5 py-2">
                    <span className="flex items-center gap-1.5">
                      <Undo2 aria-hidden />
                      Go back to Version {c - 1}
                    </span>
                    <span className="text-xs font-normal text-muted-foreground">
                      Approves Version {c - 1} and rejects Version {c}
                    </span>
                  </Button>
                )}
              </div>
            )
          )}
        </>
      )}
    </article>
  );
}
