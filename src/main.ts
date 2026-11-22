import { Notice, Plugin, TFile } from "obsidian";
import { checkIn, createThread, setField, type Field } from "./actions.ts";
import { ThreadsBlock } from "./block.ts";
import { localDate } from "./core/dates.ts";
import { isThread, PRIORITIES, readThread, STATUSES, type Frontmatter, type ThreadRecord } from "./core/thread.ts";
import { ThreadIndex } from "./index.ts";
import { NewThreadModal, pickDate, pickFrom, pickPerson, PromptModal } from "./modals.ts";
import { DEFAULT_SETTINGS, OpenThreadsSettingTab, type OpenThreadsSettings } from "./settings.ts";
import { ObsidianStore } from "./store.ts";

export default class OpenThreadsPlugin extends Plugin {
  settings: OpenThreadsSettings = { ...DEFAULT_SETTINGS };
  index!: ThreadIndex;
  store!: ObsidianStore;

  async onload(): Promise<void> {
    await this.loadSettings();
    this.store = new ObsidianStore(this.app);
    this.index = new ThreadIndex(this.app);
    this.index.register(this);
    this.addSettingTab(new OpenThreadsSettingTab(this.app, this));

    this.addCommand({ id: "new", name: "New thread", callback: () => this.newThread() });
    this.threadCommand("check-in", "Check in", (r) => this.runCheckIn(r.path));
    this.threadCommand("set-status", "Set status", async (r) => {
      const v = await pickFrom(this.app, "Status", STATUSES);
      if (v !== undefined) await this.change(r.path, "status", v);
    });
    this.threadCommand("set-priority", "Set priority", async (r) => {
      const v = await pickFrom(this.app, "Priority", PRIORITIES);
      if (v !== undefined) await this.change(r.path, "priority", v);
    });
    this.threadCommand("change-person", "Change person", async (r) => {
      const v = await pickPerson(this.app, this.index.people());
      if (v !== undefined) await this.change(r.path, "with", v);
    });
    this.threadCommand("set-due", "Set due date", async (r) => {
      const v = await pickDate(this.app, "Due date", r.due, this.today());
      if (v !== undefined) await this.change(r.path, "due", v);
    });
    this.threadCommand("set-follow-up", "Set follow-up date", async (r) => {
      const v = await pickDate(this.app, "Follow-up date", r.followUp, this.today());
      if (v !== undefined) await this.change(r.path, "follow-up", v);
    });

    this.registerMarkdownCodeBlockProcessor("threads", (source, el, ctx) => {
      ctx.addChild(new ThreadsBlock(el, this, source, ctx.sourcePath));
    });

    this.app.workspace.onLayoutReady(() => void this.index.build());
  }

  /** A command available only when the active note is a thread. */
  private threadCommand(id: string, name: string, run: (r: ThreadRecord) => Promise<void>): void {
    this.addCommand({
      id,
      name,
      checkCallback: (checking) => {
        const file = this.app.workspace.getActiveFile();
        const fm = file && this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (!file || !isThread(fm)) return false;
        if (!checking) void this.guard(run(readThread(file.path, file.basename, fm as Frontmatter)));
        return true;
      },
    });
  }

  private async guard(job: Promise<unknown>): Promise<void> {
    try {
      await job;
    } catch (e) {
      new Notice(e instanceof Error ? e.message : String(e));
    }
  }

  private async change(path: string, field: Field, value: string | null): Promise<void> {
    await setField(this.store, path, field, value, this.today());
  }

  private newThread(): void {
    const active = this.app.workspace.getActiveFile();
    const person = active ? (this.index.personAt(active.path)?.name ?? "") : "";
    new NewThreadModal(this.app, {
      person,
      people: () => this.index.people(),
      today: this.today(),
      submit: async (d) => {
        const path = await createThread(this.store, this.settings.folder, d, this.today());
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) await this.app.workspace.getLeaf(false).openFile(file);
      },
    }).open();
  }

  /** Ask for an optional note, then the next follow-up; dismissing either cancels. */
  async runCheckIn(path: string): Promise<void> {
    const note = await PromptModal.ask(this.app, "Check in", "Note (optional): Enter to continue, Esc to cancel");
    if (note === null) return;
    const current = this.index.threads().find((t) => t.path === path)?.followUp ?? null;
    const next = await pickDate(this.app, "Next follow-up", current, this.today());
    if (next === undefined) return;
    await this.guard(checkIn(this.store, path, note, next, this.today()));
  }

  async loadSettings(): Promise<void> {
    const data = ((await this.loadData()) ?? {}) as Partial<OpenThreadsSettings>;
    this.settings = { folder: typeof data.folder === "string" ? data.folder : DEFAULT_SETTINGS.folder };
  }

  async saveSettings(): Promise<void> {
    await this.saveData(this.settings);
  }

  today(): string {
    return localDate(new Date());
  }
}
