import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, daysBetween, localDate, parseDate, PRESETS, resolvePreset, shiftWeekend, weekday } from "../src/core/dates.ts";

// 2026-11-20 is a Friday.

test("presets move weekends to Monday", () => {
  assert.equal(resolvePreset(PRESETS[0], "2026-11-20"), "2026-11-23"); // Fri+1 = Sat → Mon
  assert.equal(resolvePreset(PRESETS[2], "2026-11-20"), "2026-11-27"); // +7 = Fri
  assert.deepEqual(PRESETS.map((p) => p.days), [1, 3, 7, 10, 14]);
  assert.deepEqual(PRESETS.map((p) => p.label), ["tomorrow", "in 3 days", "in 1 week", "in 10 days", "in 2 weeks"]);
});

test("shiftWeekend and weekday", () => {
  assert.equal(weekday("2026-11-20"), 5);
  assert.equal(shiftWeekend("2026-11-21"), "2026-11-23");
  assert.equal(shiftWeekend("2026-11-22"), "2026-11-23");
  assert.equal(shiftWeekend("2026-11-24"), "2026-11-24");
});

test("parseDate reads the typed date grammar", () => {
  const t = "2026-11-20";
  const d = (s: string) => parseDate(s, t);
  assert.deepEqual(d(" None "), { date: null });
  assert.deepEqual(d(""), { date: null });
  assert.deepEqual(d("today"), { date: t });
  assert.deepEqual(d("tomorrow"), { date: "2026-11-21" }); // no weekend shift
  assert.deepEqual(d("fri"), { date: "2026-11-27" });
  assert.deepEqual(d("Monday"), { date: "2026-11-23" });
  assert.deepEqual(d("+3d"), { date: "2026-11-23" });
  assert.deepEqual(d("+2w"), { date: "2026-12-04" });
  assert.deepEqual(d("2027-02-28"), { date: "2027-02-28" });
  assert.ok("error" in d("2027-02-30"));
  assert.ok("error" in d("next week"));
  assert.ok("error" in d("+xd"));
  assert.deepEqual(d("soon"), { error: 'Unrecognised date "soon" (try 2026-11-20, 11-20, +3d, +1w, fri, tomorrow, none)' });
});

test("MM-DD rolls to next year when already past", () => {
  assert.deepEqual(parseDate("11-20", "2026-12-01"), { date: "2027-11-20" });
  assert.deepEqual(parseDate("12-01", "2026-12-01"), { date: "2026-12-01" });
  assert.ok("error" in parseDate("02-30", "2026-12-01"));
});

test("date arithmetic crosses months and years", () => {
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(addDays("2026-03-01", -1), "2026-02-28");
  assert.equal(daysBetween("2026-11-20", "2026-12-01"), 11);
  assert.equal(localDate(new Date(2026, 0, 5, 23, 30)), "2026-01-05");
});
