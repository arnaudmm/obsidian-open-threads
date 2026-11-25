// In-memory index of every thread note and every person note, kept up to
// date from Obsidian's metadata cache. Blocks and pickers read from it; blocks
// re-render on its "updated" event.
import { Events, TFile, type App, type CachedMetadata, type Plugin } from "obsidian";
import { localDate } from "./core/dates.ts";
import { lastClose } from "./core/log.ts";
import { toPerson, type Person } from "./core/people.ts";
import { isOpen } from "./core/rules.ts";
import { isThread, readThread, type Frontmatter, type ThreadRecord } from "./core/thread.ts";

export class ThreadIndex extends Events {
  private items = new Map<string, ThreadRecord>();
  private persons = new Map<string, Person>();
  ready = false;

  private readonly app: App;

  constructor(app: App) {
    super();
    this.app = app;
  }

  threads(): ThreadRecord[] {
    return [...this.items.values()];
  }

  people(): Person[] {
    return [...this.persons.values()];
  }

  personAt(path: string): Person | null {
    return this.persons.get(path) ?? null;
  }

  register(plugin: Plugin): void {
    plugin.registerEvent(
      this.app.metadataCache.on("changed", (file, data, cache) => this.onChanged(file, data, cache)),
    );
    plugin.registerEvent(
      this.app.vault.on("delete", (file) => {
        const a = this.items.delete(file.path);
        const b = this.persons.delete(file.path);
        if (a || b) this.trigger("updated");
      }),
    );
    plugin.registerEvent(
      this.app.vault.on("rename", (file, oldPath) => {
        if (!(file instanceof TFile)) return;
        let hit = false;
        const item = this.items.get(oldPath);
        if (item !== undefined) {
          this.items.delete(oldPath);
          this.items.set(file.path, { ...item, path: file.path, title: file.basename });
          hit = true;
        }
        const person = this.persons.get(oldPath);
        if (person !== undefined) {
          this.persons.delete(oldPath);
          this.persons.set(file.path, { ...person, path: file.path, name: file.basename });
          hit = true;
        }
        if (hit) this.trigger("updated");
      }),
    );
  }

  async build(): Promise<void> {
    this.items.clear();
    this.persons.clear();
    for (const file of this.app.vault.getMarkdownFiles()) {
      const fm = this.app.metadataCache.getFileCache(file)?.frontmatter;
      const person = toPerson(file.path, file.basename, fm);
      if (person !== null) this.persons.set(file.path, person);
      if (!isThread(fm)) continue;
      const content = await this.app.vault.cachedRead(file);
      this.items.set(file.path, toRecord(file, fm as Frontmatter, content));
    }
    this.ready = true;
    this.trigger("updated");
  }

  private onChanged(file: TFile, data: string, cache: CachedMetadata): void {
    const fm = cache.frontmatter;
    let hit = false;
    if (isThread(fm)) {
      this.items.set(file.path, toRecord(file, fm as Frontmatter, data));
      hit = true;
    } else if (this.items.delete(file.path)) {
      hit = true;
    }
    const person = toPerson(file.path, file.basename, fm);
    if (person !== null) {
      this.persons.set(file.path, person);
      hit = true;
    } else if (this.persons.delete(file.path)) {
      hit = true;
    }
    if (hit) this.trigger("updated");
  }
}

function toRecord(file: TFile, fm: Frontmatter, content: string): ThreadRecord {
  const r = readThread(file.path, file.basename, fm);
  if (!isOpen(r)) {
    const close = lastClose(content);
    r.closedOn = close?.date ?? localDate(new Date(file.stat.mtime));
    r.closedNote = close?.note ?? "";
  }
  return r;
}
