import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const [page, collected, analysis] = await Promise.all([
  readFile(new URL("app/page.tsx", root), "utf8"),
  readFile(new URL("data/collected/bj-rsj.json", root), "utf8").then(JSON.parse),
  readFile(new URL("data/ai-analysis.json", root), "utf8").then(JSON.parse),
]);

test("notice-only cards use the same IDs as semantic analysis", () => {
  assert.match(page, /id: `\$\{notice\.id\}-notice-0`/);
  for (const notice of collected.notices) {
    if (!notice.positions.length) {
      assert.ok(
        analysis.results[`${notice.id}-notice-0`],
        `${notice.id}: notice-only card has no matching semantic analysis`,
      );
    }
  }
});

test("jobs without semantic analysis never enter the recommendation list", () => {
  assert.match(
    page,
    /currentJobs\.filter\(\(job\) => aiResults\[job\.id\] && matchForProfile\(job\)\.level !== "no"\)/,
  );
});
