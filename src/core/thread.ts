// The thread note: its properties, how they are read when edited by hand,
// and how a new note is written. Pure: no obsidian import.
import { isValidDate } from "./dates.ts";

export type Frontmatter = Record<string, unknown>;

export const STATUSES = ["todo", "in_progress", "blocked", "done", "cancelled"] as const;
export const PRIORITIES = ["low", "normal", "high", "critical"] as const;

export interface ThreadRecord {
  path: string;
  title: string;
  /** The person's note name, or "" when none is set. */
  person: string;
  status: string;
  priority: string;
  due: string | null;
  followUp: string | null;
  created: string | null;
  /** When it was last set to done or cancelled; filled by the index. */
  closedOn: string | null;
}

export interface NewThread {
  title: string;
  person: string;
  priority: string;
  due: string | null;
  followUp: string | null;
  description: string;
}

export function isThread(fm: unknown): boolean {
  return typeof fm === "object" && fm !== null && (fm as Frontmatter).type === "thread";
}

/** "[[People/Marc.md|M]]", "[[Marc]]", "Marc" or ["[[Marc]]"] → "Marc"; anything else → "". */
export function personName(v: unknown): string {
  let raw = v;
  // Unquoted [[Marc]] is YAML for a nested list: [["Marc"]].
  while (Array.isArray(raw)) raw = raw[0];
  if (typeof raw !== "string") return "";
  let s = raw.trim();
  const link = /^\[\[([^\]]*)\]\]$/.exec(s);
  s = (link === null ? s : link[1]).split("|")[0];
  s = s.split("/").pop() ?? "";
  return s.replace(/\.md$/i, "").trim();
}

/** A string starting with a valid YYYY-MM-DD → that date; anything else → null. */
export function readDate(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const d = v.trim().slice(0, 10);
  return isValidDate(d) ? d : null;
}

/** Known values are lower-cased; unknown ones are kept as typed; empty → fallback. */
function readEnum(v: unknown, known: readonly string[], fallback: string): string {
  if (typeof v !== "string" || v.trim() === "") return fallback;
  const s = v.trim();
  return known.includes(s.toLowerCase()) ? s.toLowerCase() : s;
}

export function readThread(path: string, title: string, fm: Frontmatter): ThreadRecord {
  return {
    path,
    title,
    person: personName(fm.with),
    status: readEnum(fm.status, STATUSES, "todo"),
    priority: readEnum(fm.priority, PRIORITIES, "normal"),
    due: readDate(fm.due),
    followUp: readDate(fm.follow_up),
    created: readDate(fm.created),
    closedOn: null,
  };
}

export function personLink(name: string): string {
  return `[[${name}]]`;
}

export function renderThreadNote(d: NewThread, today: string): string {
  const lines = [
    "---",
    "type: thread",
    `with: ${JSON.stringify(personLink(d.person))}`,
    "status: todo",
    `priority: ${d.priority}`,
    ...(d.due === null ? [] : [`due: ${d.due}`]),
    ...(d.followUp === null ? [] : [`follow_up: ${d.followUp}`]),
    `created: ${today}`,
    "---",
  ];
  const body = d.description.trim();
  if (body !== "") lines.push(body, "");
  lines.push("## Log", `- ${today} · created · with ${d.person}`, "");
  return lines.join("\n");
}

export function sanitizeTitle(title: string): string {
  return title
    .replace(/[\\/:*?"<>|#^[\]]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^\.+/, "")
    .trim()
    .slice(0, 100)
    .trim();
}

export function uniquePath(folder: string, base: string, exists: (path: string) => boolean): string {
  const prefix = folder === "" ? "" : `${folder}/`;
  let path = `${prefix}${base}.md`;
  for (let n = 2; exists(path); n++) path = `${prefix}${base} ${n}.md`;
  return path;
}

/**
 * A lookup that finds an existing path whatever its case, returning its real
 * spelling. macOS and Windows disks treat "Budget.md" and "budget.md" as the
 * same file, while Obsidian's path lookups are case-sensitive.
 */
export function caseInsensitiveLookup(paths: Iterable<string>): (path: string) => string | undefined {
  const byLower = new Map<string, string>();
  for (const p of paths) byLower.set(p.toLowerCase(), p);
  return (path) => byLower.get(path.toLowerCase());
}

const FRONTMATTER = /^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/;
const LOG_HEADING = /^##\s+Log\s*$/m;

/** Splits a note into its properties block, the description, and the Log section onwards. */
function splitNote(content: string): { head: string; description: string; log: string } {
  const head = FRONTMATTER.exec(content)?.[0] ?? "";
  const body = content.slice(head.length);
  const m = LOG_HEADING.exec(body);
  const at = m === null ? body.length : m.index;
  return { head, description: body.slice(0, at), log: body.slice(at) };
}

/** The text between the properties and the "## Log" heading, trimmed. */
export function readDescription(content: string): string {
  return splitNote(content).description.trim();
}

/** Replaces that text, keeping the properties and the Log section as they are. */
export function replaceDescription(content: string, text: string): string {
  const { head, log } = splitNote(content);
  const t = text.trim();
  if (t === "") return head + log;
  return `${head}${t}\n${log === "" ? "" : `\n${log}`}`;
}
