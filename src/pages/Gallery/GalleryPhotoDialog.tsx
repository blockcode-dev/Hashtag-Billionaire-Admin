import { useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/common/Spinner";
import { Thumbnail } from "@/components/common/Thumbnail";
import { ImageUploadGrid, type UploadItem } from "@/components/common/Upload";
import {
  CreateGalleryPhotoAPI,
  UpdateGalleryPhotoAPI,
  type GalleryPhoto,
} from "@/services/Api/GalleryApi";

export const CAPTION_MAX = 255;
// Gap between sort_order values, so a photo can later go between two others.
export const SORT_STEP = 10;

interface GalleryPhotoDialogProps {
  // The photo to edit, "new" to add photos, or null when closed.
  target: GalleryPhoto | "new" | null;
  // sort_order for the first photo added; the others follow in steps of SORT_STEP.
  nextSortOrder: number;
  onClose: () => void;
  // The photos created, or the one updated, as the backend returned them.
  onSaved: (photos: GalleryPhoto[]) => void;
}

// Adds photos (several at once, each its own gallery photo) or edits one photo's
// caption and image.
export function GalleryPhotoDialog({ target, nextSortOrder, onClose, onSaved }: GalleryPhotoDialogProps) {
  const open = target !== null;
  const [wasOpen, setWasOpen] = useState(open);
  // What the dialog shows; kept while it closes.
  const [shown, setShown] = useState(target);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [caption, setCaption] = useState("");
  const [visible, setVisible] = useState(true);
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Each opening starts a fresh form.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setShown(target);
      setItems([]);
      setCaption(target !== "new" ? (target.caption ?? "") : "");
      setVisible(true);
      setError(null);
      setProgress(0);
    }
  }

  const editing = shown && shown !== "new" ? shown : null;
  const message = (err: any) => err?.response?.data?.message || "Try again in a moment.";

  const saveEdit = async (photo: GalleryPhoto) => {
    const file = items[0]?.originFileObj;
    let body: FormData | { caption: string };
    if (file) {
      body = new FormData();
      body.append("images", file);
      body.append("caption", caption.trim());
    } else {
      body = { caption: caption.trim() };
    }
    const res = await UpdateGalleryPhotoAPI(photo.id, body);
    onSaved([res.data.data]);
    toast.success("Photo saved");
    onClose();
  };

  // One request per photo, in the order picked, so they keep that order.
  const addPhotos = async () => {
    const created: GalleryPhoto[] = [];
    const sent = new Set<string>();
    try {
      for (const [i, item] of items.entries()) {
        setProgress(i + 1);
        const form = new FormData();
        form.append("images", item.originFileObj);
        if (items.length === 1 && caption.trim()) form.append("caption", caption.trim());
        form.append("sort_order", String(nextSortOrder + i * SORT_STEP));
        form.append("is_active", String(visible));
        const res = await CreateGalleryPhotoAPI(form);
        created.push(res.data.data);
        sent.add(item.uid);
      }
    } catch (err) {
      // Keep what was added; a retry sends only the rest.
      if (created.length) onSaved(created);
      setItems((list) => list.filter((item) => !sent.has(item.uid)));
      setError(`${created.length ? `Added ${created.length} of ${items.length}. ` : ""}${message(err)}`);
      return;
    }
    onSaved(created);
    toast.success(created.length === 1 ? "Photo added" : `${created.length} photos added`);
    onClose();
  };

  const submit = async () => {
    setError(null);
    try {
      setSaving(true);
      if (editing) await saveEdit(editing);
      else await addPhotos();
    } catch (err) {
      setError(message(err));
    } finally {
      setSaving(false);
    }
  };

  const showCaption = !!editing || items.length <= 1;

  return (
    <Dialog open={open} onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="sm:max-w-lg" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle>{editing ? "Edit photo" : "Add photos"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Change the caption, or replace the image."
              : "JPG, PNG, WebP, AVIF or GIF, up to 20 MB each. New photos go at the end of the gallery."}
          </DialogDescription>
        </DialogHeader>

        {error && (
          <p
            role="alert"
            className="rounded-md border border-destructive-border bg-destructive-soft px-3 py-2 text-sm text-destructive-soft-foreground"
          >
            {error}
          </p>
        )}

        <div className="space-y-4">
          <div className="space-y-2">
            <p className="text-sm font-medium">{editing ? "Image" : "Images"}</p>
            {/* Inert while uploading: the photos being sent can't change underneath. */}
            <div className="flex flex-wrap items-start gap-2" inert={saving}>
              {editing && !items.length && (
                <Thumbnail src={editing.image_url} alt="Current photo" size={96} className="border" />
              )}
              <ImageUploadGrid
                fileList={items}
                onChange={(next) => {
                  setItems(next);
                  setError(null);
                }}
                multiple={!editing}
                maxCount={editing ? 1 : undefined}
                addLabel={editing ? "Replace" : "Add"}
              />
            </div>
          </div>

          {showCaption ? (
            <div className="space-y-2">
              <Label htmlFor="gallery-caption">Caption</Label>
              <Textarea
                id="gallery-caption"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                maxLength={CAPTION_MAX}
                rows={3}
                placeholder="Optional"
              />
              <p className="text-right text-xs text-muted-foreground tabular-nums">
                {caption.length}/{CAPTION_MAX}
              </p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              With several photos, add their captions afterwards with Edit.
            </p>
          )}

          {!editing && (
            <label className="flex w-fit items-center gap-2 text-sm">
              <Switch checked={visible} onCheckedChange={setVisible} />
              Show on the shop
            </label>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={submit} disabled={saving || (!editing && !items.length)}>
            {saving && <Spinner size="small" className="text-current" />}
            {editing
              ? "Save"
              : saving && items.length > 1
                ? `Uploading ${progress} of ${items.length}…`
                : items.length > 1
                  ? `Add ${items.length} photos`
                  : "Add photo"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
