#!/usr/bin/env python3
"""Validate that every current job has a complete, current model analysis."""

from __future__ import annotations

import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
ANALYSIS = ROOT / "data" / "ai-analysis.json"
PROFILE = ROOT / "data" / "profile.json"
PREPARE = ROOT / "scripts" / "prepare_codex_analysis.py"


def load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8-sig"))


def prepare_module():
    spec = importlib.util.spec_from_file_location("prepare_codex_analysis", PREPARE)
    if spec is None or spec.loader is None:
        raise RuntimeError("无法加载分析准备脚本")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


def release_fingerprint(current: dict[str, dict[str, Any]], profile: dict[str, Any], prompt_version: int, digest) -> str:
    bound_results = {
        job_id: {
            "content_hash": result.get("content_hash"),
            "match_level": result.get("match_level"),
            "normalized": result.get("normalized"),
            "reasons": result.get("reasons"),
            "conflicts": result.get("conflicts"),
            "needs_confirmation": result.get("needs_confirmation"),
            "evidence": result.get("evidence"),
        }
        for job_id, result in sorted(current.items())
    }
    return digest({"profile": profile, "prompt_version": prompt_version, "results": bound_results})


def validate() -> tuple[list[str], dict[str, Any]]:
    prepare = prepare_module()
    profile = load_json(PROFILE)
    analysis = load_json(ANALYSIS)
    results = analysis.get("results") or {}
    errors: list[str] = []
    current: dict[str, dict[str, Any]] = {}

    if analysis.get("profile_version") != profile.get("version"):
        errors.append("分析结果的个人档案版本不是当前版本")
    if analysis.get("prompt_version") != prepare.PROMPT_VERSION:
        errors.append("分析结果的模型规则版本不是当前版本")

    for job in prepare.jobs():
        job_id = job["id"]
        expected_hash = prepare.digest({"job": job, "profile": profile, "prompt_version": prepare.PROMPT_VERSION})
        result = results.get(job_id)
        if not isinstance(result, dict):
            errors.append(f"{job_id}: 缺少分析结果")
            continue
        current[job_id] = result
        if result.get("content_hash") != expected_hash:
            errors.append(f"{job_id}: 原始数据或个人档案变化后尚未重新分析")
        if result.get("match_level") not in {"match", "possible", "no"}:
            errors.append(f"{job_id}: match_level 无效")
        if not isinstance(result.get("normalized"), dict):
            errors.append(f"{job_id}: 缺少 normalized")
        evidence = result.get("evidence")
        if not isinstance(evidence, list) or not evidence or not all(item.get("quote") for item in evidence if isinstance(item, dict)):
            errors.append(f"{job_id}: 缺少有效原文证据")
        if result.get("match_level") == "possible" and not result.get("needs_confirmation"):
            errors.append(f"{job_id}: 需确认岗位没有写明具体确认事项")
        if result.get("match_level") == "no" and not result.get("conflicts"):
            errors.append(f"{job_id}: 不符合岗位没有写明硬冲突")

    fingerprint = release_fingerprint(current, profile, prepare.PROMPT_VERSION, prepare.digest)
    summary = {
        "job_count": len(prepare.jobs()),
        "validated_count": len(current),
        "error_count": len(errors),
        "profile_version": profile.get("version"),
        "prompt_version": prepare.PROMPT_VERSION,
        "fingerprint": fingerprint,
    }
    return errors, summary


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.parse_args()

    errors, summary = validate()
    if errors:
        print(json.dumps({"status": "invalid", "summary": summary, "errors": errors[:100]}, ensure_ascii=False, indent=2))
        return 1

    print(json.dumps({"status": "valid", "summary": summary}, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
