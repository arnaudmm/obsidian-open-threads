import { test } from "node:test";
import assert from "node:assert/strict";
import { activePeople, NO_PEOPLE, toPerson } from "../src/core/people.ts";

test("only type: person notes are people", () => {
  assert.equal(toPerson("a.md", "a", { type: "meeting" }), null);
  assert.equal(toPerson("a.md", "a", undefined), null);
  assert.deepEqual(toPerson("P/Marc.md", "Marc", { type: "person" }), { name: "Marc", path: "P/Marc.md", active: true });
  assert.equal(toPerson("x", "x", { type: "person", active: "false" })?.active, false);
  assert.equal(toPerson("x", "x", { type: "person", active: false })?.active, false);
  assert.equal(toPerson("x", "x", { type: "person", active: "yes" })?.active, true);
});

test("activePeople hides inactive and sorts by name", () => {
  const ps = [{ name: "zoe", path: "z", active: true }, { name: "Ann", path: "a", active: true }, { name: "Bob", path: "b", active: false }];
  assert.deepEqual(activePeople(ps).map((p) => p.name), ["Ann", "zoe"]);
});

test("the empty-picker message tells how to add people", () => {
  assert.equal(NO_PEOPLE, "No people yet. Add type: person to a person's note.");
});
