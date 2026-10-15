/** @format */

// Turns already-uploaded images (by URL) back into File objects so they can
// be re-uploaded with a new product. Used by Duplicate Product.
//
// Why re-upload instead of pointing the copy at the same file: if the copy
// shared the original's file on disk, deleting either product could delete
// the other's image. Re-uploading gives the copy its own file.
//
// Requires the image host to send CORS headers (Access-Control-Allow-Origin)
// for the admin panel's origin. Images that can't be fetched are skipped and
// reported as `failed` instead of breaking the whole save.

export interface ImageRef {
  id: number;
  file_uri?: string | null;
  file_name?: string | null;
}

const API_BASE_URL: string =
  import.meta.env.VITE_API_BASE_URL ||
  "https://node.hashtagbillionaire.com/api/v1/";

// Where uploaded images live. Override with VITE_IMAGE_BASE_URL if images
// are served from a different host than the API.
const IMAGE_ORIGIN: string = (
  import.meta.env.VITE_IMAGE_BASE_URL || new URL(API_BASE_URL).origin
).replace(/\/+$/, "");

// Always returns an absolute URL (or "" if there's nothing to go on).
// A relative file_uri would otherwise be resolved against the admin app
// itself (localhost:8080/...): the <img> shows broken, and fetch() gets
// the app's index.html back with status 200 instead of the image.
export function resolveImageUrl(img: {
  file_uri?: string | null;
  file_name?: string | null;
}): string {
  const uri = (img.file_uri || "").trim();

  if (/^https?:\/\//i.test(uri)) return uri;
  if (uri.startsWith("//")) return `https:${uri}`;
  if (uri) {
    const path = uri.replace(/^\/+/, "");
    // Bare file name → it lives in /images like every other upload.
    return path.includes("/")
      ? `${IMAGE_ORIGIN}/${path}`
      : `${IMAGE_ORIGIN}/images/${path}`;
  }
  if (img.file_name) return `${IMAGE_ORIGIN}/images/${img.file_name}`;
  return "";
}

const EXTENSION_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
  "image/avif": "avif",
};

export async function fileFromUrl(
  url: string,
  fallbackName: string,
): Promise<File> {
  // no-store: a copy the browser cached from a plain <img> tag (loaded
  // without CORS) can otherwise be reused here and fail the CORS check.
  const res = await fetch(url, { mode: "cors", cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const blob = await res.blob();

  // Never upload something that isn't an image (e.g. an HTML error page or
  // the app shell) — it would be saved as a broken "image" on the copy.
  if (!blob.type.startsWith("image/")) {
    throw new Error(`Not an image (${blob.type || "unknown type"}): ${url}`);
  }

  const nameFromUrl = decodeURIComponent(
    url.split("/").pop()?.split("?")[0] || "",
  );
  const hasExtension = /\.[a-z0-9]{2,5}$/i.test(nameFromUrl);
  const ext = EXTENSION_BY_TYPE[blob.type] || "jpg";
  const name = nameFromUrl
    ? hasExtension
      ? nameFromUrl
      : `${nameFromUrl}.${ext}`
    : `${fallbackName}.${ext}`;

  return new File([blob], name, { type: blob.type });
}

// Keeps the original order (so the first image stays primary) and never
// throws — images that can't be fetched are counted, not fatal.
export async function filesFromImages(
  images: ImageRef[],
): Promise<{ files: File[]; failed: number }> {
  const results = await Promise.allSettled(
    images.map((img, i) =>
      fileFromUrl(
        resolveImageUrl(img),
        img.file_name || `image-${img.id || i + 1}`,
      ),
    ),
  );

  const files: File[] = [];
  let failed = 0;
  results.forEach((r) => {
    if (r.status === "fulfilled") {
      files.push(r.value);
    } else {
      failed += 1;
      console.warn("Image copy failed:", r.reason);
    }
  });

  return { files, failed };
}