"use client";

import { useEffect, useMemo, useState } from "react";
import collected from "../data/collected/bj-rsj.json";

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
  }));
});

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

export default function Home() {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("进行中");
  const [education, setEducation] = useState("全部学历");
  const [sort, setSort] = useState("即将截止");
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

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const result = jobs.filter((job) => {
      const text = [job.title, job.organization, job.major, job.education, job.requirements, job.applicant_type, job.household, job.noticeTitle].join(" ").toLowerCase();
      const expired = (daysUntil(job.deadline) ?? 1) < 0;
      return (!keyword || text.includes(keyword))
        && (status === "全部" || (status === "进行中" ? !expired : expired))
        && (education === "全部学历" || (job.education || "").includes(education))
        && (!savedOnly || saved.includes(job.id));
    });
    return result.sort((a, b) => {
      if (sort === "最新发布") return b.publishedAt.localeCompare(a.publishedAt);
      const aTime = a.deadline ? new Date(a.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      const bTime = b.deadline ? new Date(b.deadline).getTime() : Number.MAX_SAFE_INTEGER;
      return aTime - bTime;
    });
  }, [query, status, education, sort, savedOnly, saved]);

  useEffect(() => setVisibleCount(40), [query, status, education, sort, savedOnly]);

  const activeCount = jobs.filter((job) => (daysUntil(job.deadline) ?? 1) >= 0).length;
  const updated = new Date(collected.generated_at);

  return (
    <main className="workspace">
      <header>
        <div>
          <h1>北京职位</h1>
          <p>{activeCount} 个进行中 · {collected.notice_count} 份公告 · 更新于 {updated.toLocaleString("zh-CN", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
        </div>
        <button className={savedOnly ? "saved active" : "saved"} onClick={() => setSavedOnly(!savedOnly)}>收藏 {saved.length}</button>
      </header>

      <section className="toolbar" aria-label="职位筛选">
        <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索单位、岗位、专业或要求" aria-label="搜索职位" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} aria-label="截止状态">
          <option>进行中</option><option>已截止</option><option>全部</option>
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
          return <article className="job" key={job.id}>
            <div className="job-top">
              <div>
                <h2>{job.title || job.noticeTitle}</h2>
                <h3>{job.organization || job.publisher || "招聘单位见公告"}</h3>
              </div>
              <button className={saved.includes(job.id) ? "star on" : "star"} onClick={() => toggleSaved(job.id)} aria-label="收藏职位">★</button>
            </div>

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

      <div className="data-note">数据来自北京市人社局公开招聘公告，最终信息以原公告和附件为准。</div>
    </main>
  );
}
