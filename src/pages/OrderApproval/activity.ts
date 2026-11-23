import { getAdminId } from "@/lib/session";
import type { ApprovalEvent, ApprovalView } from "@/services/Api/ApprovalApi";
import { count, eventLineName, imageNumber } from "./format";

// The Activity tab: the approval's events told as plain sentences, newest first. Steps that
// happen together read as one: a Send's new versions and its email, several images added at
// once, an "Approve all".

export type ActivityWho = "customer" | "team" | "store";

export interface ActivityEntry {
  // The newest event in it: its key, its time and the device it came from.
  event: ApprovalEvent;
  // Every event in it, for the "New" marker.
  ids: number[];
  // The items it's about, for the item filter.
  lineIds: number[];
  who: ActivityWho;
  text: string;
  // Words someone typed: the team's message or the customer's note.
  quote?: string | null;
  // One line per item, e.g. what a Send sent.
  details?: string[];
  // A smaller line under it, e.g. why an email failed.
  extra?: string | null;
  // The customer took it back or removed it later.
  crossedOut?: boolean;
  tone?: "good" | "attention" | "problem";
}

const whoOf = (event: ApprovalEvent): ActivityWho =>
  event.actor === "CUSTOMER" ? "customer" : event.actor === "SYSTEM" ? "store" : "team";

const isEmail = (event: ApprovalEvent | undefined) => event?.type === "EMAIL_SENT" || event?.type === "EMAIL_FAILED";

const sum = (numbers: number[]) => numbers.reduce((total, n) => total + n, 0);

export function buildActivity(view: ApprovalView): ActivityEntry[] {
  const me = getAdminId();
  const events = [...view.history].sort((a, b) => a.id - b.id);
  const entries: ActivityEntry[] = [];

  // "You" for the admin signed in here, otherwise their name.
  const subject = (event: ApprovalEvent) => {
    if (event.actor === "CUSTOMER") return "The customer";
    if (event.actor === "SYSTEM") return "The store";
    if (event.admin && me !== null && String(event.admin.id) === me) return "You";
    return event.admin?.name || "Someone on the team";
  };
  const item = (event: ApprovalEvent) => eventLineName(event, view) ?? "an item";
  const lineOf = (event: ApprovalEvent) => view.lines.find((line) => line.id === event.line_id);
  const filesIn = (event: ApprovalEvent) =>
    lineOf(event)?.versions.find((v) => v.version === event.version)?.files.length ?? 0;
  const sameAdmin = (a: ApprovalEvent, b: ApprovalEvent) =>
    a.actor === b.actor && (a.admin?.id ?? null) === (b.admin?.id ?? null);

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const who = subject(event);
    // This event and the ones right after it that `same` accepts.
    const run = (same: (next: ApprovalEvent) => boolean) => {
      const group = [event];
      while (i + 1 < events.length && same(events[i + 1])) group.push(events[++i]);
      return group;
    };
    const add = (group: ApprovalEvent[], entry: Omit<ActivityEntry, "event" | "ids" | "lineIds" | "who">) =>
      entries.push({
        event: group[group.length - 1],
        ids: group.map((e) => e.id),
        lineIds: [...new Set(group.flatMap((e) => (e.line_id === null ? [] : [e.line_id])))],
        who: whoOf(event),
        ...entry,
      });

    switch (event.type) {
      case "APPROVAL_STARTED":
        add([event], { text: `${who} started artwork approval` });
        break;

      case "PROOF_ADDED": {
        const group = run((next) => next.type === event.type && next.line_id === event.line_id && sameAdmin(next, event));
        add(group, { text: `${who} added ${count(group.length, "artwork preview")} to ${item(event)}` });
        break;
      }

      case "PROOF_REMOVED": {
        const group = run((next) => next.type === event.type && next.line_id === event.line_id && sameAdmin(next, event));
        add(group, {
          text: `${who} removed ${count(group.length, "artwork preview")} from ${item(event)} before sending ${group.length === 1 ? "it" : "them"}`,
        });
        break;
      }

      case "PROOF_COPIED": {
        const group = run(
          (next) =>
            next.type === event.type &&
            next.line_id === event.line_id &&
            next.version === event.version &&
            sameAdmin(next, event),
        );
        add(group, {
          text: `${who} reused ${count(group.length, "image")} from Version ${event.version} of ${item(event)} for the next version`,
        });
        break;
      }

      case "NO_PROOF_SET":
        add([event], { text: `${who} marked ${item(event)} as “No preview needed”` });
        break;

      case "NO_PROOF_CLEARED":
        add([event], { text: `${who} switched off “No preview needed” for ${item(event)}` });
        break;

      case "VERSION_SENT": {
        // One Send: a new version for each item that had previews ready, then the email.
        const group = run((next) => next.type === event.type && sameAdmin(next, event));
        const email = isEmail(events[i + 1]) && sameAdmin(events[i + 1], event) ? events[++i] : null;
        const previews = count(sum(group.map(filesIn)) || group.length, "artwork preview");
        const to = email?.meta?.to || "the customer";
        const failed = email?.type === "EMAIL_FAILED";
        add(email ? [...group, email] : group, {
          text: failed
            ? `${who} sent ${previews}, but the email to ${to} didn't go out`
            : email
              ? `${who} sent ${previews} to ${to}`
              : `${who} sent ${previews}`,
          details: group.map((e) => `${item(e)}: Version ${e.version}`),
          quote: event.body,
          extra: failed ? emailError(email) : null,
          tone: failed ? "problem" : undefined,
        });
        break;
      }

      case "EMAIL_SENT":
      case "EMAIL_FAILED": {
        // An email without new versions: a reminder, or the same link again.
        const to = event.meta?.to || "the customer";
        if (event.type === "EMAIL_FAILED") {
          add([event], { text: `An email to ${to} didn't go out`, extra: emailError(event), tone: "problem" });
        } else {
          add([event], {
            text:
              event.meta?.kind === "reminder"
                ? `${who} emailed ${to} a reminder to check their artwork`
                : `${who} emailed ${to} the link to check their artwork`,
            quote: event.body,
          });
        }
        break;
      }

      case "LINK_REPLACED":
        add([event], { text: `${who} replaced the customer link, so the old link doesn't open any more` });
        break;

      case "LINK_DISABLED":
        add([event], { text: `${who} switched the customer link off` });
        break;

      case "LINK_ENABLED":
        add([event], { text: `${who} switched the customer link back on` });
        break;

      case "HOLD_PENDING":
        add([event], {
          text: "The order was paid with customized items, so the shipping label waited for your decision",
        });
        break;

      case "HOLD_SET":
        add([event], {
          text:
            event.meta?.hold_state === "HOLD"
              ? `${who} chose to buy the shipping label only after the artwork is approved`
              : event.meta?.reason === "label"
                ? `${who} let the shipping label go ahead by buying it`
                : event.meta?.reason === "lock"
                  ? `${who} let the shipping label go ahead by locking for production`
                  : `${who} let the shipping label go ahead without waiting for the artwork approval`,
        });
        break;

      case "LOCKED":
        add([event], {
          text:
            event.meta?.reason === "label"
              ? `${who} bought the shipping label, which locked the order for production`
              : `${who} locked the order for production`,
        });
        break;

      case "UNLOCKED":
        add([event], { text: `${who} unlocked the order, so the customer can make changes again` });
        break;

      case "APPROVED": {
        if (event.batch_id) {
          const group = run((next) => next.type === event.type && next.batch_id === event.batch_id);
          add(group, {
            text: `The customer approved ${count(group.length, "item")} at once with “Approve all”`,
            details: group.map((e) => `${item(e)}: Version ${e.version}${e.undone ? " (taken back later)" : ""}`),
            crossedOut: group.every((e) => e.undone),
            tone: "good",
          });
        } else {
          add([event], {
            text: `The customer approved Version ${event.version} of ${item(event)}`,
            extra: event.undone ? "Taken back later" : null,
            crossedOut: event.undone,
            tone: "good",
          });
        }
        break;
      }

      case "APPROVAL_UNDONE": {
        if (event.batch_id) {
          const group = run((next) => next.type === event.type && next.batch_id === event.batch_id);
          add(group, {
            text: `The customer took back “Approve all” for ${count(group.length, "item")}`,
            details: group.map((e) => item(e)),
          });
        } else {
          const target = view.history.find((e) => e.id === event.target_event_id);
          add([event], {
            text: `The customer took back their approval${target?.version ? ` of Version ${target.version}` : ""} of ${item(event)}`,
          });
        }
        break;
      }

      case "NOTE_ADDED": {
        const line = lineOf(event);
        const note = line?.notes.find((n) => n.event_id === event.id);
        const image = line && note ? imageNumber(line, note.version, note.file_id) : null;
        const photos = note?.pictures.length ?? 0;
        const on = event.version ? `Version ${event.version} of ${item(event)}` : item(event);
        add([event], {
          text: note?.after_approval ? `The customer left a note on ${on}` : `The customer asked for changes to ${on}`,
          quote: event.body,
          extra:
            [image && `About image ${image}`, photos && `with ${count(photos, "photo")}`, note?.removed && "Removed by the customer later"]
              .filter(Boolean)
              .join(" · ") || null,
          crossedOut: note?.removed,
          tone: note?.after_approval ? undefined : "attention",
        });
        break;
      }

      case "NOTE_REMOVED":
        add([event], { text: `The customer removed their note on ${item(event)}` });
        break;

      case "NOTE_RESTORED":
        add([event], { text: `The customer brought back their note on ${item(event)}` });
        break;

      default:
        add([event], { text: `${who}: ${String(event.type).toLowerCase().replace(/_/g, " ")}` });
    }
  }

  return entries.reverse();
}

const emailError = (event: ApprovalEvent) =>
  event.meta?.error ? `The mail server said: ${event.meta.error.replace(/[\s.]+$/, "")}.` : null;
