import { test } from "node:test";
import assert from "node:assert/strict";
import { appendLogLine, changeLine, checkInLine, closeLine, lastClose, lastClosedOn } from "../src/core/log.ts";

test("check-in lines have the spec's shape", () => {
  assert.equal(checkInLine("2026-11-25", "Waiting\non infra ", "2026-11-28"), "- 2026-11-25 · check-in · Waiting on infra · next 2026-11-28");
  assert.equal(checkInLine("2026-11-25", "  ", null), "- 2026-11-25 · check-in · next none");
});

test("change lines write none for an empty value", () => {
  assert.equal(changeLine("2026-11-28", "status", "open", "closed"), "- 2026-11-28 · closed");
  assert.equal(changeLine("2026-11-28", "status", "closed", "open"), "- 2026-11-28 · reopened");
  assert.equal(changeLine("2026-11-28", "due", null, "2026-12-04"), "- 2026-11-28 · due none → 2026-12-04");
  assert.equal(changeLine("2026-11-28", "follow-up", "2026-12-01", null), "- 2026-11-28 · follow-up 2026-12-01 → none");
  assert.equal(changeLine("2026-11-28", "with", "Marc", "Ann"), "- 2026-11-28 · with Marc → Ann");
});

test("appendLogLine adds the heading when missing", () => {
  assert.equal(appendLogLine("---\ntype: thread\n---\nBody\n", "- x"), "---\ntype: thread\n---\nBody\n\n## Log\n- x\n");
  assert.equal(appendLogLine("x\n\n\n", "- L"), "x\n\n## Log\n- L\n");
});

test("appendLogLine adds after the last entry of the Log section", () => {
  assert.equal(appendLogLine("x\n\n## Log\n- a\n", "- b"), "x\n\n## Log\n- a\n- b\n");
});

test("appendLogLine appends inside the section, before a later heading", () => {
  assert.equal(appendLogLine("## Log\n- a\n\n## Notes\nn\n", "- b"), "## Log\n- a\n- b\n\n## Notes\nn\n");
  assert.equal(appendLogLine("## Log\n\n# Other\n", "- L"), "## Log\n- L\n\n# Other\n");
});

test("appendLogLine keeps a level-3 heading inside the section and CRLF endings", () => {
  assert.equal(appendLogLine("## Log\n- L1\n### Sub\n- L2\n", "- L3"), "## Log\n- L1\n### Sub\n- L2\n- L3\n");
  assert.equal(appendLogLine("x\r\n\r\n## Log\r\n- L1\r\n", "- L2"), "x\r\n\r\n## Log\r\n- L1\r\n- L2\r\n");
});

test("lastClosedOn finds the last close", () => {
  assert.equal(lastClosedOn("## Log\n- 2026-11-01 · closed\n- 2026-11-03 · reopened\n- 2026-11-07 · closed\n"), "2026-11-07");
  const c = "## Log\n- 2026-11-01 · status todo → done\n- 2026-11-03 · status done → todo\n- 2026-11-05 · status todo → cancelled\n";
  assert.equal(lastClosedOn(c), "2026-11-05");
  assert.equal(lastClosedOn("## Log\n- 2026-11-01 · created · with Marc\n"), null);
  assert.equal(lastClosedOn("## Log\r\n- 2026-11-02 · status blocked → done\r\n"), "2026-11-02");
});

test("closeLine adds the note when there is one", () => {
  assert.equal(closeLine("2026-11-25", "done · thanks"), "- 2026-11-25 · closed · done · thanks");
  assert.equal(closeLine("2026-11-25", "  "), "- 2026-11-25 · closed");
});

test("lastClose reads the date and the note of the last close", () => {
  const c = "## Log\n- 2026-11-01 · closed · first\n- 2026-11-03 · reopened\n- 2026-11-07 · closed · sent · thanks\n";
  assert.deepEqual(lastClose(c), { date: "2026-11-07", note: "sent · thanks" });
  assert.equal(lastClosedOn(c), "2026-11-07");
  assert.deepEqual(lastClose("## Log\n- 2026-11-01 · closed\n"), { date: "2026-11-01", note: "" });
  assert.deepEqual(lastClose("## Log\n- 2026-11-05 · status todo → done\n"), { date: "2026-11-05", note: "" });
  assert.equal(lastClose("## Log\n- 2026-11-01 · created · with Marc\n"), null);
});
