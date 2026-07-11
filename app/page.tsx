"use client";

import { useEffect, useMemo, useState } from "react";

type Job = {
  id: string;
  title: string;
  organization: string;
  category: "互联网大厂" | "央企国企" | "事业单位" | "公务员";
  location: string;
  education: string;
  employment: string;
  publishedAt: string;
  deadline: string;
  tags: string[];
  summary: string;
  source: string;
  url: string;
};

const jobs: Job[] = [
  {
    id: "demo-001",
    title: "后端开发工程师（校招）",
    organization: "字节跳动",
    category: "互联网大厂",
    location: "海淀区",
    education: "本科及以上",
    employment: "校园招聘",
    publishedAt: "2026-07-08",
    deadline: "2026-08-15",
    tags: ["Java", "Go", "应届生"],
    summary: "参与业务系统设计、开发与性能优化，面向 2026 届毕业生。",
    source: "企业招聘官网",
    url: "https://jobs.bytedance.com/campus",
  },
  {
    id: "demo-002",
    title: "人工智能算法工程师",
    organization: "百度",
    category: "互联网大厂",
    location: "海淀区",
    education: "硕士及以上",
    employment: "社会招聘",
    publishedAt: "2026-07-06",
    deadline: "2026-08-06",
    tags: ["机器学习", "Python", "大模型"],
    summary: "从事大模型训练、推理优化与应用算法研发。",
    source: "企业招聘官网",
    url: "https://talent.baidu.com/jobs/social-list",
  },
  {
    id: "demo-003",
    title: "信息化管理岗",
    organization: "中国电子科技集团有限公司",
    category: "央企国企",
    location: "石景山区",
    education: "本科及以上",
    employment: "社会招聘",
    publishedAt: "2026-07-03",
    deadline: "2026-07-28",
    tags: ["信息化", "项目管理", "央企"],
    summary: "负责信息系统建设、项目协调和日常运维管理。",
    source: "国聘平台",
    url: "https://www.iguopin.com/",
  },
  {
    id: "demo-004",
    title: "综合管理岗位",
    organization: "北京市属事业单位（示例）",
    category: "事业单位",
    location: "西城区",
    education: "本科及以上",
    employment: "公开招聘",
    publishedAt: "2026-07-01",
    deadline: "2026-07-20",
    tags: ["事业编", "综合管理", "公开招聘"],
    summary: "承担综合行政、材料撰写和跨部门协调等工作。",
    source: "北京市人力资源和社会保障局",
    url: "https://rsj.beijing.gov.cn/xxgk/gkzp/",
  },
  {
    id: "demo-005",
    title: "一级主任科员及以下",
    organization: "中央机关及其直属机构（示例）",
    category: "公务员",
    location: "东城区",
    education: "本科及以上",
    employment: "公务员招录",
    publishedAt: "2026-06-28",
    deadline: "2026-07-18",
    tags: ["国考", "行政管理", "应届生"],
    summary: "示例职位，用于展示公务员岗位筛选和截止时间提醒。",
    source: "国家公务员局",
    url: "https://www.scs.gov.cn/",
  },
  {
    id: "demo-006",
    title: "数据分析岗",
    organization: "北京城市副中心投资建设集团",
    category: "央企国企",
    location: "通州区",
    education: "硕士及以上",
    employment: "校园招聘",
    publishedAt: "2026-06-25",
    deadline: "2026-08-01",
    tags: ["数据分析", "SQL", "市属国企"],
    summary: "负责经营数据分析、指标体系建设与可视化报告。",
    source: "企业招聘官网",
    url: "https://www.bsig.com.cn/",
  },
];

const categories = ["全部", "互联网大厂", "央企国企", "事业单位", "公务员"] as const;

function daysLeft(date: string) {
  const end = new Date(`${date}T23:59:59`);
  const now = new Date();
  return Math.ceil((end.getTime() - now.getTime()) / 86400000);
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof categories)[number]>("全部");
  const [education, setEducation] = useState("全部学历");
  const [sort, setSort] = useState("最新发布");
  const [saved, setSaved] = useState<string[]>([]);
  const [savedOnly, setSavedOnly] = useState(false);

  useEffect(() => {
    try {
      setSaved(JSON.parse(localStorage.getItem("beijing-job-saved") || "[]"));
    } catch {
      setSaved([]);
    }
  }, []);

  const toggleSaved = (id: string) => {
    const next = saved.includes(id) ? saved.filter((item) => item !== id) : [...saved, id];
    setSaved(next);
    localStorage.setItem("beijing-job-saved", JSON.stringify(next));
  };

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const result = jobs.filter((job) => {
      const text = `${job.title} ${job.organization} ${job.location} ${job.tags.join(" ")}`.toLowerCase();
      return (!keyword || text.includes(keyword)) &&
        (category === "全部" || job.category === category) &&
        (education === "全部学历" || job.education.includes(education)) &&
        (!savedOnly || saved.includes(job.id));
    });
    return [...result].sort((a, b) => sort === "即将截止"
      ? a.deadline.localeCompare(b.deadline)
      : b.publishedAt.localeCompare(a.publishedAt));
  }, [query, category, education, sort, savedOnly, saved]);

  const urgentCount = jobs.filter((job) => daysLeft(job.deadline) >= 0 && daysLeft(job.deadline) <= 14).length;

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#top" aria-label="京职搜首页">
          <span className="brand-mark">京</span>
          <span>京职搜<small>北京招聘信息聚合</small></span>
        </a>
        <nav aria-label="主要导航">
          <a href="#jobs">职位大厅</a>
          <a href="#sources">信息来源</a>
          <button className={savedOnly ? "saved active" : "saved"} onClick={() => setSavedOnly(!savedOnly)}>
            ★ 我的收藏 <b>{saved.length}</b>
          </button>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <span className="eyebrow">BEIJING CAREER BOARD</span>
          <h1>一处查遍北京<br /><em>好工作</em></h1>
          <p>聚合互联网大厂、央企国企、事业单位和公务员招聘，帮你更快发现机会，不错过报名期限。</p>
          <div className="searchbox">
            <span aria-hidden="true">⌕</span>
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索职位、单位、区域或技能…" aria-label="搜索职位" />
            <a href="#jobs">搜索职位</a>
          </div>
          <div className="quick-terms"><span>热门：</span>{["应届生", "数据分析", "事业编", "海淀区"].map((term) => <button key={term} onClick={() => setQuery(term)}>{term}</button>)}</div>
        </div>
        <div className="hero-card" aria-label="招聘数据概览">
          <div className="city-line"><span>BEIJING</span><b>01</b></div>
          <div className="big-number">{jobs.length}<small>条示例职位</small></div>
          <div className="hero-grid">
            <div><b>{categories.length - 1}</b><span>招聘类型</span></div>
            <div><b>{urgentCount}</b><span>近期截止</span></div>
          </div>
          <p>数据结构已准备好，可逐步接入官方招聘来源。</p>
        </div>
      </section>

      <section className="category-strip" aria-label="职位类别">
        {categories.slice(1).map((item, index) => (
          <button key={item} onClick={() => { setCategory(item); document.querySelector("#jobs")?.scrollIntoView({ behavior: "smooth" }); }}>
            <span>0{index + 1}</span><b>{item}</b><small>{jobs.filter((job) => job.category === item).length} 个职位</small>
          </button>
        ))}
      </section>

      <section className="content" id="jobs">
        <div className="section-heading">
          <div><span className="eyebrow">LATEST OPPORTUNITIES</span><h2>最新招聘机会</h2></div>
          <p>共找到 <b>{filtered.length}</b> 条符合条件的职位</p>
        </div>

        <div className="filters">
          <div className="tabs">{categories.map((item) => <button key={item} className={category === item ? "active" : ""} onClick={() => setCategory(item)}>{item}</button>)}</div>
          <div className="selects">
            <select value={education} onChange={(event) => setEducation(event.target.value)} aria-label="学历筛选">
              <option>全部学历</option><option>本科</option><option>硕士</option>
            </select>
            <select value={sort} onChange={(event) => setSort(event.target.value)} aria-label="排序方式">
              <option>最新发布</option><option>即将截止</option>
            </select>
          </div>
        </div>

        <div className="job-list">
          {filtered.map((job) => {
            const left = daysLeft(job.deadline);
            return (
              <article className="job-card" key={job.id}>
                <div className={`org-icon kind-${categories.indexOf(job.category)}`}>{job.organization.slice(0, 1)}</div>
                <div className="job-main">
                  <div className="job-title-row"><span className="category-tag">{job.category}</span><span className={left <= 14 ? "deadline urgent" : "deadline"}>{left < 0 ? "已截止" : left === 0 ? "今日截止" : `${left} 天后截止`}</span></div>
                  <h3><a href={job.url} target="_blank" rel="noreferrer">{job.title}</a></h3>
                  <h4>{job.organization}</h4>
                  <div className="meta"><span>⌖ {job.location}</span><span>▣ {job.education}</span><span>◷ {job.employment}</span></div>
                  <p>{job.summary}</p>
                  <div className="tags">{job.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>
                </div>
                <aside>
                  <button className={saved.includes(job.id) ? "bookmark on" : "bookmark"} onClick={() => toggleSaved(job.id)} aria-label={saved.includes(job.id) ? "取消收藏" : "收藏职位"}>★</button>
                  <div><small>发布于</small><b>{job.publishedAt}</b></div>
                  <a className="detail" href={job.url} target="_blank" rel="noreferrer">查看原文 ↗</a>
                  <small className="source">来源：{job.source}</small>
                </aside>
              </article>
            );
          })}
          {filtered.length === 0 && <div className="empty"><b>没有找到匹配的职位</b><span>试试更换关键词或清除筛选条件。</span><button onClick={() => { setQuery(""); setCategory("全部"); setEducation("全部学历"); setSavedOnly(false); }}>清除筛选</button></div>}
        </div>
      </section>

      <section className="sources" id="sources">
        <div><span className="eyebrow">TRUSTED SOURCES</span><h2>优先收录官方信息</h2><p>职位详情以原招聘单位和政府网站公告为准，本站只做检索、分类与提醒。</p></div>
        <div className="source-list"><span>国家公务员局</span><span>北京市人社局</span><span>国聘平台</span><span>企业招聘官网</span></div>
      </section>

      <footer><div className="brand"><span className="brand-mark">京</span><span>京职搜<small>个人招聘信息助手</small></span></div><p>当前内容为界面演示数据，请以来源网站实时公告为准。</p><a href="#top">回到顶部 ↑</a></footer>
    </main>
  );
}
