import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("manifest declares the Open Threads plugin", () => {
  const m = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(m.id, "open-threads");
  assert.equal(m.name, "Open Threads");
  assert.match(m.version, /^\d+\.\d+\.\d+(-[\w.]+)?$/);
  assert.equal(m.minAppVersion, "1.13.0");
  assert.equal(m.isDesktopOnly, false);
  assert.doesNotMatch(m.id, /obsidian/i);
});

// The exact version changes with every release; version-bump.test.ts checks the files agree on it.
test("versions.json maps every version to a minimum Obsidian version", () => {
  const v = JSON.parse(readFileSync(new URL("../versions.json", import.meta.url), "utf8"));
  assert.equal(v["0.1.0"], "1.13.0");
  for (const app of Object.values(v)) assert.match(app as string, /^\d+\.\d+\.\d+$/);
});
