"use client";

import { useEffect, useMemo, useState } from "react";
import collected from "../data/collected/bj-rsj.json";
import otherSources from "../data/collected/other-sources.json";

type Position = {
  organization?: string;
  title?: string;
  category?: string;
  headcount?: string;
  education?: string;
  degree?: string;
  major?: string;
  age?: string;
  household?: string;
  applicant_type?: string;
  requirements?: string;
  contact?: string;
  sheet?: string;
  row?: number;
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
};

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
      sourceGroup: "事业单位",
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
    sourceGroup: "事业单位",
  }));
});

const otherJobs: Job[] = otherSources.items.map((item) => ({
  id: item.id,
  title: item.title,
  organization: item.organization,
  noticeTitle: item.title,
  publisher: item.organization,
  publishedAt: item.published_at,
  applicationStartAt: "",
  deadline: "",
  sourceUrl: item.source_url,
  isNotice: true,
  sourceName: item.source_name,
  sourceGroup: item.category,
}));

const allJobs = [...jobs, ...otherJobs];

function unitName(job: Job) {
  return (job.organization || job.publisher || job.sourceName || "单位未注明").trim();
}

function daysUntil(value: string) {
  if (!value) return null;
  return Math.ceil((new Date(value).getTime() - Date.now()) / 86400000);
}

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

type MatchResult = { level: "match" | "possible" | "no"; label: string; reasons: string[] };

function matchForProfile(job: Job): MatchResult {
  const education = job.education || "";
  const major = job.major || "";
  const applicant = `${job.applicant_type || ""} ${job.requirements || ""} ${job.noticeTitle}`;
  const deadlineYear = job.deadline ? new Date(job.deadline).getFullYear() : null;
  const reasons: string[] = [];

  if (deadlineYear && deadlineYear < 2027) {
    return { level: "no", label: "不符合", reasons: ["报名截止早于2027年毕业"] };
  }
  if (/202[3-6]届|202[3-6]年毕业/.test(applicant) && !/2027/.test(applicant)) {
    return { level: "no", label: "不符合", reasons: ["招聘毕业年份不包含2027届"] };
  }
  if (/仅限博士|博士研究生/.test(education) && !/硕士及以上|本科及以上/.test(education)) {
    return { level: "no", label: "不符合", reasons: ["学历要求为博士"] };
  }

  const educationKnown = Boolean(education);
  if (educationKnown && !/本科及以上|硕士|研究生|不限/.test(education)) {
    return { level: "no", label: "不符合", reasons: ["学历要求不匹配"] };
  }
  if (educationKnown) reasons.push("硕士学历满足");
  else reasons.push("学历需确认");

  const designPattern = /设计学|艺术设计|视觉传达|环境设计|产品设计|工业设计|数字媒体艺术|服装与服饰设计|工艺美术|设计类/;
  const majorUnlimited = !major || /不限|专业不限/.test(major);
  if (!majorUnlimited && !designPattern.test(major)) {
    return { level: "no", label: "不符合", reasons: ["专业要求不含设计类"] };
  }
  reasons.push(majorUnlimited ? "专业需确认" : "设计类专业匹配");

  if (/男性|限男/.test(applicant) && !/女性/.test(applicant)) {
    return { level: "no", label: "不符合", reasons: ["岗位限男性"] };
  }
  if (/中共党员/.test(applicant)) reasons.push("党员条件满足");
  if (/985|双一流|重点大学/.test(applicant)) reasons.push("院校条件满足");

  if (/2027/.test(applicant)) {
    reasons.push("2027届匹配");
    return { level: "match", label: "符合", reasons };
  }
  reasons.push("毕业年份需确认");
  return { level: "possible", label: "需确认", reasons };
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("进行中");
  const [education, setEducation] = useState("全部学历");
  const [sort, setSort] = useState("即将截止");
  const [profileFilter, setProfileFilter] = useState("全部岗位");
  const [sourceGroup, setSourceGroup] = useState("全部来源");
  const [unit, setUnit] = useState("全部单位");
  const [savedOnly, setSavedOnly] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState(40);

  useEffect(() => {
    try { setSaved(JSON.parse(localStorage.getItem("beijing-job-saved") || "[]")); } catch { setSaved([]); }
  }, []);

  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem("beijing-job-saved", JSON.stringify(next));
  };

  const unitOptions = useMemo(() => {
    const names = allJobs
      .filter((job) => sourceGroup === "全部来源" || job.sourceGroup === sourceGroup)
      .map(unitName)
      .filter((name) => name !== "单位未注明");
    return [...new Set(names)].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [sourceGroup]);

  useEffect(() => {
    if (unit !== "全部单位" && !unitOptions.includes(unit)) setUnit("全部单位");
  }, [unit, unitOptions]);

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const result = allJobs.filter((job) => {
      const text = [job.title, job.organization, job.major, job.education, job.requirements, job.applicant_type, job.household, job.noticeTitle].join(" ").toLowerCase();
      const expired = (daysUntil(job.deadline) ?? 1) < 0;
      const profileMatch = matchForProfile(job);
      return (!keyword || text.includes(keyword))
        && (status === "全部" || (status === "进行中" ? !expired : expired))
        && (education === "全部学历" || (job.education || "").includes(education))
        && (profileFilter === "全部岗位" || (profileFilter === "适合我" ? profileMatch.level !== "no" : profileMatch.level === "match"))
        && (sourceGroup === "全部来源" || job.sourceGroup === sourceGroup)
        && (unit === "全部单位" || unitName(job) === unit)
        && (!savedOnly || saved.includes(job.id));
    });
    return result.sort((a, b) => {
      if (sort === "最新发布") return b.publishedAt.localeCompare(a.publishedAt);
      const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [query, status, education, sort, profileFilter, sourceGroup, unit, savedOnly, saved]);

  useEffect(() => setVisibleCount(40), [query, status, education, sort, profileFilter, sourceGroup, unit, savedOnly]);

  const activeCount = allJobs.filter((job) => (daysUntil(job.deadline) ?? 1) >= 0).length;
  const profileCount = allJobs.filter((job) => matchForProfile(job).level !== "no").length;
  const updated = new Date(collected.generated_at);

  return (
    <main className="workspace">
      <header>
        <div>
          <h1>北京职位</h1>
          <p>{activeCount} 个进行中 · {profileCount} 个可能适合 · 更新于 {updated.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <button className={savedOnly ? "saved active" : "saved"} onClick={() => setSavedOnly(!savedOnly)}>收藏 {saved.length}</button>
      </header>

      <div className="profile"><b>我的条件</b><span>女</span><span>2027届硕士</span><span>华东师大本硕</span><span>设计类</span><span>中共党员</span></div>

      <section className="toolbar" aria-label="职位筛选">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单位、岗位、专业或要求" aria-label="搜索职位" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="截止状态">
          <option>进行中</option><option>已截止</option><option>全部</option>
        </select>
        <select value={profileFilter} onChange={(event) => setProfileFilter(event.target.value)} aria-label="个人条件匹配">
          <option>全部岗位</option><option>适合我</option><option>明确符合</option>
        </select>
        <select value={sourceGroup} onChange={(event) => setSourceGroup(event.target.value)} aria-label="来源类别">
          <option>全部来源</option><option>事业单位</option><option>公务员</option><option>央企国企</option><option>中央机关重点单位</option><option>互联网大厂</option>
        </select>
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
          return <article className="job" key={job.id}>
            <div className="job-top">
              <div>
                <span className={`match ${match.level}`}>{match.label}</span>
                <h2>{job.title || job.noticeTitle}</h2>
                <h3>{job.organization || job.publisher || "招聘单位见公告"}</h3>
              </div>
              <button className={saved.includes(job.id) ? "star on" : "star"} onClick={() => toggleSaved(job.id)} aria-label="收藏职位">★</button>
            </div>

            <div className="match-reasons">{match.reasons.map((reason) => <span key={reason}>{reason}</span>)}</div>
            <div className="source-name">{job.sourceName}</div>

            <div className="facts">
              {job.headcount && <span>招 {job.headcount} 人</span>}
              {job.education && <span>{job.education}</span>}
              {job.degree && <span>{job.degree}</span>}
              {job.applicant_type && <span>{job.applicant_type}</span>}
              {job.household && <span>{job.household}</span>}
              {job.age && <span>{job.age}</span>}
            </div>

            {job.major && <p><b>专业：</b>{job.major}</p>}
            {job.requirements && <p className="requirements"><b>要求：</b>{job.requirements}</p>}

            <footer>
              <div>
                <span className={days !== null && days <= 7 && days >= 0 ? "deadline urgent" : days !== null && days < 0 ? "deadline expired" : "deadline"}>{statusLabel(job.deadline)}</span>
                <span>发布 {job.publishedAt || "未注明"}</span>
              </div>
              <a href={job.sourceUrl} target="_blank" rel="noreferrer">原公告 ↗</a>
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
