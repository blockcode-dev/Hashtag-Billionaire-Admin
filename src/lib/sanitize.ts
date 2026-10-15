import DOMPurify from "dompurify";

// Product descriptions and supplier fields are stored exactly as received (the
// backend doesn't sanitise HTML), so clean them before rendering: no scripts,
// event handlers or javascript: URLs, and no tags that could restyle the panel
// or put a form on the page.
const OPTIONS = {
  FORBID_TAGS: ["style", "form", "input", "button", "textarea", "select"],
};

export const sanitizeHtml = (html: unknown): string =>
  typeof html === "string" && html ? DOMPurify.sanitize(html, OPTIONS) : "";
