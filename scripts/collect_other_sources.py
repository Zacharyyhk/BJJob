#!/usr/bin/env python3
"""Low-frequency collectors for the configured recruitment sources.

Every source is requested at most a few times per run.  The dedicated adapters
below cover static government columns, seasonal civil-service pages and the
public data embedded by large-company recruitment sites.
"""

from __future__ import annotations

import hashlib
import json
import re
import time
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Any, Callable
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
SOURCES_PATH = ROOT / "data" / "sources.json"
OUTPUT_PATH = ROOT / "data" / "collected" / "other-sources.json"
BEIJING_TZ = timezone(timedelta(hours=8))
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 BJJob/0.2"
INCLUDE_RE = re.compile(r"招聘|招录|考录|公务员|事业单位|校园招聘|社会招聘|实习|职位|岗位|选调|优培|补录|调剂")
EXCLUDE_RE = re.compile(r"登录|注册|隐私|关于我们|网站地图|联系我们|帮助|政策法规|成绩查询|报名入口")
DATE_RE = re.compile(r"(20\d{2})[-年./](\d{1,2})[-月./](\d{1,2})日?")


def clean(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def now_iso() -> str:
    return datetime.now(BEIJING_TZ).replace(microsecond=0).isoformat()


def make_item(source: dict[str, Any], title: str, url: str, published: str = "", organization: str = "") -> dict[str, str]:
    return {
        "id": hashlib.sha1(url.encode("utf-8")).hexdigest()[:16],
        "title": clean(title)[:240],
        "organization": clean(organization) or source["name"],
        "category": source["group"],
        "published_at": published,
        "source_name": source["name"],
        "source_url": url,
        "source_home": source["url"],
    }


def published_from(text: str) -> str:
    match = DATE_RE.search(text)
    if not match:
        return ""
    year, month, day = match.groups()
    return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"


def same_site(base: str, candidate: str) -> bool:
    a = urlparse(base).netloc.removeprefix("www.")
    b = urlparse(candidate).netloc.removeprefix("www.")
    return b == a or b.endswith("." + a)


def parse_links(source: dict[str, Any], response: requests.Response, allow_external: bool = False,
                href_pattern: str | None = None) -> list[dict[str, str]]:
    soup = BeautifulSoup(response.text, "html.parser")
    found: dict[str, dict[str, str]] = {}
    for link in soup.find_all("a", href=True):
        title = clean(link.get("title") or link.get_text(" ", strip=True))
        href = clean(link.get("href"))
        wrapped = re.match(r"javascript:checkUrl\(['\"](.+?)['\"]\)", href)
        if wrapped:
            href = wrapped.group(1)
        if len(title) < 4 or EXCLUDE_RE.search(title):
            continue
        if not INCLUDE_RE.search(title) and not (href_pattern and re.search(href_pattern, href)):
            continue
        url = urljoin(response.url, href)
        if not url.startswith(("http://", "https://")):
            continue
        if not allow_external and not same_site(response.url, url):
            continue
        context = clean(link.parent.get_text(" ", strip=True)) if link.parent else title
        found[url] = make_item(source, title, url, published_from(context))
    return list(found.values())[:100]


def static_adapter(session: requests.Session, source: dict[str, Any], **kwargs: Any) -> tuple[list[dict[str, str]], str, str]:
    response = session.get(source["url"], timeout=30, allow_redirects=True)
    response.raise_for_status()
    response.encoding = response.apparent_encoding or "utf-8"
    items = parse_links(source, response, **kwargs)
    return items, "collected" if items else "collected-empty", response.url


def yearly_civil_service(session: requests.Session, source: dict[str, Any]) -> tuple[list[dict[str, str]], str, str]:
    # The annual host is only populated during recruitment. Probe current and next
    # annual专题; an inactive redirect is a valid seasonal state, not an error.
    years = sorted({datetime.now(BEIJING_TZ).year, datetime.now(BEIJING_TZ).year + 1}, reverse=True)
    for year in years:
        url = f"http://bm.scs.gov.cn/kl{year}"
        response = session.get(url, timeout=30, allow_redirects=True)
        response.encoding = response.apparent_encoding or "utf-8"
        if response.ok and len(response.text) > 1000:
            current = {**source, "url": url, "name": f"{year}年度国考专题"}
            items = parse_links(current, response, allow_external=True)
            if items:
                return items, "collected", response.url
    return [], "seasonal-inactive", response.url


def baidu_adapter(session: requests.Session, source: dict[str, Any]) -> tuple[list[dict[str, str]], str, str]:
    found: dict[str, dict[str, str]] = {}
    final_url = source["url"]
    for recruit_type in ("GRADUATE", "INTERN", "SOCIAL"):
        url = f"https://talent.baidu.com/jobs/list?recruitType={recruit_type}"
        response = session.get(url, timeout=40)
        response.raise_for_status()
        final_url = response.url
        marker = re.search(r"window\.__INITIAL_DATA__\s*=\s*", response.text)
        if not marker:
            continue
        try:
            # Baidu serializes JavaScript `undefined` in this otherwise-JSON object.
            serialised = response.text[marker.end():].replace("undefined", "null")
            payload, _ = json.JSONDecoder().raw_decode(serialised)
        except json.JSONDecodeError:
            continue

        def walk(value: Any) -> None:
            if isinstance(value, dict):
                title = clean(value.get("name") or value.get("jobName") or value.get("title"))
                place = clean(value.get("workPlace") or value.get("workplace") or value.get("city"))
                code = clean(value.get("jobId") or value.get("postId") or value.get("jobCode") or value.get("code") or value.get("id"))
                if title and code and ("北京" in place or not place):
                    detail = f"https://talent.baidu.com/jobs/detail/{code}"
                    found[detail] = make_item(source, title, detail, clean(value.get("publishDate")), "百度")
                for child in value.values():
                    walk(child)
            elif isinstance(value, list):
                for child in value:
                    walk(child)
        walk(payload)
    values = list(found.values())[:200]
    return values, "collected" if values else "collected-empty", final_url


def api_spa_adapter(session: requests.Session, source: dict[str, Any], endpoint: str) -> tuple[list[dict[str, str]], str, str]:
    """Probe a documented public SPA endpoint; keep failures distinct from empty data."""
    response = session.get(endpoint, timeout=30, headers={"Referer": source["url"]})
    if not response.ok:
        response.raise_for_status()
    content_type = response.headers.get("Content-Type", "")
    if "json" not in content_type:
        return [], "adapter-blocked", response.url
    data = response.json()
    found: dict[str, dict[str, str]] = {}
    def walk(value: Any) -> None:
        if isinstance(value, dict):
            title = clean(value.get("jobName") or value.get("name") or value.get("title"))
            city = clean(value.get("workCity") or value.get("cityName") or value.get("workPlace"))
            ident = clean(value.get("jobId") or value.get("id") or value.get("code"))
            if title and ident and (not city or "北京" in city):
                url = source["url"].split("?")[0] + ("&" if "?" in source["url"] else "?") + "jobId=" + ident
                found[url] = make_item(source, title, url)
            for child in value.values(): walk(child)
        elif isinstance(value, list):
            for child in value: walk(child)
    walk(data)
    values = list(found.values())[:200]
    return values, "collected" if values else "collected-empty", response.url


SPECIAL: dict[str, Callable[..., tuple[list[dict[str, str]], str, str]]] = {
    "bj-civil-service": lambda s, x: static_adapter(s, x, allow_external=True),
    "bj-exam-notices": lambda s, x: static_adapter(s, x),
    "national-civil-service-yearly": yearly_civil_service,
    "bj-sasac-jobs": lambda s, x: static_adapter(s, x, allow_external=True),
    "iguopin": lambda s, x: api_spa_adapter(s, x, "https://www.iguopin.com/api/jobs/v3/list"),
    "ggj-notices": lambda s, x: static_adapter(s, x),
    "cnipa-personnel": lambda s, x: static_adapter(s, x, href_pattern=r"/art/\d{4}/.*art_74_"),
    "baidu-jobs": baidu_adapter,
    "meituan-jobs": lambda s, x: api_spa_adapter(s, x, "https://zhaopin.meituan.com/api/official/job/getJobList"),
}


def collect_source(session: requests.Session, source: dict[str, Any]) -> dict[str, Any]:
    started = time.monotonic()
    try:
        adapter = SPECIAL.get(source["id"], static_adapter)
        items, status, final_url = adapter(session, source)
        return {"source_id": source["id"], "source_name": source["name"], "group": source["group"],
                "home": source["url"], "adapter": "dedicated" if source["id"] in SPECIAL else "static",
                "status": status, "final_url": final_url, "item_count": len(items),
                "duration_ms": round((time.monotonic() - started) * 1000), "items": items}
    except Exception as exc:
        status_code = getattr(getattr(exc, "response", None), "status_code", None)
        return {"source_id": source["id"], "source_name": source["name"], "group": source["group"],
                "home": source["url"], "adapter": "dedicated" if source["id"] in SPECIAL else "static",
                "status": "adapter-blocked" if source["id"] in SPECIAL else "unavailable",
                "http_status": status_code, "item_count": 0, "error": clean(exc)[:300], "items": []}


def main() -> int:
    sources = [s for s in json.loads(SOURCES_PATH.read_text(encoding="utf-8")) if s["id"] != "bj-rsj-institutions"]
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "zh-CN,zh;q=0.9", "Accept": "text/html,application/json"})
    reports = []
    for index, source in enumerate(sources):
        if index: time.sleep(2)
        report = collect_source(session, source)
        reports.append(report)
        print(f"{source['id']}: {report['status']} ({report['item_count']})")
    all_items = {item["source_url"]: item for report in reports for item in report["items"]}
    output = {"generated_at": now_iso(), "source_count": len(reports),
              "collected_source_count": sum(r["status"] in ("collected", "collected-empty", "seasonal-inactive") for r in reports),
              "needs_adapter_count": 0,
              "unavailable_count": sum(r["status"] in ("unavailable", "adapter-blocked") for r in reports),
              "item_count": len(all_items), "sources": reports,
              "items": sorted(all_items.values(), key=lambda i: (i["published_at"], i["title"]), reverse=True)}
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT_PATH.write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
