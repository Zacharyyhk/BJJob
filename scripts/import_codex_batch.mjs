#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const batchPath = process.argv[2] && path.resolve(process.cwd(), process.argv[2]);

if (!batchPath) {
  throw new Error("Usage: node scripts/import_codex_batch.mjs <model-authored-batch.json>");
}

const pendingPath = path.join(root, "data", "ai-pending.json");
const analysisPath = path.join(root, "data", "ai-analysis.json");
const pending = JSON.parse(fs.readFileSync(pendingPath, "utf8"));
const analysis = JSON.parse(fs.readFileSync(analysisPath, "utf8"));
const batch = JSON.parse(fs.readFileSync(batchPath, "utf8"));
const pendingById = new Map(pending.items.map((item) => [item.id, item]));
const entries = Object.entries(batch.results ?? {});

if (!Number.isInteger(pending.prompt_version)) {
  throw new Error("Pending queue is missing prompt_version; rerun prepare_codex_analysis.py");
}

if (entries.length === 0) {
  throw new Error("Batch contains no model-authored results");
}

for (const [id, result] of entries) {
  const item = pendingById.get(id);
  if (!item) {
    throw new Error(`Batch id is not currently pending: ${id}`);
  }
  if (result.content_hash !== item.content_hash) {
    throw new Error(`content_hash mismatch for ${id}`);
  }
  if (!Array.isArray(result.evidence) || result.evidence.length === 0) {
    throw new Error(`Missing model-authored evidence for ${id}`);
  }
  if (result.match_level === "possible" && !(result.needs_confirmation?.length > 0)) {
    throw new Error(`Missing needs_confirmation for ${id}`);
  }
  if (result.match_level === "no" && !(result.conflicts?.length > 0)) {
    throw new Error(`Missing conflicts for ${id}`);
  }
  if (!['match', 'possible', 'no'].includes(result.match_level)) {
    throw new Error(`Invalid match_level for ${id}`);
  }
}

analysis.results ??= {};
for (const [id, result] of entries) {
  analysis.results[id] = result;
}
analysis.schema_version = 1;
analysis.profile_version = pending.profile.version;
analysis.prompt_version = pending.prompt_version;
analysis.generated_at = batch.generated_at;

fs.writeFileSync(analysisPath, `${JSON.stringify(analysis, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ imported: entries.length, batch: batchPath })}\n`);
