// Every write the plugin makes, written against a small Store port so the
// logic runs in Node tests. The Obsidian side implements Store in store.ts.
import { appendLogLine, changeLine, checkInLine, type Field } from "./core/log.ts";
import {
  personLink,
  readThread,
  renderThreadNote,
  sanitizeTitle,
  uniquePath,
  type Frontmatter,
  type NewThread,
} from "./core/thread.ts";

export type { Field };

export interface Store {
  exists(path: string): boolean;
  /** Create the folder if needed; returns its real path (an existing folder's case wins). */
  ensureFolder(path: string): Promise<string>;
  create(path: string, content: string): Promise<void>;
  /** Edit the note's properties in place (Obsidian: processFrontMatter). */
  editFrontmatter(path: string, fn: (fm: Frontmatter) => void): Promise<void>;
  /** Rewrite the note's text (Obsidian: vault.process). */
  editContent(path: string, fn: (content: string) => string): Promise<void>;
}

export const DEFAULT_FOLDER = "Threads";

export async function createThread(store: Store, folder: string, d: NewThread, today: string): Promise<string> {
  const base = sanitizeTitle(d.title);
  if (base === "") throw new Error("Title is empty.");
  if (d.person.trim() === "") throw new Error("Pick a person.");
  const dir = folder.trim().replace(/^\/+|\/+$/g, "") || DEFAULT_FOLDER;
  const realDir = await store.ensureFolder(dir);
  const path = uniquePath(realDir, base, (p) => store.exists(p));
  await store.create(path, renderThreadNote({ ...d, title: base, person: d.person.trim() }, today));
  return path;
}

export async function checkIn(store: Store, path: string, note: string, next: string | null, today: string): Promise<void> {
  await store.editFrontmatter(path, (fm) => {
    if (next === null) delete fm.follow_up;
    else fm.follow_up = next;
  });
  await store.editContent(path, (c) => appendLogLine(c, checkInLine(today, note, next)));
}

const KEYS: Record<Field, string> = { status: "status", priority: "priority", with: "with", due: "due", "follow-up": "follow_up" };

function currentValue(fm: Frontmatter, field: Field): string | null {
  const r = readThread("", "", fm);
  switch (field) {
    case "status":
      return r.status;
    case "priority":
      return r.priority;
    case "with":
      return r.person === "" ? null : r.person;
    case "due":
      return r.due;
    case "follow-up":
      return r.followUp;
  }
}

/** Sets one property and logs the change. Returns false, writing nothing, when the value is unchanged. */
export async function setField(store: Store, path: string, field: Field, value: string | null, today: string): Promise<boolean> {
  let from: string | null = null;
  let changed = false;
  await store.editFrontmatter(path, (fm) => {
    from = currentValue(fm, field);
    if (from === value) return;
    changed = true;
    const key = KEYS[field];
    if (value === null) delete fm[key];
    else fm[key] = field === "with" ? personLink(value) : value;
  });
  if (!changed) return false;
  await store.editContent(path, (c) => appendLogLine(c, changeLine(today, field, from, value)));
  return true;
}
