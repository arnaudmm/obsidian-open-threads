// The ```threads block: its options, which threads it lists, in what order,
// and the counts header. Pure.
import { daysBetween } from "./dates.ts";
import { followUpDue, isOpen, isOverdue, missingFollowUp, type Counts } from "./rules.ts";
import { personName, type ThreadRecord } from "./thread.ts";

export const ALL = "all";
export const VIEWS = ["open", "overdue", "followups", "closed"] as const;
export type View = (typeof VIEWS)[number];
/** Older names still accepted. */
const VIEW_ALIASES: Record<string, View> = { done: "closed" };

export interface BlockSpec {
  /** A person's name, "all", or null when not given. */
  person: string | null;
  view: View;
}

const DONE_DAYS = 30;

/**
 * The block's `key: value` lines, with keys lower-cased. Blank lines and
 * `# comments` are skipped, and quotes around a value are dropped. Talking
 * Points' agenda block reads its options the same way.
 */
export function readOptions(src: string, keys: readonly string[]): Map<string, string> | { error: string } {
  const options = new Map<string, string>();
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.replace(/(^|\s)#.*$/, "").trim();
    if (line === "") continue;
    const m = /^([^:]+):(.*)$/.exec(line);
    if (m === null) return { error: `Expected "key: value", got "${line}".` };
    const key = m[1].trim().toLowerCase();
    if (!keys.includes(key)) return { error: `Unknown option "${m[1].trim()}". Use ${keys.join(" or ")}.` };
    const value = m[2].trim();
    const quoted = /^(['"])(.*)\1$/.exec(value);
    options.set(key, (quoted === null ? value : quoted[2]).trim());
  }
  return options;
}

export function parseBlockSource(src: string): BlockSpec | { error: string } {
  const options = readOptions(src, ["with", "view"]);
  if ("error" in options) return options;
  const spec: BlockSpec = { person: null, view: "open" };
  const who = options.get("with") ?? "";
  if (who !== "") spec.person = who.toLowerCase() === ALL ? ALL : personName(who) || null;
  const value = options.get("view") ?? "";
  if (value !== "") {
    const v = VIEW_ALIASES[value.toLowerCase()] ?? value.toLowerCase();
    if (!(VIEWS as readonly string[]).includes(v)) return { error: `Unknown view "${value}". Use open, overdue, followups or closed.` };
    spec.view = v as View;
  }
  return spec;
}

export function resolvePerson(spec: BlockSpec, notePerson: string | null): string {
  return spec.person ?? notePerson ?? ALL;
}

function inView(d: ThreadRecord, view: View, today: string): boolean {
  switch (view) {
    case "open":
      return isOpen(d);
    case "overdue":
      return isOverdue(d, today);
    case "followups":
      return followUpDue(d, today) || missingFollowUp(d);
    case "closed": {
      if (isOpen(d) || d.closedOn === null) return false;
      const age = daysBetween(d.closedOn, today);
      return age >= 0 && age < DONE_DAYS;
    }
  }
}

function compareOpen(today: string): (a: ThreadRecord, b: ThreadRecord) => number {
  const tier = (d: ThreadRecord) => (isOverdue(d, today) ? 0 : followUpDue(d, today) ? 1 : 2);
  return (a, b) =>
    tier(a) - tier(b) ||
    (a.due === b.due ? 0 : a.due === null ? 1 : b.due === null ? -1 : a.due < b.due ? -1 : 1) ||
    a.title.localeCompare(b.title);
}

export function selectRows(ds: ThreadRecord[], person: string, view: View, today: string): ThreadRecord[] {
  const who = person.toLowerCase();
  const rows = ds.filter((d) => (person === ALL || d.person.toLowerCase() === who) && inView(d, view, today));
  if (view === "closed") return rows.sort((a, b) => (b.closedOn as string).localeCompare(a.closedOn as string) || a.title.localeCompare(b.title));
  return rows.sort(compareOpen(today));
}

export function headerText(scope: string, c: Counts): string {
  const parts = [scope === ALL ? "Everyone" : scope, `${c.open} open`];
  if (c.overdue > 0) parts.push(`${c.overdue} overdue`);
  if (c.followUpsDue > 0) parts.push(`${c.followUpsDue} follow-up${c.followUpsDue === 1 ? "" : "s"} due`);
  if (c.noFollowUp > 0) parts.push(`${c.noFollowUp} no follow-up`);
  return parts.join(" · ");
}
