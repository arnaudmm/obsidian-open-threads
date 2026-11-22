import { Plugin } from "obsidian";
import { localDate } from "./core/dates.ts";
import { ThreadIndex } from "./index.ts";
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
    this.app.workspace.onLayoutReady(() => void this.index.build());
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
