// Local calendar dates as "YYYY-MM-DD" strings: arithmetic, the date
// picker's presets, and the typed date grammar. Pure.

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 86_400_000;

function pad(n: number, width = 2): string {
  return String(n).padStart(width, "0");
}

/** Days since the epoch for a valid ISO date, or null. Done in UTC so DST never shifts a day. */
function toDays(iso: string): number | null {
  const m = ISO.exec(iso);
  if (m === null) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const t = Date.UTC(y, mo - 1, d);
  const back = new Date(t);
  if (back.getUTCFullYear() !== y || back.getUTCMonth() !== mo - 1 || back.getUTCDate() !== d) return null;
  return t / DAY_MS;
}

function fromDays(days: number): string {
  const d = new Date(days * DAY_MS);
  return `${pad(d.getUTCFullYear(), 4)}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

function days(iso: string): number {
  const n = toDays(iso);
  if (n === null) throw new Error(`Invalid date: ${iso}`);
  return n;
}

export function isValidDate(iso: string): boolean {
  return toDays(iso) !== null;
}

export function localDate(d: Date): string {
  return `${pad(d.getFullYear(), 4)}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addDays(iso: string, n: number): string {
  return fromDays(days(iso) + n);
}

/** `to − from` in days. */
export function daysBetween(from: string, to: string): number {
  return days(to) - days(from);
}

/** 0 = Sunday … 6 = Saturday. */
export function weekday(iso: string): number {
  return new Date(days(iso) * DAY_MS).getUTCDay();
}

/** Saturday and Sunday move to the following Monday. */
export function shiftWeekend(iso: string): string {
  const wd = weekday(iso);
  if (wd === 6) return addDays(iso, 2);
  if (wd === 0) return addDays(iso, 1);
  return iso;
}

export interface Preset {
  label: string;
  days: number;
}

export const PRESETS: Preset[] = [
  { label: "tomorrow", days: 1 },
  { label: "in 3 days", days: 3 },
  { label: "in 1 week", days: 7 },
  { label: "in 10 days", days: 10 },
  { label: "in 2 weeks", days: 14 },
];

export function resolvePreset(p: Preset, today: string): string {
  return shiftWeekend(addDays(today, p.days));
}

const WEEKDAYS: Record<string, number> = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tuesday: 2, wed: 3, wednesday: 3,
  thu: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};

export type ParsedDate = { date: string | null } | { error: string };

/** The typed date grammar, relative to today. "" and "none" clear the date. No weekend shift. */
export function parseDate(input: string, today: string): ParsedDate {
  const s = input.trim().toLowerCase();
  const bad = { error: `Unrecognised date "${input.trim()}" (try 2026-11-20, 11-20, +3d, +1w, fri, tomorrow, none)` };
  if (s === "" || s === "none") return { date: null };
  if (s === "today") return { date: today };
  if (s === "tomorrow") return { date: addDays(today, 1) };
  if (s in WEEKDAYS) {
    const n = (WEEKDAYS[s] - weekday(today) + 7) % 7;
    return { date: addDays(today, n === 0 ? 7 : n) };
  }
  const rel = /^\+(\d+)([dw])$/.exec(s);
  if (rel !== null) return { date: addDays(today, Number(rel[1]) * (rel[2] === "w" ? 7 : 1)) };
  if (ISO.test(s)) return isValidDate(s) ? { date: s } : bad;
  const md = /^(\d{2})-(\d{2})$/.exec(s);
  if (md !== null) {
    const year = Number(today.slice(0, 4));
    for (const y of [year, year + 1]) {
      const c = `${pad(y, 4)}-${md[1]}-${md[2]}`;
      if (isValidDate(c) && (y > year || daysBetween(today, c) >= 0)) return { date: c };
    }
    return bad;
  }
  return bad;
}
