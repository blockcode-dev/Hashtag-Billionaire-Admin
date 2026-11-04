/** @format */

import axios from "axios";
import { toast } from "sonner";
import { SUPER_ADMIN_ROLE, getRoleName } from "@/lib/session";

// The backend's message for a failed call. Deliberate errors carry one written for people,
// including the 502 and 503 about suppliers and ShipStation.
export const apiErrorMessage = (err: unknown, fallback: string): string =>
  (axios.isAxiosError(err) && err.response?.data?.message) || fallback;

// 503 "<Label> isn't set up yet. An admin can set it in Settings, under <Group>."
const needsSetting = (err: unknown) =>
  axios.isAxiosError(err) &&
  err.response?.status === 503 &&
  String(err.response.data?.message).includes("in Settings");

// Shows a failed call. Settings is a Super Admin screen, so only they get the way there.
export const toastApiError = (title: string, err: unknown, fallback = "Try again in a moment.") => {
  toast.error(title, {
    description: apiErrorMessage(err, fallback),
    action:
      needsSetting(err) && getRoleName() === SUPER_ADMIN_ROLE
        ? { label: "Open Settings", onClick: () => window.location.assign("/settings") }
        : undefined,
  });
};
