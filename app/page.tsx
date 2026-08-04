"use client";

import { useEffect, useMemo, useState } from "react";
import collected from "../data/collected/bj-rsj.json";
import otherSources from "../data/collected/other-sources.json";
import aiAnalysisData from "../data/ai-analysis.json";

type Position = {
  organization?: string;
  title?: string;
  category?: string;
  establishment_type?: string;
  headcount?: string;
  education?: string;
  degree?: string;
  major?: string;
  age?: string;
  household?: string;
  applicant_type?: string;
  requirements?: string;
  responsibilities?: string;
  location?: string;
  recruitment_type?: string;
  category_detail?: string;
  data_quality?: string;
  last_verified_at?: string;
  contact?: string;
  sheet?: string;
  row?: number;
  sourceAttachmentUrl?: string;
  source_attachment_url?: string;
  position_code?: string;
};

type Notice = {
  id: string;
  title: string;
  publisher: string;
  published_at: string;
  application_start_at: string;
  deadline: string;
  summary: string;
  source_url: string;
  positions: Position[];
};

type Job = Position & {
  id: string;
  noticeTitle: string;
  publisher: string;
  publishedAt: string;
  applicationStartAt: string;
  deadline: string;
  sourceUrl: string;
  isNotice: boolean;
  sourceName: string;
  sourceGroup: string;
  establishmentType: string;
};

type OtherSourceItem = Position & {
  id: string;
  title: string;
  organization: string;
  published_at: string;
  source_url: string;
  source_name: string;
  category: string;
  deadline?: string;
};

type MatchResult = { level: "match" | "possible" | "no"; label: string; reasons: string[]; needsConfirmation: string[] };

type AiMatch = {
  match_level: "match" | "possible" | "no";
  label?: string;
  reasons?: string[];
  conflicts?: string[];
  needs_confirmation?: string[];
  normalized?: {
    organization?: string;
    title?: string;
    location?: string;
    education?: string;
    majors?: string[];
    responsibilities?: string;
    requirements?: string;
    headcount?: string;
    applicant_type?: string;
    position_code?: string;
    deadline?: string;
  };
};

const aiData = aiAnalysisData as { generated_at?: string; results: Record<string, AiMatch> };
const aiResults = aiData.results;

const notices = collected.notices as Notice[];

function positionIds(noticeId: string, positions: Position[]) {
  const bases = positions.map((position, index) => `${noticeId}-${position.sheet || "position"}-${position.row || index}`);
  const counts = new Map<string, number>();
  bases.forEach((base) => counts.set(base, (counts.get(base) || 0) + 1));
  const used = new Map<string, number>();
  return positions.map((position, index) => {
    const base = bases[index];
    if (counts.get(base) === 1) return base;
    const attachmentUrl = position.source_attachment_url || "";
    const identity = attachmentUrl.split("?", 1)[0].replace(/\/$/, "").split("/").pop() || `position-${index}`;
    const candidate = `${base}-${identity}`;
    const occurrence = (used.get(candidate) || 0) + 1;
    used.set(candidate, occurrence);
    return occurrence === 1 ? candidate : `${candidate}-${occurrence}`;
  });
}

const jobs: Job[] = notices.flatMap<Job>((notice): Job[] => {
  if (!notice.positions.length) {
    return [{
      id: `${notice.id}-notice-0`,
      title: notice.title,
      organization: notice.publisher,
      noticeTitle: notice.title,
      publisher: notice.publisher,
      publishedAt: notice.published_at,
      applicationStartAt: notice.application_start_at,
      deadline: notice.deadline,
      sourceUrl: notice.source_url,
      isNotice: true,
      sourceName: "北京市人社局事业单位公开招聘",
      sourceGroup: "北京市机关单位",
      establishmentType: "事业编制",
    }];
  }
  const ids = positionIds(notice.id, notice.positions);
  return notice.positions.map((position, index) => ({
    ...position,
    id: ids[index],
    noticeTitle: notice.title,
    publisher: notice.publisher,
    publishedAt: notice.published_at,
    applicationStartAt: notice.application_start_at,
    deadline: notice.deadline,
    sourceUrl: notice.source_url,
    isNotice: false,
    sourceName: "北京市人社局事业单位公开招聘",
    sourceGroup: "北京市机关单位",
    establishmentType: "事业编制",
    sourceAttachmentUrl: position.source_attachment_url,
  }));
});

const otherJobs: Job[] = (otherSources.items as OtherSourceItem[]).map((item) => {
  return {
    id: item.id,
    title: item.title,
    organization: item.organization,
    noticeTitle: item.title,
    publisher: item.organization,
    publishedAt: item.published_at,
    applicationStartAt: "",
    deadline: "deadline" in item ? String(item.deadline || "") : "",
    sourceUrl: item.source_url,
    isNotice: true,
    sourceName: item.source_name,
    sourceGroup: item.category,
    establishmentType: "establishment_type" in item ? String(item.establishment_type || "") : "",
    requirements: item.requirements,
    responsibilities: item.responsibilities,
    major: item.major,
    location: item.location,
    recruitment_type: item.recruitment_type,
    category_detail: item.category_detail,
    data_quality: item.data_quality,
    last_verified_at: item.last_verified_at,
    education: item.education,
    headcount: item.headcount,
    sheet: "sheet" in item ? String(item.sheet || "") : "",
    row: "row" in item ? Number(item.row) : undefined,
    sourceAttachmentUrl: "source_attachment_url" in item ? String(item.source_attachment_url || "") : "",
  };
});

const rawJobs = [...jobs, ...otherJobs].map((job) => ({
  ...job,
  organization: aiResults[job.id]?.normalized?.organization?.trim() || job.organization,
  title: aiResults[job.id]?.normalized?.title?.trim() || job.title,
  location: aiResults[job.id]?.normalized?.location?.trim() || job.location,
  education: aiResults[job.id]?.normalized?.education?.trim() || job.education,
  major: aiResults[job.id]?.normalized?.majors?.join("、") || job.major,
  responsibilities: aiResults[job.id]?.normalized?.responsibilities?.trim() || job.responsibilities,
  requirements: aiResults[job.id]?.normalized?.requirements?.trim() || job.requirements,
  headcount: aiResults[job.id]?.normalized?.headcount?.trim() || job.headcount,
  applicant_type: aiResults[job.id]?.normalized?.applicant_type?.trim() || job.applicant_type,
  position_code: aiResults[job.id]?.normalized?.position_code?.trim() || job.position_code,
  deadline: aiResults[job.id]?.normalized?.deadline?.trim() || job.deadline,
}));

const allJobs = [...new Map(rawJobs.map((job) => [
  job.sourceGroup === "互联网大厂"
    ? job.id
    : [job.organization, job.title, job.major, job.education, job.headcount, job.publishedAt].join("|"),
  job,
])).values()];

function unitName(job: Job) {
  return (job.organization || job.publisher || job.sourceName || "单位未注明").trim();
}

function attachmentPosition(job: Job) {
  const fragment = job.sourceUrl.match(/#position-(.+)-(\d+)$/);
  return {
    sheet: job.sheet || (fragment ? decodeURIComponent(fragment[1]) : ""),
    row: job.row || (fragment ? Number(fragment[2]) : undefined),
  };
}

function daysUntil(value: string) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

function isCurrentJob(job: Job) {
  const deadlineDays = daysUntil(job.deadline);
  if (deadlineDays !== null) return deadlineDays >= 0;
  const publishedAt = new Date(job.publishedAt).getTime();
  const verifiedAt = job.last_verified_at ? new Date(job.last_verified_at).getTime() : Number.NaN;
  const freshnessTime = Number.isNaN(publishedAt) ? verifiedAt : publishedAt;
  if (Number.isNaN(freshnessTime)) return false;
  return Date.now() - freshnessTime <= 30 * 86400000;
}

const currentJobs = allJobs.filter(isCurrentJob);

function shortDate(value: string) {
  if (!value) return "未注明";
  const date = new Date(value);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

function statusLabel(deadline: string) {
  const days = daysUntil(deadline);
  if (days === null) return "截止时间未注明";
  if (days < 0) return "已截止";
  if (days === 0) return "今天截止";
  if (days <= 7) return `${days}天后截止`;
  return `截止 ${shortDate(deadline)}`;
}

function matchForProfile(job: Job): MatchResult {
  const ai = aiResults[job.id];
  if (ai) {
    const reasons = [...(ai.reasons || []), ...(ai.conflicts || [])].slice(0, 6);
    return {
      level: ai.match_level,
      label: ai.label || (ai.match_level === "match" ? "符合" : ai.match_level === "no" ? "不符合" : "需确认"),
      reasons,
      needsConfirmation: (ai.needs_confirmation || []).slice(0, 3),
    };
  }
  return { level: "possible", label: "待分析", reasons: [], needsConfirmation: ["等待 Codex 语义分析"] };
}

function matchesMajorRequirement(job: Job, filter: string) {
  if (filter === "全部专业要求") return true;
  const majors = aiResults[job.id]?.normalized?.majors || [];
  if (!majors.length) return true;
  const text = majors.join("、");
  if (/专业不限|不限专业|不限制专业|无专业要求/.test(text)) return true;
  return /设计|艺术|美术|视觉|交互|1301|1305|1357|13类|艺术学/.test(text);
}

const displayJobs = currentJobs.filter((job) => aiResults[job.id] && matchForProfile(job).level !== "no");

const commonLocations = [
  "北京", "上海", "深圳", "广州", "杭州", "成都", "南京", "武汉", "西安", "苏州",
  "天津", "重庆", "长沙", "厦门", "合肥", "郑州", "济南", "青岛", "东莞", "佛山",
  "珠海", "无锡", "宁波", "福州", "沈阳", "大连", "昆明", "南昌", "南宁", "海口",
  "贵阳", "石家庄", "太原", "哈尔滨", "长春", "兰州", "乌鲁木齐", "呼和浩特",
];

function locationLabels(value?: string) {
  const text = (value || "").trim();
  if (!text) return ["地点未注明"];
  const matched = commonLocations.filter((name) => text.includes(name));
  if (/全国|多地/.test(text)) matched.push("全国/多地");
  if (/海外|国外|全球/.test(text)) matched.push("海外");
  if (/远程/.test(text)) matched.push("远程");
  return [...new Set(matched.length ? matched : ["其他地点"])];
}

function interleaveByUnit(items: Job[]) {
  const buckets = new Map<string, Job[]>();
  for (const job of items) {
    const name = unitName(job);
    const bucket = buckets.get(name) || [];
    bucket.push(job);
    buckets.set(name, bucket);
  }

  const result: Job[] = [];
  let index = 0;
  while (result.length < items.length) {
    for (const bucket of buckets.values()) {
      if (index < bucket.length) result.push(bucket[index]);
    }
    index += 1;
  }
  return result;
}

function matchesSource(job: Job, sourceGroup: string) {
  return sourceGroup === "全部来源"
    || (sourceGroup === "机关单位" && (job.sourceGroup === "北京市机关单位" || job.sourceGroup === "中央机关单位"))
    || job.sourceGroup === sourceGroup;
}

const PAGE_SIZE = 30;

export default function Home() {
  const [query, setQuery] = useState("");
  const [education, setEducation] = useState("全部学历");
  const [majorRequirement, setMajorRequirement] = useState("设计类或不限");
  const [sort, setSort] = useState("即将截止");
  const [profileFilter, setProfileFilter] = useState("全部岗位");
  const [sourceGroup, setSourceGroup] = useState("机关单位");
  const [establishment, setEstablishment] = useState("全部编制");
  const [unit, setUnit] = useState("全部单位");
  const [location, setLocation] = useState("全部地点");
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [page, setPage] = useState(1);
  const [selectedJobId, setSelectedJobId] = useState("");
  const [urlReady, setUrlReady] = useState(false);
  const supportsEstablishment = sourceGroup === "机关单位" || sourceGroup === "北京市机关单位" || sourceGroup === "中央机关单位";

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem("beijing-job-saved") || "[]")); } catch { setSaved([]); }
    const params = new URLSearchParams(window.location.search);
    const source = params.get("source");
    const profile = params.get("profile");
    const degree = params.get("education");
    const major = params.get("major");
    const order = params.get("sort");
    const requestedPage = Number(params.get("page"));
    setQuery(params.get("q") || "");
    if (["机关单位", "北京市机关单位", "中央机关单位", "互联网大厂", "央国企", "全部来源"].includes(source || "")) setSourceGroup(source!);
    if (["全部岗位", "适合我", "明确符合", "需确认"].includes(profile || "")) setProfileFilter(profile!);
    if (["全部学历", "本科", "硕士", "博士", "大专"].includes(degree || "")) setEducation(degree!);
    if (["设计类或不限", "全部专业要求"].includes(major || "")) setMajorRequirement(major!);
    if (["即将截止", "最新发布"].includes(order || "")) setSort(order!);
    setEstablishment(params.get("establishment") || "全部编制");
    setUnit(params.get("unit") || "全部单位");
    setLocation(params.get("location") || "全部地点");
    setSavedOnly(params.get("saved") === "1");
    setPage(Number.isInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1);
    setSelectedJobId(params.get("job") || "");
    setUrlReady(true);
  }, []);

  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem("beijing-job-saved", JSON.stringify(next));
  };

  const resetBrowse = () => {
    setPage(1);
    setSelectedJobId("");
  };

  const unitOptions = useMemo(() => {
    const names = displayJobs
      .filter((job) => matchesSource(job, sourceGroup))
      .filter((job) => establishment === "全部编制" || job.establishmentType === establishment)
      .map(unitName)
      .filter((name) => name !== "单位未注明");
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [sourceGroup, establishment]);

  const locationOptions = useMemo(() => {
    const names = displayJobs
      .filter((job) => matchesSource(job, sourceGroup))
      .filter((job) => establishment === "全部编制" || job.establishmentType === establishment)
      .flatMap((job) => locationLabels(job.location));
    return [...new Set(names)].sort((a, b) => {
      if (a === "北京") return -1;
      if (b === "北京") return 1;
      return a.localeCompare(b, "zh-CN");
    });
  }, [sourceGroup, establishment]);

  useEffect(() => {
    if (urlReady && unit !== "全部单位" && !unitOptions.includes(unit)) {
      setUnit("全部单位");
      resetBrowse();
    }
  }, [unit, unitOptions]);

  useEffect(() => {
    if (urlReady && location !== "全部地点" && !locationOptions.includes(location)) {
      setLocation("全部地点");
      resetBrowse();
    }
  }, [location, locationOptions]);

  useEffect(() => {
    if (!supportsEstablishment && establishment !== "全部编制") setEstablishment("全部编制");
  }, [supportsEstablishment, establishment]);

  const filteredWithoutUnit = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const result = displayJobs.filter((job) => {
      const text = [job.title, job.organization, job.major, job.education, job.requirements, job.responsibilities, job.location, job.applicant_type, job.household, job.noticeTitle].join(" ").toLowerCase();
      const profileMatch = matchForProfile(job);
      return (!keyword || text.includes(keyword))
        && (education === "全部学历" || (job.education || "").includes(education))
        && matchesMajorRequirement(job, majorRequirement)
        && (profileFilter === "全部岗位"
          || (profileFilter === "适合我" && profileMatch.level !== "no")
          || (profileFilter === "明确符合" && profileMatch.level === "match")
          || (profileFilter === "需确认" && profileMatch.level === "possible"))
        && matchesSource(job, sourceGroup)
        && (establishment === "全部编制" || job.establishmentType === establishment)
        && (location === "全部地点" || locationLabels(job.location).includes(location))
        && (!savedOnly || saved.includes(job.id));
    });
    const sorted = result.sort((a, b) => {
      if (sort === "最新发布") return b.publishedAt.localeCompare(a.publishedAt);
      const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
    return sourceGroup === "互联网大厂"
      ? interleaveByUnit(sorted)
      : sorted;
  }, [query, education, majorRequirement, sort, profileFilter, sourceGroup, establishment, location, savedOnly, saved]);

  const filtered = useMemo(() => unit === "全部单位"
    ? filteredWithoutUnit
    : filteredWithoutUnit.filter((job) => unitName(job) === unit), [filteredWithoutUnit, unit]);

  const companyCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of filteredWithoutUnit) counts.set(unitName(job), (counts.get(unitName(job)) || 0) + 1);
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "zh-CN"));
  }, [filteredWithoutUnit]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pagedJobs = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const selectedJob = pagedJobs.find((job) => job.id === selectedJobId) || pagedJobs[0];
  const selectedMatch = selectedJob ? matchForProfile(selectedJob) : null;
  const selectedAttachment = selectedJob ? attachmentPosition(selectedJob) : null;

  const pageNumbers = useMemo(() => {
    const start = Math.max(1, Math.min(currentPage - 3, pageCount - 6));
    return Array.from({ length: Math.min(7, pageCount) }, (_, index) => start + index);
  }, [currentPage, pageCount]);

  const summaryParts = [
    sourceGroup,
    unit !== "全部单位" ? unit : "",
    location !== "全部地点" ? location : "",
    profileFilter !== "全部岗位" ? profileFilter : "",
    education !== "全部学历" ? education : "",
    majorRequirement,
  ].filter(Boolean);

  const changePage = (nextPage: number) => {
    setPage(Math.max(1, Math.min(nextPage, pageCount)));
    setSelectedJobId("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  useEffect(() => {
    if (pagedJobs.length && !pagedJobs.some((job) => job.id === selectedJobId)) setSelectedJobId(pagedJobs[0].id);
    if (!pagedJobs.length && selectedJobId) setSelectedJobId("");
  }, [pagedJobs, selectedJobId]);

  useEffect(() => {
    if (!urlReady) return;
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (sourceGroup !== "机关单位") params.set("source", sourceGroup);
    if (profileFilter !== "全部岗位") params.set("profile", profileFilter);
    if (establishment !== "全部编制") params.set("establishment", establishment);
    if (unit !== "全部单位") params.set("unit", unit);
    if (location !== "全部地点") params.set("location", location);
    if (education !== "全部学历") params.set("education", education);
    if (majorRequirement !== "设计类或不限") params.set("major", majorRequirement);
    if (sort !== "即将截止") params.set("sort", sort);
    if (savedOnly) params.set("saved", "1");
    if (currentPage > 1) params.set("page", String(currentPage));
    if (selectedJobId) params.set("job", selectedJobId);
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}#jobs`);
  }, [urlReady, query, sourceGroup, profileFilter, establishment, unit, location, education, majorRequirement, sort, savedOnly, currentPage, selectedJobId]);

  useEffect(() => {
    if (!urlReady) return;
    const savedScroll = Number(sessionStorage.getItem("job-list-scroll") || 0);
    if (savedScroll > 0) requestAnimationFrame(() => window.scrollTo({ top: savedScroll }));
    let timer = 0;
    const rememberScroll = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => sessionStorage.setItem("job-list-scroll", String(window.scrollY)), 80);
    };
    window.addEventListener("scroll", rememberScroll, { passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", rememberScroll);
    };
  }, [urlReady]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (["INPUT", "SELECT", "TEXTAREA"].includes(target.tagName) || target.isContentEditable) return;
      if (!["j", "k", "ArrowDown", "ArrowUp"].includes(event.key)) return;
      event.preventDefault();
      const index = pagedJobs.findIndex((job) => job.id === selectedJobId);
      const forward = event.key === "j" || event.key === "ArrowDown";
      if (forward && index < pagedJobs.length - 1) setSelectedJobId(pagedJobs[index + 1].id);
      else if (!forward && index > 0) setSelectedJobId(pagedJobs[index - 1].id);
      else if (forward && currentPage < pageCount) changePage(currentPage + 1);
      else if (!forward && currentPage > 1) changePage(currentPage - 1);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pagedJobs, selectedJobId, currentPage, pageCount]);

  useEffect(() => {
    if (selectedJobId) document.getElementById(`job-${selectedJobId}`)?.scrollIntoView({ block: "nearest" });
  }, [selectedJobId]);

  return (
    <main className="workspace">
      <header>
        <h1>招聘信息聚合</h1>
        <button className={savedOnly ? "saved active" : "saved"} onClick={() => { setSavedOnly(!savedOnly); resetBrowse(); }}>收藏 {saved.length}</button>
      </header>
      <div className="browse-grid" id="jobs">
        <aside className="filter-panel" aria-label="职位筛选">
          <div className="panel-title">筛选条件</div>
          <input value={query} onChange={(event) => { setQuery(event.target.value); resetBrowse(); }} placeholder="搜索岗位、单位或要求" aria-label="搜索职位" />
          <label>匹配程度<select value={profileFilter} onChange={(event) => { setProfileFilter(event.target.value); resetBrowse(); }}><option>全部岗位</option><option>适合我</option><option>明确符合</option><option>需确认</option></select></label>
          <label>来源类别<select value={sourceGroup} onChange={(event) => { setSourceGroup(event.target.value); setUnit("全部单位"); resetBrowse(); }}><option value="机关单位">机关单位（默认）</option><option>北京市机关单位</option><option>中央机关单位</option><option>互联网大厂</option><option>央国企</option><option>全部来源</option></select></label>
          {supportsEstablishment && <label>编制类型<select value={establishment} onChange={(event) => { setEstablishment(event.target.value); resetBrowse(); }}><option>全部编制</option><option>事业编制</option><option>公务员编制</option></select></label>}
          <label>单位或公司<select value={unit} onChange={(event) => { setUnit(event.target.value); resetBrowse(); }}><option>全部单位</option>{unitOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label>工作地点<select value={location} onChange={(event) => { setLocation(event.target.value); resetBrowse(); }}><option>全部地点</option>{locationOptions.map((name) => <option key={name}>{name}</option>)}</select></label>
          <label>学历要求<select value={education} onChange={(event) => { setEducation(event.target.value); resetBrowse(); }}><option>全部学历</option><option>本科</option><option>硕士</option><option>博士</option><option>大专</option></select></label>
          <label>专业要求<select value={majorRequirement} onChange={(event) => { setMajorRequirement(event.target.value); resetBrowse(); }}><option>设计类或不限</option><option>全部专业要求</option></select></label>
          <label>排序方式<select value={sort} onChange={(event) => { setSort(event.target.value); resetBrowse(); }}><option>即将截止</option><option>最新发布</option></select></label>
          {sourceGroup === "互联网大厂" && <div className="company-shortcuts"><div className="filter-caption">公司快捷筛选</div><button className={unit === "全部单位" ? "company-chip active" : "company-chip"} onClick={() => { setUnit("全部单位"); resetBrowse(); }}>全部 <b>{filteredWithoutUnit.length}</b></button>{companyCounts.map(([name, count]) => <button key={name} className={unit === name ? "company-chip active" : "company-chip"} onClick={() => { setUnit(name); resetBrowse(); }}>{name} <b>{count}</b></button>)}</div>}
        </aside>

        <section className="results-column" aria-label="岗位列表">
          <div className="result-head">
            <div><b>{filtered.length}</b> 个岗位</div>
            <div className="filter-summary">{summaryParts.join(" · ")}</div>
            <span>第 {currentPage}/{pageCount} 页</span>
          </div>
          <div className="compact-list">
            {pagedJobs.map((job) => {
              const days = daysUntil(job.deadline);
              const match = matchForProfile(job);
              return <article id={`job-${job.id}`} className={selectedJob?.id === job.id ? "compact-job selected" : "compact-job"} key={job.id} role="button" tabIndex={0} onClick={() => setSelectedJobId(job.id)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedJobId(job.id); }}>
                <div className="compact-main"><div className="compact-title-row"><span className={`match ${match.level}`}>{match.label}</span><h2>{job.title || job.noticeTitle}</h2></div><h3>{unitName(job)}</h3><div className="brief-facts">{job.location && <span>{job.location}</span>}{job.education && <span>{job.education}</span>}<span className={days !== null && days <= 7 && days >= 0 ? "deadline urgent" : "deadline"}>{statusLabel(job.deadline)}</span></div></div>
                <div className="compact-actions"><a className="detail-link" href={job.sourceUrl} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>{job.sourceGroup === "互联网大厂" ? "岗位详情" : "原公告"} ↗</a><button className={saved.includes(job.id) ? "star on" : "star"} onClick={(event) => { event.stopPropagation(); toggleSaved(job.id); }} aria-label="收藏职位">★</button></div>
              </article>;
            })}
          </div>
          {!filtered.length && <div className="empty">没有符合条件的职位</div>}
          {filtered.length > 0 && <nav className="pagination" aria-label="岗位分页"><button disabled={currentPage === 1} onClick={() => changePage(currentPage - 1)}>上一页</button>{pageNumbers.map((number) => <button key={number} className={number === currentPage ? "active" : ""} onClick={() => changePage(number)}>{number}</button>)}<button disabled={currentPage === pageCount} onClick={() => changePage(currentPage + 1)}>下一页</button></nav>}
        </section>

        <aside className="detail-panel" aria-label="岗位详情">
          {selectedJob && selectedMatch && selectedAttachment ? <>
            <div className="detail-heading"><div><span className={`match ${selectedMatch.level}`}>{selectedMatch.label}</span><h2>{selectedJob.title || selectedJob.noticeTitle}</h2><h3>{unitName(selectedJob)}</h3></div><button className={saved.includes(selectedJob.id) ? "star on" : "star"} onClick={() => toggleSaved(selectedJob.id)} aria-label="收藏职位">★</button></div>
            {selectedMatch.level === "possible" && <div className="confirm-note">需确认：{selectedMatch.needsConfirmation.join("；") || "公开信息不足"}</div>}
            <div className="match-reasons">{selectedMatch.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
            <div className="facts">{selectedJob.headcount && <span>招 {selectedJob.headcount} 人</span>}{selectedJob.education && <span>{selectedJob.education}</span>}{selectedJob.degree && <span>{selectedJob.degree}</span>}{selectedJob.applicant_type && <span>{selectedJob.applicant_type}</span>}{selectedJob.household && <span>{selectedJob.household}</span>}{selectedJob.age && <span>{selectedJob.age}</span>}{selectedJob.location && <span>{selectedJob.location}</span>}{selectedJob.establishmentType && <span>{selectedJob.establishmentType}</span>}</div>
            {selectedJob.sourceAttachmentUrl && <div className="attachment-ref"><span><b>附件岗位：</b>{selectedAttachment.sheet ? `${selectedAttachment.sheet} · ` : ""}{selectedAttachment.row ? `第 ${selectedAttachment.row} 行` : "原始岗位行"}{selectedJob.position_code ? ` · 岗位代码 ${selectedJob.position_code}` : ""}</span><a href={selectedJob.sourceAttachmentUrl} target="_blank" rel="noreferrer">查看附件 ↗</a></div>}
            {selectedJob.major && <div className="detail-section"><h4>专业要求</h4><p>{selectedJob.major}</p></div>}
            {selectedJob.requirements && <div className="detail-section"><h4>任职要求</h4><p>{selectedJob.requirements}</p></div>}
            {selectedJob.responsibilities && <div className="detail-section"><h4>岗位职责</h4><p>{selectedJob.responsibilities}</p></div>}
            <div className="detail-meta"><span>{statusLabel(selectedJob.deadline)}</span><span>发布 {selectedJob.publishedAt || "未注明"}</span><span>{selectedJob.sourceName}</span></div>
            <a className="primary-link" href={selectedJob.sourceUrl} target="_blank" rel="noreferrer">{selectedJob.sourceGroup === "互联网大厂" ? "打开岗位详情" : "打开原公告"} ↗</a>
            <div className="keyboard-hint">使用 J / K 或 ↑ / ↓ 切换岗位</div>
          </> : <div className="detail-empty">选择一个岗位查看详情</div>}
        </aside>
      </div>
    </main>
  );
}
