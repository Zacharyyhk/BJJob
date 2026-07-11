#!/usr/bin/env python3
"""Collect recruitment announcement links from every configured source.

This is the safe baseline adapter: one low-frequency request per source, no
login or browser automation. Dynamic sites that expose no public items remain
visible in the source report as `needs-adapter` for a later API-specific adapter.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup


ROOT = Path(__file__).resolve().parents[1]
SOURCES_PATH = ROOT / "data" / "sources.json"
OUTPUT_PATH = ROOT / "data" / "collected" / "other-sources.json"
BEIJING_TZ = timezone(timedelta(hours=8))
USER_AGENT = "BJJob/0.1 (personal low-frequency recruitment index; source links preserved)"
INCLUDE_RE = re.compile(r"招聘|招录|考录|公务员|事业单位|校园招聘|社会招聘|实习|职位|岗位|选调|优培")
EXCLUDE_RE = re.compile(r"登录|注册|隐私|关于我们|网站地图|联系我们|帮助|政策法规|成绩查询|报名入口")
DATE_RE = re.compile(r"(20\d{2})[-年/.](\d{1,2})[-月/.](\d{1,2})日?")


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def now_iso() -> str:
    return datetime.now(BEIJING_TZ).replace(microsecond=0).isoformat()


def same_site(source_url: str, candidate_url: str) -> bool:
    source_host = urlparse(source_url).netloc.removeprefix("www.")
    candidate_host = urlparse(candidate_url).netloc.removeprefix("www.")
    return candidate_host == source_host or candidate_host.endswith("." + source_host)


def collect_source(session: requests.Session, source: dict[str, Any]) -> dict[str, Any]:
    started = time.monotonic()
    try:
        response = session.get(source["url"], timeout=30, allow_redirects=True)
        response.raise_for_status()
        if "text" in response.headers.get("Content-Type", "") or "html" in response.headers.get("Content-Type", ""):
            response.encoding = response.apparent_encoding or "utf-8"
        soup = BeautifulSoup(response.text, "html.parser")
        items: dict[str, dict[str, str]] = {}
        for link in soup.find_all("a", href=True):
            title = clean(link.get("title") or link.get_text(" ", strip=True))
            if len(title) < 4 or not INCLUDE_RE.search(title) or EXCLUDE_RE.search(title):
                continue
            url = urljoin(response.url, link["href"])
            if not url.startswith(("http://", "https://")) or not same_site(response.url, url):
                continue
            context = clean(link.parent.get_text(" ", strip=True)) if link.parent else title
            date_match = DATE_RE.search(context)
            published = ""
            if date_match:
                year, month, day = date_match.groups()
                published = f"{int(year):04d}-{int(month):02d}-{int(day):02d}"
            items[url] = {
                "id": hashlib.sha1(url.encode("utf-8")).hexdigest()[:16],
                "title": title[:240],
                "organization": source["name"],
                "category": source["group"],
                "published_at": published,
                "source_name": source["name"],
                "source_url": url,
                "source_home": source["url"],
            }
        values = list(items.values())[:60]
        return {
            "source_id": source["id"],
            "source_name": source["name"],
            "group": source["group"],
            "home": source["url"],
            "status": "collected" if values else "needs-adapter",
            "http_status": response.status_code,
            "final_url": response.url,
            "item_count": len(values),
            "duration_ms": round((time.monotonic() - started) * 1000),
            "items": values,
        }
    except Exception as exc:
        return {
            "source_id": source["id"],
            "source_name": source["name"],
            "group": source["group"],
            "home": source["url"],
            "status": "unavailable",
            "http_status": getattr(getattr(exc, "response", None), "status_code", None),
            "item_count": 0,
            "error": clean(exc)[:300],
            "items": [],
        }


def main() -> int:
    sources = json.loads(SOURCES_PATH.read_text(encoding="utf-8"))
    sources = [source for source in sources if source["id"] != "bj-rsj-institutions"]
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "zh-CN,zh;q=0.9"})
    reports = []
    for index, source in enumerate(sources):
        if index:
            time.sleep(2)
        report = collect_source(session, source)
        reports.append(report)
        print(f"{source['id']}: {report['status']} ({report['item_count']})")

    all_items: dict[str, dict[str, str]] = {}
    for report in reports:
        for item in report["items"]:
            all_items[item["source_url"]] = item
    output = {
        "generated_at": now_iso(),
        "source_count": len(reports),
        "collected_source_count": sum(report["status"] == "collected" for report in reports),
        "needs_adapter_count": sum(report["status"] == "needs-adapter" for report in reports),
        "unavailable_count": sum(report["status"] == "unavailable" for report in reports),
        "item_count": len(all_items),
        "sources": reports,
        "items": sorted(all_items.values(), key=lambda item: (item["published_at"], item["title"]), reverse=True),
    }
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
