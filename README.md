# 🦉 DET Practice Lab — 多邻国英语测试模拟练习站

按 2024-07 官方 6 段结构编排的 DET 备考练习站：14 个题型组件（含互动阅读 5 子题、互动听力 3 子题，合计官方口径 19 大类）、客观题即时评分、主观题 AI 批改（DeepSeek）、CAT 自适应、错题本/收藏夹、模拟考试与官方流程两种全真考试模式、视线守护（摄像头监考模拟）。

- 中文 UI，无构建、无依赖：`file://` 双击 `index.html` 即可用核心功能。
- 架构分层与演进记录见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)；前端视觉/交互交接给 OpenDesign 的规格见 [`docs/OPEN_DESIGN_SPEC.md`](docs/OPEN_DESIGN_SPEC.md)。

## 快速开始

```powershell
# 方式 A（推荐）：本地代理 + 静态服务一体入口（Key 只进服务端）
Copy-Item server.env.example server.env   # 填入你的 DET_PROXY_KEY
python server.py                          # 打开 http://127.0.0.1:8787
# 方式 B：纯静态（无需 Key 也能练全部客观题）
python -m http.server 8123                # 打开 http://127.0.0.1:8123
# 方式 C：直接双击 index.html（file://）
```

站内「设置」里两种连接方式：
| 连接方式 | 说明 |
|---|---|
| 直连（默认） | Key 存浏览器 localStorage，只适合本机自用 |
| 本地代理 | 请求同源 `/v1/chat/completions`，Key 在服务端 `server.env`/环境变量，浏览器不接触 Key，公开部署推荐 |

> 🔐 **Key 安全**：直连模式下 Key 绝不写入任何项目文件（仅浏览器 localStorage）；代理模式下 Key 只存在于你自己的服务端配置文件。`server.env` 记得不要外传。

## 目录结构

```
index.html              UI 主体（HTML+CSS+内联 JS：题型渲染/导航/考试流程）
js/engine.js            引擎层（评分/自适应/听写纯函数，可单测）
js/storage.js           数据层（9 个 localStorage key + schema 版本化）
js/ai.js                AI 客户端（生成模板/结构校验/OpenAI 兼容调用，direct/proxy）
server.py               可选本地代理 + 静态服务（Python 标准库零依赖）
server.env.example      server.py 配置模板
tests/                  引擎/数据/AI 三层单测（39 用例）
smoke.js                jsdom 整站冒烟（38 检查点，真实执行页面脚本）
docs/                   架构说明 + OpenDesign 交接规格
images/                 看图题照片库（与 PHOTOS 一一对应，删图先查它）
```

## 测试与冒烟

```powershell
# 单测（沙箱内需 --test-isolation=none，否则 spawn 子进程被挡）
node --test --test-isolation=none tests/engine.test.js tests/storage.test.js tests/ai.test.js
# 整站冒烟：起 server.py 后执行；jsdom 需先装一次
npm install jsdom acorn --prefix $env:TEMP\det-smoke
$env:NODE_PATH="$env:TEMP\det-smoke\node_modules"; node smoke.js
# 静态审计：顶层 const 无重赋值（acorn）
# node "$env:TEMP\const-audit.js"（脚本内容见仓库测试记录，或按 ARCHITECTURE.md §6.5 重建）
# 服务器自检
Invoke-RestMethod http://127.0.0.1:8787/api/health
```

## 数据

全部进度/设置/历史在浏览器 `localStorage`（9 个 key，见 `docs/ARCHITECTURE.md` §4）；「设置 → 配置备份」可导出/导入全部数据。清数据 = 清 `det*` 前缀的 key。

## 已知边界

- 口语/听力识别需要 Chrome/Edge + 麦克风权限；朗读/听写发音用浏览器 TTS 模拟，辨音仅供参考；
- 视线守护需要 `http://localhost`/HTTPS 安全上下文，摄像头数据完全本地处理；
- 单题分数与模拟总分是**练习估分**，不等同官方成绩。