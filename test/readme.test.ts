import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseBlockSource } from "../src/core/block.ts";

test("every threads block shown in the README parses without error", () => {
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  const blocks = [...readme.matchAll(/^[ \t]*```threads\n([\s\S]*?)^[ \t]*```/gm)].map((m) => m[1]);
  assert.ok(blocks.length >= 2, "expected the README to show at least two threads blocks");
  for (const block of blocks) assert.equal("error" in parseBlockSource(block), false, block);
});
