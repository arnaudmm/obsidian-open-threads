// The new-thread window, the date picker, the person and value pickers, and a
// one-line prompt. Each picker resolves to `undefined` when dismissed.
import { FuzzySuggestModal, Modal, Notice, Platform, SuggestModal, type App } from "obsidian";
import { addMonths, monthGrid, monthLabel, PRESETS, resolvePreset, typedDate } from "./core/dates.ts";
import { activePeople, NO_PEOPLE, type Person } from "./core/people.ts";
import type { ThreadValues } from "./actions.ts";

/** Runs `resolve` once: on a choice, or with `undefined` after the modal closes without one. */
function once<T>(resolve: (v: T | undefined) => void): { choose: (v: T) => void; dismiss: () => void } {
  let done = false;
  return {
    choose: (v) => {
      if (done) return;
      done = true;
      resolve(v);
    },
    // Obsidian may call onClose before the choice callback, so wait a tick.
    dismiss: () =>
      window.setTimeout(() => {
        if (done) return;
        done = true;
        resolve(undefined);
      }, 0),
  };
}

// ── Date picker ────────────────────────────────────────────────────────────

class DateModal extends Modal {
  private readonly heading: string;
  private readonly current: string | null;
  private readonly today: string;
  private readonly result: { choose: (v: string | null) => void; dismiss: () => void };

  constructor(app: App, heading: string, current: string | null, today: string, resolve: (v: string | null | undefined) => void) {
    super(app);
    this.heading = heading;
    this.current = current;
    this.today = today;
    this.result = once(resolve);
  }

  onOpen(): void {
    const { contentEl } = this;
    this.modalEl.addClass("ot-modal");
    this.titleEl.setText(this.heading);
    if (this.current !== null) contentEl.createDiv({ cls: "ot-muted", text: `Now: ${this.current}` });

    const presets = contentEl.createDiv({ cls: "ot-presets" });
    for (const p of PRESETS) {
      const date = resolvePreset(p, this.today);
      const b = presets.createEl("button", { text: `${p.label} · ${date}` });
      b.onclick = () => this.pick(date);
    }

    this.renderCalendar(contentEl.createDiv({ cls: "ot-calendar" }), this.current ?? this.today);

    const input = contentEl.createEl("input", {
      type: "text",
      cls: "ot-date-input",
      attr: { placeholder: "Or type: 2026-11-20, 11-20, +3d, +1w, fri, tomorrow, none" },
    });
    const hint = contentEl.createDiv({ cls: "ot-muted ot-date-hint" });
    const update = () => {
      const r = typedDate(input.value, this.today);
      hint.toggleClass("ot-error", r !== undefined && "error" in r);
      hint.setText(r === undefined ? "" : "error" in r ? r.error : r.date === null ? "No date" : r.date);
    };
    input.addEventListener("input", update);
    input.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" || ev.isComposing) return;
      ev.preventDefault();
      const r = typedDate(input.value, this.today);
      if (r !== undefined && !("error" in r)) this.pick(r.date);
    });

    const footer = contentEl.createDiv({ cls: "ot-footer" });
    footer.createEl("button", { text: "None" }).onclick = () => this.pick(null);
    input.focus();
  }

  /** A month of day buttons; ‹ and › change month. A clicked day is used as is (no weekend shift). */
  private renderCalendar(el: HTMLElement, month: string): void {
    el.empty();
    const nav = el.createDiv({ cls: "ot-cal-nav" });
    const prev = nav.createEl("button", { cls: "clickable-icon", text: "‹", attr: { "aria-label": "Previous month" } });
    nav.createSpan({ cls: "ot-cal-month", text: monthLabel(month) });
    const next = nav.createEl("button", { cls: "clickable-icon", text: "›", attr: { "aria-label": "Next month" } });
    prev.onclick = () => this.renderCalendar(el, addMonths(month, -1));
    next.onclick = () => this.renderCalendar(el, addMonths(month, 1));

    const grid = el.createDiv({ cls: "ot-cal-grid" });
    for (const d of ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"]) grid.createSpan({ cls: "ot-cal-wd", text: d });
    for (const week of monthGrid(month)) {
      for (const day of week) {
        if (day === null) {
          grid.createSpan();
          continue;
        }
        const cls = ["ot-cal-day"];
        if (day === this.today) cls.push("ot-cal-today");
        if (day === this.current) cls.push("ot-cal-selected");
        if (day < this.today) cls.push("ot-cal-past");
        const b = grid.createEl("button", { cls: cls.join(" "), text: String(Number(day.slice(8))), attr: { "aria-label": day } });
        b.onclick = () => this.pick(day);
      }
    }
  }

  private pick(date: string | null): void {
    this.result.choose(date);
    this.close();
  }

  onClose(): void {
    this.contentEl.empty();
    this.result.dismiss();
  }
}

/** A date, `null` to clear it, or `undefined` when dismissed. */
export function pickDate(app: App, title: string, current: string | null, today: string): Promise<string | null | undefined> {
  return new Promise((resolve) => new DateModal(app, title, current, today, resolve).open());
}

// ── Person and value pickers ───────────────────────────────────────────────

class PersonModal extends FuzzySuggestModal<Person> {
  private readonly people: Person[];
  private readonly result: { choose: (v: string) => void; dismiss: () => void };

  constructor(app: App, people: Person[], resolve: (v: string | undefined) => void) {
    super(app);
    this.people = people;
    this.result = once(resolve);
    this.setPlaceholder("Who is it with?");
  }

  getItems(): Person[] {
    return this.people;
  }

  getItemText(p: Person): string {
    return p.name;
  }

  onChooseItem(p: Person): void {
    this.result.choose(p.name);
  }

  onClose(): void {
    super.onClose();
    this.result.dismiss();
  }
}

/** A person's name from the active people, or `undefined` (dismissed, or nobody to pick). */
export function pickPerson(app: App, people: Person[]): Promise<string | undefined> {
  const list = activePeople(people);
  if (list.length === 0) {
    new Notice(NO_PEOPLE);
    return Promise.resolve(undefined);
  }
  return new Promise((resolve) => new PersonModal(app, list, resolve).open());
}

class ValueModal extends SuggestModal<string> {
  private readonly values: readonly string[];
  private readonly result: { choose: (v: string) => void; dismiss: () => void };

  constructor(app: App, title: string, values: readonly string[], resolve: (v: string | undefined) => void) {
    super(app);
    this.values = values;
    this.result = once(resolve);
    this.setPlaceholder(title);
  }

  getSuggestions(query: string): string[] {
    const q = query.trim().toLowerCase();
    return this.values.filter((v) => v.toLowerCase().includes(q));
  }

  renderSuggestion(value: string, el: HTMLElement): void {
    el.setText(value);
  }

  onChooseSuggestion(value: string): void {
    this.result.choose(value);
  }

  onClose(): void {
    super.onClose();
    this.result.dismiss();
  }
}

export function pickFrom(app: App, title: string, values: readonly string[]): Promise<string | undefined> {
  return new Promise((resolve) => new ValueModal(app, title, values, resolve).open());
}

// ── One-line prompt ────────────────────────────────────────────────────────

/** One-line text prompt. Resolves to the text (maybe ""), or null when cancelled. */
export class PromptModal extends Modal {
  private readonly heading: string;
  private readonly placeholder: string;
  private resolve: (value: string | null) => void = () => {};
  private done = false;

  constructor(app: App, heading: string, placeholder: string) {
    super(app);
    this.heading = heading;
    this.placeholder = placeholder;
  }

  static ask(app: App, heading: string, placeholder: string): Promise<string | null> {
    const modal = new PromptModal(app, heading, placeholder);
    const answer = new Promise<string | null>((resolve) => (modal.resolve = resolve));
    modal.open();
    return answer;
  }

  onOpen(): void {
    this.modalEl.addClass("ot-modal");
    this.titleEl.setText(this.heading);
    const input = this.contentEl.createEl("input", { type: "text", cls: "ot-prompt", attr: { placeholder: this.placeholder } });
    input.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter" || ev.isComposing) return;
      ev.preventDefault();
      this.finish(input.value);
    });
    input.focus();
  }

  private finish(value: string | null): void {
    if (this.done) return;
    this.done = true;
    this.resolve(value);
    this.close();
  }

  onClose(): void {
    this.finish(null);
    this.contentEl.empty();
  }
}

// ── New and edit thread ────────────────────────────────────────────────────

export interface ThreadModalOptions {
  mode: "create" | "edit";
  initial: ThreadValues;
  people: () => Person[];
  today: string;
  submit: (values: ThreadValues) => Promise<void>;
}

/** The same window creates a thread or edits one; editing adds a Closed checkbox. */
export class ThreadModal extends Modal {
  private readonly opts: ThreadModalOptions;
  private values: ThreadValues;
  private saving = false;

  constructor(app: App, opts: ThreadModalOptions) {
    super(app);
    this.opts = opts;
    this.values = { ...opts.initial };
  }

  onOpen(): void {
    const { contentEl } = this;
    const editing = this.opts.mode === "edit";
    this.modalEl.addClass("ot-modal");
    this.titleEl.setText(editing ? "Edit thread" : "New thread");

    const title = contentEl.createEl("input", { type: "text", cls: "ot-title-input", attr: { placeholder: "What is it about?" } });
    title.value = this.values.title;
    title.addEventListener("input", () => (this.values.title = title.value));

    const grid = contentEl.createDiv({ cls: "ot-fields" });
    const field = (label: string) => {
      const row = grid.createDiv({ cls: "ot-field" });
      row.createSpan({ cls: "ot-label", text: label });
      return row;
    };

    const personBtn = field("With").createEl("button");
    const showPerson = () => personBtn.setText(this.values.person === "" ? "Pick a person" : this.values.person);
    showPerson();
    personBtn.onclick = async () => {
      const name = await pickPerson(this.app, this.opts.people());
      if (name !== undefined) this.values.person = name;
      showPerson();
    };

    if (editing) {
      const box = field("Closed").createEl("input", { type: "checkbox" });
      box.checked = this.values.status === "closed";
      box.onchange = () => (this.values.status = box.checked ? "closed" : "open");
    }

    const dateBtn = (label: string, key: "due" | "followUp") => {
      const b = field(label).createEl("button");
      const show = () => b.setText(this.values[key] ?? "None");
      show();
      b.onclick = async () => {
        const d = await pickDate(this.app, label, this.values[key], this.opts.today);
        if (d !== undefined) this.values[key] = d;
        show();
      };
    };
    dateBtn("Due", "due");
    dateBtn("Follow-up", "followUp");

    const desc = contentEl.createEl("textarea", { cls: "ot-description", attr: { placeholder: "Details and links (optional)", rows: "4" } });
    desc.value = this.values.description;
    desc.addEventListener("input", () => (this.values.description = desc.value));

    const footer = contentEl.createDiv({ cls: "ot-footer" });
    const save = footer.createEl("button", { text: "Save", cls: "mod-cta" });
    save.title = `${Platform.isMacOS ? "⌘" : "Ctrl"}+Enter`;
    save.onclick = () => void this.save();
    this.scope.register(["Mod"], "Enter", () => {
      void this.save();
      return false;
    });
    title.focus();
  }

  /** One save at a time: a double click or key repeat must not save twice. */
  private async save(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    try {
      await this.opts.submit({ ...this.values });
      this.close();
    } catch (e) {
      new Notice(e instanceof Error ? e.message : String(e));
    } finally {
      this.saving = false;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
