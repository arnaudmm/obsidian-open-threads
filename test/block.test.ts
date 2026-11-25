import { test } from "node:test";
import assert from "node:assert/strict";
import { headerText, parseBlockSource, resolvePerson, selectRows } from "../src/core/block.ts";
import type { ThreadRecord } from "../src/core/thread.ts";

const base: ThreadRecord = {
  path: "p", title: "t", person: "Marc", status: "open",
  due: null, followUp: null, created: null, closedOn: null, closedNote: "",
};
const today = "2026-11-20";

test("options parse and report errors", () => {
  assert.deepEqual(parseBlockSource(""), { person: null, view: "open" });
  assert.deepEqual(parseBlockSource("with: [[Marc]]\nview: overdue\n"), { person: "Marc", view: "overdue" });
  assert.deepEqual(parseBlockSource("\n  with: all  \n"), { person: "all", view: "open" });
  assert.deepEqual(parseBlockSource("view: Followups"), { person: null, view: "followups" });
  assert.deepEqual(parseBlockSource("view: done"), { person: null, view: "closed" });
  assert.deepEqual(parseBlockSource("view: soon"), { error: 'Unknown view "soon". Use open, overdue, followups or closed.' });
  assert.deepEqual(parseBlockSource("colour: red"), { error: 'Unknown option "colour". Use with or view.' });
  assert.deepEqual(parseBlockSource("just text"), { error: 'Expected "key: value", got "just text".' });
});

test("options take quotes, # comments and Name or [[Name]], the same way as Talking Points' agenda block", () => {
  assert.deepEqual(parseBlockSource('With: "Marc"   # my 1:1\n# a comment line\nview: \'overdue\''), { person: "Marc", view: "overdue" });
  assert.deepEqual(parseBlockSource("with: [[People/Marc|Marc D.]]"), { person: "Marc", view: "open" });
  assert.deepEqual(parseBlockSource("with: ALL # everyone"), { person: "all", view: "open" });
  assert.deepEqual(parseBlockSource("with:"), { person: null, view: "open" });
});

test("person defaults to the note's person, else everyone", () => {
  assert.equal(resolvePerson({ person: null, view: "open" }, "Marc"), "Marc");
  assert.equal(resolvePerson({ person: null, view: "open" }, null), "all");
  assert.equal(resolvePerson({ person: "all", view: "open" }, "Marc"), "all");
  assert.equal(resolvePerson({ person: "Ann", view: "open" }, "Marc"), "Ann");
});

test("open rows sort overdue, then follow-up due, then due date, then title", () => {
  const rows: ThreadRecord[] = [
    { ...base, title: "e", followUp: "2026-11-30" },
    { ...base, title: "c", followUp: "2026-11-30", due: "2026-11-25" },
    { ...base, title: "d", followUp: "2026-11-30", due: "2026-11-25" },
    { ...base, title: "b", followUp: "2026-11-19", due: "2026-12-01" },
    { ...base, title: "a", due: "2026-11-10" },
    { ...base, title: "f", status: "closed" },
    { ...base, title: "g", person: "Ann" },
  ];
  assert.deepEqual(selectRows(rows, "marc", "open", today).map((r) => r.title), ["a", "b", "c", "d", "e"]);
  assert.equal(selectRows(rows, "all", "open", today).length, 6);
});

test("overdue and followups views", () => {
  const rows: ThreadRecord[] = [
    { ...base, title: "late", due: "2026-11-19", followUp: "2026-12-01" },
    { ...base, title: "check", followUp: "2026-11-20" },
    { ...base, title: "none" },
    { ...base, title: "later", followUp: "2026-11-21" },
  ];
  assert.deepEqual(selectRows(rows, "all", "overdue", today).map((r) => r.title), ["late"]);
  assert.deepEqual(selectRows(rows, "all", "followups", today).map((r) => r.title), ["check", "none"]);
});

test("closed lists closes from the last 30 days, newest first", () => {
  const rows: ThreadRecord[] = [
    { ...base, title: "y", status: "closed", closedOn: "2026-10-22" },
    { ...base, title: "z", status: "closed", closedOn: "2026-10-21" },
    { ...base, title: "x", status: "closed", closedOn: "2026-11-20" },
    { ...base, title: "w", closedOn: "2026-11-20" },
    { ...base, title: "v", status: "closed", closedOn: null },
  ];
  assert.deepEqual(selectRows(rows, "all", "closed", today).map((r) => r.title), ["x", "y"]);
});

test("header leaves out zero counts", () => {
  assert.equal(headerText("Marc", { open: 4, overdue: 1, followUpsDue: 2, noFollowUp: 1 }), "Open Threads · Marc · 4 open · 1 overdue · 2 follow-ups due · 1 no follow-up");
  assert.equal(headerText("all", { open: 0, overdue: 0, followUpsDue: 0, noFollowUp: 0 }), "Open Threads · Everyone · 0 open");
});
