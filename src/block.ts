// Renders a ```threads block: a person's threads in their note, or everyone's
// elsewhere, with the counts header and the overdue / follow-up flags.
import { MarkdownRenderChild } from "obsidian";
import { ALL, headerText, parseBlockSource, resolvePerson, selectRows } from "./core/block.ts";
import { daysLate, followUpDue, isOverdue, missingFollowUp, summarize } from "./core/rules.ts";
import type { ThreadRecord } from "./core/thread.ts";
import type OpenThreadsPlugin from "./main.ts";

export class ThreadsBlock extends MarkdownRenderChild {
  private readonly plugin: OpenThreadsPlugin;
  private readonly source: string;
  private sourcePath: string;

  constructor(containerEl: HTMLElement, plugin: OpenThreadsPlugin, source: string, sourcePath: string) {
    super(containerEl);
    this.plugin = plugin;
    this.source = source;
    this.sourcePath = sourcePath;
  }

  onload(): void {
    // Renaming the open note does not re-run the block, so follow the new path
    // (before the index re-renders, or a person note would show everyone).
    this.registerEvent(
      this.plugin.app.vault.on("rename", (file, oldPath) => {
        if (oldPath === this.sourcePath) this.sourcePath = file.path;
      }),
    );
    this.registerEvent(this.plugin.index.on("updated", () => this.render()));
    this.render();
  }

  private render(): void {
    const el = this.containerEl;
    el.empty();
    el.addClass("ot-block");

    const spec = parseBlockSource(this.source);
    if ("error" in spec) {
      el.createDiv({ cls: "ot-error", text: spec.error });
      return;
    }
    const index = this.plugin.index;
    if (!index.ready) {
      el.createDiv({ cls: "ot-muted", text: "Loading…" });
      return;
    }

    const today = this.plugin.today();
    const person = resolvePerson(spec, index.personAt(this.sourcePath)?.name ?? null);
    const all = index.threads();
    el.createDiv({ cls: "ot-header", text: headerText(person, summarize(selectRows(all, person, "open", today), today)) });

    const rows = selectRows(all, person, spec.view, today);
    if (rows.length === 0) el.createDiv({ cls: "ot-muted", text: "Nothing here." });
    for (const r of rows) this.row(el, r, person === ALL, spec.view !== "done", today);
  }

  private row(parent: HTMLElement, r: ThreadRecord, showPerson: boolean, canCheckIn: boolean, today: string): void {
    const row = parent.createDiv({ cls: "ot-row" });
    const a = row.createEl("a", { cls: "internal-link ot-title", text: r.title, href: r.path });
    a.onclick = (ev) => {
      // Stop here, or Obsidian's own internal-link handler opens the note a second time.
      ev.preventDefault();
      ev.stopPropagation();
      void this.plugin.app.workspace.openLinkText(r.path, this.sourcePath, ev.ctrlKey || ev.metaKey);
    };

    const meta = row.createDiv({ cls: "ot-meta" });
    if (showPerson) meta.createSpan({ cls: "ot-person", text: r.person === "" ? "no one" : r.person });
    meta.createSpan({ cls: `ot-status${r.status === "blocked" ? " ot-blocked" : ""}`, text: r.status });
    meta.createSpan({ cls: "ot-priority", text: r.priority });
    if (r.due !== null) {
      const late = isOverdue(r, today);
      meta.createSpan({ cls: late ? "ot-due ot-overdue" : "ot-due", text: `due ${r.due}${late ? ` · ${daysLate(r, today)}d late` : ""}` });
    }
    if (r.followUp !== null) {
      meta.createSpan({ cls: followUpDue(r, today) ? "ot-follow ot-followup" : "ot-follow", text: `follow-up ${r.followUp}` });
    } else if (missingFollowUp(r)) {
      meta.createSpan({ cls: "ot-follow ot-followup ot-muted-warning", text: "no follow-up" });
    }

    const actions = row.createDiv({ cls: "ot-actions" });
    actions.createEl("button", { text: "Edit" }).onclick = () => void this.plugin.editThreadAt(r.path);
    if (canCheckIn) actions.createEl("button", { text: "Check in" }).onclick = () => void this.plugin.runCheckIn(r.path);
  }
}
