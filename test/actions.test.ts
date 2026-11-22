import { test } from "node:test";
import assert from "node:assert/strict";
import { checkIn, createThread, DEFAULT_FOLDER, setField } from "../src/actions.ts";
import type { NewThread } from "../src/core/thread.ts";
import { FakeStore } from "./fake-store.ts";

const t = "2026-11-22";
const d: NewThread = { title: "API", person: "Marc", priority: "normal", due: null, followUp: "2026-11-27", description: "" };

test("createThread writes a note in the folder and logs creation", async () => {
  const s = new FakeStore();
  const p = await createThread(s, " ", d, t);
  assert.equal(DEFAULT_FOLDER, "Threads");
  assert.equal(p, "Threads/API.md");
  assert.deepEqual(s.folders, ["Threads"]);
  const f = s.files.get(p)!;
  assert.equal(f.fm!.follow_up, "2026-11-27");
  assert.equal(f.fm!.with, "[[Marc]]");
  assert.equal(f.fm!.type, "thread");
  assert.match(f.body, /- 2026-11-22 · created · with Marc\n$/);
});

test("createThread sanitises the title, avoids clashes and uses the folder's real case", async () => {
  const s = new FakeStore();
  s.existingFolders = ["threads"];
  assert.equal(await createThread(s, "Threads/", { ...d, title: "API: v2 / rate?" }, t), "threads/API v2 rate.md");
  assert.equal(await createThread(s, "Threads", { ...d, title: "API: v2 / rate?" }, t), "threads/API v2 rate 2.md");
});

test("createThread refuses an empty title or person", async () => {
  await assert.rejects(createThread(new FakeStore(), "D", { ...d, title: " ?/ " }, t), /Title is empty/);
  await assert.rejects(createThread(new FakeStore(), "D", { ...d, person: "" }, t), /Pick a person/);
});

test("checkIn sets the next follow-up and logs, even with no Log heading", async () => {
  const s = new FakeStore();
  s.put("D/x.md", { type: "thread", follow_up: "2026-11-20" }, "Body\n");
  await checkIn(s, "D/x.md", "ok", "2026-11-28", "2026-11-25");
  assert.equal(s.files.get("D/x.md")!.fm!.follow_up, "2026-11-28");
  assert.equal(s.files.get("D/x.md")!.body, "Body\n\n## Log\n- 2026-11-25 · check-in · ok · next 2026-11-28\n");
});

test("checkIn with no next date clears follow_up", async () => {
  const s = new FakeStore();
  s.put("x", { type: "thread", follow_up: "2026-11-20" }, "## Log\n");
  await checkIn(s, "x", "", null, t);
  assert.equal("follow_up" in s.files.get("x")!.fm!, false);
  assert.equal(s.files.get("x")!.body, `## Log\n- ${t} · check-in · next none\n`);
});

test("setField logs only real changes", async () => {
  const s = new FakeStore();
  s.put("x", { type: "thread", status: "todo", with: "[[Marc]]" }, "## Log\n");
  assert.equal(await setField(s, "x", "status", "todo", t), false);
  assert.equal(await setField(s, "x", "status", "blocked", t), true);
  assert.equal(await setField(s, "x", "with", "Ann", t), true);
  assert.equal(s.files.get("x")!.fm!.with, "[[Ann]]");
  assert.equal(await setField(s, "x", "due", null, t), false);
  assert.equal(s.files.get("x")!.body, `## Log\n- ${t} · status todo → blocked\n- ${t} · with Marc → Ann\n`);
});

test("setField writes and clears dates, and treats a missing priority as normal", async () => {
  const s = new FakeStore();
  s.put("x", { type: "thread" }, "");
  assert.equal(await setField(s, "x", "follow-up", "2026-12-01", t), true);
  assert.equal(s.files.get("x")!.fm!.follow_up, "2026-12-01");
  assert.equal(await setField(s, "x", "follow-up", null, t), true);
  assert.equal("follow_up" in s.files.get("x")!.fm!, false);
  assert.equal(await setField(s, "x", "priority", "normal", t), false);
  assert.equal(await setField(s, "x", "due", "2026-12-04", t), true);
  assert.equal(s.files.get("x")!.fm!.due, "2026-12-04");
  assert.equal(s.files.get("x")!.body,
    `## Log\n- ${t} · follow-up none → 2026-12-01\n- ${t} · follow-up 2026-12-01 → none\n- ${t} · due none → 2026-12-04\n`);
});
