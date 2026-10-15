// What the backend accepts for image uploads (hashtag-backend, src/config/multer.js).
// A request that breaks any of these is rejected as a whole, so the panel checks
// them before sending instead of losing everything else on the form.

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "avif", "gif"];

// For <input accept>. Leaves out formats phones often produce (HEIC) and SVG,
// which the backend refuses.
export const IMAGE_ACCEPT = IMAGE_EXTENSIONS.map((ext) => `.${ext}`).join(",");

export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

// Per save request: `images` and `variant_images` are capped separately.
export const MAX_PRODUCT_IMAGES_PER_SAVE = 10;
export const MAX_VARIANT_IMAGES_PER_SAVE = 20;

const extensionOf = (name: string) => name.split(".").pop()?.toLowerCase() ?? "";

// Splits picked files into the ones the backend will take and a message about the rest.
export function checkImageFiles(files: File[]): { accepted: File[]; error: string | null } {
  const accepted: File[] = [];
  const wrongType: string[] = [];
  const tooBig: string[] = [];

  for (const file of files) {
    if (!IMAGE_EXTENSIONS.includes(extensionOf(file.name)) || !file.type.startsWith("image/")) {
      wrongType.push(file.name);
    } else if (file.size > MAX_IMAGE_BYTES) {
      tooBig.push(file.name);
    } else {
      accepted.push(file);
    }
  }

  const problems: string[] = [];
  if (wrongType.length) {
    problems.push(`${listNames(wrongType)} ${wrongType.length === 1 ? "isn't" : "aren't"} JPG, PNG, WebP, AVIF or GIF`);
  }
  if (tooBig.length) {
    problems.push(`${listNames(tooBig)} ${tooBig.length === 1 ? "is" : "are"} over 20 MB`);
  }

  return {
    accepted,
    error: problems.length ? `Skipped: ${problems.join("; ")}.` : null,
  };
}

// Message for a save that would send more files than the backend takes, or null.
export function checkUploadCounts(productImages: number, variantImages: number): string | null {
  if (productImages > MAX_PRODUCT_IMAGES_PER_SAVE) {
    return `You can add up to ${MAX_PRODUCT_IMAGES_PER_SAVE} product images per save (you have ${productImages} new). Save, then add the rest.`;
  }
  if (variantImages > MAX_VARIANT_IMAGES_PER_SAVE) {
    return `You can add up to ${MAX_VARIANT_IMAGES_PER_SAVE} variant images per save, across all variants (you have ${variantImages} new). Save, then add the rest.`;
  }
  return null;
}

const listNames = (names: string[]) =>
  names.length <= 2 ? names.join(" and ") : `${names.slice(0, 2).join(", ")} and ${names.length - 2} more`;
