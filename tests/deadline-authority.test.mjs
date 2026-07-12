import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const page = await readFile(new URL("app/page.tsx", root), "utf8");

test("Codex normalized deadline overrides the collected fallback", () => {
  assert.match(page, /aiResults\[job\.id\]\?\.normalized\?\.deadline\?\.trim\(\) \|\| job\.deadline/);
});

test("missing AI analysis does not invoke a frontend semantic rule engine", () => {
  assert.match(page, /等待 Codex 语义分析/);
  assert.doesNotMatch(page, /设计学\|艺术设计\|视觉传达/);
});
