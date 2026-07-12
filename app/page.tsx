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

const jobs: Job[] = notices.flatMap<Job>((notice): Job[] => {
  if (!notice.positions.length) {
    return [{
      id: `${notice.id}-notice`,
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
  return notice.positions.map((position, index) => ({
    ...position,
    id: `${notice.id}-${position.sheet || "position"}-${position.row || index}`,
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

const otherJobs: Job[] = otherSources.items.map((item) => {
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
  [job.organization, job.title, job.major, job.education, job.headcount, job.publishedAt].join("|"),
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
  return { level: "possible", label: "待分析", reasons: [], needsConfirmation: ["等待大模型读取原始招聘信息"] };
}

const displayJobs = currentJobs.filter((job) => matchForProfile(job).level !== "no");

export default function Home() {
  const [query, setQuery] = useState("");
  const [education, setEducation] = useState("全部学历");
  const [sort, setSort] = useState("即将截止");
  const [profileFilter, setProfileFilter] = useState("全部岗位");
  const [sourceGroup, setSourceGroup] = useState("机关单位");
  const [establishment, setEstablishment] = useState("全部编制");
  const [unit, setUnit] = useState("全部单位");
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(40);
  const supportsEstablishment = sourceGroup === "机关单位" || sourceGroup === "北京市机关单位" || sourceGroup === "中央机关单位";
  const matchesSourceGroup = (job: Job) => sourceGroup === "全部来源"
    || (sourceGroup === "机关单位" && (job.sourceGroup === "北京市机关单位" || job.sourceGroup === "中央机关单位"))
    || job.sourceGroup === sourceGroup;

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem("beijing-job-saved") || "[]")); } catch { setSaved([]); }
  }, []);

  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem("beijing-job-saved", JSON.stringify(next));
  };

  const unitOptions = useMemo(() => {
    const names = displayJobs
      .filter(matchesSourceGroup)
      .filter((job) => establishment === "全部编制" || job.establishmentType === establishment)
      .map(unitName)
      .filter((name) => name !== "单位未注明");
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [sourceGroup, establishment]);

  useEffect(() => {
    if (unit !== "全部单位" && !unitOptions.includes(unit)) setUnit("全部单位");
  }, [unit, unitOptions]);

  useEffect(() => {
    if (!supportsEstablishment && establishment !== "全部编制") setEstablishment("全部编制");
  }, [supportsEstablishment, establishment]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const result = displayJobs.filter((job) => {
      const text = [job.title, job.organization, job.major, job.education, job.requirements, job.responsibilities, job.location, job.applicant_type, job.household, job.noticeTitle].join(" ").toLowerCase();
      const profileMatch = matchForProfile(job);
      return (!keyword || text.includes(keyword))
        && (education === "全部学历" || (job.education || "").includes(education))
        && (profileFilter === "全部岗位" || (profileFilter === "适合我" ? profileMatch.level !== "no" : profileMatch.level === "match"))
        && matchesSourceGroup(job)
        && (establishment === "全部编制" || job.establishmentType === establishment)
        && (unit === "全部单位" || unitName(job) === unit)
        && (!savedOnly || saved.includes(job.id));
    });
    return result.sort((a, b) => {
      if (sort === "最新发布") return b.publishedAt.localeCompare(a.publishedAt);
      const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [query, education, sort, profileFilter, sourceGroup, establishment, unit, savedOnly, saved]);

  useEffect(() => setVisibleCount(40), [query, education, sort, profileFilter, sourceGroup, establishment, unit, savedOnly]);

  const activeCount = displayJobs.length;
  const hiddenNoCount = currentJobs.length - displayJobs.length;
  const definiteCount = displayJobs.filter((job) => matchForProfile(job).level === "match").length;
  const analyzedCount = Object.keys(aiResults).length;
  const updated = new Date(collected.generated_at);

  return (
    <main className="workspace">
      <header>
        <div>
          <h1>北京职位</h1>
          <p>{activeCount} 个可关注 · 明确符合 {definiteCount} 个 · 已隐藏 {hiddenNoCount} 个不符合岗位 · Codex 已分析 {analyzedCount} 个 · 更新于 {updated.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <button className={savedOnly ? "saved active" : "saved"} onClick={() => setSavedOnly(!savedOnly)}>收藏 {saved.length}</button>
      </header>

      <div className="profile"><b>我的条件</b><span>女</span><span>非北京户口</span><span>2027届硕士</span><span>华东师大本硕</span><span>设计类（兼容新旧目录）</span><span>中共党员</span></div>

      <section className="toolbar" aria-label="职位筛选">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单位、岗位、专业或要求" aria-label="搜索职位" />
        <select value={profileFilter} onChange={(event) => setProfileFilter(event.target.value)} aria-label="个人条件匹配">
          <option>全部岗位</option><option>适合我</option><option>明确符合</option>
        </select>
        <select value={sourceGroup} onChange={(event) => setSourceGroup(event.target.value)} aria-label="来源类别">
          <option value="机关单位">机关单位（默认）</option><option>北京市机关单位</option><option>中央机关单位</option><option>互联网大厂</option><option>央国企</option><option>全部来源</option>
        </select>
        {supportsEstablishment && <select value={establishment} onChange={(event) => setEstablishment(event.target.value)} aria-label="编制类型">
          <option>全部编制</option><option>事业编制</option><option>公务员编制</option>
        </select>}
        <select value={unit} onChange={(event) => setUnit(event.target.value)} aria-label="单位或公司">
          <option>全部单位</option>
          {unitOptions.map((name) => <option key={name} value={name}>{name}</option>)}
        </select>
        <select value={education} onChange={(event) => setEducation(event.target.value)} aria-label="学历要求">
          <option>全部学历</option><option>本科</option><option>硕士</option><option>博士</option><option>大专</option>
        </select>
        <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="排序方式">
          <option>即将截止</option><option>最新发布</option>
        </select>
      </section>

      <div className="result-line"><b>{filtered.length}</b> 个结果{savedOnly && <button onClick={() => setSavedOnly(false)}>查看全部</button>}</div>

      <section className="job-list">
        {filtered.slice(0, visibleCount).map((job) => {
          const days = daysUntil(job.deadline);
          const match = matchForProfile(job);
          const attachment = attachmentPosition(job);
          return <article className="job" key={job.id}>
            <div className="job-top">
              <div>
                <div className="match-line">
                  <span className={`match ${match.level}`}>{match.label}</span>
                  {match.level === "possible" && <span className="confirm-note">需确认：{match.needsConfirmation.join("；") || "公开信息不足"}</span>}
                </div>
                <h2>{job.title || job.noticeTitle}</h2>
                <h3>{job.organization || job.publisher || "招聘单位见公告"}</h3>
              </div>
              <button className={saved.includes(job.id) ? "star on" : "star"} onClick={() => toggleSaved(job.id)} aria-label="收藏职位">★</button>
            </div>

            <div className="match-reasons">{match.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
            <div className="source-name">{job.sourceName}</div>
            {job.sourceAttachmentUrl && <div className="attachment-ref">
              <span><b>附件岗位：</b>{attachment.sheet ? `${attachment.sheet} · ` : ""}{attachment.row ? `第 ${attachment.row} 行` : "原始岗位行"}{job.position_code ? ` · 岗位代码 ${job.position_code}` : ""}</span>
              <a href={job.sourceAttachmentUrl} target="_blank" rel="noreferrer">查看附件 ↗</a>
            </div>}

            <div className="facts">
              {job.headcount && <span>招 {job.headcount} 人</span>}
              {job.education && <span>{job.education}</span>}
              {job.degree && <span>{job.degree}</span>}
              {job.applicant_type && <span>{job.applicant_type}</span>}
              {job.household && <span>{job.household}</span>}
              {job.age && <span>{job.age}</span>}
              {job.location && <span>{job.location}</span>}
              {job.recruitment_type && <span>{job.recruitment_type}</span>}
              {job.category_detail && <span>{job.category_detail}</span>}
              {job.establishmentType && <span>{job.establishmentType}</span>}
            </div>

            {job.major && <p><b>专业：</b>{job.major}</p>}
            {job.requirements && <p className="requirements"><b>要求：</b>{job.requirements}</p>}
            {job.responsibilities && <p className="requirements"><b>职责：</b>{job.responsibilities}</p>}

            <footer>
              <div>
                <span className={days !== null && days <= 7 && days >= 0 ? "deadline urgent" : days !== null && days < 0 ? "deadline expired" : "deadline"}>{statusLabel(job.deadline)}</span>
                <span>发布 {job.publishedAt || "未注明"}</span>
              </div>
              <a href={job.sourceUrl} target="_blank" rel="noreferrer">{job.sourceGroup === "互联网大厂" ? "岗位详情" : "原公告"} ↗</a>
            </footer>
          </article>;
        })}
      </section>

      {!filtered.length && <div className="empty">没有符合条件的职位</div>}
      {visibleCount < filtered.length && <button className="more" onClick={() => setVisibleCount(visibleCount + 40)}>再显示 40 个</button>}

      <details className="source-report">
        <summary>数据源状态：已采集 {otherSources.collected_source_count} · 待专用适配 {otherSources.needs_adapter_count} · 暂不可用 {otherSources.unavailable_count}</summary>
        <div>{otherSources.sources.map((source) => <span key={source.source_id}>{source.source_name}：{source.status === "collected" ? `${source.item_count}条` : source.status === "collected-empty" ? "今日无结果" : source.status === "seasonal-inactive" ? "非招录期" : source.status === "adapter-blocked" ? "接口受限" : "不可用"}</span>)}</div>
      </details>
      <div className="data-note">自动整理公开招聘信息，最终条件以原公告和附件为准。</div>
    </main>
  );
}
