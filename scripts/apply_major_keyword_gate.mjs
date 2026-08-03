#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const pendingPath = path.join(root, "data", "ai-pending.json");
const analysisPath = path.join(root, "data", "ai-analysis.json");

const DESIGN_MAJOR = /设计|艺术|美术|视觉传达|交互|数字媒体|动画|1301|1305|1357|13类|艺术学/;
const OTHER_MAJOR = /计算机|软件工程|人工智能|数学|统计|物理|化学|电子|通信|自动化|机械|电气|材料|生物|医学|临床|药学|护理|法学|法律|经济|金融|会计|财务|工商管理|市场营销|新闻|传播|中文|语言|物流|供应链|信息安全|网络安全|土木|建筑/;
const UNLIMITED_MAJOR = /专业不限|不限专业|不限制专业|专业背景不限|无专业要求/;

export function requirementText(job) {
  const raw = job.raw_fields || {};
  return [raw.requirement, raw.jobRequirement, raw.request, raw.topicRequirement]
    .filter((value) => typeof value === "string" && value.trim())
    .join("\n");
}

export function findMajorConflict(job) {
  const clauses = requirementText(job)
    .split(/[；;。\n]/)
    .map((value) => value.trim())
    .filter((value) => value.includes("专业"));

  return clauses.find((clause) => (
    !UNLIMITED_MAJOR.test(clause)
    && !DESIGN_MAJOR.test(clause)
    && OTHER_MAJOR.test(clause)
  )) || "";
}

function normalizedResult(item, quote, analyzedAt) {
  const job = item.job;
  return {
    content_hash: item.content_hash,
    match_level: "no",
    label: "不符合",
    score: 0,
    normalized: {
      organization: job.organization || "",
      title: job.title || "",
      location: job.location || "",
      education: "",
      majors: [quote],
      graduation_years: [],
      fresh_graduate_required: false,
      political_status: "",
      gender_requirement: "",
      responsibilities: "",
      requirements: quote,
      headcount: "",
      applicant_type: "",
      position_code: job.raw_fields?.code || job.raw_fields?.postId || "",
      deadline: job.deadline || "",
    },
    reasons: [],
    conflicts: [`任职要求明确限定或优先考虑非设计类专业：${quote}`],
    needs_confirmation: [],
    evidence: [{ field: "任职要求", quote }],
    analyzed_at: analyzedAt,
    analysis_version: 1,
    analysis_method: "major-keyword-gate",
  };
}

export function collectGateResults(pending, analyzedAt = new Date().toISOString()) {
  return Object.fromEntries(pending.items.flatMap((item) => {
    const quote = findMajorConflict(item.job);
    return quote ? [[item.id, normalizedResult(item, quote, analyzedAt)]] : [];
  }));
}

function main() {
  const apply = process.argv.includes("--apply");
  const pending = JSON.parse(fs.readFileSync(pendingPath, "utf8"));
  const results = collectGateResults(pending);
  const summary = {
    mode: apply ? "apply" : "dry-run",
    pending: pending.pending_count,
    auto_no: Object.keys(results).length,
    remaining_for_codex: pending.pending_count - Object.keys(results).length,
  };

  if (apply) {
    const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
    analysis.results ||= {};
    Object.assign(analysis.results, results);
    analysis.schema_version = 1;
    analysis.profile_version = pending.profile.version;
    analysis.prompt_version = pending.prompt_version;
    analysis.generated_at = new Date().toISOString();
    fs.writeFileSync(analysisPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
  }

  process.stdout.write(`${JSON.stringify(summary)}\n`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main();
