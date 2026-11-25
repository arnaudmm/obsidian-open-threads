import { test } from "node:test";
import assert from "node:assert/strict";
import { daysLate, followUpDue, isOpen, isOverdue, missingFollowUp, summarize } from "../src/core/rules.ts";
import type { ThreadRecord } from "../src/core/thread.ts";

const base: ThreadRecord = {
  path: "p", title: "t", person: "Marc", status: "open",
  due: null, followUp: null, created: null, closedOn: null, closedNote: "",
};
const today = "2026-11-20";

test("overdue is open and due before today", () => {
  assert.equal(isOverdue({ ...base, due: "2026-11-19" }, today), true);
  assert.equal(isOverdue({ ...base, due: "2026-11-20" }, today), false);
  assert.equal(isOverdue({ ...base, due: "2026-11-01", status: "closed" }, today), false);
  assert.equal(isOverdue(base, today), false);
  assert.equal(daysLate({ ...base, due: "2026-11-17" }, today), 3);
  assert.equal(daysLate({ ...base, due: "2026-11-27" }, today), 0);
});

test("follow-up due includes today; missing only when open", () => {
  assert.equal(followUpDue({ ...base, followUp: "2026-11-20" }, today), true);
  assert.equal(followUpDue({ ...base, followUp: "2026-11-21" }, today), false);
  assert.equal(followUpDue({ ...base, followUp: "2026-11-01", status: "closed" }, today), false);
  assert.equal(missingFollowUp(base), true);
  assert.equal(missingFollowUp({ ...base, status: "closed" }), false);
});

test("only closed is not open", () => assert.equal(isOpen({ ...base, status: "closed" }), false));

test("summarize counts open items only", () => {
  const c = summarize([
    { ...base, due: "2026-11-01", followUp: "2026-11-20", status: "open" },
    { ...base },
    { ...base, status: "closed", due: "2026-11-01" },
  ], today);
  assert.deepEqual(c, { open: 2, overdue: 1, followUpsDue: 1, noFollowUp: 1 });
});
