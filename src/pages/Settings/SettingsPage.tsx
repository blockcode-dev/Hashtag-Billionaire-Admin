/** @format */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useNavigate } from "react-router";
import {
  ChevronDown,
  Info,
  KeyRound,
  Mail,
  RefreshCw,
  RotateCcw,
  TriangleAlert,
  Undo2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { confirm } from "@/components/common/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";
import { PageHeader } from "@/components/common/PageHeader";
import { Spinner } from "@/components/common/Spinner";
import { StatusTag } from "@/components/common/StatusTag";
import { getAdminId } from "@/lib/session";
import {
  GetSettingsAPI,
  SaveSettingsAPI,
  SendSettingsTestEmailAPI,
  UnlockSettingsAPI,
  type Setting,
  type SettingsPage as SettingsData,
} from "@/services/Api/SettingsApi";
import { SettingControl } from "./SettingControl";
import { SettingsKeyDialog } from "./SettingsKeyDialog";

// The site's master controls (hashtag-backend docs/admin-settings.md). The settings are
// stored once on the server, so every Super Admin works on the same values; this page
// re-checks them while it's open and names who changed what. Revealing and saving take
// the settings key. The key and the revealed values stay in this page's state only.

// Edit mode ends after this long without activity, dropping the revealed values.
const IDLE_LIMIT_MS = 10 * 60 * 1000;
const IDLE_WARNING_MS = 60 * 1000;
// How often the page checks for changes other admins saved.
const SYNC_EVERY_MS = 60 * 1000;
const SYNC_MIN_GAP_MS = 15 * 1000;

const HEX = /^#[0-9a-f]{6}$/i;

interface EditState {
  // The page from the unlock answer, every value in full.
  snapshot: SettingsData;
  // The text of every field the admin touched, by setting key.
  drafts: Record<string, string>;
  // From a 400 answer, by setting key.
  errors: Record<string, string>;
  startedAt: number;
}

interface RemoteChange {
  key: string;
  label: string;
  by: { id: number; name: string | null } | null;
}

const allSettings = (page: SettingsData) => page.groups.flatMap((group) => group.settings);

// What a save would send: new text, or null to go back to .env or the default. An
// emptied field only resets a value saved here; there's nothing to clear otherwise.
const changesOf = (edit: EditState) => {
  const changes: Record<string, string | null> = {};
  for (const setting of allSettings(edit.snapshot)) {
    const text = edit.drafts[setting.key];
    if (text === undefined || text === (setting.value ?? "")) continue;
    if (text !== "") changes[setting.key] = text;
    else if (setting.source === "admin") changes[setting.key] = null;
  }
  return changes;
};

// Settings that changed between two loads of the page. Secrets are compared by when
// they were saved, since one side may be masked.
const changesBetween = (before: SettingsData | null, after: SettingsData): RemoteChange[] => {
  if (!before) return [];
  const old = new Map(allSettings(before).map((setting) => [setting.key, setting]));
  return allSettings(after).flatMap((setting) => {
    const was = old.get(setting.key);
    if (!was) return [];
    const changed =
      was.updated_at !== setting.updated_at ||
      was.source !== setting.source ||
      (!setting.secret && was.value !== setting.value);
    return changed ? [{ key: setting.key, label: setting.label, by: setting.updated_by }] : [];
  });
};

const listLabels = (labels: string[]) =>
  labels.length <= 3 ? labels.join(", ") : `${labels.slice(0, 3).join(", ")} and ${labels.length - 3} more`;

const whoChanged = (changes: RemoteChange[]) => {
  const names = [...new Set(changes.map((change) => change.by?.name).filter(Boolean))] as string[];
  return names.length ? names.join(" and ") : "Another admin";
};

const formatWhen = (value: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const errorMessage = (err: any) => err?.response?.data?.message || "Try again in a moment.";

const TONES = {
  info: "border-info-border bg-info-soft text-info-soft-foreground",
  warning: "border-warning-border bg-warning-soft text-warning-soft-foreground",
  danger: "border-destructive-border bg-destructive-soft text-destructive-soft-foreground",
};

function Banner({ tone, icon, children }: { tone: keyof typeof TONES; icon: ReactNode; children: ReactNode }) {
  return (
    <div role="status" className={cn("flex gap-3 rounded-lg border px-4 py-3 text-sm", TONES[tone])}>
      <span className="mt-0.5 shrink-0 [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 space-y-1">{children}</div>
    </div>
  );
}

function SourceBadge({ setting }: { setting: Setting }) {
  switch (setting.source) {
    case "admin":
      return <StatusTag color="green">Set here</StatusTag>;
    case "env":
      return <StatusTag color="blue">From .env</StatusTag>;
    case "default":
      return <StatusTag>Default</StatusTag>;
    default:
      return <StatusTag color={setting.required ? "red" : "default"}>Not set</StatusTag>;
  }
}

function ReadValue({ setting }: { setting: Setting }) {
  if (setting.value == null) return <span className="text-sm text-muted-foreground">—</span>;
  if (setting.type === "boolean") return <span className="text-sm">{setting.value === "true" ? "On" : "Off"}</span>;
  if (setting.type === "color" && HEX.test(setting.value)) {
    return (
      <span className="inline-flex items-center gap-2 font-mono text-sm">
        <span className="size-4 rounded border" style={{ background: setting.value }} aria-hidden />
        {setting.value}
      </span>
    );
  }
  return <span className={cn("text-sm break-all", setting.secret && "font-mono")}>{setting.value}</span>;
}

function ChangedBy({ setting }: { setting: Setting }) {
  if (setting.source !== "admin") return null;
  const when = formatWhen(setting.updated_at);
  return (
    <p className="text-xs text-muted-foreground">
      Changed by {setting.updated_by?.name || "an admin"}
      {when ? ` on ${when}` : ""}
    </p>
  );
}

const SettingsPage = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState<SettingsData | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  // The load the page last finished, so loading and error follow from it.
  const [settled, setSettled] = useState<{ key: number; failed: boolean } | null>(null);
  const [edit, setEdit] = useState<EditState | null>(null);
  const [dialog, setDialog] = useState<"unlock" | "save" | null>(null);
  // Edit mode: settings other admins changed since this admin unlocked.
  const [remoteChanges, setRemoteChanges] = useState<RemoteChange[]>([]);
  const [idleWarning, setIdleWarning] = useState(false);
  const [checkingSave, setCheckingSave] = useState(false);
  const [testing, setTesting] = useState(false);
  const [envListOpen, setEnvListOpen] = useState(false);

  // Bumped whenever an answer replaces what's shown (unlock, save, leaving edit mode),
  // so a background check that started earlier can't overwrite it.
  const generation = useRef(0);
  const pageRef = useRef(page);
  const editRef = useRef(edit);
  useEffect(() => {
    pageRef.current = page;
    editRef.current = edit;
  });

  const loading = settled?.key !== reloadKey;

  useEffect(() => {
    let active = true;
    GetSettingsAPI()
      .then((res) => {
        if (!active) return;
        setPage(res.data.data);
        setSettled({ key: reloadKey, failed: false });
      })
      .catch(() => {
        if (active) setSettled({ key: reloadKey, failed: true });
      });
    return () => {
      active = false;
    };
  }, [reloadKey]);

  // Every Super Admin works on the same stored settings. While the page is open it checks
  // for changes others saved: reading mode shows them, edit mode lists them.
  useEffect(() => {
    let lastCheck = Date.now();
    const check = async () => {
      if (document.visibilityState !== "visible" || Date.now() - lastCheck < SYNC_MIN_GAP_MS) return;
      lastCheck = Date.now();
      const started = generation.current;
      try {
        const fresh = (await GetSettingsAPI()).data.data;
        if (started !== generation.current) return;
        const editing = editRef.current;
        if (editing) {
          setRemoteChanges(changesBetween(editing.snapshot, fresh));
          return;
        }
        const me = String(getAdminId());
        const byOthers = changesBetween(pageRef.current, fresh).filter((change) => String(change.by?.id) !== me);
        if (byOthers.length) {
          toast.info(`${whoChanged(byOthers)} changed settings`, {
            description: listLabels(byOthers.map((change) => change.label)),
          });
        }
        setPage(fresh);
      } catch {
        // Keep what's shown; the next check tries again.
      }
    };
    const timer = setInterval(check, SYNC_EVERY_MS);
    window.addEventListener("focus", check);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, []);

  // Leaves edit mode, dropping the revealed values and any changes, and shows the
  // masked page as it is now.
  const endEdit = useCallback(() => {
    generation.current++;
    setEdit(null);
    setRemoteChanges([]);
    setIdleWarning(false);
    setDialog(null);
    setReloadKey((k) => k + 1);
  }, []);

  // Edit mode ends after 10 minutes without activity, with a warning in the last minute.
  const startedAt = edit?.startedAt;
  useEffect(() => {
    if (!startedAt) return;
    let last = Date.now();
    const bump = () => {
      last = Date.now();
    };
    const events = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart"];
    events.forEach((name) => window.addEventListener(name, bump, { passive: true }));
    const timer = setInterval(() => {
      const idle = Date.now() - last;
      if (idle >= IDLE_LIMIT_MS) {
        const hadChanges = editRef.current ? Object.keys(changesOf(editRef.current)).length > 0 : false;
        endEdit();
        toast.info("Edit mode ended after 10 minutes without activity", {
          description: hadChanges ? "Your unsaved changes were dropped." : undefined,
        });
      } else {
        setIdleWarning(idle >= IDLE_LIMIT_MS - IDLE_WARNING_MS);
      }
    }, 5000);
    return () => {
      events.forEach((name) => window.removeEventListener(name, bump));
      clearInterval(timer);
    };
  }, [startedAt, endEdit]);

  const changes = edit ? changesOf(edit) : {};
  const changeCount = Object.keys(changes).length;
  const dirty = changeCount > 0;

  // Unsaved changes: ask before the tab closes or a menu link leaves the page.
  useEffect(() => {
    if (!dirty) return;
    const beforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const link = (e.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      const url = new URL(link.href, window.location.href);
      if (url.origin !== window.location.origin || url.pathname === window.location.pathname) return;
      e.preventDefault();
      e.stopPropagation();
      confirm({
        title: "Leave without saving?",
        content: "Your changes to the settings haven't been saved and will be lost.",
        okText: "Leave",
        okType: "danger",
        onOk: () => navigate(url.pathname + url.search + url.hash),
      });
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty, navigate]);

  const unlock = async (key: string) => {
    const res = await UnlockSettingsAPI(key);
    generation.current++;
    setEdit({ snapshot: res.data.data, drafts: {}, errors: {}, startedAt: Date.now() });
    setRemoteChanges([]);
    setIdleWarning(false);
    setDialog(null);
  };

  const cancelEdit = () => {
    if (!dirty) return endEdit();
    confirm({
      title: "Discard your changes?",
      content: "Nothing has been saved. Leaving edit mode drops your changes.",
      okText: "Discard",
      okType: "danger",
      onOk: endEdit,
    });
  };

  const setDraft = (setting: Setting, text: string) =>
    setEdit((current) => {
      if (!current) return current;
      const errors = { ...current.errors };
      delete errors[setting.key];
      return { ...current, drafts: { ...current.drafts, [setting.key]: text }, errors };
    });

  const undo = (setting: Setting) =>
    setEdit((current) => {
      if (!current) return current;
      const drafts = { ...current.drafts };
      const errors = { ...current.errors };
      delete drafts[setting.key];
      delete errors[setting.key];
      return { ...current, drafts, errors };
    });

  // Checks for changes other admins saved meanwhile, then asks for the key.
  const openSave = async () => {
    if (!edit || !dirty) return;
    setCheckingSave(true);
    try {
      const fresh = (await GetSettingsAPI()).data.data;
      setRemoteChanges(changesBetween(edit.snapshot, fresh));
    } catch {
      // The save itself doesn't depend on this check.
    } finally {
      setCheckingSave(false);
    }
    setDialog("save");
  };

  const save = async (key: string) => {
    if (!edit) return;
    try {
      const res = await SaveSettingsAPI(key, changesOf(edit));
      generation.current++;
      setPage(res.data.data);
      setEdit(null);
      setRemoteChanges([]);
      setIdleWarning(false);
      setDialog(null);
      toast.success(res.data.message || "Settings saved");
    } catch (err: any) {
      const errors = err?.response?.status === 400 ? err.response.data?.data?.errors : null;
      if (errors && typeof errors === "object") {
        setEdit((current) => (current ? { ...current, errors } : current));
        setDialog(null);
        toast.error(errorMessage(err));
        return;
      }
      // A wrong key or too many tries: shown in the dialog.
      throw err;
    }
  };

  const sendTestEmail = async () => {
    try {
      setTesting(true);
      const res = await SendSettingsTestEmailAPI();
      toast.success(res.data?.message || "Test email sent");
    } catch (err) {
      toast.error("The test email wasn't sent", { description: errorMessage(err) });
    } finally {
      setTesting(false);
    }
  };

  if (!page) {
    return loading ? (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    ) : (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-xl border px-6 py-12 text-center">
        <TriangleAlert className="size-8 text-destructive" aria-hidden />
        <div className="space-y-1">
          <p className="font-medium text-foreground">Couldn't load the settings</p>
          <p className="text-sm text-muted-foreground">The server returned an error. Try again in a moment.</p>
        </div>
        <Button variant="outline" onClick={() => setReloadKey((k) => k + 1)}>
          <RefreshCw />
          Try again
        </Button>
      </div>
    );
  }

  const shown = edit ? edit.snapshot : page;
  const labelOf = new Map(allSettings(shown).map((setting) => [setting.key, setting.label]));
  const missing = shown.missing_required.map((key) => labelOf.get(key) ?? key);
  const fromEnv = shown.from_env.map((key) => labelOf.get(key) ?? key);
  const conflicts = remoteChanges.filter((change) => change.key in changes);

  const readRow = (setting: Setting) => (
    <div key={setting.key} className="grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium text-foreground">{setting.label}</span>
        {setting.required && <StatusTag>Required</StatusTag>}
      </div>
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <ReadValue setting={setting} />
          <SourceBadge setting={setting} />
        </div>
        <ChangedBy setting={setting} />
        {setting.description && <p className="text-xs text-muted-foreground">{setting.description}</p>}
      </div>
    </div>
  );

  const editRow = (setting: Setting, current: EditState) => {
    const id = `setting-${setting.key}`;
    const draft = current.drafts[setting.key];
    const text = draft ?? setting.value ?? "";
    const changed = setting.key in changes;
    const resetting = changes[setting.key] === null;
    const error = current.errors[setting.key];
    // An emptied value from .env or the default stays in effect: say so.
    const keepsValue = draft === "" && setting.source !== "admin" && (setting.value ?? "") !== "";
    const describedBy = [error && `${id}-error`, setting.description && `${id}-help`].filter(Boolean).join(" ");

    return (
      <div
        key={setting.key}
        className={cn(
          "grid gap-2 px-5 py-4 sm:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] sm:gap-6",
          changed && "bg-primary-soft/50",
        )}
      >
        <div className="space-y-1.5">
          <Label htmlFor={id}>{setting.label}</Label>
          <div className="flex flex-wrap gap-1.5">
            {setting.required && <StatusTag>Required</StatusTag>}
            <SourceBadge setting={setting} />
            {changed && <StatusTag color="gold">{resetting ? "Will reset" : "Changed"}</StatusTag>}
          </div>
        </div>
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 sm:max-w-md">
              <SettingControl
                setting={setting}
                value={text}
                onChange={(value) => setDraft(setting, value)}
                id={id}
                invalid={!!error}
                describedBy={describedBy || undefined}
              />
            </div>
            {setting.source === "admin" && !resetting && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(setting, "")}>
                <RotateCcw />
                Reset
              </Button>
            )}
            {draft !== undefined && (
              <Button type="button" variant="ghost" size="sm" onClick={() => undo(setting)}>
                <Undo2 />
                Undo
              </Button>
            )}
          </div>
          {error && (
            <p id={`${id}-error`} role="alert" className="text-xs text-destructive">
              {setting.label} {error}
            </p>
          )}
          {resetting && (
            <p className="text-xs text-muted-foreground">
              Saving removes the value set here, so the server's .env value or the default applies again.
            </p>
          )}
          {keepsValue && (
            <p className="text-xs text-muted-foreground">
              Left empty, {setting.source === "env" ? "the value from .env" : "the default"} stays in effect.
            </p>
          )}
          <ChangedBy setting={setting} />
          {setting.description && (
            <p id={`${id}-help`} className="text-xs text-muted-foreground">
              {setting.description}
            </p>
          )}
        </div>
      </div>
    );
  };

  return (
    <div>
      <PageHeader
        title="Settings"
        description="Master controls for the whole site. They're stored once on the server, so every Super Admin sees and changes the same values, and changes apply without a restart."
        actions={
          edit ? (
            <StatusTag color="gold">Editing</StatusTag>
          ) : (
            <Button onClick={() => setDialog("unlock")}>
              <KeyRound />
              Edit settings
            </Button>
          )
        }
      />

      <div className="mb-6 space-y-3">
        {edit &&
          (idleWarning ? (
            <Banner tone="warning" icon={<TriangleAlert />}>
              <p>
                Edit mode ends in under a minute without activity.
                {dirty ? " Your unsaved changes will be lost." : ""}
              </p>
            </Banner>
          ) : (
            <Banner tone="info" icon={<KeyRound />}>
              <p>
                Edit mode: every value shows in full. It ends when you save, cancel or leave this page, or
                after 10 minutes without activity.
              </p>
            </Banner>
          ))}

        {edit && remoteChanges.length > 0 && (
          <Banner tone="warning" icon={<Users />}>
            <p>
              {whoChanged(remoteChanges)} changed {listLabels(remoteChanges.map((change) => change.label))} since you
              started editing. Saving sends only the settings you change.
            </p>
          </Banner>
        )}

        {missing.length > 0 && (
          <Banner tone="danger" icon={<TriangleAlert />}>
            <p>These need a value for the site to work fully: {missing.join(", ")}.</p>
          </Banner>
        )}

        {!edit && fromEnv.length > 0 && (
          <Banner tone="info" icon={<Info />}>
            <p>
              {fromEnv.length} {fromEnv.length === 1 ? "setting still comes" : "settings still come"} from the
              server's .env file. Saving them here moves them; the server's .env lines can then be removed.
            </p>
            <button
              type="button"
              className="inline-flex items-center gap-1 font-medium underline-offset-2 hover:underline"
              aria-expanded={envListOpen}
              onClick={() => setEnvListOpen((open) => !open)}
            >
              <ChevronDown className={cn("size-3.5 transition-transform", envListOpen && "rotate-180")} />
              {envListOpen ? "Hide the list" : "Show the list"}
            </button>
            {envListOpen && <p>{fromEnv.join(", ")}</p>}
          </Banner>
        )}
      </div>

      {shown.groups.length === 0 ? (
        <div className="rounded-xl border">
          <EmptyState description="The server sent no settings." />
        </div>
      ) : (
        shown.groups.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`group-${group.key}`}
            className="mb-6 overflow-hidden rounded-xl border bg-card shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b px-5 py-4">
              <h2 id={`group-${group.key}`} className="text-base font-semibold text-foreground">
                {group.label}
              </h2>
              {group.key === "email" && !edit && (
                <Button variant="outline" size="sm" onClick={sendTestEmail} disabled={testing}>
                  {testing ? <Spinner size="small" /> : <Mail />}
                  Send a test email
                </Button>
              )}
            </div>
            <div className="divide-y">
              {group.settings.map((setting) => (edit ? editRow(setting, edit) : readRow(setting)))}
            </div>
          </section>
        ))
      )}

      {edit && (
        <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center justify-between gap-3 border-t bg-background/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <p className="text-sm text-muted-foreground">
            {changeCount
              ? `${changeCount} ${changeCount === 1 ? "change" : "changes"} not saved yet`
              : "No changes yet"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={cancelEdit}>
              Cancel
            </Button>
            <Button onClick={openSave} disabled={!dirty || checkingSave}>
              {checkingSave && <Spinner size="small" className="text-current" />}
              Save changes
            </Button>
          </div>
        </div>
      )}

      <SettingsKeyDialog
        open={dialog === "unlock"}
        title="Edit settings"
        description="Enter the settings key to see every value in full and make changes."
        confirmLabel="Continue"
        onSubmit={unlock}
        onClose={() => setDialog(null)}
      />

      <SettingsKeyDialog
        open={dialog === "save"}
        title="Save settings"
        description="Enter the settings key again to save. Every Super Admin sees the new values straight away."
        confirmLabel="Save"
        onSubmit={save}
        onClose={() => setDialog(null)}
      >
        <div className="space-y-2">
          <p className="text-sm font-medium">
            {changeCount === 1 ? "This setting changes:" : `These ${changeCount} settings change:`}
          </p>
          <ul className="max-h-40 list-disc space-y-0.5 overflow-auto pl-5 text-sm">
            {Object.entries(changes).map(([key, value]) => (
              <li key={key}>
                {labelOf.get(key) ?? key}
                {value === null && <span className="text-muted-foreground"> (reset)</span>}
              </li>
            ))}
          </ul>
        </div>
        {conflicts.length > 0 && (
          <p
            role="alert"
            className="rounded-md border border-warning-border bg-warning-soft px-3 py-2 text-sm text-warning-soft-foreground"
          >
            {whoChanged(conflicts)} also changed {listLabels(conflicts.map((change) => change.label))} since you
            started editing. Saving replaces their values with yours.
          </p>
        )}
      </SettingsKeyDialog>
    </div>
  );
};

export default SettingsPage;
