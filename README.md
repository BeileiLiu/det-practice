# DET Path：多邻国英语测试练习站

这是一个可以在自己电脑上运行的 DET 练习网站。它包含专项练习、即时评分、AI 批改、错题复习和模拟考试。

如果你不懂编程，也可以按照下面的步骤使用。**不需要安装 Node.js，不需要输入 `npm install`，也不需要购买服务器。**

## 一、从 GitHub 下载到电脑

### 方法 A：下载 ZIP（第一次使用最推荐）

1. 打开项目主页：[github.com/BeileiLiu/det-practice](https://github.com/BeileiLiu/det-practice)。
2. 点击页面右上方绿色的 **Code** 按钮。
3. 点击 **Download ZIP**。
4. 下载完成后，打开电脑的“下载”文件夹，找到 `det-practice-master.zip`。
5. 右键这个 ZIP 文件，选择 **全部解压缩**。
6. 打开解压后的 `det-practice-master` 文件夹。

请先完整解压，不要直接在 ZIP 压缩包里双击文件，否则图片、字体和脚本可能无法正常加载。

### 方法 B：使用 Git 克隆（适合以后经常更新）

电脑已经安装 Git 时，打开 PowerShell 或 Windows 终端，依次输入：

```powershell
cd D:\Project
git clone https://github.com/BeileiLiu/det-practice.git
cd det-practice
```

`D:\Project` 可以换成你想存放项目的文件夹。第一次接触 Git 的用户直接使用方法 A 即可。

## 二、启动网站

### 推荐方式：双击启动脚本

1. 确认电脑已经安装 Python。
   - 按 `Win + R`，输入 `cmd` 后回车。
   - 输入 `python --version` 后回车。
   - 如果能看到类似 `Python 3.x.x`，说明已经安装。
2. 如果没有安装，请前往 [Python 官方下载页面](https://www.python.org/downloads/)下载安装。
   - 安装界面请勾选 **Add Python to PATH**。
   - 安装结束后，关闭并重新打开项目文件夹。
3. 回到项目文件夹，双击 **`start-windows.bat`**。
4. 浏览器会自动打开：<http://127.0.0.1:8787>。
5. 启动后请保留黑色命令窗口。关闭该窗口，网站服务也会停止。

下次使用时，只需再次双击 `start-windows.bat`。

### 不安装 Python：直接打开网页

双击项目中的 **`index.html`** 也可以开始做大部分客观题。

这种方式有两个限制：

- 摄像头和麦克风功能可能被浏览器拦截；
- 部分 AI 接口可能不允许网页直接连接。

因此，长期使用仍建议安装 Python，并通过 `start-windows.bat` 启动。

## 三、第一次进入后怎么用

1. 首页会推荐一个短练习。点击 **开始今日练习**。
2. 先阅读任务说明。此时不会倒计时。
3. 点击 **开始本题** 后，题目才会出现并开始计时。
4. 想自己选择题型，可以点击左侧或底部的 **专项练习**。
5. 做错的题会进入 **错题复习**，练习记录会保存在当前浏览器中。

不配置 AI Key 也可以使用客观题、错题本和本地评分。

## 四、配置 AI 批改

作文、口语批改和 AI 出题需要 API Key。

1. 点击左下角的 **AI 与设置**。
2. 把 API Key 粘贴到输入框。
3. 点击 **测试连接**。
4. 测试成功后点击 **保存**。

如果使用 MiMo Token Plan，直接粘贴以 `tp-` 开头的 Key 即可，网站会自动选择对应模型和中国节点。其他 OpenAI 兼容服务可以在“高级设置”中填写模型和接口地址。

直连模式下，Key 只保存在当前浏览器的本地存储中，不会写入项目文件。请不要截图或公开分享自己的 Key。

## 五、以后如何更新

### 当初使用 ZIP 下载

重新前往 GitHub 下载最新 ZIP，并解压到新文件夹即可。练习记录存储在浏览器中；只要仍通过 `http://127.0.0.1:8787` 打开，原有记录通常会继续保留。

如果需要保险，可以先打开 **AI 与设置 → 导出配置**，再更新项目。

### 当初使用 Git 克隆

在项目文件夹空白处右键，选择“在终端中打开”，然后运行：

```powershell
git pull origin master
```

更新结束后，重新双击 `start-windows.bat`。

## 六、常见问题

### 双击启动脚本后提示“没有找到 Python”

Python 尚未安装，或者安装时没有加入 PATH。重新安装 Python，勾选 **Add Python to PATH**，安装完成后重新打开项目文件夹。

### 浏览器显示“无法访问此网站”

检查黑色命令窗口是否仍然打开。正常启动时会显示：

```text
DET 代理+静态服务器: http://127.0.0.1:8787
```

如果窗口已经关闭，请重新双击 `start-windows.bat`。

### 提示端口 8787 已被占用

通常表示网站已经启动过。先在浏览器打开 <http://127.0.0.1:8787> 试试。如果仍然打不开，关闭旧的命令窗口，再重新启动。

### 页面样式不正常或按钮没有反应

1. 确认项目已经完整解压；
2. 按 `Ctrl + F5` 强制刷新页面；
3. 不要单独移动 `index.html`，它必须与 `js`、`styles`、`fonts` 和 `images` 文件夹放在一起。

### AI 测试连接失败

先检查 Key 是否完整、是否仍有可用额度。MiMo Token Plan Key 应以 `tp-` 开头。若直连被浏览器或接口限制，可查看“高级设置”中的本地代理方式。

## 七、开发者说明

项目没有构建步骤，运行时不依赖 npm。页面入口和题型编排位于 `index.html`，其他职责按模块拆分：

```text
index.html              页面入口、题型渲染与考试流程
styles/app.css          学习首页、题型总览和专注练习布局
js/learning.js          学习概览、推荐题型和今日计划
js/views.js             首页与题型总览视图
js/engine.js            评分、自适应和听写逻辑
js/session.js           答题会话生命周期
js/storage.js           本地数据与版本迁移
js/ai.js                AI 生成与批改客户端
js/rules.js             当前考试规则契约
js/sound.js             本地界面音效
server.py               静态服务与可选 AI 代理
```

完整测试：

```powershell
node --test --test-isolation=none tests/engine.test.js tests/storage.test.js tests/ai.test.js tests/session.test.js tests/rules.test.js tests/sound.test.js tests/learning.test.js
python -m unittest tests/server_test.py
```

整站冒烟测试需要先启动 `server.py`，并在临时目录安装 jsdom。架构与当前考试规则说明见 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) 和 [`docs/CURRENT_DET_RULES.md`](docs/CURRENT_DET_RULES.md)。

## 八、使用边界

- 口语和听力识别建议使用最新版 Chrome 或 Edge；
- 摄像头功能需要通过 `http://localhost`、`http://127.0.0.1` 或 HTTPS 打开；
- 单题分数和模拟考试总分属于练习估分，不等同于官方成绩；
- 仓库中的“2024 旧版流程”只用于历史题型练习，不代表当前官方考试。
