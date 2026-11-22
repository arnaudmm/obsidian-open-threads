import { test } from "node:test";
import assert from "node:assert/strict";
import {
  caseInsensitiveLookup,
  isThread,
  personName,
  readDate,
  readThread,
  renderThreadNote,
  sanitizeTitle,
  uniquePath,
} from "../src/core/thread.ts";

test("isThread checks type: thread", () => {
  assert.equal(isThread({ type: "thread" }), true);
  assert.equal(isThread({ type: "agenda" }), false);
  assert.equal(isThread(null), false);
});

test("personName reads the shapes people type", () => {
  for (const v of ["[[Marc]]", "[[People/Marc]]", "[[Marc|M]]", "Marc", ["[[Marc]]"], " [[Marc]] ", "[[People/Marc.md|M]]"])
    assert.equal(personName(v), "Marc", JSON.stringify(v));
  assert.equal(personName(undefined), "");
  assert.equal(personName(3), "");
  assert.equal(personName([]), "");
});

test("readDate keeps the date part and rejects the rest", () => {
  assert.equal(readDate("2026-11-27"), "2026-11-27");
  assert.equal(readDate("2026-11-27T10:00"), "2026-11-27");
  assert.equal(readDate("next week"), null);
  assert.equal(readDate("2026-02-30"), null);
  assert.equal(readDate(null), null);
});

test("readThread is lenient", () => {
  const r = readThread("D/x.md", "x", { type: "thread", with: "[[Marc]]", status: " Waiting ", due: "soon" });
  assert.deepEqual(r, {
    path: "D/x.md", title: "x", person: "Marc", status: "Waiting", priority: "normal",
    due: null, followUp: null, created: null, closedOn: null,
  });
  const s = readThread("p", "t", { type: "thread", status: "Blocked", priority: "HIGH", follow_up: "2026-11-27", created: "2026-11-01" });
  assert.equal(s.status, "blocked");
  assert.equal(s.priority, "high");
  assert.equal(s.followUp, "2026-11-27");
  assert.equal(s.created, "2026-11-01");
  assert.equal(readThread("p", "t", { type: "thread" }).status, "todo");
});

test("renderThreadNote writes properties, description and the created line", () => {
  const note = renderThreadNote(
    { title: "API", person: "Marc", priority: "high", due: "2026-12-04", followUp: null, description: " See https://x \n" },
    "2026-11-22",
  );
  assert.equal(note, [
    "---", "type: thread", 'with: "[[Marc]]"', "status: todo", "priority: high",
    "due: 2026-12-04", "created: 2026-11-22", "---",
    "See https://x", "", "## Log", "- 2026-11-22 · created · with Marc", "",
  ].join("\n"));
});

test("renderThreadNote with no description and a follow-up", () => {
  const note = renderThreadNote({ title: "A", person: "Ann", priority: "normal", due: null, followUp: "2026-11-27", description: "" }, "2026-11-22");
  assert.equal(note, [
    "---", "type: thread", 'with: "[[Ann]]"', "status: todo", "priority: normal",
    "follow_up: 2026-11-27", "created: 2026-11-22", "---",
    "## Log", "- 2026-11-22 · created · with Ann", "",
  ].join("\n"));
});

test("sanitizeTitle removes characters that are illegal in file names", () => {
  assert.equal(sanitizeTitle("Q4: plan/budget? [draft] #x"), "Q4 planbudget draft x");
  assert.equal(sanitizeTitle("..hidden"), "hidden");
  assert.equal(sanitizeTitle("///"), "");
  assert.equal(sanitizeTitle("a".repeat(150)).length, 100);
  assert.doesNotMatch(sanitizeTitle('API: v2 / rate? "x" <y> |z| \\w *'), /[\\/:*?"<>|]/);
});

test("uniquePath appends a counter when the name is taken", () => {
  assert.equal(uniquePath("D", "Budget", (p) => p === "D/Budget.md"), "D/Budget 2.md");
  const taken = new Set(["D/Plan.md", "D/Plan 2.md"]);
  assert.equal(uniquePath("D", "Plan", (p) => taken.has(p)), "D/Plan 3.md");
  assert.equal(uniquePath("D", "Plan", () => false), "D/Plan.md");
  const lookup = caseInsensitiveLookup(["D/budget.md"]);
  assert.equal(uniquePath("D", "Budget", (p) => lookup(p) !== undefined), "D/Budget 2.md");
});

test("personName reads an unquoted [[Marc]], which YAML turns into a nested list", () => {
  assert.equal(personName([["Marc"]]), "Marc");
  assert.equal(personName([["People/Marc|M"]]), "Marc");
});
