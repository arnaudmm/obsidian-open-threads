// Every write the plugin makes, written against a small Store port so the
// logic runs in Node tests. The Obsidian side implements Store in store.ts.
import { appendLogLine, changeLine, checkInLine, type Field } from "./core/log.ts";
import {
  personLink,
  readThread,
  renderThreadNote,
  replaceDescription,
  sanitizeTitle,
  uniquePath,
  type Frontmatter,
  type NewThread,
  type Status,
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
  /** Move or rename the note, updating links to it (Obsidian: fileManager.renameFile). */
  rename(path: string, newPath: string): Promise<void>;
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

const KEYS: Record<Field, string> = { status: "status", with: "with", due: "due", "follow-up": "follow_up" };

function currentValue(fm: Frontmatter, field: Field): string | null {
  const r = readThread("", "", fm);
  switch (field) {
    case "status":
      return r.status;
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

/** What the edit window shows and returns. */
export interface ThreadValues extends NewThread {
  status: Status;
}

/**
 * Applies what changed between `before` and `after`: each property through
 * setField (logged), the description (not logged), then the title as a rename
 * in the same folder. Returns the note's path afterwards.
 */
export async function editThread(store: Store, path: string, before: ThreadValues, after: ThreadValues, today: string): Promise<string> {
  const base = sanitizeTitle(after.title);
  if (base === "") throw new Error("Title is empty.");
  const person = after.person.trim();
  if (person === "") throw new Error("Pick a person.");

  const fields: [Field, string | null, string | null][] = [
    ["status", before.status, after.status],
    ["with", before.person, person],
    ["due", before.due, after.due],
    ["follow-up", before.followUp, after.followUp],
  ];
  for (const [field, from, to] of fields) if (from !== to) await setField(store, path, field, to, today);

  if (after.description.trim() !== before.description.trim()) {
    await store.editContent(path, (c) => replaceDescription(c, after.description));
  }

  if (base === sanitizeTitle(before.title)) return path;
  const slash = path.lastIndexOf("/");
  const folder = slash === -1 ? "" : path.slice(0, slash);
  const self = path.toLowerCase();
  const newPath = uniquePath(folder, base, (p) => p.toLowerCase() !== self && store.exists(p));
  if (newPath !== path) await store.rename(path, newPath);
  return newPath;
}
