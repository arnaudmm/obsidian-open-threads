// In-memory vault for the action tests. Frontmatter and body are kept apart,
// as Obsidian's two edit APIs (processFrontMatter, vault.process) see them.
import type { Store } from "../src/actions.ts";
import type { Frontmatter } from "../src/core/thread.ts";

export class FakeStore implements Store {
  files = new Map<string, { fm: Frontmatter | null; body: string }>();
  folders: string[] = [];
  existingFolders: string[] = [];

  put(path: string, fm: Frontmatter | null, body: string): void {
    this.files.set(path, { fm, body });
  }
  exists(path: string): boolean {
    return this.files.has(path);
  }
  async ensureFolder(path: string): Promise<string> {
    this.folders.push(path);
    return this.existingFolders.find((f) => f.toLowerCase() === path.toLowerCase()) ?? path;
  }
  async create(path: string, content: string): Promise<void> {
    if (this.files.has(path)) throw new Error(`exists: ${path}`);
    const m = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/.exec(content);
    if (m === null) return this.put(path, null, content);
    const fm: Frontmatter = {};
    for (const line of m[1].split("\n")) {
      const [key, ...rest] = line.split(": ");
      const value = rest.join(": ");
      fm[key] = value.startsWith('"') || value.startsWith("[") ? JSON.parse(value) : value;
    }
    this.put(path, fm, m[2]);
  }
  async editFrontmatter(path: string, fn: (fm: Frontmatter) => void): Promise<void> {
    const file = this.files.get(path);
    if (file === undefined) throw new Error(`missing: ${path}`);
    file.fm ??= {};
    fn(file.fm);
  }
  async editContent(path: string, fn: (content: string) => string): Promise<void> {
    const file = this.files.get(path);
    if (file === undefined) throw new Error(`missing: ${path}`);
    file.body = fn(file.body);
  }
}
