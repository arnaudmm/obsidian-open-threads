import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("manifest declares the Open Threads plugin", () => {
  const m = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
  assert.equal(m.id, "open-threads");
  assert.equal(m.name, "Open Threads");
  assert.equal(m.version, "0.1.0");
  assert.equal(m.minAppVersion, "1.13.0");
  assert.equal(m.isDesktopOnly, false);
  assert.doesNotMatch(m.id, /obsidian/i);
});

test("versions.json maps 0.1.0 to 1.13.0", () => {
  const v = JSON.parse(readFileSync(new URL("../versions.json", import.meta.url), "utf8"));
  assert.deepEqual(v, { "0.1.0": "1.13.0" });
});
