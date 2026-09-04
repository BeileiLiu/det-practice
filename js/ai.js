/* ============================================================
 * DET 练习站 · AI 客户端层（生成 prompt / 校验 / OpenAI 兼容调用）
 * ------------------------------------------------------------
 * 从 index.html 内联脚本抽离：
 * - AI_PROMPTS：14 个题型的 AI 生成指令模板（纯数据）；
 * - validateAI：AI 返回 JSON 的结构校验（TC 注入，便于单测）；
 * - parseJSON：容错 JSON 提取（markdown 围栏/前后杂文）；
 * - callDS：OpenAI 兼容 chat/completions 调用，支持
 *   direct（浏览器直连，Key 在前端）/ proxy（同源 /v1/… 代理，
 *   Key 在服务端）两种模式；依赖经 opts 注入（settings/fetch）。
 * 经典脚本 + UMD：浏览器挂同名全局（调用点不变），Node 可测。
 * ============================================================ */
(function (root) {
  'use strict';

  const AI_PROMPTS = {
    rs: '生成一道 DET 词汇判断题。只输出 JSON，不要其他文字：{"words":[{"w":"单词","real":true}]}。共 9 个词，约一半真实常用词、一半看似合理的编造词。',
    fib: '生成一道 DET 完形打字题（Read & Complete）。只输出 JSON：{"segments":[{"text":"前面文字"},{"gap":{"word":"完整单词"}},{"text":"后面文字"}]}。共 3 个空，中间难度的自然英文短文，单词 4–12 个字母。',
    fibw: '生成一道 DET 选词填空（Fill in the Blanks）练习。只输出 JSON：{"items":[{"segments":[{"text":"句首"},{"gap":{"word":"完整单词"}},{"text":"句尾"}]}]}。共 3 个独立英文句子，每句缺一个单词。',
    lt: '生成一句 5–12 词的英文句子用于听写。只输出 JSON：{"sentence":"..."}',
    ra: '生成一段 30–60 词的英文短文用于 Read Aloud(朗读)练习。题材日常,自然连贯,句长适中(中等难度的完整段落,2-4 句)。只输出 JSON：{"text":"英文段落"}。',
    ir: '生成一道 DET 互动阅读题。只输出 JSON，结构必须严格为：{"paras":["英文段落1","英文段落2","英文段落3"],"q1":{"blanks":[{"p":0,"word":"原文中完整单词","options":["正确词","干扰词","干扰词","干扰词"],"answer":0}],"pool":["正确词1","正确词2","正确词3","正确词4","正确词5","干扰词1","干扰词2","干扰词3"]},"q2":{"p":1,"sentence":"原文中的完整句子","options":["同一句原文","干扰句","干扰句","干扰句"],"answer":0},"q3":{"question":"英文短答题","answer":"简短英文答案"},"q4":{"question":"英文短答题","answer":"简短英文答案"},"q5":{"question":"主旨题","options":["正确选项","干扰项","干扰项","干扰项"],"answer":0},"q6":{"options":["最佳标题","干扰标题","干扰标题","干扰标题"],"answer":0}}。要求：3 段共 8–10 句；q1 至少 5 个 blanks，word 必须来自 paras；所有 answer 使用 0-based 下标。',
    il: '生成一道 DET 互动听力（Listen and Respond）题：一段学生与教授/同学的场景对话。只输出 JSON：{"scenario":"英文场景描述（你是学生，想找对方办什么事）","turns":[{"speaker":"Professor","line":"对方说的一句台词","options":["回应A","回应B","回应C","回应D"],"answer":0}]}。要求：scenario 用英文写清场景；5 个回合，每回合 4 个回应选项；answer 为最佳回应下标(0-based)；对话连贯自然、难度中等。',
    sp: '用中文描述一张照片场景，用于看图说话。只输出 JSON：{"scene":"中文场景描述，30-50字"}',
    rtsp: '生成一道 DET 读后口说（Read, Then Speak）英文题目（考生读完开口回答）。只输出 JSON：{"topic":"英文题目"}',
    isp: '生成一道 DET 互动口说（Interactive Speaking）的第一个问题（AI 角色 Bea 的开场白，英文，一句话，适合轻松开场）。只输出 JSON：{"opener":"英文第一问"}',
    ss: '生成一道 DET 口说样题（Speaking Sample）英文题目。只输出 JSON：{"topic":"英文题目"}',
    wp: '用中文描述一张照片场景，用于看图写作。只输出 JSON：{"scene":"中文场景描述，30-50字"}',
    iw: '生成一段 DET 互动写作 Part 1 的英文阅读材料（80–120 词，末尾自然引出写作任务）。只输出 JSON：{"prompt":"英文阅读段落"}',
    ws: '生成一道 DET 写作样题（Writing Sample）英文题目。只输出 JSON：{"topic":"英文题目"}'
  };

  const MIMO_TOKEN_PRESET = Object.freeze({
    provider: 'mimo-token-cn',
    model: 'mimo-v2.5-pro',
    endpoint: 'https://token-plan-cn.xiaomimimo.com/v1/chat/completions'
  });

  function presetForKey(key) {
    return /^tp-/i.test(String(key || '').trim()) ? MIMO_TOKEN_PRESET : null;
  }

  // 容错 JSON 提取：剥 markdown 围栏 → 直接解析 → 正则抓取对象
  function parseJSON(raw) {
    const c = String(raw).trim().replace(/^```(?:json)?/, '').replace(/```$/, '').trim();
    try { return JSON.parse(c); } catch (e) { /* fallthrough */ }
    const m = c.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e) { /* fallthrough */ } }
    return null;
  }

  // tcmap 由参数注入（题目类型元信息 {type:{label,sub,time}}）；浏览器下默认取全局 TC
  function validateAI(type, q, tcmap) {
    const tc = (tcmap && tcmap[type]) || (typeof TC !== 'undefined' && TC ? TC[type] : null);
    if (!tc) return null;
    if (!tc) return null;
    const t = tc.time;
    if (type === 'rs') return Array.isArray(q.words) && q.words.length === 9 && q.words.every(w => typeof w.w === 'string' && typeof w.real === 'boolean') ? Object.assign({ time: t }, q) : null;
    if (type === 'fib') return Array.isArray(q.segments) && q.segments.filter(s => s.gap).length >= 2 && q.segments.every(s => !s.gap || typeof s.gap.word === 'string') ? Object.assign({ time: t }, q) : null;
    if (type === 'fibw') return Array.isArray(q.items) && q.items.length >= 2 && q.items.every(it => Array.isArray(it.segments) && it.segments.filter(s => s.gap).length >= 1) ? Object.assign({ time: t }, q) : null;
    if (type === 'lt') return typeof q.sentence === 'string' && q.sentence ? Object.assign({ time: t }, q) : null;
    if (type === 'ra') return typeof q.text === 'string' && q.text && q.text.length >= 40 ? Object.assign({ time: t }, q) : null;
    if (type === 'ir') return Array.isArray(q.paras) && q.paras.length >= 2 && q.q1 && Array.isArray(q.q1.blanks) && q.q1.blanks.length >= 3 && q.q2 && Array.isArray(q.q2.options) && q.q2.options.length >= 3 && q.q3 && q.q4 && q.q5 && Array.isArray(q.q5.options) && q.q6 && Array.isArray(q.q6.options) ? Object.assign({ time: t }, q) : null;
    if (type === 'il') return typeof q.scenario === 'string' && q.scenario && Array.isArray(q.turns) && q.turns.length >= 3 && q.turns.every(x => typeof x.line === 'string' && Array.isArray(x.options) && x.options.length >= 3 && typeof x.answer === 'number') ? Object.assign({ time: t, summary_time: 75, scenario: q.scenario, turns: q.turns }, q) : null;
    if (type === 'sp' || type === 'wp') return typeof q.scene === 'string' && q.scene ? Object.assign({ time: t }, q) : null;
    if (type === 'rtsp' || type === 'ss' || type === 'ws') return typeof q.topic === 'string' && q.topic ? Object.assign({ time: t }, q) : null;
    if (type === 'isp') return typeof q.opener === 'string' && q.opener ? Object.assign({ time: t, opener: q.opener, target: 6, fallback: [] }, q) : null;
    if (type === 'iw') return typeof q.prompt === 'string' && q.prompt ? Object.assign({ time: t }, q) : null;
    return null;
  }

  // opts: { settings, fetch }；默认取自浏览器全局（懒解析）
  async function callDS(messages, temperature, opts) {
    opts = opts || {};
    const s = opts.settings || (typeof settings !== 'undefined' ? settings : {});
    const fetcher = opts.fetch || (typeof fetch !== 'undefined' ? fetch.bind(globalThis) : null);
    if (!fetcher) throw new Error('当前环境没有 fetch');
    const viaProxy = s.connection === 'proxy';
    if (!viaProxy && !s.apiKey) throw new Error('请先在 ⚙ 设置 里填 API Key（或切换为本地代理连接）');
    const url = viaProxy ? '/v1/chat/completions' : s.endpoint;
    const headers = { 'Content-Type': 'application/json' };
    if (!viaProxy) headers['Authorization'] = 'Bearer ' + s.apiKey;
    const res = await fetcher(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ model: s.model, messages, temperature, max_tokens: 1800 })
    });
    if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error('API ' + res.status + ' ' + t.slice(0, 200)); }
    const data = await res.json();
    return data.choices[0].message.content;
  }

  const A = { AI_PROMPTS, MIMO_TOKEN_PRESET, presetForKey, parseJSON, validateAI, callDS };
  root.AppAI = A;
  if (typeof window !== 'undefined') {
    for (const k in A) { if (!(k in window)) window[k] = A[k]; }
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = A; }
})(typeof globalThis !== 'undefined' ? globalThis : this);
