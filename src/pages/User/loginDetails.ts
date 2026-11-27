/** @format */

import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/api-errors";
import { SendLoginDetailsAPI } from "@/services/Api/UserApi";

// A client's login details, after Add User, the CSV import or Set password. The password is stored
// one-way, so these screens are the only place it's ever shown: the admin copies it, or has it
// emailed (from support@, with a link to sign in).

export const copyText = async (text: string, what: string) => {
  try {
    await navigator.clipboard.writeText(text);
    toast.success(`${what} copied`);
  } catch {
    toast.error("Couldn't copy it. Select the text and copy it by hand.");
  }
};

export interface ClientLogin {
  name?: string | null;
  email: string;
  password: string;
  // The website's sign-in page; null when the backend doesn't know the website's address.
  signInUrl?: string | null;
}

const hostOf = (url?: string | null) => {
  try {
    return url ? new URL(url).host.replace(/^www\./, "") : null;
  } catch {
    return null;
  }
};

// The details as a message to paste into a chat or a text.
export const loginMessage = ({ name, email, password, signInUrl }: ClientLogin) => {
  const first = name?.trim().split(/\s+/)[0];
  const host = hostOf(signInUrl);
  return [
    `Hi${first ? ` ${first}` : ""}, your account${host ? ` on ${host}` : ""} is ready.`,
    signInUrl ? `Sign in: ${signInUrl}` : null,
    `Email: ${email}`,
    `Password: ${password}`,
    "Please change the password after you sign in (My Account › Change Password).",
  ]
    .filter(Boolean)
    .join("\n");
};

export type SendState =
  | { status: "idle" }
  | { status: "sending" }
  | { status: "sent"; at: Date }
  | { status: "failed"; error: string };

// Emails one client their email and this password.
export const sendLoginDetails = async (clientId: number, password: string): Promise<SendState> => {
  try {
    await SendLoginDetailsAPI(clientId, password);
    return { status: "sent", at: new Date() };
  } catch (err) {
    return { status: "failed", error: apiErrorMessage(err, "Check your connection and try again.") };
  }
};

// 8325550123 → (832) 555-0123; anything else as it is, or null when empty.
export const formatPhone = (value?: string | null) => {
  const digits = String(value ?? "").replace(/\D/g, "");
  return digits.length === 10 ? `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}` : value || null;
};

export const sentTime = (at: Date) => at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
