'use strict';
// DET 整站 headless 冒烟（jsdom）：真实执行页面脚本，捕获运行时错误
// 前置：server.py 在 8787 运行；jsdom 装在 $env:TEMP/det-smoke
// 运行：node smoke.js（NODE_PATH 指向 jsdom 所在 node_modules）
// 覆盖：初始化 / RS 全程答题 / 题型切换 / 题库工厂面板 / 无 Key AI 出题错误路径 /
//       AI 出题成功链路（mock 上游）/ AI 批改链路（mock 评分 JSON）/
//       模拟考试（19 步手动全程推进 → 自动出报告）/ 按钮退出 / 2024 旧版流程 / 学习夹
// 注意：顶层 let/const（RENDERERS/currentType/testSteps 等）不挂在 window 上，须用 w.eval 读取
const { JSDOM, VirtualConsole } = require('jsdom');

const vc = new VirtualConsole();
const errors = [];
vc.on('jsdomError', e => {
  const m = String((e && e.message) || e);
  if (m.includes('Not implemented')) return;
  if (m.includes('scrollIntoView')) return; // jsdom 无此 API，浏览器有
  errors.push(m);
});
vc.on('error', (...a) => errors.push('console.error: ' + a.join(' ')));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const assert = (cond, msg) => { if (!cond) errors.push('ASSERT FAIL: ' + msg); };
const say = msg => console.log('  [step] ' + msg);

// ---- 可路由的 AI 上游 mock：按 prompt 特征词返回对应 JSON ----
const MOCK_RS = {
  words: [
    { w: 'weather', real: true }, { w: 'cleam', real: false }, { w: 'journey', real: true },
    { w: 'thriend', real: false }, { w: 'honest', real: true }, { w: 'spleak', real: false },
    { w: 'breakfast', real: true }, { w: 'mircle', real: false }, { w: 'window', real: true }
  ]
};
const MOCK_FIB = {
  segments: [
    { text: 'Learning a language can be ' }, { gap: { word: 'challenging' } },
    { text: ' at first, but practice makes it ' }, { gap: { word: 'easier' } },
    { text: ' over time.' }
  ]
};
const MOCK_WRITING = {
  overall: 120, reading: null, writing: 125, listening: null, speaking: null,
  literacy: null, comprehension: null, conversation: null, production: null,
  criteria: { content: 82, discourse_coherence: 75, lexis: 78, spelling: 90, grammar: 74 },
  strengths: ['结构清晰'], issues: ['举例可以更具体'], comment: '总体不错，继续保持。',
  priority: '多给具体例子', improved_answer: 'A more detailed essay with concrete examples.',
  next_steps: ['练习举例展开']
};
const MOCK_SPEAKING = { overall: 110, speaking: 110, comment: '口语尚可。', criteria: { content: 70, fluency: 66 } };
function mockFetch(url, opts) {
  // callDS 期望 OpenAI 壳：{ choices:[{ message:{ content: <string> } }] }
  const reply = payload => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: JSON.stringify(payload) } }] }) });
  try {
    const body = JSON.parse(opts.body || '{}');
    const all = (body.messages || []).map(m => String(m.content || '')).join('\n');
    if (all.includes('资深考官')) return reply(MOCK_WRITING);
    if (all.includes('口语考官')) return reply(MOCK_SPEAKING);
    if (all.includes('词汇判断题')) return reply(MOCK_RS);
    if (all.includes('完形打字题')) return reply(MOCK_FIB);
    if (all.includes('中文翻译助手')) return reply({ translation: '（冒烟）中文翻译' });
    return { ok: false, status: 422, text: async () => 'mock: unknown prompt type' };
  } catch (e) {
    return { ok: false, status: 500, text: async () => 'mock: bad request' };
  }
}

(async () => {
  const dom = await JSDOM.fromURL('http://127.0.0.1:8787/index.html', {
    resources: 'usable',
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    virtualConsole: vc,
    beforeParse(window) {
      window.confirm = () => true;
      // jsdom 没有 TTS：给空实现，让考试流程能往前走
      Object.defineProperty(window, 'speechSynthesis', {
        value: { getVoices: () => [], cancel() {}, speak() {}, get onvoiceschanged() { return null; }, set onvoiceschanged(_v) {} },
        configurable: true
      });
      window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
      // jsdom 无 fetch：可路由 mock（按 prompt 特征词返回题库/评分 JSON）
      window.fetch = mockFetch;
    }
  });
  const w = dom.window;
  const E = expr => { try { return w.eval(expr); } catch (e) { return 'EVALERR:' + e.message; } };
  await sleep(900);

  // ---- 1. 初始化 ----
  assert(w.AppStorage && w.AppAI && w.DETEngine && w.AppSound && w.AppLearning && w.AppViews, '核心模块全局存在');
  assert(E('typeof RENDERERS === "object" && Object.keys(RENDERERS).length') === 14, 'RENDERERS 14 题型: ' + E('Object.keys(RENDERERS).length'));
  assert(E('currentView') === 'home', '初始化进入学习首页, 实际 ' + E('currentView'));
  assert(E('currentType') === null, '首页没有强制选中题型');
  assert(w.document.querySelector('#questionArea .learning-home'), '首页学习面板可见');
  assert(!E('timerId'), '首次进入没有倒计时');
  w.document.querySelector('#homeStartBtn').click();
  await sleep(80);
  assert(w.document.querySelector('#questionArea .practice-ready-card'), '推荐练习先显示任务说明');
  assert(!E('timerId'), '任务说明页仍未开始倒计时');
  w.document.querySelector('#startPracticeBtn').click();
  await sleep(100);
  assert(w.document.querySelector('#rsWord') && w.document.querySelector('#rsWord').textContent.trim(), 'RS 首个单词可见');

  // ---- 1.5 AI 快速配置 + 音效设置 ----
  w.document.querySelector('#btnSettings').click();
  await sleep(80);
  const advanced = w.document.querySelector('#advancedAISettings');
  assert(advanced && !advanced.open, 'AI 高级设置默认收起');
  const keyInput = w.document.querySelector('#setKey');
  keyInput.value = 'tp-smoke'; keyInput.dispatchEvent(new w.Event('input'));
  assert(w.document.querySelector('#setModel').value === 'mimo-v2.5-pro', 'tp- Key 自动选择 MiMo 模型');
  assert(/token-plan-cn\.xiaomimimo\.com/.test(w.document.querySelector('#setEndpoint').value), 'tp- Key 自动选择 MiMo 中国节点');
  assert(w.document.querySelector('#setSound') && w.document.querySelector('#setSoundVolume') && w.document.querySelector('#soundPreview'), '音效开关、音量与试听可用');
  w.document.querySelector('#closeSettings').click();

  // ---- 2. 答完 9 词 → 结果卡 + 历史 ----
  for (let i = 0; i < 9; i++) {
    const yes = w.document.querySelector('#yesBtn');
    if (!yes) { assert(false, 'yesBtn 缺失于第 ' + i + ' 词'); break; }
    yes.click();
    await sleep(720);
  }
  await sleep(400);
  assert(w.document.querySelector('#resultArea .score-ring'), 'RS 分数环渲染');
  const hist = w.AppStorage.getHistory();
  assert(hist.length >= 1 && hist[0].type === 'rs', '历史已记录 rs: ' + (hist[0] && hist[0].type));

  // ---- 3. 切题型 FIB ----
  w.showType('fib');
  await sleep(250);
  assert(E('currentType') === 'fib', '切到 fib, 实际 ' + E('currentType'));
  assert(w.document.querySelector('.fib-wordbox'), 'FIB 空格渲染');

  // ---- 3.5 听写会话：答案快照 + 幂等提交 ----
  w.showType('lt');
  await sleep(150);
  const ltPlay = w.document.querySelector('#playBtn');
  const ltInput = w.document.querySelector('#ltInput');
  assert(ltPlay && ltInput, 'LT 播放和输入控件渲染');
  if (ltPlay) ltPlay.click();
  if (ltInput) {
    ltInput.value = E('currentQ.sentence');
    ltInput.dispatchEvent(new w.Event('input'));
  }
  const ltBefore = w.AppStorage.getHistory().filter(x => x.type === 'lt').length;
  const ltQuestion = w.eval('currentQ');
  w.submitLT(ltQuestion, 'manual');
  w.submitLT(ltQuestion, 'timeout');
  const ltItems = w.AppStorage.getHistory().filter(x => x.type === 'lt');
  assert(ltItems.length === ltBefore + 1, 'LT 重复提交只记一次');
  assert(ltItems[0].details && ltItems[0].details.session && ltItems[0].details.session.reason === 'manual', 'LT 历史包含会话摘要');

  // ---- 4. 题库工厂面板：打开/关闭 ----
  w.openFactoryDialog();
  await sleep(150);
  assert(w.document.querySelector('#factoryPanel'), '题库工厂面板打开');
  w.showType('rs'); // 先把主区域恢复成题目
  await sleep(150);
  const closeBtn = w.document.querySelector('#factoryCloseBtn');
  if (closeBtn) closeBtn.click();
  await sleep(150);
  assert(!w.document.querySelector('#factoryPanel'), '工厂面板可关闭');

  // ---- 5. 无 Key 时 AI 出题 → 错误提示路径 ----
  w.doAIQuestion();
  await sleep(500);
  const errHtml = w.document.querySelector('#resultArea') && w.document.querySelector('#resultArea').textContent;
  assert(errHtml && errHtml.includes('API Key'), '无 Key AI 出题给出引导错误: ' + String(errHtml).slice(0, 80));
  w.showType('rs');
  await sleep(150);

  // ---- 6. AI 出题成功链路（mock 上游）----
  w.eval('settings.apiKey="sk-smoke-mock"');
  w.doAIQuestion();
  await sleep(900);
  assert(E('currentQ && currentQ.source') === 'ai', 'AI 出题落地为 ai 题: ' + E('currentQ && currentQ.source'));
  assert(E('Array.isArray(currentQ.words) ? currentQ.words.length : -1') === 9, 'AI RS 题恰好 9 词');
  const qs = w.AppStorage.readQuestionStore();
  assert(Array.isArray(qs.rs) && qs.rs.length >= 1, 'AI 题已持久化 questionStore.rs: ' + (qs.rs ? qs.rs.length : 0));
  assert(w.document.querySelector('#rsWord') && w.document.querySelector('#rsWord').textContent.trim(), 'AI 题渲染出单词');

  // ---- 7. AI 批改链路（mock 评分 JSON + 中文翻译）----
  w.showType('ws');
  await sleep(250);
  const ta = w.document.querySelector('#wsInput');
  assert(ta, 'WS 答题框渲染');
  ta.value = 'Success means growing every day. I feel successful when I finish what I start and help others.';
  await w.submitWS(w.eval('currentQ'));
  await sleep(900);
  const ring = w.document.querySelector('#resultArea .score-ring-inner b');
  assert(ring && ring.textContent.trim() === '120', 'AI 批改分数环 120: ' + (ring && ring.textContent));
  const rtext = w.document.querySelector('#resultArea').textContent;
  assert(rtext.includes('总体不错'), 'AI 总评渲染');
  assert(rtext.includes('（冒烟）中文翻译'), '中文翻译盒子已填充');
  const wsHist = w.AppStorage.getHistory().find(x => x.type === 'ws');
  assert(wsHist && wsHist.details && wsHist.details.feedback, 'WS 批改详情写入历史: wsKeys=' + JSON.stringify(wsHist ? Object.keys(wsHist) : []));

  // ---- 7.5 互动听力 IL 全流程：场景→5 回合选答→总结 AI 批改 ----
  w.showType('il');
  await sleep(300);
  const nextBtn = () => w.document.querySelector('#nextBtn');
  if (nextBtn()) nextBtn().click(); // 进入第 1 回合
  await sleep(150);
  for (let tIdx = 0; tIdx < 5; tIdx++) {
    const correct = E('currentQ.turns[' + tIdx + '].answer');
    const radio = w.document.querySelector('input[name="ilOpt"][value="' + correct + '"]');
    if (!radio) { assert(false, 'IL 回合 ' + tIdx + ' 选项缺失'); break; }
    radio.checked = true;
    radio.dispatchEvent(new w.Event('change'));
    await sleep(80);
    const nb = nextBtn();
    if (nb) nb.click(); else { assert(false, 'IL 回合 ' + tIdx + ' 无 next'); break; }
    await sleep(80);
  }
  const ilSum = w.document.querySelector('#ilSummary');
  assert(ilSum, 'IL 总结输入框出现（回合全走完）');
  ilSum.value = 'The student asked about the lab assistant position and agreed to start on Monday after discussing his lab experience.';
  ilSum.dispatchEvent(new w.Event('input'));
  await sleep(80);
  const ilSubmit = w.document.querySelector('#submitBtn');
  assert(ilSubmit && !ilSubmit.disabled, 'IL 总结后提交可用');
  if (ilSubmit) ilSubmit.click();
  await sleep(1200);
  const ilRing = w.document.querySelector('#resultArea .score-ring-inner b');
  // 回应题 5/5 → Listening 160；总结 mock → Writing 125；overall=(160+125)/2=142.5→145
  assert(ilRing && ilRing.textContent.trim() === '145', 'IL 综合分 145: ' + (ilRing && ilRing.textContent));
  const ilText = w.document.querySelector('#resultArea').textContent;
  assert(ilText.includes('总结已由 AI 批改'), 'IL 总结 AI 批改提示');
  const ilHist = w.AppStorage.getHistory().find(x => x.type === 'il');
  assert(ilHist && ilHist.details && ilHist.details.summaryContribWriting === true, 'IL 总结计入 Writing 子分标记');

  // ---- 7.6 互动写作 IW 两段式：Part 1 → 追问 → Part 2 → AI 批改 ----
  w.showType('iw');
  await sleep(300);
  const iwA = w.document.querySelector('#iwA');
  assert(iwA, 'IW Part 1 输入框渲染');
  iwA.value = 'Schools should reduce homework because free time helps children develop hobbies.';
  iwA.dispatchEvent(new w.Event('input'));
  const startBtn = w.document.querySelector('#startBtn');
  if (startBtn) startBtn.click();
  await sleep(80);
  const iwNext = w.document.querySelector('#submitBtn');
  if (iwNext) iwNext.click(); // Part 1 → 生成 Part 2（mock 422 → 默认追问兜底）
  await sleep(700);
  const iwB = w.document.querySelector('#iwB');
  assert(iwB, 'IW Part 2 渲染（追问兜底生效）');
  iwB.value = 'For example, I learned painting after school and it made me more creative.';
  iwB.dispatchEvent(new w.Event('input'));
  const startB = w.document.querySelector('#startB');
  if (startB) startB.click();
  await sleep(80);
  const iwSub = w.document.querySelector('#submitB');
  if (iwSub) iwSub.click();
  await sleep(1200);
  const iwRing = w.document.querySelector('#resultArea .score-ring-inner b');
  assert(iwRing && iwRing.textContent.trim() === '120', 'IW 批改分数环 120: ' + (iwRing && iwRing.textContent));
  const iwText = w.document.querySelector('#resultArea').textContent;
  assert(iwText.includes('互动写作'), 'IW 结果卡标题');
  const iwHist = w.AppStorage.getHistory().find(x => x.type === 'iw');
  assert(iwHist && iwHist.details && iwHist.details.feedback, 'IW 两段批改详情写入历史');

  // ---- 7.7 练习记录弹窗 ----
  const histBtn = w.document.querySelector('#btnHistory');
  if (histBtn) histBtn.click();
  await sleep(200);
  const items = w.document.querySelectorAll('#historyList .history-item');
  assert(items.length >= 3, '历史弹窗条目≥3: ' + items.length);
  const closeHist = w.document.querySelector('#closeHistory');
  if (closeHist) closeHist.click();
  await sleep(150);
  assert(w.document.querySelector('#historyModal').classList.contains('hidden'), '历史弹窗可关闭');

  w.eval('settings.apiKey=""');
  say('AI 链路 + IL/IW 全流程验证完成');

  // ---- 8. 模拟考试：启动 → 手动推进 19 步 → 自动出报告 ----
  w.startTest();
  await sleep(1800);
  assert(w.document.body.classList.contains('testing'), '考试模式 body.testing 生效');
  assert(E('Array.isArray(testSteps) ? testSteps.length : -1') === 19, '模拟考试 19 步: ' + E('Array.isArray(testSteps) ? testSteps.length : -1'));
  const phase = w.document.querySelector('#testPhase');
  assert(phase && /第 \d+/.test(phase.textContent || ''), '考试阶段推进: ' + (phase && phase.textContent));
  assert(E('rsState.idx') === 0, '模拟考试不会替考生自动回答词汇题');
  // 手动推进 19 步（每步清掉限时器避免异步干扰）
  for (let i = 0; i < 19; i++) {
    w.clearTimer && w.clearTimer();
    w.stopRecord && w.stopRecord();
    say('testNext #' + i + ' (step ' + E('testStepIdx') + '/' + E('Array.isArray(testSteps)?testSteps.length:-1') + ')');
    try { await w.testNext(); } catch (e) { errors.push('testNext 异常 @' + i + ': ' + e.message); break; }
    await sleep(150);
  }
  say('drive done, awaiting finish');
  await sleep(1600); // 等 testFinish 的批改降级循环 + 报告渲染
  assert(w.document.querySelector('#resultArea .report-table'), '模拟考试报告表格渲染');
  const reportText = w.document.querySelector('#resultArea') && w.document.querySelector('#resultArea').textContent;
  assert(reportText && reportText.includes('模拟考试报告'), '模拟考试报告标题存在');
  assert(!w.document.body.classList.contains('testing'), '报告展示后退出考试模式');
  const testHist = w.AppStorage.getHistory();
  assert(testHist[0] && testHist[0].type === 'test', '考试总结写入历史: ' + (testHist[0] && testHist[0].type));
  w.afterTest(); // 报告页「返回练习」= afterTest()，重置 testRunning
  await sleep(200);
  assert(!E('testRunning'), 'afterTest 后 testRunning 已复位');

  // ---- 9. 再开一场，走「退出按钮」路径 ----
  w.startTest();
  await sleep(1000);
  assert(w.document.body.classList.contains('testing'), '第二场考试启动');
  const quit = w.document.querySelector('#btnQuitTest');
  if (quit) quit.click();
  await sleep(300);
  assert(!w.document.body.classList.contains('testing'), '退出按钮可离开考试');

  // ---- 10. 2024 旧版流程（54 步）全程推进 → 自动出报告 ----
  w.startOfficialFlow();
  await sleep(2500);
  const officialN = E('Array.isArray(testSteps) ? testSteps.length : -1');
  assert(officialN === 54, '2024 旧版流程按 OFFICIAL_SECTION_PLAN 生成 54 步: ' + officialN);
  assert(E('testSteps.slice(24,28).map(s=>s.type).join(",")') === 'fibw,lt,ra,fibw', '第 3 段 FIBW/LT/RA 交替: ' + E('testSteps.slice(24,28).map(s=>s.type).join(",")'));
  assert(w.document.body.classList.contains('testing'), '2024 旧版流程 testing 生效');
  for (let i = 0; i < officialN; i++) {
    w.clearTimer && w.clearTimer();
    w.stopRecord && w.stopRecord();
    try { await w.testNext(); } catch (e) { errors.push('official testNext 异常 @' + i + ': ' + e.message); break; }
    await sleep(120);
  }
  await sleep(1600); // testFinish 批改降级循环 + 报告渲染
  assert(w.document.querySelector('#resultArea .report-table'), '2024 旧版流程报告渲染');
  assert(!w.document.body.classList.contains('testing'), '2024 旧版流程结束退出考试模式');
  w.afterTest();
  await sleep(200);

  // ---- 11. 学习夹视图 ----
  w.showStudyBook('mistakes');
  await sleep(200);
  assert(w.document.querySelector('#typeTabs [data-view="mistakes"]'), '错题本视图打开');
  w.showType('rs');
  await sleep(150);

  const verdict = errors.length ? 'FAIL' : 'PASS';
  console.log('SMOKE ' + verdict + ' · 检查点 48 · 错误数 ' + errors.length);
  errors.slice(0, 14).forEach(e => console.log('  ERR: ' + String(e).slice(0, 260)));
  dom.window.close();
  process.exitCode = verdict === 'FAIL' ? 1 : 0;
})().catch(e => {
  console.log('SMOKE CRASH: ' + e.message);
  process.exitCode = 1;
});
