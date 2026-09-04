# AGENTS.md

Duolingo English Test (DET) 模拟练习站：单文件静态应用，中文 UI。位于 SecondBrain vault 的 `output/`（运行时目录，非 canonical knowledge）。

## 架构

- **`index.html`（约 4400 行）是 UI 主体**：HTML + `<style>` + 内联 JS（题型渲染、导航、考试流程状态机）。没有构建、打包、依赖、测试框架，也不是 git 仓库。详细分层见 `docs/ARCHITECTURE.md`。
- **`js/engine.js` 是引擎层（评分/自适应/听写纯函数）**：从内联脚本抽离，经典脚本 + UMD（file:// 可用），浏览器挂同名全局（调用点不变），Node 下 `require` 可测。
- **`js/storage.js` 是数据层（AppStorage）**：9 个 key 读写 + schema 版本化（`SCHEMA_VERSION`/`MIGRATIONS`），存储后端可注入；内联脚本保留旧常量名兼容别名（`SETTINGS_KEY` 等 → `AppStorage.KEYS`）。
- **`js/ai.js` 是 AI 客户端层（AppAI）**：`AI_PROMPTS` 生成模板、`validateAI` 结构校验、`parseJSON`、`callDS`（direct/proxy 双模式，settings/fetch 可注入）。
- **改这三层必须跑单测**：`node --test --test-isolation=none tests/engine.test.js tests/storage.test.js tests/ai.test.js`（沙箱内必须加 `--test-isolation=none`，否则 spawn 子进程被挡；39 用例）。
- **`server.py` 是可选本地代理 + 静态服务**（Python 标准库零依赖）：静态托管本站 + `POST /v1/chat/completions` 转发（Key 只进服务端：系统环境变量 `DET_PROXY_KEY` 或仓库根 `server.env` 文件，模板见 `server.env.example`；`GET /api/health` 可查 keyConfigured）。前端设置里「连接方式」切 `direct`（旧直连）/ `proxy`（同源代理，Key 不落前端）。
- 所有内容以 `<script>` 内的 `const` 全局对象组织：
  - `BANK`（~line 1045）— 内置题库，按题型 key 分：`rs, fib, fibw, lt, ra, ir, il, sp, rtsp, isp, ss, wp, iw, ws`
  - `QUESTION_GROUPS` / `TABORDER` — 侧栏分组与题型顺序
  - `PHOTOS` — 照片库，与 `images/` 下的文件一一对应（带 `band` 分档）；删图必须先查这里
  - `RUBRIC_BY_TYPE`、`OFFICIAL_SECTION_PLAN`（官方模拟考的分段/题量）、`SCORE_BANDS`
- 新增题型需要同步改：`BANK`、`QUESTION_GROUPS`、`TC`（题型元信息）、`RUBRIC_BY_TYPE`、`OFFICIAL_SECTION_PLAN`、`RENDERERS`、`AI_PROMPTS`。
- 代码注释与 UI 文本均为中文，编辑时保持；**UI 文案不得出现开发术语**（EAP/CAT/AEBS/曝光/校准/官方化/「回聊天」等），验收见 `docs/OPEN_DESIGN_SPEC.md` §8。
- 2026 改版后：练习模式 = 品牌化界面（hero + 学习统计 + 绿色卡片，hero/统计此前被 CSS 死隐藏，勿再隐藏）；考试模式 = `body.testing` 沉浸灰白壳（Strict 区块已全部限定 `body.testing` 生效，别改回无条件）。
- **字体**：品牌/数字字体 Nunito 已本地化（`fonts/nunito-latin-{400..900}-normal.woff2` + `fonts/OFL-Nunito.txt`，SIL OFL-1.1）。**勿改回 Google Fonts CDN**（严格离线承诺）；需要新字重时同步 `fonts/` 与 `<style>` 头部 `@font-face`。
- **协作流水线已建立**：OpenDesign 只动 `<head>`/`<style>`/页面结构，回执写 `docs/OPEN_DESIGN_HANDOFF.md`；主 Agent 负责引擎/数据/AI/考试状态机并验收门禁（`node --test … tests/` + `node smoke.js`）。改动 `RENDERERS` 返回结构前先看 `docs/OPEN_DESIGN_SPEC.md` §4/§6。
- 前端视觉/交互后续由 OpenDesign 接管，边界与契约见 `docs/OPEN_DESIGN_SPEC.md`（渲染层/引擎层不可改清单、题目对象结构、验收清单）。

## 运行与测试

- 无构建步骤。直接打开 `index.html` 即可用核心功能（localStorage 与外部经典脚本 `js/engine.js`、`js/storage.js`、`js/ai.js` 在 `file://` 下均可用）。
- **推荐入口**：`$env:DET_PROXY_KEY='sk-…'; python server.py 8787` → `http://127.0.0.1:8787`（静态 + AI 代理 + 安全上下文一体的本地开发环境）。
- **视线守护（摄像头防作弊）需要安全上下文**：必须用 `http://localhost` 或 HTTPS 打开，`file://` 下 `getUserMedia` 会被拒绝。
- 自动化测试覆盖引擎/数据/AI 三层（39 用例）：`node --test --test-isolation=none tests/engine.test.js tests/storage.test.js tests/ai.test.js`；改动后手工在浏览器验证（注意 `body.testing` / 官方考试布局两套 CSS override）。
- **整站冒烟（真实执行页面脚本）**：起 server.py 后 `node smoke.js`（jsdom 需先 `npm install jsdom --prefix $env:TEMP\det-smoke`，或用 `NODE_PATH` 指向其 node_modules）。冒烟覆盖：初始化/RS 全程答题/切题型/题库工厂面板/无 Key AI 出题错误/有 Key AI 出题与 AI 批改成功链路（fetch mock）/互动听力 IL 全流程与总结批改/互动写作 IW 两段式/练习记录弹窗/模拟考试 19 步全程推进至出报告/按钮退出/官方流程 54 步全程推进至报告/学习夹（38 检查点 + 运行时错误捕获）。**改渲染/考试/AI 流程代码后必跑**。
- 快速语法校验：`node --check` 对提取出的 `<script>` 内容（见文档，PowerShell 提取时注意 UTF-8）。

## 数据与状态

- 全部进度、设置、历史存在浏览器 `localStorage`，不在文件里。Key：`detSettings, detHistory, detUiState, detAdaptiveState, detQuestionBank, detMistakes, detFavorites, detGazeState, detSetupSkipped`（定义见 line 858、1252）。清理数据 = 清这些 key。
- AI 调用支持两档连接（`detSettings.connection`）：`direct` 浏览器直连 OpenAI 兼容接口（默认 DeepSeek `https://api.deepseek.com/chat/completions`，`model: deepseek-chat`，Key 存 `detSettings`，**绝不写入项目文件**，只适合自用）；`proxy` 走 `server.py` 同源代理（Key 放服务端环境变量 `DET_PROXY_KEY`，浏览器不接触 Key，适合公开部署）。详见 `docs/ARCHITECTURE.md` §6.2。

## 参考文件（勿当作代码改）

- `index.backup-before-codex-20260801.html` — 2026-08-01 Codex 重写前的快照，只读参考。
- `arno-19-types.md` — DET 19 题型原文（Arno 博客抓取），题库设计的来源依据。
- `_det_sample.pdf` — DET 官方样卷，仅参考。
- `_old_block.txt` — 旧视线检测代码片段，仅参考。
