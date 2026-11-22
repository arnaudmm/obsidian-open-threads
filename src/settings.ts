// Settings: only the folder new threads go in. Stored in the plugin's
// data.json. People are not stored here: they are the notes with type: person.
// Declared with Obsidian's settings definitions (1.13+), so they appear in the
// settings search.
import { PluginSettingTab, type App, type SettingDefinitionItem } from "obsidian";
import { DEFAULT_FOLDER } from "./actions.ts";
import type OpenThreadsPlugin from "./main.ts";

export interface OpenThreadsSettings {
  folder: string;
}

export const DEFAULT_SETTINGS: OpenThreadsSettings = { folder: DEFAULT_FOLDER };

export class OpenThreadsSettingTab extends PluginSettingTab {
  private readonly plugin: OpenThreadsPlugin;

  constructor(app: App, plugin: OpenThreadsPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      {
        type: "group",
        heading: "Threads",
        items: [
          {
            name: "Thread folder",
            desc: "Where new threads are created. Threads are found by their type property, wherever they are.",
            control: { type: "folder", key: "folder", placeholder: DEFAULT_FOLDER },
          },
        ],
      },
    ];
  }

  getControlValue(key: string): unknown {
    return key === "folder" ? this.plugin.settings.folder : undefined;
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    if (key !== "folder") return;
    this.plugin.settings.folder = typeof value === "string" ? value.trim() : DEFAULT_FOLDER;
    await this.plugin.saveSettings();
  }
}
