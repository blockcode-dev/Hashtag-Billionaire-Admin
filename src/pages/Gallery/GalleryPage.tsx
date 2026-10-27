/** @format */

import { useEffect, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Pencil,
  RefreshCw,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { confirm } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { StatusTag } from "@/components/common/StatusTag";
import { Thumbnail } from "@/components/common/Thumbnail";
import {
  DeleteGalleryPhotoAPI,
  GetGalleryAdminAPI,
  UpdateGalleryPhotoAPI,
  type GalleryPhoto,
} from "@/services/Api/GalleryApi";
import { GalleryPhotoDialog, SORT_STEP } from "./GalleryPhotoDialog";

// The shop's order: lowest sort_order first, newest first among equals.
const byShopOrder = (a: GalleryPhoto, b: GalleryPhoto) => a.sort_order - b.sort_order || b.id - a.id;

const errorMessage = (err: any) => err?.response?.data?.message || "Try again in a moment.";

// The photos on the shop's Gallery page (client decision Q56): add, caption,
// order, hide and delete them.
const GalleryPage = () => {
  const [photos, setPhotos] = useState<GalleryPhoto[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  // The load the page last finished, so loading and error follow from it.
  const [settled, setSettled] = useState<{ key: number; failed: boolean } | null>(null);
  // New photos are numbered after the existing ones, so adding waits for a list.
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [reordering, setReordering] = useState(false);
  const [dialog, setDialog] = useState<GalleryPhoto | "new" | null>(null);

  const loading = settled?.key !== reloadKey;
  const failed = !loading && settled?.failed;

  useEffect(() => {
    let active = true;
    GetGalleryAdminAPI()
      .then((res) => {
        if (!active) return;
        setPhotos([...(res.data?.data ?? [])].sort(byShopOrder));
        setLoadedOnce(true);
        setSettled({ key: reloadKey, failed: false });
      })
      .catch(() => {
        if (active) setSettled({ key: reloadKey, failed: true });
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  const reload = () => setReloadKey((k) => k + 1);

  const shownCount = photos.filter((p) => p.is_active).length;
  const nextSortOrder = photos.length ? Math.max(...photos.map((p) => p.sort_order)) + SORT_STEP : SORT_STEP;

  const merge = (saved: GalleryPhoto[]) =>
    setPhotos((list) => {
      const byId = new Map(list.map((p) => [p.id, p]));
      saved.forEach((p) => byId.set(p.id, p));
      return [...byId.values()].sort(byShopOrder);
    });

  // Swaps a photo with its neighbour, then numbers every photo again (10, 20, …) so
  // the order doesn't depend on ties, and saves the ones whose number changed.
  const move = async (index: number, delta: -1 | 1) => {
    const other = index + delta;
    if (other < 0 || other >= photos.length) return;
    const next = [...photos];
    [next[index], next[other]] = [next[other], next[index]];
    const renumbered = next.map((p, i) => ({ ...p, sort_order: (i + 1) * SORT_STEP }));
    const before = new Map(photos.map((p) => [p.id, p.sort_order]));
    const changed = renumbered.filter((p) => before.get(p.id) !== p.sort_order);

    setPhotos(renumbered);
    setReordering(true);
    // Wait for every save, so the reload below sees all of them.
    const results = await Promise.allSettled(
      changed.map((p) => UpdateGalleryPhotoAPI(p.id, { sort_order: p.sort_order })),
    );
    const failure = results.find((r): r is PromiseRejectedResult => r.status === "rejected");
    if (failure) {
      toast.error("Couldn't save the new order", { description: errorMessage(failure.reason) });
      // Some photos may have saved; show the order the server has. The arrows stay off until it loads.
      reload();
    }
    setReordering(false);
  };

  const setVisible = async (photo: GalleryPhoto, is_active: boolean) => {
    const patch = (value: boolean) =>
      setPhotos((list) => list.map((p) => (p.id === photo.id ? { ...p, is_active: value } : p)));
    patch(is_active);
    try {
      await UpdateGalleryPhotoAPI(photo.id, { is_active });
      toast.success(is_active ? "Shown on the shop" : "Hidden from the shop");
    } catch (err) {
      patch(!is_active);
      toast.error("Couldn't change the photo", { description: errorMessage(err) });
    }
  };

  const remove = (photo: GalleryPhoto) =>
    confirm({
      title: "Delete this photo?",
      content: "It leaves the gallery and the shop. To take it off the shop for now, hide it instead.",
      okText: "Delete",
      okType: "danger",
      onOk: async () => {
        try {
          await DeleteGalleryPhotoAPI(photo.id);
          setPhotos((list) => list.filter((p) => p.id !== photo.id));
          toast.success("Photo deleted");
        } catch (err) {
          toast.error("Couldn't delete the photo", { description: errorMessage(err) });
          throw err;
        }
      },
    });

  return (
    <div>
      <PageHeader
        title="Gallery"
        description={
          photos.length
            ? `${photos.length} ${photos.length === 1 ? "photo" : "photos"}, ${shownCount} shown on the shop. The shop shows them in this order.`
            : "Photos for the shop's Gallery page, in the order the shop shows them."
        }
        actions={
          <Button onClick={() => setDialog("new")} disabled={!loadedOnce}>
            <ImagePlus />
            Add photos
          </Button>
        }
      />

      {loading && !photos.length ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : failed && !photos.length ? (
        <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center">
          <TriangleAlert className="size-8 text-destructive" aria-hidden />
          <div className="space-y-1">
            <p className="font-medium text-foreground">Couldn't load the gallery</p>
            <p className="text-sm text-muted-foreground">The server returned an error. Try again in a moment.</p>
          </div>
          <Button variant="outline" onClick={reload}>
            <RefreshCw />
            Try again
          </Button>
        </div>
      ) : !photos.length ? (
        <div className="rounded-xl border">
          <EmptyState description="No photos yet. Add the shop's gallery photos to manage them here." />
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" aria-busy={loading || reordering}>
          {photos.map((photo, index) => {
            const name = photo.caption || `photo ${index + 1}`;
            return (
              <li key={photo.id} className="flex flex-col overflow-hidden rounded-xl border bg-card shadow-xs">
                <div className="relative aspect-[4/3] bg-muted">
                  <Thumbnail
                    src={photo.image_url}
                    alt={photo.caption || `Gallery photo ${index + 1}`}
                    className={cn("rounded-none", !photo.is_active && "opacity-50")}
                  />
                  <span className="absolute top-2 left-2 rounded-md bg-background/90 px-1.5 py-0.5 text-xs font-medium tabular-nums">
                    {index + 1}
                  </span>
                  {!photo.is_active && <StatusTag className="absolute top-2 right-2">Hidden</StatusTag>}
                </div>

                <div className="flex flex-1 flex-col gap-3 p-3">
                  <p className={cn("line-clamp-2 text-sm", !photo.caption && "text-muted-foreground italic")}>
                    {photo.caption || "No caption"}
                  </p>

                  <div className="mt-auto flex flex-wrap items-center justify-between gap-2">
                    <label className="flex items-center gap-2 text-sm">
                      <Switch
                        checked={photo.is_active}
                        onCheckedChange={(checked) => setVisible(photo, checked)}
                      />
                      On shop
                    </label>

                    <div className="flex items-center">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${name} earlier`}
                        title="Move earlier"
                        disabled={index === 0 || reordering || loading}
                        onClick={() => move(index, -1)}
                      >
                        <ChevronLeft />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Move ${name} later`}
                        title="Move later"
                        disabled={index === photos.length - 1 || reordering || loading}
                        onClick={() => move(index, 1)}
                      >
                        <ChevronRight />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        aria-label={`Edit ${name}`}
                        title="Edit"
                        onClick={() => setDialog(photo)}
                      >
                        <Pencil />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        className="text-destructive hover:text-destructive"
                        aria-label={`Delete ${name}`}
                        title="Delete"
                        onClick={() => remove(photo)}
                      >
                        <Trash2 />
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <GalleryPhotoDialog
        target={dialog}
        nextSortOrder={nextSortOrder}
        onClose={() => setDialog(null)}
        onSaved={merge}
      />
    </div>
  );
};

export default GalleryPage;
