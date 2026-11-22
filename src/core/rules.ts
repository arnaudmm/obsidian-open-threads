// The attention rules: open, overdue, follow-up due, no follow-up. Pure.
import { daysBetween } from "./dates.ts";
import type { ThreadRecord } from "./thread.ts";

export function isOpen(d: ThreadRecord): boolean {
  return d.status !== "closed";
}

export function isOverdue(d: ThreadRecord, today: string): boolean {
  return isOpen(d) && d.due !== null && daysBetween(d.due, today) > 0;
}

export function daysLate(d: ThreadRecord, today: string): number {
  return isOverdue(d, today) ? daysBetween(d.due as string, today) : 0;
}

export function followUpDue(d: ThreadRecord, today: string): boolean {
  return isOpen(d) && d.followUp !== null && daysBetween(d.followUp, today) >= 0;
}

export function missingFollowUp(d: ThreadRecord): boolean {
  return isOpen(d) && d.followUp === null;
}

export interface Counts {
  open: number;
  overdue: number;
  followUpsDue: number;
  noFollowUp: number;
}

export function summarize(ds: ThreadRecord[], today: string): Counts {
  const c: Counts = { open: 0, overdue: 0, followUpsDue: 0, noFollowUp: 0 };
  for (const d of ds) {
    if (!isOpen(d)) continue;
    c.open++;
    if (isOverdue(d, today)) c.overdue++;
    if (followUpDue(d, today)) c.followUpsDue++;
    if (missingFollowUp(d)) c.noFollowUp++;
  }
  return c;
}
