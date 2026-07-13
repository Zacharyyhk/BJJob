# Codex 招聘数据自动化运行规范

当前不启用远端定时任务。本文件用于将来创建 Codex 自动化，或在当前 Codex 对话中手动运行完整流程。

## 自动化允许执行的阶段

1. 运行原始数据采集器：
   - `python scripts/collect_bj_rsj.py --weekly`
   - `python scripts/collect_other_sources.py`
2. 运行 `python scripts/prepare_codex_analysis.py` 生成增量队列。
3. 按 `CODEX_ANALYSIS.md` 直接理解原始正文、接口响应和附件行，分析全部 pending 记录并写回 `data/ai-analysis.json`。
4. 再次运行准备脚本，必须得到 `pending_count: 0`。
5. 运行 `python scripts/validate_codex_analysis.py`，必须得到 `status: valid`。
6. 构建页面并向用户报告结果数量、明确符合、需确认、不符合及校验状态。

## 自动化禁止执行的阶段

- 不得运行 `--approve`，不得自行生成人工批准文件。
- 不得触发 GitHub Pages 部署。
- 不得在存在 pending、校验错误或证据缺失时提交发布结果。
- 不得使用 Python 或正则表达式替代大模型做专业、户籍、届别、经验、职责或截止时间语义判断。

## 人工审核与发布

审核者确认页面与分析结果后运行：

```powershell
python scripts/validate_codex_analysis.py --approve --approved-by "审核者说明"
git add data/ai-analysis.json data/release-approval.json
git commit -m "Approve reviewed recruitment analysis"
git push origin main
```

随后在 GitHub Actions 中手动运行 `Deploy reviewed GitHub Pages`，并输入确认短语 `publish-reviewed-analysis`。部署工作流会重新校验批准指纹；数据或分析发生任何变化都会使旧批准失效。
