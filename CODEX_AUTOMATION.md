# Codex 招聘数据自动化运行规范

本项目使用本地 Codex 自动化完成“原始数据采集 → 大模型语义分析 → 完整性校验 → 自动提交推送 → GitHub Pages 自动发布”。不再设置人工批准文件或发布确认短语。

## 自动化执行流程

1. 运行原始数据采集器：
   - 首次运行或依赖变化后：`python -m pip install -r requirements.txt`
   - 每日增量：`python scripts/collect_bj_rsj.py`
   - 每周一复查历史公告：`python scripts/collect_bj_rsj.py --weekly`（当日不再重复运行增量命令）
   - `python scripts/collect_other_sources.py`
2. 运行 `python scripts/prepare_codex_analysis.py` 生成增量分析队列。
3. 按 `CODEX_ANALYSIS.md` 由当前 Codex 模型直接理解原始正文、接口响应、职位描述和附件原始行，分析全部 pending 记录并写回 `data/ai-analysis.json`。
4. 再次运行准备脚本，必须得到 `pending_count: 0`。
5. 运行 `python scripts/validate_codex_analysis.py`，必须得到 `status: valid`。
6. 运行 Python 采集器测试、`pnpm test:data` 和 `pnpm build:pages`，确保采集、岗位 ID、页面规则与生产构建全部通过。
7. 仅在以上步骤全部成功后，提交本次采集数据和语义分析结果并推送 `main`。推送会自动触发 GitHub Pages 部署。
8. 如果没有实质数据或分析变化，不创建空提交，也不重复发布。

## 发布安全边界

- 存在 pending、校验错误、证据缺失或构建失败时，不得提交或推送。
- 采集后的岗位或成功来源数量异常大幅下降时，视为来源故障，不得用不完整结果覆盖线上数据。
- 不得使用 Python、关键词或正则表达式代替大模型做专业、户籍、届别、经验、职责或截止时间的语义判断。
- Python 采集器只保留来源原始数据和必要的来源定位信息，不做岗位是否符合个人条件的预处理。
- 自动化必须保留工作区中已有的无关用户改动，不得覆盖或一并提交。
- 推送失败时应先安全同步远端变更，确认无冲突后再重试；禁止强制推送覆盖远端。
- 推送后应核对对应 GitHub Actions 运行结果；只有部署成功且线上页面可访问，才报告本轮发布完成。
