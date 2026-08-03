import assert from "node:assert/strict";
import test from "node:test";

import { findMajorConflict } from "../scripts/apply_major_keyword_gate.mjs";

const job = (requirement) => ({ raw_fields: { requirement } });

test("major gate skips explicit non-design majors, including preferred majors", () => {
  assert.match(findMajorConflict(job("计算机相关专业")), /计算机/);
  assert.match(findMajorConflict(job("物流、供应链等相关专业优先")), /物流/);
});

test("major gate preserves unrestricted, unspecified, and design-compatible majors", () => {
  assert.equal(findMajorConflict(job("专业不限")), "");
  assert.equal(findMajorConflict(job("沟通能力强，有运营经验")), "");
  assert.equal(findMajorConflict(job("视觉设计、计算机相关专业优先")), "");
  assert.equal(findMajorConflict(job("1301、1305、1357相关专业")), "");
});
