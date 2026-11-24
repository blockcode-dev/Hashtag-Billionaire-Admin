import { IMAGE_BASE_URL } from "@/config/env";
import { plainText } from "@/pages/Dashboard/format";
import type { ApprovalEvent, ApprovalLine, ApprovalView, EmailKind } from "@/services/Api/ApprovalApi";

// "Sport-Tek Tee (Black)": one product can be on two lines, in different colours. Product names
// arrive with HTML entities (&#174;), decoded as plain text.
export const lineName = (line: ApprovalLine) => {
  const title = plainText(line.title);
  return line.detail.color ? `${title} (${line.detail.color})` : title;
};

// The line an event is about, or its stored title when the line isn't on the page.
export const eventLineName = (event: ApprovalEvent, view: ApprovalView) => {
  const line = view.lines.find((candidate) => candidate.id === event.line_id);
  return line ? lineName(line) : event.line_title ? plainText(event.line_title) : null;
};

// Times here are the store's (US Central) with the zone written out, so everyone on the team
// quotes the same time: "Nov 21, 2:05 PM CT". The customer's page shows their own time zone.
const STORE_TIME_ZONE = "America/Chicago";
const parts = { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" } as const;
const sameYear = new Intl.DateTimeFormat("en-US", { timeZone: STORE_TIME_ZONE, ...parts });
const otherYear = new Intl.DateTimeFormat("en-US", { timeZone: STORE_TIME_ZONE, year: "numeric", ...parts });
const yearOf = new Intl.DateTimeFormat("en-US", { timeZone: STORE_TIME_ZONE, year: "numeric" });

export const centralTime = (iso: string | null | undefined) => {
  if (!iso) return "—";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const format = yearOf.format(date) === yearOf.format(new Date()) ? sameYear : otherYear;
  return `${format.format(date)} CT`;
};

// File links arrive as full URLs; a bare path is resolved against the file host, as on the
// Orders page.
export const fileUrl = (path: string | null | undefined) => {
  if (!path) return null;
  if (/^(https?:)?\/\//i.test(path)) return path;
  try {
    return new URL(path, IMAGE_BASE_URL).toString();
  } catch {
    return path;
  }
};

// The customer's own artwork can be any format they ordered with; AI, EPS or PDF don't show
// in an <img>.
export const isDisplayable = (url: string) => {
  const name = url.split(/[?#]/)[0].split("/").pop() ?? "";
  return !name.includes(".") || /\.(jpe?g|png|gif|webp|avif|svg)$/i.test(name);
};

export const fileSize = (bytes: number) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;

// "1 artwork preview", "3 artwork previews".
export const count = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// "Polo", "Polo and Tumbler", "Polo, Tumbler and Hoodie".
export const listNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

// Print methods and locations come as codes: SCREEN_PRINT → Screen Print, FRONT → Front.
// Short codes are acronyms (DTG, DTF) and stay as they are.
export const codeLabel = (code: string) =>
  /^[A-Z0-9_]+$/.test(code) && code.length > 3
    ? code
        .toLowerCase()
        .split("_")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ")
    : code;

// "iPhone · Safari", from a customer event's user agent.
export const deviceOf = (userAgent: string | null) => {
  if (!userAgent) return null;
  const device = /iPhone/.test(userAgent)
    ? "iPhone"
    : /iPad/.test(userAgent)
      ? "iPad"
      : /Android/.test(userAgent)
        ? "Android"
        : /Windows/.test(userAgent)
          ? "Windows"
          : /Macintosh|Mac OS X/.test(userAgent)
            ? "Mac"
            : null;
  const browser = /Edg\//.test(userAgent)
    ? "Edge"
    : /Firefox\/|FxiOS/.test(userAgent)
      ? "Firefox"
      : /Chrome\/|CriOS/.test(userAgent)
        ? "Chrome"
        : /Safari\//.test(userAgent)
          ? "Safari"
          : null;
  return [device, browser].filter(Boolean).join(" · ") || null;
};

// The versions newer than k, up to the newest c, which going back to Version k rejected:
// "Version 2", "Versions 2 and 3", "Versions 2 to 4".
export const newerVersions = (k: number, c: number) =>
  c - k <= 1 ? `Version ${k + 1}` : c - k === 2 ? `Versions ${k + 1} and ${c}` : `Versions ${k + 1} to ${c}`;

// The subject the customer gets for each kind of email (the backend's templates/approvals.js).
export const emailSubject = (kind: EmailKind, orderNumber: string) =>
  kind === "first"
    ? `Your artwork for order ${orderNumber} is ready to review`
    : kind === "updated"
      ? `Updated artwork for order ${orderNumber} is ready to review`
      : `Reminder: your artwork for order ${orderNumber} is waiting for your approval`;
