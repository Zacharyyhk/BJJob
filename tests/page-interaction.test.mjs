import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");

test("desktop job browser keeps the compact paginated master-detail contract", () => {
  assert.match(page, /const PAGE_SIZE = 30/);
  assert.match(page, /className="browse-grid"/);
  assert.match(page, /className="filter-panel"/);
  assert.match(page, /className="results-column"/);
  assert.match(page, /className="detail-panel"/);
  assert.match(page, /className="pagination"/);
});

test("filter, selection and keyboard state can survive navigation", () => {
  assert.match(page, /new URLSearchParams\(window\.location\.search\)/);
  assert.match(page, /window\.history\.replaceState/);
  assert.match(page, /sessionStorage\.setItem\("job-list-scroll"/);
  assert.match(page, /\["j", "k", "ArrowDown", "ArrowUp"\]/);
});

test("official job link remains directly available in compact rows", () => {
  assert.match(page, /className="compact-actions"/);
  assert.match(page, /href=\{job\.sourceUrl\}/);
  assert.match(page, /岗位详情/);
});
