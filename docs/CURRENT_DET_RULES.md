# 当前 DET 规则基线

> 核对日期：2026-09-04  
> 权威来源：Duolingo English Test Help Center。规则可能变化，修改模拟考试前应重新核对。

## 当前结构和本站映射

| 当前官方题型 | 官方频次 | 本站组件 | 当前差异与处理 |
|---|---:|---|---|
| Read and Select | 15–18 | `rs` | 官方每次显示一个词、每词 5 秒；本站把 9 词合成一组、共 30 秒。需改为单词级步骤 |
| Fill in the Blanks | 6–9 | `fibw` | 官方每题一句话、一个未完成单词、20 秒；本站把多句合为一组并给 180 秒。需拆步 |
| Read and Complete | 3–6 | `fib` | 题型匹配；官方每题 3 分钟。需校验题目格式和提交行为 |
| Listen and Type | 6–9 | `lt` | 题型和 60 秒匹配；官方允许首次播放加两次重播。已作为首条会话迁移流程 |
| Interactive Reading | 2 组 × 6 问 | `ir` | 数量大体匹配；官方每组 7 或 8 分钟。需校验题序和段落交互 |
| Interactive Listening | 2 组 × 8–10 问 | `il` | 本站只有简化选择回合与总结，缺少当前 Listen and Complete 3–4 问结构 |
| Write About the Photo | 3 | `wp` | 组件存在；需核对当前计时和评分证据 |
| Interactive Writing | 1 组 × 2 问 | `iw` | 两段结构存在；需把同组答案和追问保存为一个会话 |
| Speak About the Photo | 1 | `sp` | 组件存在；当前仅保存转写文本 |
| Read, Then Speak | 1 | `rtsp` | 当前官方题型，组件存在；当前仅保存转写文本 |
| Interactive Speaking | 1 组 × 6–8 问 | `isp` | 组件存在；官方每问只播放一次、回答 35 秒，总计约 3:30–4:40。需校验自适应追问和音频保存 |
| Writing Sample | 1 | `ws` | 组件存在；需明确该回答会随成绩分享给机构 |
| Speaking Sample | 1 | `ss` | 组件存在；需明确该回答会随成绩分享给机构 |
| Read Aloud | 已移除 | `ra` | 只保留为“朗读训练”，不得进入当前模拟考试 |

## 官方顺序与计分边界

- 考试约需一小时，题量会随评分引擎对分数的置信度变化，因此固定总题数只能是本站模拟策略，不能称为完整复刻。
- 客观题由官方专用流程比较正确答案与作答。部分正确可获得部分分；Listen and Type 漏词的影响大于拼写错误。
- 开放回答由官方评分引擎评估。本站 AI 只能给“练习反馈”或“练习估分”，不能声称复现官方评分引擎。
- 口语的流利度和发音需要音频证据。只有转写文本时，这两项必须显示“未评估”或说明证据不足。

## 实现约束

1. `ExamRules` 必须带 `version`、`verifiedAt` 和来源链接。
2. 当前模拟只能使用上表中的题型；`ra` 不得进入当前模拟。
3. 固定题量策略需要在报告中披露。
4. 每个结果记录 `scoreKind`：`accuracy`、`practice_estimate` 或 `mock_estimate`。
5. 官方页面变化后，先更新本文件和契约测试，再修改考试流程。

## 来源

- 当前结构与题型频次：https://testcenter.zendesk.com/hc/en-us/articles/39104891663245-Test-Structure
- 计分说明：https://testcenter.zendesk.com/hc/en-us/articles/39104960626189-How-the-Items-Are-Scored
- Read and Select：https://testcenter.zendesk.com/hc/en-us/articles/39104559327885-Read-and-Select
- Fill in the Blanks：https://testcenter.zendesk.com/hc/en-us/articles/39104736577293-Fill-in-the-Blanks
- Read and Complete：https://testcenter.zendesk.com/hc/en-us/articles/39104704109965-Read-and-Complete
- Listen and Type：https://testcenter.zendesk.com/hc/en-us/articles/39104721906829-Listen-and-Type
- Interactive Listening：https://testcenter.zendesk.com/hc/en-us/articles/39104693735437-Interactive-Listening-Listen-and-Complete
- Interactive Speaking：https://testcenter.zendesk.com/hc/en-us/articles/39104630903821-Interactive-Speaking
- 2025 题型变更：https://testcenter.zendesk.com/hc/en-us/articles/36094897057421-Test-Update-New-Interactive-Speaking-questions

