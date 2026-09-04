# OpenDesign 前端交接规格

> 版本：v1（2026 改版第 1 轮后）。对象：接管前端视觉与交互的 OpenDesign。
> 后端/架构（数据、引擎、AI、考试流程）由主 Agent 维护，**不要改动**；本文档给出可改边界与必须保留的契约。

## 1. 背景与目标

DET 模拟练习站是给中文用户备考 Duolingo English Test 的单文件静态应用。用户反馈「完成度低、没有打开的欲望」。已确认的视觉方向：**Duolingo 绿 · 圆润友好**（绿 `#58cc02` 系、大圆角、卡片化、进度反馈丰富），与官方 DET 的灰白严肃形成「练习 vs 考试」双态。

## 2. 双态布局（必须保留的既有交互契约）

| 状态 | 触发 | 视觉 | 说明 |
|---|---|---|---|
| 练习模式（默认） | 普通浏览 | 品牌化：hero + 学习统计 + 绿色卡片 + 左侧题型栏 | P0 已恢复 hero/统计显示；你的设计在此模式发挥 |
| 考试模式 | `<body class="testing">`（模拟考试/官方流程按钮） | 沉浸灰白、无品牌、无侧栏（抽屉式）、宽屏 | 已有完整 override 区块，可重绘但**不要改变其状态机**（`body.testing` 类切换、`#testBar`、`testNext()` 自动流转） |

## 3. 页面清单（现状）

1. **首页/练习态**：header（品牌 + 9 个操作按钮）→ hero（学习目标/状态卡）→ 学习统计（4 卡）→ 左侧题型侧栏（4 分组 + 学习夹）→ 主区答题卡。
2. **老 9 按钮**：随机一题 / AI 出题 / 模拟考试 / 官方流程 / 视线守护 / AI 题库 / 评分标准 / 设置 / 记录 —— **建议重排**：主操作（随机/模拟考试/官方流程）与次级操作（视线守护/AI 题库/设置/记录）分组，或收进齿轮 popover；功能 id 勿改。
3. **答题卡**（14 题型共用壳）：顶栏（倒计时 + 题型名 + 难度徽章 + 收藏 ☆ + 暂停/评分/重开）+ 中央 exam-stage（题型内容）+ 底部 submitbar（SUBMIT 等）。
4. **结果卡**：分数环（conic-gradient，`--score-angle` CSS 变量）、CEFR 行、正确率 pill、8 维分数条、AI 反馈（优点/问题/下一步/高分改写/中文翻译）。
5. **弹窗**：设置（API Key/模型/目标分/弱项/视线守护/备份）、练习记录、评分标准（5 tab）。
6. **专业页面**：错题本、收藏（含筛选/掌握/错词重练）、AI 题库生成面板（进度条+日志）、确认对话框（`confirm()` 原生）。
7. **考试态页面**：报告卡（总分大数字 + 8 维 + 表格 + 视线守护统计）。

## 4. 渲染层契约（改 UI 时不能打破的接口）

所有题型渲染走 `RENDERERS = {rs, fib, fibw, lt, ra, ir, il, sp, rtsp, isp, ss, wp, iw, ws}`，签名 `function(type 专用)(q)`：
- 输入：题目对象 `q`（结构见 §6）；
- 职责：把答题 UI 写入 `#questionArea.innerHTML`，绑定事件；
- 交互必须调用（函数名勿改）：`startTimer(秒, 到点回调)`、`clearTimer()`、`showResult(label, score, note, dims, type, accuracy)`、`logHistory(type, score, note, details)`、`nextQuestion(type)`、`showType(type)`、`continuePractice()`、`showRubric(type)`、`openModal(id)`。
- 结果区永远渲染进 `#resultArea`；答题区永远渲染进 `#questionArea`。
- 计时器：`startTimer` 自动渲染到 `#timer`；到点自动交卷的回调由各 renderer 自己传（如 `submitFIB(q)`）。
- 考试模式下 renderer 会收到 `body.testing` 类，实现**自动交卷/自动下一题**（`testNext()`）；你的 UI 不得在考试模式引入需要人工点击才能继续的阻塞交互（确认弹窗除外）。

## 5. 禁止改动（主 Agent 负责的引擎/数据/AI 层）

以下为纯逻辑，修改将破坏评分与数据兼容性，需先与主 Agent 沟通：
- **`js/engine.js`（引擎层）整体**：评分（`objectiveDetScore`、`listenTypeAssessment`、`wordDifficultyWeight`、`rsWeightedStats`、`scale100To160`、`round5`、`officializeFeedback`、`cefrOf`、`ieltsOf`）、自适应（`eapUpdate`、`getItemRecord`、`responseProb`、`itemInformation`）、换算（`detFromScore`、`scoreToBand`、`normalizeHistoryScore`）——该文件已有单测，改动需保证测试全绿
- **`js/ai.js`（AI 客户端）**：`AI_PROMPTS`、`validateAI`、`parseJSON`、`callDS`；`js/storage.js`（数据层）：9 个 key 字面量/读写/Schema 版本——这两层同样有单测覆盖，改前先读测试
- 数据：`BANK`、`PHOTOS`、`TC`、`QUESTION_GROUPS`、`TABORDER`、`SCORE_BANDS`、`RUBRIC_DEFS`、`OFFICIAL_SECTION_PLAN`、全部 localStorage key 与读写函数
- 考试状态机：`buildTestSteps`、`renderTestStep`、`testNext`、`collect`、`renderTestReport`、`startOfficialFlow`、`OFFICIAL_SECTION_PLAN`
- 连接方式：`settings.connection`（`direct`/`proxy`）与 `callDS` 的代理分支——proxy 模式下请求 `/v1/chat/completions` 且不发 Key，这是 Key 不落前端的安全边界

可以自由改：CSS 全部、页面 HTML 结构（保留上述 id/class 钩子）、`RENDERERS` 内部视觉、导航重排、新页面（只要通过既有函数拼装）、动画、字体加载。连接方式的下拉/提示属于设置面板 UI，可重绘但语义与 id（`setConn`/`connHint`/`applyConnUI`）保持。

## 6. 题目对象结构（渲染依赖，勿改字段名）

```js
rs:  {words:[{w:'weather',real:true},…]}                       fib: {segments:[{text:'…'},{gap:{word:'challenging'}},{text:'…'}]}
fibw:{items:[{segments:[…同上…]}]}                             lt:  {sentence:'…',band:'60'}
ra:  {text:'…',band:'90'}                                      ir:  {type:'叙事'|'说明',paras:[…],q1:{blanks:[…],pool:[…]},q2:{…},q3..q6:{…}}
il:  {scenario:'…',turns:[{speaker,line,options:[4],answer}],summary_time:75}
sp/wp:{photo:'images/….jpg' 或 scene:'中文场景描述',band}      rtsp/ss/ws:{topic:'…',band}
isp: {opener:'…',target:6,fallback:[…]}                       iw:  {prompt:'…'}
所有题都可能带 {time:秒, band:'60'|'90'|'120', source:'ai'}
```

## 7. 视觉方向建议（Duolingo 绿 · 圆润友好）

- 主色沿用 `--accent:#58cc02`（Duolingo 绿），正确=亮绿/错误=红/信息=蓝 `#1cb0f6`；大圆角（卡片 16–20px、按钮 12–14px）、底部 3–4px 实色阴影的「按压 3D 感」按钮（现有 `.exam-choice`/`.lt-play` 就是范例）。
- **字体是本仓库最大的视觉短板**：现在靠系统字体回退，Windows 会落到雅黑。建议引入一枚圆体/圆润无衬线 webfont（如 Nunito，当前 font-stack 已留位），通过 `@font-face` 本地托管（保证 file:// 可用）。
- hero 区是「打开欲」的第一载体：建议做目标导向的欢迎（当前学习目标 + 继续上次 + 今日推荐路径），而非静态标语。
- 术语洁癖：UI 文案不得出现 EAP/CAT/曝光/AEBS/校准/官方化/题库工厂 v2 等开发词（P0 已清理，新增界面同理）；答题反馈用考生语言。
- 首次访问引导：横幅主按钮「先练客观题」（无 key 可玩），次按钮「配置 AI 批改」——保持不催 key 的价值导向。
- 移动端：已有一套抽屉方案（`<820px` `body.nav-drawer-open`），在它之上继续即可；考试模式移动端保持固定顶部倒计时。

## 7.5 信息架构线框图（让 OpenDesign 零调研起步）

> 线框只定信息层级与区块职责，视觉完全自由；id/class 钩子不变即可。

```
[练习首页 · 桌面练习模式]
┌────────────────────────────────────────────────────────────┐
│ 🦉 DET Practice Lab        AI 评分 · 19 大题型     [随机][模拟考][设置]│
├────────────────────────────────────────────────────────────┤
│  HERO：每做一题，都知道为什么得这个分          │ 学习目标卡            │
│  （欢迎语 + 主 CTA）                              │ 目标分/弱项/继续上次   │
│  学习统计：累计练习 │ 最近均分 │ 历史最佳 │ 近 7 天               │
├───────────────┬────────────────────────────────────────────┤
│ 侧栏 练习题库    │ 答题卡（见下）                              │
│ ▾ Reading      │                                          │
│   · 词汇判断 rs │                                          │
│   · 完形打字 fib│                                          │
│ ▸ Listening    │                                          │
│ ▸ Speaking     │                                          │
│ ▸ Writing      │                                          │
│ ▸ 学习夹(错题/收藏)│                                       │
└───────────────┴────────────────────────────────────────────┘

[答题卡（客观题壳，14 题型共用）]
┌────────────────────────────────────────────────────────────┐
│ ⏱ 1:30  for this question      题型名·难度徽章 ☆ 暂停 评分 × │
├────────────────────────────────────────────────────────────┤
│                                                          │
│              Is this a real English word?                │
│                    "weather"                             │
│             [Yes]                [No]                    │
│                                                          │
├────────────────────────────────────────────────────────────┤
│ ▼ 进度条（词进度）                                           │
└────────────────────────────────────────────────────────────┘

[结果卡（主观/客观统一）]
┌────────────────────────────────────────────────────────────┐
│  AI评分反馈 · 词汇判断                                      │
│  ⭕ 分数环 125/160   CEFR B2 · 独立表达                     │
│  ✓ 正确 7/9 · 78%                                         │
│  Reading 125 │ Writing – │ Listening – │ Speaking –       │
│  做得好的地方 / 需要修正         下一步练习                 │
│  🎯 当前最该练的一点                                         │
│  高分表达参考 / 中文翻译                                     │
│  [NEXT QUESTION →]  [查看评分标准]                          │
└────────────────────────────────────────────────────────────┘

[考试模式（body.testing 沉浸壳，不可有品牌/侧栏）]
┌────────────────────────────────────────────────────────────┐
│ ⏱ 02:14                Vocabulary · Question 3/54    ×    │
│             （题型内容 = 答题卡，全屏宽、灰白）                 │
│                                            [下一题 →]      │
└────────────────────────────────────────────────────────────┘

[设置弹窗 · 连接方式]
  连接方式：[直连（Key 存浏览器）] / [本地代理（Key 在服务端）] ▾
  API Key / 模型 / 接口地址（代理模式下 Key 框禁用）
  目标分 / 弱项 / 视线守护开关 / 配置备份
  [🔌 测试连接] [保存] [关闭]      ← 状态条实时显示连接状态
```

主路径建议（“打开欲”的第一屏）：**欢迎 + 继续上次练习 + 一个主 CTA**（如「随机开练」），
比现在的 9 个平级按钮更聚焦；次级功能（视线守护/AI 题库/评分标准/记录）收进齿轮或设置，
header 只留 2–3 个主操作。

## 8. 验收标准（改完后请逐条自测）

- [ ] 无 key 打开首页：见 hero+统计+题型侧栏，点任意客观题可做完并出分（RS/FIB/FIBW/LT/RA/IR）
- [ ] 有 key：AI 出题、主观题（SP/RTSP/ISP/SS/WP/IW/WS）批改出 JSON 反馈与 8 维分数
- [ ] 考试模式（模拟考试/官方流程）无品牌元素、倒计时自动流转、中途可退出
- [ ] 错题本/收藏 增删、复刷、错词重练（rs-word 词条）可用
- [ ] `127.0.0.1:8123` 静态服务下全部功能可用；`file://` 双击直开无报错（console 无红错）
- [ ] 视口 360px/768px/1440px 无横向滚动；抽屉交互正常
- [ ] `node --check` 提取的 `<script>` 内容通过，且 `node --test --test-isolation=none tests/engine.test.js tests/storage.test.js tests/ai.test.js` 全绿
- [ ] 起 server.py 后 `node smoke.js` 冒烟通过（38 检查点零错误，含 AI 出题/批改 mock 链路与 IL/IW 全流程）——改 UI/交互后尤其要跑，抓运行时崩溃
- [ ] 无开发术语残留（grep：`EAP|AEBS|曝光|官方化|回聊天|题库工厂 v2`）
- [ ] 连接方式：default `direct` 行为与旧版完全一致；切 `proxy` 后 API Key 框禁用、AI 出题走 `/v1/chat/completions` 而不带 Key

## 9. 协作边界

- 需要新增题型/改评分/改数据 → 写进需求丢回主 Agent。
- 有引擎层疑问 → 读 `docs/ARCHITECTURE.md` §2/§4，或让主 Agent 解释。
- 设计对账工具：`_det_sample.pdf`（官方样卷视觉）、`https://englishtest.duolingo.com`（官方字体/配色参考）。