#!/usr/bin/env python3
"""Build the incremental queue consumed by the scheduled Codex analysis task."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
RSJ = ROOT / "data/collected/bj-rsj.json"
OTHER = ROOT / "data/collected/other-sources.json"
PROFILE = ROOT / "data/profile.json"
ANALYSIS = ROOT / "data/ai-analysis.json"
QUEUE = ROOT / "data/ai-pending.json"
PROMPT_VERSION = 9


def digest(value: Any) -> str:
    encoded = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(encoded.encode("utf-8")).hexdigest()


def position_ids(notice_id: str, positions: list[dict[str, Any]]) -> list[str]:
    """Return stable IDs, including attachment identity when sheet/row collide."""
    bases = [
        f"{notice_id}-{position.get('sheet') or 'position'}-{position.get('row') or index}"
        for index, position in enumerate(positions)
    ]
    counts = {base: bases.count(base) for base in set(bases)}
    used: dict[str, int] = {}
    result: list[str] = []
    for index, (base, position) in enumerate(zip(bases, positions)):
        if counts[base] == 1:
            result.append(base)
            continue
        attachment_url = str(position.get("source_attachment_url", ""))
        identity = attachment_url.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1] or f"position-{index}"
        candidate = f"{base}-{identity}"
        used[candidate] = used.get(candidate, 0) + 1
        result.append(candidate if used[candidate] == 1 else f"{candidate}-{used[candidate]}")
    return result


def jobs() -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    rsj = json.loads(RSJ.read_text(encoding="utf-8"))
    for notice in rsj.get("notices", []):
        positions = notice.get("positions", [])
        if not positions:
            positions = [{"title": notice.get("title"), "organization": notice.get("publisher"), "sheet": "notice", "row": 0}]
        ids = position_ids(notice["id"], positions)
        for position, job_id in zip(positions, ids):
            item = dict(position)
            item.update({
                "id": job_id,
                "notice_title": notice.get("title", ""), "publisher": notice.get("publisher", ""),
                "published_at": notice.get("published_at", ""), "deadline": notice.get("deadline", ""),
                "source_url": notice.get("source_url", ""),
                "source_group": "北京市机关单位", "establishment_type": "事业编制",
            })
            if notice.get("body_text"):
                item.update({
                    "body_text": notice["body_text"],
                    "notice_content_hash": notice.get("content_hash", ""),
                    "notice_attachments": notice.get("attachments", []),
                })
            result.append(item)
    other = json.loads(OTHER.read_text(encoding="utf-8"))
    for item in other.get("items", []):
        result.append({
            **item,
            "notice_title": item.get("title", ""),
            "source_group": item.get("category", ""),
            "establishment_type": item.get("establishment_type", ""),
        })
    return result


def main() -> int:
    profile = json.loads(PROFILE.read_text(encoding="utf-8"))
    analysis = json.loads(ANALYSIS.read_text(encoding="utf-8")) if ANALYSIS.exists() else {"results": {}}
    previous = analysis.get("results", {})
    pending = []
    for job in jobs():
        content_hash = digest({"job": job, "profile": profile, "prompt_version": PROMPT_VERSION})
        if previous.get(job["id"], {}).get("content_hash") == content_hash:
            continue
        pending.append({"id": job["id"], "content_hash": content_hash, "job": job})
    output = {"schema_version": 1, "profile": profile, "pending_count": len(pending), "items": pending}
    QUEUE.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"pending_count": len(pending)}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
