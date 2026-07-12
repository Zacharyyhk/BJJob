import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const sources = JSON.parse(await readFile(new URL("data/sources.json", root), "utf8"));
const collected = JSON.parse(await readFile(new URL("data/collected/other-sources.json", root), "utf8"));
const groups = new Set(["互联网大厂", "北京市机关单位", "中央机关单位", "央国企"]);
const establishmentTypes = new Set(["事业编制", "公务员编制"]);

test("configured sources use the two-level taxonomy", () => {
  for (const source of sources) {
    assert.ok(groups.has(source.group), `${source.id}: unexpected group ${source.group}`);
    if (source.group === "北京市机关单位" || source.group === "中央机关单位") {
      assert.ok(establishmentTypes.has(source.establishment_type), `${source.id}: missing establishment type`);
    } else {
      assert.equal(source.establishment_type, undefined, `${source.id}: establishment type does not apply`);
    }
  }
});

test("collected jobs use valid groups and establishment types", () => {
  for (const item of collected.items) {
    assert.ok(groups.has(item.category), `${item.id}: unexpected category ${item.category}`);
    if (item.category === "北京市机关单位" || item.category === "中央机关单位") {
      assert.ok(establishmentTypes.has(item.establishment_type), `${item.id}: missing establishment type`);
    } else {
      assert.equal(item.establishment_type, undefined, `${item.id}: establishment type does not apply`);
    }
  }
});
