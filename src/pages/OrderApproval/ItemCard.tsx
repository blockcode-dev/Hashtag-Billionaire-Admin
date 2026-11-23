import { useRef, useState, type DragEvent, type ReactNode } from "react";
import {
  Check,
  CircleCheck,
  CircleDashed,
  Clock,
  Copy,
  Download,
  Ellipsis,
  ImagePlus,
  MessageSquareWarning,
  Plus,
  Send,
  Upload,
  X,
} from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImagePreview } from "@/components/common/ImagePreview";
import { Spinner } from "@/components/common/Spinner";
import { StatusTag } from "@/components/common/StatusTag";
import { Tip } from "@/components/common/Tip";
import { FilePicker } from "@/components/common/Upload";
import { PROOF_ACCEPT } from "@/lib/uploads";
import { plainText } from "@/pages/Dashboard/format";
import type { ApprovalFile, ApprovalLine, ApprovalNote } from "@/services/Api/ApprovalApi";
import { centralTime, codeLabel, count, fileSize, fileUrl, imageNumber, isDisplayable } from "./format";

export interface UploadProgress {
  lineId: number;
  // Files uploaded so far, of `total`.
  done: number;
  total: number;
}

interface ItemCardProps {
  line: ApprovalLine;
  index: number;
  total: number;
  // False before artwork approval starts: the item as it will be, with nothing to do yet.
  started: boolean;
  // Why nothing can change now (locked, shipped or cancelled), or null.
  readOnly: string | null;
  // The customer's notes that still count on this item (flow.ts activeNotes).
  openNotes: ApprovalNote[];
  // The write under way anywhere on the page; every button waits for it.
  busy: string | null;
  upload: UploadProgress | null;
  newEventIds: ReadonlySet<number>;
  onUpload: (line: ApprovalLine, files: File[]) => void;
  onRemove: (file: ApprovalFile) => void;
  onReuse: (line: ApprovalLine, version: number) => void;
  onNoPreview: (line: ApprovalLine, on: boolean) => void;
}

// One thing the customer approves (a product in one colour, all its sizes): what they ordered,
// where it stands, their own artwork, and the team's artwork previews.
export function ItemCard({
  line,
  index,
  total,
  started,
  readOnly,
  openNotes,
  busy,
  upload,
  newEventIds,
  onUpload,
  onRemove,
  onReuse,
  onNoPreview,
}: ItemCardProps) {
  const picker = useRef<HTMLInputElement>(null);
  const title = plainText(line.title) || `Item ${index + 1}`;
  const { detail } = line;
  const facts = [
    detail.color,
    detail.sizes_text,
    ...detail.print_methods.map(codeLabel),
    detail.locations.map(codeLabel).join(", "),
  ].filter(Boolean);
  const cardId = `approval-item-${line.id ?? `proposed-${index}`}`;
  const live = started && line.id !== null;
  // New previews can be added unless the order is locked, shipped or cancelled.
  const canAdd = live && !readOnly && !line.no_proof;
  // An item marked "No preview needed" before anything was added has no previews to show, and
  // without the customer's artwork either it needs no body at all.
  const showPreviews = live && !(line.no_proof && !line.versions.length && !line.drafts.length);
  const hasArtwork = detail.customer_artwork.some((file) => fileUrl(file.url));
  const openPicker = () => picker.current?.click();
  // "No preview needed" sits at the bottom of an item that was never sent, or is marked so. Once
  // its artwork previews were sent it's rarely wanted, so it waits in the card's menu.
  const sent = line.current_version > 0 && !line.no_proof;
  // Previews that aren't sent yet would be left behind on an item that needs none.
  const noPreviewBlock =
    readOnly ?? (!line.no_proof && line.drafts.length > 0 ? "Remove the artwork previews that aren't sent yet first." : null);

  return (
    // The scroll margin keeps the card's top clear of the panel's sticky header.
    <section
      id={cardId}
      aria-labelledby={`${cardId}-name`}
      className="@container scroll-mt-20 overflow-hidden rounded-xl border bg-card shadow-xs"
    >
      <header className="flex items-start gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs font-medium text-muted-foreground">
            Item {index + 1} of {total}
          </p>
          <h3 id={`${cardId}-name`} className="text-base font-semibold text-foreground">
            {title}
          </h3>
          {facts.length > 0 && <p className="text-sm text-muted-foreground">{facts.join(" · ")}</p>}
        </div>
        {live && sent && !readOnly && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon-sm" className="-mr-2 text-muted-foreground" aria-label={`More for ${title}`}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuItem
                disabled={busy !== null || noPreviewBlock !== null}
                onSelect={() => onNoPreview(line, true)}
                className="flex-col items-start gap-0.5"
              >
                <span className="font-medium">Mark as “No preview needed”</span>
                <span className="text-xs text-muted-foreground">
                  {noPreviewBlock ?? "The customer then sees this item as done, with nothing to approve."}
                </span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </header>

      {live && (
        <StatusStrip
          line={line}
          title={title}
          readOnly={readOnly}
          openNotes={openNotes}
          newEventIds={newEventIds}
          canAdd={canAdd}
          busy={busy}
          onUploadClick={openPicker}
          onReuse={onReuse}
        />
      )}

      {(!live || showPreviews || hasArtwork) && (
        <div
          className={cn("grid gap-5 border-t px-5 py-4", showPreviews && "@2xl:grid-cols-[14rem_minmax(0,1fr)] @2xl:gap-8")}
        >
          <CustomerArtwork files={detail.customer_artwork} title={title} />
          {showPreviews && (
            <Previews
              line={line}
              title={title}
              canAdd={canAdd}
              readOnly={readOnly}
              openNotes={openNotes}
              busy={busy}
              upload={upload?.lineId === line.id ? upload : null}
              onUpload={onUpload}
              onRemove={onRemove}
              onUploadClick={openPicker}
            />
          )}
        </div>
      )}

      {live && !sent && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t bg-muted/30 px-5 py-2.5">
          <Tip content={noPreviewBlock}>
            <Switch
              id={`no-preview-${line.id}`}
              checked={line.no_proof}
              disabled={busy !== null || noPreviewBlock !== null}
              onCheckedChange={(checked) => onNoPreview(line, checked)}
            />
          </Tip>
          <Label htmlFor={`no-preview-${line.id}`} className="text-sm font-medium">
            No preview needed
          </Label>
          <span className="text-sm text-muted-foreground">
            For an item the customer doesn't need to check, like a blank one. It then counts as done.
          </span>
        </div>
      )}

      {/* Shared by the card's "Upload a new version" buttons. */}
      {canAdd && (
        <input
          ref={picker}
          type="file"
          hidden
          multiple
          accept={PROOF_ACCEPT}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            // Reset, so picking the same file again still counts.
            e.target.value = "";
            if (files.length) onUpload(line, files);
          }}
        />
      )}
    </section>
  );
}

const STRIP_TONES = {
  good: "border-success-border bg-success-soft",
  attention: "border-warning-border bg-warning-soft",
  waiting: "border-info-border bg-info-soft",
  ready: "border-primary-border bg-primary-soft",
  quiet: "border-border bg-muted/50",
};

function Strip({ tone, icon, children }: { tone: keyof typeof STRIP_TONES; icon: ReactNode; children: ReactNode }) {
  return (
    <div className="px-5 pb-4">
      <div className={cn("flex gap-3 rounded-lg border px-4 py-2.5", STRIP_TONES[tone])}>
        <span className="mt-px shrink-0 [&_svg]:size-5">{icon}</span>
        <div className="min-w-0 flex-1 space-y-2 text-sm text-foreground">{children}</div>
      </div>
    </div>
  );
}

interface StatusStripProps {
  line: ApprovalLine;
  title: string;
  readOnly: string | null;
  openNotes: ApprovalNote[];
  newEventIds: ReadonlySet<number>;
  canAdd: boolean;
  busy: string | null;
  onUploadClick: () => void;
  onReuse: (line: ApprovalLine, version: number) => void;
}

// Where the item stands, in one coloured strip under its name: above all what the customer did
// (approved, or asked for changes with their note and photos), so nobody can miss it.
function StatusStrip({
  line,
  title,
  readOnly,
  openNotes,
  newEventIds,
  canAdd,
  busy,
  onUploadClick,
  onReuse,
}: StatusStripProps) {
  const latest = line.versions[line.versions.length - 1];
  const nextVersion = line.current_version + 1;
  const ready = line.drafts.length;
  const notes = openNotes.length > 0 && (
    <ul className="space-y-2">
      {openNotes.map((note) => (
        <NoteItem key={note.event_id} note={note} line={line} title={title} isNew={newEventIds.has(note.event_id)} />
      ))}
    </ul>
  );
  // What to do with previews added but not sent; nothing while the order is locked or closed.
  const sendHint = readOnly
    ? `${ready === 1 ? "It" : "They"} can't be sent right now.`
    : "Press Send to customer at the bottom of the page.";
  const readyLine = ready > 0 && (
    <p className="font-medium">
      Version {nextVersion} is ready ({count(ready, "image")}, not sent yet). {sendHint}
    </p>
  );

  switch (line.status) {
    case "NOT_SENT":
      return ready ? (
        <Strip tone="ready" icon={<Send className="text-primary" />}>
          <p>
            <span className="font-semibold text-primary-soft-foreground">Ready to send:</span>{" "}
            {count(ready, "artwork preview")}. {sendHint}
          </p>
        </Strip>
      ) : (
        <Strip tone="quiet" icon={<CircleDashed className="text-muted-foreground" />}>
          <p>
            <span className="font-semibold">Not sent yet.</span>{" "}
            {canAdd ? "Add an artwork preview below." : "No artwork preview was sent for this item."}
          </p>
        </Strip>
      );

    case "NO_PROOF_NEEDED":
      return (
        <Strip tone="quiet" icon={<Check className="text-muted-foreground" />}>
          <p>
            <span className="font-semibold">No preview needed.</span> The customer sees this item as done.
          </p>
        </Strip>
      );

    case "APPROVED":
      return (
        <Strip tone="good" icon={<CircleCheck className="text-success" />}>
          <p className="font-semibold text-success-soft-foreground">
            The customer approved Version {line.approved_version} · {centralTime(line.approved_at)}
          </p>
          {line.approved_version !== null && line.approved_version < line.current_version && (
            <p>They chose Version {line.approved_version}, not the newest one (Version {line.current_version}).</p>
          )}
          {openNotes.length > 0 && <p className="font-medium">They also left a note:</p>}
          {notes}
          {ready > 0 && (
            <p className="text-muted-foreground">
              Version {nextVersion} is ready, not sent yet. Sending it asks the customer to approve this item again.
            </p>
          )}
        </Strip>
      );

    case "CHANGES_REQUESTED":
      return (
        <Strip tone="attention" icon={<MessageSquareWarning className="text-warning" />}>
          <p className="font-semibold text-warning-soft-foreground">Customer asked for changes</p>
          {notes}
          {ready > 0
            ? readyLine
            : canAdd && (
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 pt-0.5">
                  <Button size="sm" variant="outline" className="bg-background" disabled={busy !== null} onClick={onUploadClick}>
                    {busy === `upload:${line.id}` ? <Spinner size="small" className="text-current" /> : <Upload />}
                    Upload a new version
                  </Button>
                  {latest && latest.files.length > 0 && (
                    <Tip
                      content={`Puts Version ${latest.version}'s ${latest.files.length === 1 ? "image" : "images"} in the new version, so you only remove or add what changed.`}
                    >
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={busy !== null}
                        onClick={() => onReuse(line, latest.version)}
                      >
                        {busy === `copy:${line.id}` ? <Spinner size="small" className="text-current" /> : <Copy />}
                        Start from Version {latest.version}'s {latest.files.length === 1 ? "image" : "images"}
                      </Button>
                    </Tip>
                  )}
                  <span className="text-muted-foreground">It becomes Version {nextVersion}.</span>
                </div>
              )}
        </Strip>
      );

    default: {
      const sent = latest ? ` · sent ${centralTime(latest.sent_at)}` : "";
      // Locked, shipped or cancelled: the customer can't approve any more, so nothing is awaited.
      return readOnly ? (
        <Strip tone="quiet" icon={<CircleDashed className="text-muted-foreground" />}>
          <p>
            <span className="font-semibold">Not approved.</span> Version {line.current_version}
            {sent}
          </p>
        </Strip>
      ) : (
        <Strip tone="waiting" icon={<Clock className="text-info" />}>
          <p>
            <span className="font-semibold text-info-soft-foreground">Waiting for the customer</span> to check Version{" "}
            {line.current_version}
            {sent}
          </p>
          {readyLine}
        </Strip>
      );
    }
  }
}

// The files the customer ordered with, each with a Download link for making the artwork
// previews. Formats an <img> can't show (AI, EPS, PDF) are only that link.
function CustomerArtwork({ files, title }: { files: ApprovalLine["detail"]["customer_artwork"]; title: string }) {
  const shown = files.flatMap((file) => {
    const href = fileUrl(file.url);
    return href ? [{ href, name: file.name || href.split(/[?#]/)[0].split("/").pop() || "Artwork file" }] : [];
  });
  const gallery = shown.filter((file) => isDisplayable(file.href)).map((file) => file.href);

  return (
    <div className="min-w-0 space-y-2">
      <h4 className="text-sm font-semibold text-foreground">Customer's uploaded artwork</h4>
      {shown.length ? (
        <ul className="flex flex-wrap gap-3">
          {shown.map((file, i) => (
            <li key={`${file.href}-${i}`} className="w-20">
              {isDisplayable(file.href) ? (
                <ImagePreview
                  src={file.href}
                  alt={`${title}: the customer's ${file.name}`}
                  gallery={gallery}
                  width={80}
                  height={80}
                  className="size-20 rounded-md border bg-muted/30 object-contain"
                />
              ) : (
                <a
                  href={file.href}
                  download={file.name}
                  className="flex size-20 flex-col items-center justify-center gap-1 rounded-md border bg-muted/30 px-1 text-center text-xs hover:bg-muted"
                >
                  <Download className="size-4" aria-hidden />
                  Download
                </a>
              )}
              <p className="mt-1 truncate text-xs text-muted-foreground" title={file.name}>
                {file.name}
              </p>
              {isDisplayable(file.href) && (
                <a
                  href={file.href}
                  download={file.name}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Download ${file.name}`}
                  className="inline-flex items-center gap-1 text-xs font-medium text-foreground underline underline-offset-2 hover:text-primary"
                >
                  <Download className="size-3" aria-hidden />
                  Download
                </a>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">The customer didn't upload artwork for this item.</p>
      )}
    </div>
  );
}

interface PreviewsProps {
  line: ApprovalLine;
  title: string;
  canAdd: boolean;
  readOnly: string | null;
  openNotes: ApprovalNote[];
  busy: string | null;
  upload: UploadProgress | null;
  onUpload: (line: ApprovalLine, files: File[]) => void;
  onRemove: (file: ApprovalFile) => void;
  onUploadClick: () => void;
}

// The team's side: the place to add artwork previews, the ones not sent yet, and what was sent.
function Previews({
  line,
  title,
  canAdd,
  readOnly,
  openNotes,
  busy,
  upload,
  onUpload,
  onRemove,
  onUploadClick,
}: PreviewsProps) {
  const neverSent = line.current_version === 0;
  const firstUpload = neverSent && !line.drafts.length;
  const one = line.drafts.length === 1;
  // What happens to the previews that aren't sent yet. An item marked "No preview needed" doesn't
  // send them (flow.ts).
  const notSentText = readOnly
    ? `${one ? "It" : "They"} can't be sent right now. ${readOnly}`
    : line.no_proof
      ? `Remove ${one ? "this preview" : "these previews"}, or switch off No preview needed to send ${one ? "it" : "them"}.`
      : `${neverSent ? "" : `${one ? "It becomes" : "These become"} Version ${line.current_version + 1}. `}You can remove ${one ? "it" : "them"} or add more before sending.`;

  return (
    <div className="min-w-0 space-y-3">
      <h4 className="text-sm font-semibold text-foreground">Artwork previews</h4>

      {firstUpload &&
        (canAdd ? (
          <DropArea line={line} busy={busy} upload={upload} onUpload={onUpload} />
        ) : (
          <p className="text-sm text-muted-foreground">None were sent for this item.</p>
        ))}

      {line.drafts.length > 0 && (
        <div className="space-y-3 rounded-lg border border-primary-border bg-primary-soft/40 p-3">
          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
            <StatusTag color="gold">Not sent yet</StatusTag>
            <span className="text-muted-foreground">{notSentText}</span>
          </p>
          <Thumbs
            files={line.drafts}
            title={`${title}, not sent yet`}
            onRemove={busy === null ? onRemove : undefined}
            after={canAdd && <AddTile line={line} busy={busy} upload={upload} onUpload={onUpload} />}
          />
        </div>
      )}

      {line.versions.length > 0 && (
        <SentVersions
          key={line.current_version}
          line={line}
          title={title}
          openNotes={openNotes}
          canAdd={canAdd}
          busy={busy}
          onUploadClick={onUploadClick}
        />
      )}
    </div>
  );
}

interface DropProps {
  line: ApprovalLine;
  busy: string | null;
  upload: UploadProgress | null;
  onUpload: (line: ApprovalLine, files: File[]) => void;
}

// Images dragged onto an upload area: its handlers, and whether files are over it right now.
function useDropTarget({ line, busy, onUpload }: DropProps) {
  const [over, setOver] = useState(false);
  return {
    over,
    handlers: {
      onDragOver: (e: DragEvent) => {
        e.preventDefault();
        setOver(true);
      },
      onDragLeave: () => setOver(false),
      onDrop: (e: DragEvent) => {
        e.preventDefault();
        setOver(false);
        if (busy === null) onUpload(line, Array.from(e.dataTransfer.files));
      },
    },
  };
}

// The big upload area an item shows until its first artwork preview is added.
function DropArea(props: DropProps) {
  const { line, busy, upload, onUpload } = props;
  const { over, handlers } = useDropTarget(props);
  return (
    <FilePicker
      accept={PROOF_ACCEPT}
      multiple
      disabled={busy !== null}
      onFiles={(files) => onUpload(line, files)}
      className="block rounded-xl"
    >
      <div
        {...handlers}
        className={cn(
          "flex min-h-40 flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-input bg-muted/30 px-6 py-7 text-center transition-colors hover:border-primary hover:bg-primary-soft/40",
          over && "border-primary bg-primary-soft/60",
        )}
      >
        <span className="mb-1 flex size-11 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
          {upload ? <Spinner size="small" className="text-current" /> : <ImagePlus className="size-5" aria-hidden />}
        </span>
        <span aria-live="polite" className="text-base font-semibold text-foreground">
          {upload
            ? `Uploading ${Math.min(upload.done + 1, upload.total)} of ${upload.total}…`
            : "Add artwork preview"}
        </span>
        <span className="text-sm text-foreground/80">A picture of this item with the customer's design on it.</span>
        <span className="text-sm text-muted-foreground">Click to choose images, or drag them here.</span>
        <span className="text-xs text-muted-foreground">PNG, JPG or SVG, up to 20 MB each.</span>
      </div>
    </FilePicker>
  );
}

// "Add more" next to the previews that aren't sent yet.
function AddTile(props: DropProps) {
  const { line, busy, upload, onUpload } = props;
  const { over, handlers } = useDropTarget(props);
  return (
    <FilePicker
      accept={PROOF_ACCEPT}
      multiple
      disabled={busy !== null}
      onFiles={(files) => onUpload(line, files)}
      className="block rounded-lg"
    >
      <div
        {...handlers}
        className={cn(
          "flex size-28 flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-input bg-background px-2 text-center text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-primary",
          over && "border-primary text-primary",
        )}
      >
        {upload ? (
          <span aria-live="polite" className="flex flex-col items-center gap-1">
            <Spinner size="small" className="text-current" label="Uploading" />
            {Math.min(upload.done + 1, upload.total)} of {upload.total}
          </span>
        ) : (
          <>
            <Plus className="size-5" aria-hidden />
            Add more
          </>
        )}
      </div>
    </FilePicker>
  );
}

interface SentVersionsProps {
  line: ApprovalLine;
  title: string;
  openNotes: ApprovalNote[];
  canAdd: boolean;
  busy: string | null;
  onUploadClick: () => void;
}

// What the customer was sent, newest version first. The page remounts this when a new version
// goes out, so it opens on that one.
function SentVersions({ line, title, openNotes, canAdd, busy, onUploadClick }: SentVersionsProps) {
  const [shown, setShown] = useState(line.current_version);
  const newestFirst = [...line.versions].reverse();
  const version = line.versions.find((v) => v.version === shown) ?? newestFirst[0];
  const approvedHere = line.status === "APPROVED" && line.approved_version === version.version;
  const open = new Set(openNotes.map((note) => note.event_id));
  // Notes shown in the strip above aren't repeated here.
  const notes = line.notes.filter((note) => note.version === version.version && !open.has(note.event_id));
  const versionLabel = (n: number) => `Version ${n}${n === line.current_version ? " (latest)" : ""}`;
  // The changes strip has its own buttons, and previews already added show "Add more". While the
  // customer is checking or has approved, a new version is the exception: a quiet button.
  const offerUpload = canAdd && !line.drafts.length && line.status !== "CHANGES_REQUESTED";

  return (
    <div className="space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          <span className="font-medium text-foreground">Sent to the customer:</span> {versionLabel(version.version)},{" "}
          {centralTime(version.sent_at)}
          {approvedHere && (
            <span className="font-medium text-success-soft-foreground">
              {" "}
              · <Check className="inline size-3.5 align-[-2px]" aria-hidden /> approved
            </span>
          )}
        </p>
        {newestFirst.length > 1 && (
          <div role="group" aria-label={`Versions of ${title}`} className="inline-flex flex-wrap rounded-lg bg-muted p-[3px]">
            {newestFirst.map((v) => (
              <button
                key={v.version}
                type="button"
                aria-pressed={v.version === version.version}
                onClick={() => setShown(v.version)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-xs font-medium text-foreground/60 transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  v.version === version.version && "bg-background text-foreground shadow-sm",
                )}
              >
                {versionLabel(v.version)}
              </button>
            ))}
          </div>
        )}
      </div>

      <Thumbs files={version.files} title={`${title}, Version ${version.version}`} />

      {notes.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">The customer's notes on Version {version.version}</p>
          <ul className="space-y-2">
            {notes.map((note) => (
              <NoteItem key={note.event_id} note={note} line={line} title={title} isNew={false} />
            ))}
          </ul>
        </div>
      )}

      {offerUpload && (
        <div className="border-t pt-2">
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-ml-2 text-muted-foreground"
            disabled={busy !== null}
            onClick={onUploadClick}
          >
            {busy === `upload:${line.id}` ? <Spinner size="small" className="text-current" /> : <Upload />}
            Upload a new version
          </Button>
        </div>
      )}
    </div>
  );
}

interface ThumbsProps {
  files: ApprovalFile[];
  title: string;
  // Only for previews that aren't sent yet.
  onRemove?: (file: ApprovalFile) => void;
  after?: ReactNode;
}

// Images numbered as the customer sees them, each with a link to the file as uploaded.
function Thumbs({ files, title, onRemove, after }: ThumbsProps) {
  const gallery = files.map((file) => fileUrl(file.preview_url ?? file.url) ?? "");
  return (
    <ul className="flex flex-wrap gap-3">
      {files.map((file, i) => (
        <li key={file.id} className="w-28">
          <div className="relative size-28 overflow-hidden rounded-lg border bg-muted/30">
            <ImagePreview
              src={gallery[i]}
              alt={`${title}: image ${i + 1}, ${file.name}`}
              gallery={gallery}
              className="size-full object-contain"
            />
            <span className="absolute top-1.5 left-1.5 rounded bg-background/90 px-1.5 text-xs font-medium tabular-nums">
              {i + 1}
            </span>
            {onRemove && (
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                title="Remove (not sent yet)"
                onClick={() => onRemove(file)}
                className="absolute top-1.5 right-1.5 flex rounded-full bg-black/60 p-1 text-white transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          <a
            href={fileUrl(file.url) ?? undefined}
            download={file.name}
            title={`Download ${file.name}`}
            className="mt-1 block truncate text-xs font-medium text-foreground hover:underline"
          >
            {file.name}
          </a>
          <p className="text-xs text-muted-foreground">{fileSize(file.bytes)}</p>
        </li>
      ))}
      {after && <li>{after}</li>}
    </ul>
  );
}

function NoteItem({ note, line, title, isNew }: { note: ApprovalNote; line: ApprovalLine; title: string; isNew: boolean }) {
  const image = imageNumber(line, note.version, note.file_id);
  const imageFile = image ? line.versions.find((v) => v.version === note.version)?.files[image - 1] : null;
  const photos = note.pictures.map((picture) => fileUrl(picture.url) ?? "");

  return (
    <li className={cn("rounded-md border bg-background p-3", note.removed && "bg-muted/40")}>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
        <span>{centralTime(note.created_at)}</span>
        {note.version > 0 && <span>· on Version {note.version}</span>}
        {image && <span>· about image {image}</span>}
        {note.removed && <StatusTag>Removed by the customer {centralTime(note.removed_at)}</StatusTag>}
        {isNew && <StatusTag color="gold">New</StatusTag>}
      </div>
      <div className="mt-2 flex gap-3">
        {imageFile && (
          <ImagePreview
            src={fileUrl(imageFile.preview_url ?? imageFile.url)}
            alt={`${title}: image ${image} of Version ${note.version}, which the note is about`}
            width={48}
            height={48}
            className="size-12 shrink-0 rounded-md border bg-muted/30 object-contain"
          />
        )}
        <div className="min-w-0 flex-1 space-y-2">
          {note.body ? (
            <p
              className={cn(
                "text-sm break-words whitespace-pre-wrap text-foreground",
                note.removed && "text-muted-foreground line-through",
              )}
            >
              {note.body}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground italic">Photos only, no words</p>
          )}
          {photos.length > 0 && (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">
                The customer's {photos.length === 1 ? "photo" : "photos"}:
              </p>
              <ul className="flex flex-wrap gap-2">
                {note.pictures.map((picture, i) => (
                  <li key={picture.id}>
                    <ImagePreview
                      src={photos[i]}
                      alt={`The customer's photo ${i + 1}: ${picture.name}`}
                      gallery={photos}
                      width={72}
                      height={72}
                      className={cn("size-18 rounded-md border bg-muted/30 object-cover", note.removed && "opacity-60")}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </li>
  );
}
