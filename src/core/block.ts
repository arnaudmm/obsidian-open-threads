// The ```threads block: its options, which threads it lists, in what order,
// and the counts header. Pure.
import { daysBetween } from "./dates.ts";
import { followUpDue, isOpen, isOverdue, missingFollowUp, type Counts } from "./rules.ts";
import { personName, PRIORITIES, type ThreadRecord } from "./thread.ts";

export const ALL = "all";
export const VIEWS = ["open", "overdue", "followups", "done"] as const;
export type View = (typeof VIEWS)[number];

export interface BlockSpec {
  /** A person's name, "all", or null when not given. */
  person: string | null;
  view: View;
}

const DONE_DAYS = 30;

export function parseBlockSource(src: string): BlockSpec | { error: string } {
  const spec: BlockSpec = { person: null, view: "open" };
  for (const raw of src.split(/\r?\n/)) {
    const line = raw.trim();
    if (line === "") continue;
    const m = /^([^:]+):(.*)$/.exec(line);
    if (m === null) return { error: `Expected "key: value", got "${line}".` };
    const key = m[1].trim().toLowerCase();
    const value = m[2].trim();
    if (key === "with") {
      spec.person = value.toLowerCase() === ALL ? ALL : personName(value);
    } else if (key === "view") {
      const v = value.toLowerCase();
      if (!(VIEWS as readonly string[]).includes(v)) return { error: `Unknown view "${value}". Use open, overdue, followups or done.` };
      spec.view = v as View;
    } else {
      return { error: `Unknown option "${m[1].trim()}". Use with or view.` };
    }
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
    case "done": {
      if (isOpen(d) || d.closedOn === null) return false;
      const age = daysBetween(d.closedOn, today);
      return age >= 0 && age < DONE_DAYS;
    }
  }
}

function priorityRank(p: string): number {
  const i = PRIORITIES.indexOf(p as (typeof PRIORITIES)[number]);
  return i === -1 ? PRIORITIES.length : PRIORITIES.length - 1 - i;
}

function compareOpen(today: string): (a: ThreadRecord, b: ThreadRecord) => number {
  const tier = (d: ThreadRecord) => (isOverdue(d, today) ? 0 : followUpDue(d, today) ? 1 : 2);
  return (a, b) =>
    tier(a) - tier(b) ||
    (a.due === b.due ? 0 : a.due === null ? 1 : b.due === null ? -1 : a.due < b.due ? -1 : 1) ||
    priorityRank(a.priority) - priorityRank(b.priority) ||
    a.title.localeCompare(b.title);
}

export function selectRows(ds: ThreadRecord[], person: string, view: View, today: string): ThreadRecord[] {
  const who = person.toLowerCase();
  const rows = ds.filter((d) => (person === ALL || d.person.toLowerCase() === who) && inView(d, view, today));
  if (view === "done") return rows.sort((a, b) => (b.closedOn as string).localeCompare(a.closedOn as string) || a.title.localeCompare(b.title));
  return rows.sort(compareOpen(today));
}

export function headerText(scope: string, c: Counts): string {
  const parts = [scope === ALL ? "Everyone" : scope, `${c.open} open`];
  if (c.overdue > 0) parts.push(`${c.overdue} overdue`);
  if (c.followUpsDue > 0) parts.push(`${c.followUpsDue} follow-up${c.followUpsDue === 1 ? "" : "s"} due`);
  if (c.noFollowUp > 0) parts.push(`${c.noFollowUp} no follow-up`);
  return parts.join(" · ");
}
