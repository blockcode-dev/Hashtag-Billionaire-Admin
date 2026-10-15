import { useState, type CSSProperties } from "react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "cn";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface ImagePreviewProps {
  src?: string | null;
  alt?: string;
  width?: number | string;
  height?: number | string;
  style?: CSSProperties;
  className?: string;
  // Shown when `src` is empty or fails to load.
  fallback?: string;
  // Click to open a larger view. Defaults to true.
  preview?: boolean;
  // Other images to page through in the larger view (includes `src`).
  gallery?: string[];
}

// Image that opens a larger view when clicked.
export function ImagePreview({
  src,
  alt = "",
  width,
  height,
  style,
  className,
  fallback,
  preview = true,
  gallery,
}: ImagePreviewProps) {
  const images = gallery?.length ? gallery : src ? [src] : [];
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);
  // Remember which image failed, so the next one (e.g. in a carousel) still loads.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !!src && failedSrc === src;
  const shown = !src || failed ? fallback : src;
  // Nothing to show: same placeholder as <Thumbnail>.
  if (!shown) {
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        className={cn("flex items-center justify-center rounded-md bg-muted text-placeholder", className)}
        style={{ width, height, ...style }}
      >
        <ImageOff className="size-6" aria-hidden />
      </span>
    );
  }

  const show = () => {
    if (!preview || !images.length) return;
    setIndex(Math.max(0, images.indexOf(src ?? "")));
    setOpen(true);
  };

  return (
    <>
      <img
        src={shown}
        alt={alt}
        width={width}
        height={height}
        style={style}
        loading="lazy"
        onError={() => src && setFailedSrc(src)}
        onClick={show}
        className={cn(preview && images.length && "cursor-zoom-in", className)}
      />
      {preview && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-4xl border-0 bg-transparent p-0 shadow-none">
            <DialogTitle className="sr-only">{alt || "Image preview"}</DialogTitle>
            <DialogDescription className="sr-only">
              Image {index + 1} of {images.length}
            </DialogDescription>
            <div className="relative flex items-center justify-center">
              <img src={images[index]} alt={alt} className="max-h-[80vh] max-w-full rounded-lg bg-white object-contain" />
              {images.length > 1 && (
                <>
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label="Previous image"
                    className="absolute left-2 rounded-full"
                    onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
                  >
                    <ChevronLeft />
                  </Button>
                  <Button
                    size="icon"
                    variant="secondary"
                    aria-label="Next image"
                    className="absolute right-2 rounded-full"
                    onClick={() => setIndex((i) => (i + 1) % images.length)}
                  >
                    <ChevronRight />
                  </Button>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}
