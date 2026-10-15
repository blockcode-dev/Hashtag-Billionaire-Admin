/** @format */

import { useEffect, useState } from "react";

// Everything the panel keeps about the signed-in admin lives here, so sign-in,
// sign-out and the 401 handler all touch the same keys.

const TOKEN_KEY = "token";
const ADMIN_ID_KEY = "admin_id";
const ROLE_ID_KEY = "role_id";
const ROLE_NAME_KEY = "admin_role";
// Written by older builds; cleared on sign-out so nothing stale is left behind.
const LEGACY_KEYS = ["isAdmin"];

const SESSION_EVENT = "admin-session-change";

export const SUPER_ADMIN_ROLE = "Super Admin";

const notify = () => window.dispatchEvent(new Event(SESSION_EVENT));

export const getToken = (): string | null => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || token === "undefined" || token === "null") return null;
  return token;
};

export const setToken = (token: string) => {
  localStorage.setItem(TOKEN_KEY, token);
};

export const startSession = (data: {
  token: string;
  id?: number | string | null;
  role_id?: number | string | null;
}) => {
  setToken(data.token);
  if (data.id != null) localStorage.setItem(ADMIN_ID_KEY, String(data.id));
  if (data.role_id != null) localStorage.setItem(ROLE_ID_KEY, String(data.role_id));
  notify();
};

export const clearSession = () => {
  [TOKEN_KEY, ADMIN_ID_KEY, ROLE_ID_KEY, ROLE_NAME_KEY, ...LEGACY_KEYS].forEach(
    (key) => localStorage.removeItem(key),
  );
  sessionStorage.clear();
  notify();
};

export const getAdminId = () => localStorage.getItem(ADMIN_ID_KEY);

// Stored from GET /admin/auth/getProfile (admin_role.name). The backend re-checks
// the role on every request; this copy only decides what the UI shows.
export const setRoleName = (name: string | null | undefined) => {
  if (name) localStorage.setItem(ROLE_NAME_KEY, name);
  else localStorage.removeItem(ROLE_NAME_KEY);
  notify();
};

export const getRoleName = () => localStorage.getItem(ROLE_NAME_KEY);

export const isSuperAdmin = () => getRoleName() === SUPER_ADMIN_ROLE;

// Re-renders when the session changes in this tab or another one.
export const useSession = () => {
  const read = () => ({
    roleName: getRoleName(),
    isSuperAdmin: isSuperAdmin(),
    adminId: getAdminId(),
  });
  const [session, setSession] = useState(read);

  useEffect(() => {
    const update = () => setSession(read());
    window.addEventListener(SESSION_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(SESSION_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return session;
};

// Same rule as the backend (helpers/validatePassword.js): 8 to 100 characters,
// at least 2 digits, no spaces, and not one of two blocked values. Returns an
// error message, or null when it passes.
const BLOCKED_PASSWORDS = ["Passw0rd", "Password123"];

export const checkPasswordRule = (password: string): string | null => {
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 100) return "Password must be 100 characters or fewer.";
  if ((password.match(/\d/g) || []).length < 2)
    return "Password must contain at least 2 digits.";
  if (/\s/.test(password)) return "Password must not contain spaces.";
  if (BLOCKED_PASSWORDS.includes(password)) return "This password is too common. Choose another.";
  return null;
};

export const PASSWORD_RULE_HINT =
  "At least 8 characters, including at least 2 digits, and no spaces.";
