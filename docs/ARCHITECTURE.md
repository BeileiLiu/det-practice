# DET 模拟练习站 · 架构说明

> 状态：2026-09 交互架构重构进行中。本文描述当前可运行结构，以及把旧单文件编排逐步迁出的边界。

## 1. 总体形态

- **渐进式模块化入口**：`index.html` 仍承载题型渲染和考试状态机，页面入口、学习推荐与题型总览已经从旧题型树中分离。默认路由是学习首页，进入题型后切换到专注练习壳；只有用户确认开始才创建题目并启动计时。
- **产品壳**：`styles/app.css` 负责全局侧栏、首页、能力卡片、题型总览、专注模式与移动端底栏。旧样式保留给 14 个题型组件与考试态，避免一次性重写破坏答题流程。
- **学习决策与视图**：`js/learning.js` 是纯函数层，负责进度汇总、四项能力覆盖、推荐题型与三步计划；`js/views.js` 只生成首页和题型总览 HTML。二者均保持经典脚本 + UMD，可在 `file://` 与 Node 测试中使用。
- **领域与基础设施模块**：`js/engine.js`（评分/自适应/听写）、`js/session.js`（答题生命周期）、`js/rules.js`（当前规则契约）、`js/storage.js`（版本化存储）、`js/ai.js`（AI 客户端）、`js/sound.js`（声音反馈）。
- **运行方式**：零构建、运行时零依赖，`file://` 双击可用；`server.py` 提供受白名单保护的静态服务和可选 AI 代理。Node 测试与 jsdom 冒烟只属于开发验证。

## 2. 分层逻辑

用户路径与五笔鸟保持相同的职责分离思路：应用壳决定“去哪里”，学习决策决定“练什么”，题型组件只决定“怎么作答”。

```
学习首页 / 专项题库 / 错题复习
            │
            ▼
AppLearning（纯函数：概览、推荐、计划、四项进度）
            │
            ▼
AppViews（无状态视图：首页、题型卡片）
            │  用户明确选择题型
            ▼
练习编排层（准备页 → 开始 → 作答 → 反馈 → 下一题）
            │
     ┌──────┼──────────┐
     ▼      ▼          ▼
  Engine  Session   AI / Storage / Sound
```

`index.html` 中尚未迁出的旧编排细节如下；新代码不再继续向这一层堆首页或导航逻辑：

```
┌─ 页面/交互层（DOM 挂载、导航、弹窗、考试流程状态机）
│   renderQuestionNavigation / showType / switchType / openModal / startTest / startOfficialFlow …
├─ 题型渲染层 RENDERERS： rs fib fibw lt ra ir il sp rtsp isp ss wp iw ws
│   renderRS / renderFIB / renderSP …（每个题型一个函数，输出答题卡 HTML + 绑定事件）
│   共享壳：cardHead（顶栏+计时+收藏+评分入口）/ exam-topbar / exam-stage / exam-submitbar
├─ 结果层：showResult（分数环、CEFR、维度条、AI 反馈、错题本联动）/ resultStatusHtml
├─ 引擎层（**已抽离到 `js/engine.js`**，纯逻辑、无 DOM、可单测）：
│   · 客观题评分：objectiveDetScore、listenTypeAssessment（漏词重罚/拼写部分分/大小写标点轻扣）
│   · RS 词汇加权：wordDifficultyWeight、rsWeightedStats
│   · CAT 自适应：eapUpdate（EAP 网格）、responseProb、getItemRecord（参数校准）
│   · 换算：scale100To160、round5（5 分档）、cefrOf、ieltsOf、officializeFeedback（综合能力平均规则）
│   · 依赖全局状态（adaptiveState/selectedBand/currentQ/questionSignature）的函数通过 env 注入，
│     浏览器下 engine.js 自动懒解析默认 env（行为与旧版一致），Node 下由测试显式传入
├─ AI 服务层（**已抽离到 `js/ai.js`**，AppAI）：callDS（OpenAI 兼容 POST，direct/proxy 双模式）、
│   parseJSON（容错 JSON 提取）、AI_PROMPTS（14 个题型生成模板）、validateAI（结构校验，TC 注入）
├─ 数据层（**已抽离到 `js/storage.js`**，AppStorage）：9 个 key 的读写封装 + SCHEMA_VERSION/
│   MIGRATIONS 迁移钩子（详见 §4）；内联脚本保留旧常量名兼容别名指向 AppStorage.KEYS
│   运行时题库：BANK（内置）→ expandLocalSeeds() 扩充 → hydrateStoredBank() 合流 localStorage
│   AI 题 → applyDefaultBands()
├─ 工具层：esc / rnd / fmt / timer（startTimer/clearTimer，每题倒计时+到点自动交卷）
└─ 视线守护：Gaze 状态机（FaceDetector 高级 / 亮度帧差降级），纯本地，不上传
```

**数据流**：选题型 → `nextQuestion(type)`（难度筛选/自适应抽题，避免重复与刚做过的题）→ `RENDERERS[type](q)` 渲染 → 作答 → 客观题本地评分 / 主观题 `callDS` AI 打分 → `showResult(...)` → `logHistory(...)` + 错题本/收藏联动 + 自适应状态更新。

## 3. 两个考试模式

| 模式 | 入口 | 结构 | 注意 |
|---|---|---|---|
| 模拟考试 | header「模拟考试」 | 19 题软流程（buildTestSteps） | 时间到自动下一题；主观题由 AI 批改汇总报告 |
| 2024 旧版流程 | header「2024 旧版流程」 | 历史 6 段结构（OFFICIAL_SECTION_PLAN） | 仅供旧版练习，不代表当前官方考试 |

考试模式通过 `body.testing` 类切换为**沉浸式灰白布局**（见 CSS §Strict official exam layout，整个区块已限定 `body.testing` 生效）；日常练习模式是品牌化界面（hero + 学习统计 + 绿色卡片）。

## 4. 数据契约（localStorage）

> key 的权威定义在 `js/storage.js` 的 `AppStorage.KEYS`；内联脚本用兼容别名（`SETTINGS_KEY` 等）。
> schema 版本化：`detSchemaVersion`；升版时改 `SCHEMA_VERSION` 并在 `MIGRATIONS` 补迁移钩子。

| Key | 内容 | 写入点 |
|---|---|---|
| detSettings | apiKey/model/endpoint/goal/weak/_lastTest | saveSettings |
| detHistory | 最近 200 条记录（含答案、AI 反馈、detail） | logHistory |
| detUiState | sidebarCollapsed/openGroups/bandFilter/adaptiveMode/adaptiveBand/lastType | saveUiState |
| detAdaptiveState | ability/se/answered/items（题目参数）/types/last | saveAdaptiveState |
| detQuestionBank | AI 生成的题库（每题 source='ai'，上限 5000/题型） | saveQuestionStore |
| detMistakes | 错题本（含 rs-word 词条） | saveBook |
| detFavorites | 收藏题 | saveBook |
| detGazeState | 视线守护开关与警告计数 | saveGazeStored |
| detSetupSkipped | 首屏引导横幅已跳过 | — |

**注意**：API Key **只**存 localStorage，绝不写项目文件；浏览器直连 DeepSeek，公开部署必须换代理（见 §6 方案）。

## 5. P0 改版（2026 第 1 轮）变更记录

1. 恢复品牌化练习界面：hero（学习目标）+ 学习统计（4 卡）此前被 CSS 无条件 `display:none`，属死代码；已恢复显示；页面底色/内容宽度回到品牌主题；题目卡片改为圆角+阴影卡片。
2. 原「Strict official exam layout」区块的去全局化：所有无条件规则（隐藏品牌、按钮、侧栏、灰白底、全屏壳）全部限定为 `body.testing` 生效——**日常练习不再被考试壳压制**，考试模式保持沉浸。
3. 删除重复函数定义（bookItemHtml/showStudyBook/practiceBookItem/removeBookItem 旧版）；`practiceBookItem` 合并 rs-word 错词复刷分支（防止复删词条回归失效）。
4. 删除 `showIRResult` 不可达死代码。
5. 术语净化：UI 中去掉 CAT/EAP/AEBS/曝光/难度校准/「官方化」等开发术语，换成考生语言；设置弹窗移除「🧪 测警告/测严重/📊 诊断」按钮（函数保留，仅 console 可调）；footer「回聊天说一声」等聊天痕迹移除。
6. 首次打开引导改价值导向：横幅主按钮「先练客观题」（无需 key），次按钮「配置 AI 批改」；未配置时状态条文案同步改。
7. 文案一致性：品牌副标「19 大题型」、侧栏计数动态化（`TABORDER.length`）、AI 题库面板去「v2」。
8. **修复 `testGazeBaseline` 未声明 Bug（第 4 轮）**：该变量被赋值但从未声明，严格模式下
   `startTest()`/`startOfficialFlow()` 一启动就抛 ReferenceError——**两个考试模式此前完全不可用**；已声明并冒烟验证。
9. **新增 jsdom 整站冒烟 `smoke.js`（第 4–6 轮）**：headless 载入页面真实执行全部脚本，覆盖
   初始化、RS 全程 9 词答题、切题型、题库工厂面板、无 Key AI 出题错误路径、**AI 出题成功链路**
   （mock 上游：callDS→parseJSON→validateAI→questionStore 持久化→渲染）、**AI 批改链路**
   （mock 评分 JSON：writingSys→分数环/总评/中文翻译→历史 details.feedback）、模拟考试 19 步
   手动全程推进至自动出报告、**官方流程 54 步全程推进至报告**（含第 3 段 FIBW/LT/RA 交替序列、
   IR 双文体、IL 成对等结构断言）、按钮退出、学习夹——28 个检查点 + 运行时错误捕获，稳定通过。
10. **修复 `raState` 被 const 声明却整体重赋值（第 7 轮）**：`renderRA` 对 `raState={…}` 重赋值，
    严格模式下抛 `Assignment to constant variable`——**「朗读」题型一渲染即崩**（此前冒烟 19 步恰好
    不含 RA 步未暴露；官方流程全驱动首轮立即抓到）。已改 `let` 并冒烟验证。
11. **server.py 增强（第 7 轮）**：支持 `server.env` 配置文件（BOM 容错）、`GET /api/health`
    健康检查、静态响应 `Cache-Control: no-cache`；新增 `server.env.example` 模板。
12. **冒烟扩至 38 检查点（第 8 轮）**：新增互动听力 IL 全流程（场景→5 回合选答→总结 AI 批改，
    断言综合分 145 与 Writing 子分标记）、互动写作 IW 两段式（Part 1→追问兜底→Part 2→AI 批改
    120→历史详情）、练习记录弹窗开合；并对 38 个顶层 const 做 acorn AST 重赋值审计（清零该类 Bug）。
13. **OpenDesign 首轮交接（第 9 轮）**：OpenDesign 按 `docs/OPEN_DESIGN_SPEC.md` 完成首轮前端
    打磨（Nunito 字体加载、`:focus-visible` 键盘焦点态、`prefers-reduced-motion` 动效降级、
    移动端 44px 触控目标；`<script>` 零改动，回执见 `docs/OPEN_DESIGN_HANDOFF.md` §1–§7）。
    主 Agent 验收：门禁全绿（39 单测 + 38 冒烟）→ 打开交接流水线。
    主 Agent 落地：Nunito 本地化（`fonts/` 六字重 woff2 ≈98KB + OFL-1.1 许可证，移除 Google Fonts
    CDN，严格离线可用）；顺带净化「评分标准」弹窗 3 处用户可见术语残余。

## 6. P1 架构拆分（第 2 轮完成两部分，其余见 6.3）

### 6.1 引擎层提取（已完成）✅

- 新增 `js/engine.js`：把内联脚本中的评分/换算/RS 加权/听写评估/CAT 自适应/官方化反馈等 ~30 个纯函数抽离；
- 关键设计：**经典脚本（非 ES module）** + UMD 导出——浏览器 `file://` 双击仍可用；Node 下 `require` 可测；
- 依赖注入：`getItemRecord`/`questionDifficultyValue`/`objectiveDetScore` 通过 env 传依赖，
  浏览器自动用默认 env（懒解析，行为与旧版逐字节一致）；内联脚本调用名完全不变；
- `rsWeightedStats(q, ans, band)` 签名改为显式传答案与难度（唯一调用点已更新）；
- 单测：`node --test --test-isolation=none tests/engine.test.js`（22 用例，覆盖分段映射单调性、
  难题不虚高、漏词重于拼写错、EAP 后验方向、综合能力成对计算等）。
  注：沙箱环境须加 `--test-isolation=none`（默认按进程隔离会 spawn 子进程）。

### 6.2 本地代理后端（已完成）✅

- 新增 `server.py`（Python 标准库、零依赖、单文件）：
  - 静态服务：托管本站根目录（`index.html`/`js/`/`images/`/`docs/`），响应带 `Cache-Control: no-cache`（开发期防旧缓存）；
  - `POST /v1/chat/completions`：转发到 `DET_PROXY_ENDPOINT`（默认 DeepSeek），
    Key 由服务端注入，**浏览器永远接触不到 Key**；
  - 配置优先级：命令行端口 > 系统环境变量 > **`server.env` 文件**（复制 `server.env.example` 填写；
    解析器兼容 `#` 注释、引号剥离、UTF-8 BOM——Windows 记事本产物也能读）；
  - `GET /api/health`：`{ok, service, proxyEndpoint, keyConfigured, port}` 健康检查；
  - CORS：允许跨源（无 Cookie/凭据，风险可控）；只监听 127.0.0.1；未配置 Key 时代理返回 500（静态不受影响）。
- 前端「连接方式」两档（`detSettings.connection`：`direct` 默认 / `proxy`）：
  - `direct`：维持原浏览器直连（Key 存 localStorage）；
  - `proxy`：`callDS` 与「测试连接」改请求同源 `/v1/chat/completions`，不附带 Key，
    API Key 输入框与接口地址自动禁用；状态条显示「已连接本地代理」。
- 用法：
  ```powershell
  # 方式 A：环境变量
  $env:DET_PROXY_KEY='sk-你的key'
  python server.py 8787
  # 方式 B：server.env（复制 server.env.example 填写，然后把 server.env 加入忽略列表）
  python server.py
  ```

### 6.3 数据层与 AI 客户端抽离（已完成）✅（第 3 轮）

- `js/storage.js`（AppStorage）：9 个 key 读写封装（后端可注入，Node 用内存 Map 模拟）、
  `SCHEMA_VERSION` + `MIGRATIONS` 迁移钩子（浏览器加载自动 `ensureSchema()`）；
  内联脚本保留旧常量名兼容别名，18+ 调用点零改动；
- `js/ai.js`（AppAI）：`AI_PROMPTS` 14 题型模板、`validateAI`（TC 注入可测）、
  `parseJSON`、`callDS`（direct/proxy 双模式，settings/fetch 可注入）；
- 单测扩展至 39 例：`node --test --test-isolation=none tests/engine.test.js tests/storage.test.js tests/ai.test.js`，
  覆盖存储损坏兜底/上限 500/schema 幂等，AI 校验全题型、代理不带 Key 等关键路径。

### 6.4 剩余演进（未执行）

1. **渲染层/编排层命名空间化**：内联脚本组织为 `App.Bank（题库数据与扩充）`、`App.Views（RENDERERS+结果）`、
   `App.Exam（考试状态机）`——为 OpenDesign 提供更明确的渲染层边界（约束：保持 file:// 兼容）；
2. **IndexedDB / 云端同步**：storage.js 的 schema 版本化已就位，后续可平滑加后端落盘/同步；
3. **补测**：`adaptivePick`/`bankHealth` 等编排逻辑属浏览器胶水，暂以引擎覆盖为主；冒烟脚本已把
   「启动-答题-考试-退出」主路径纳入回归（`node smoke.js`，需先 `npm install jsdom` 到本地并起 server.py）。

## 7. 已知债

- `parseJSON` 靠正则兜底，AI 偶尔返回 markdown 时可用但不完美（AI 题型验证已做双保险）。
- IL/ISP/IW 的 AI 追问环节在无 key 时走内置 fallback，行为 OK 但质量分岔。
- `.toolbar`（旧难度栏）CSS 已死（被 `display:none!important` 压死），内容迁到齿轮 popover，标记待删。
- `refreshApiStatusBar` 中「检查中…」等文案在无 key 时会被立即覆盖，无感知影响。
- 视线守护基础模式（亮度/帧差）误报率高，仅作兜底。
