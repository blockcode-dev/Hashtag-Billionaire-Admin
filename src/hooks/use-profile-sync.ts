import { useEffect } from "react";
import { GetAdminProfileAPI } from "@/services/Api/AuthApi";
import { getRoleName, getToken, setRoleName } from "@/lib/session";

// The role decides what the menu shows. It used to be read only at sign-in, so an
// admin made Super Admin (or no longer one) by another Super Admin saw the old menu
// until they signed in again. It's now re-read when the panel opens, when the window
// regains focus, and every few minutes. The backend checks the role on every request
// either way.

const MIN_GAP_MS = 60 * 1000;
const EVERY_MS = 5 * 60 * 1000;

let lastSync = 0;

const syncRole = async () => {
  if (!getToken() || Date.now() - lastSync < MIN_GAP_MS) return;
  lastSync = Date.now();
  try {
    const res = await GetAdminProfileAPI();
    const name = res.data?.data?.admin_role?.name ?? null;
    if (name !== getRoleName()) setRoleName(name);
  } catch {
    // A 401 signs out through the interceptor; anything else keeps the role as it was.
  }
};

export function useProfileSync() {
  useEffect(() => {
    syncRole();
    const onFocus = () => syncRole();
    window.addEventListener("focus", onFocus);
    const timer = setInterval(syncRole, EVERY_MS);
    return () => {
      window.removeEventListener("focus", onFocus);
      clearInterval(timer);
    };
  }, []);
}
