import { useState, type CSSProperties } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "cn";

interface ThumbnailProps {
  src?: string | null;
  alt?: string;
  // Square size in px. Leave out to fill the parent element.
  size?: number;
  fit?: "cover" | "contain";
  className?: string;
  style?: CSSProperties;
}

// Image that shows a neutral placeholder when the image is missing or fails
// to load, instead of the browser's broken-image icon and clipped alt text.
export function Thumbnail({ src, alt = "", size, fit = "cover", className, style }: ThumbnailProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const failed = !src || failedSrc === src;
  const box: CSSProperties = size ? { width: size, height: size, ...style } : { ...style };
  const fill = size ? "" : "size-full";

  if (failed) {
    return (
      <span
        role={alt ? "img" : undefined}
        aria-label={alt || undefined}
        className={cn("flex shrink-0 items-center justify-center rounded-md bg-muted text-placeholder", fill, className)}
        style={box}
      >
        <ImageOff className="size-[45%] max-h-6 max-w-6" aria-hidden />
      </span>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setFailedSrc(src)}
      className={cn("shrink-0 rounded-md", fit === "contain" ? "object-contain" : "object-cover", fill, className)}
      style={box}
    />
  );
}
