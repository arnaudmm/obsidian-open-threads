// Renders a ```threads block: a person's threads in their note, or everyone's
// elsewhere, with the counts header and the overdue / follow-up flags.
import { MarkdownRenderChild, setIcon } from "obsidian";
import { ALL, headerText, parseBlockSource, resolvePerson, selectRows } from "./core/block.ts";
import { followUpDue, isOverdue, missingFollowUp, summarize } from "./core/rules.ts";
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
    const header = el.createDiv({ cls: "ot-header" });
    header.createSpan({ text: headerText(person, summarize(selectRows(all, person, "open", today), today)) });
    const add = header.createEl("button", { cls: "ot-new", text: "New", attr: { "aria-label": "New thread" } });
    // The block's person, in their note's spelling; an overview block starts with nobody.
    const known = index.people().find((p) => p.name.toLowerCase() === person.toLowerCase());
    add.onclick = () => this.plugin.newThread(person === ALL ? "" : (known?.name ?? ""));

    const rows = selectRows(all, person, spec.view, today);
    if (rows.length === 0) {
      el.createDiv({ cls: "ot-muted", text: "Nothing here." });
      return;
    }
    for (const r of rows) this.row(el, r, person === ALL, spec.view !== "closed", today);
  }

  /** Column labels, so the two dates can be told apart; the same grid as the rows. */
  /** One line per thread; every cell is always there, empty or not, so the rows line up. */
  private row(parent: HTMLElement, r: ThreadRecord, showPerson: boolean, canCheckIn: boolean, today: string): void {
    const row = parent.createDiv({ cls: `ot-row${showPerson ? " ot-with-person" : ""}` });
    const a = row.createEl("a", { cls: "internal-link ot-cell ot-row-title", text: r.title, href: r.path, attr: { title: r.title } });
    a.onclick = (ev) => {
      // Stop here, or Obsidian's own internal-link handler opens the note a second time.
      ev.preventDefault();
      ev.stopPropagation();
      void this.plugin.app.workspace.openLinkText(r.path, this.sourcePath, ev.ctrlKey || ev.metaKey);
    };

    const cell = (text: string, cls = "", tip = text) => row.createSpan({ cls: `ot-cell ${cls}`.trim(), text, attr: tip === "" ? {} : { title: tip } });
    if (showPerson) cell(r.person === "" ? "—" : r.person);

    if (r.due === null) cell("", "", "");
    else cell(r.due, isOverdue(r, today) ? "ot-overdue" : "", `Due ${r.due}`);

    if (r.followUp !== null) cell(r.followUp, followUpDue(r, today) ? "ot-followup" : "", `Follow-up ${r.followUp}`);
    else if (missingFollowUp(r)) cell("none", "ot-followup ot-muted-warning", "No follow-up planned");
    else cell("", "", "");

    const actions = row.createSpan({ cls: "ot-cell ot-actions" });
    const edit = actions.createEl("button", { cls: "clickable-icon", attr: { "aria-label": "Edit" } });
    setIcon(edit, "pencil");
    edit.onclick = () => void this.plugin.editThreadAt(r.path);
    const check = actions.createEl("button", { cls: "clickable-icon ot-checkin", text: "..", attr: { "aria-label": "Check in" } });
    check.onclick = () => void this.plugin.runCheckIn(r.path);
    // In the closed view the button keeps its place, so the columns don't move.
    if (!canCheckIn) check.addClass("ot-hidden");
  }
}
