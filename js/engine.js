/* ============================================================
 * DET 练习站 · 引擎层（纯逻辑，无 DOM）
 * ------------------------------------------------------------
 * 从 index.html 内联脚本抽离的评分/自适应/听写评估纯函数。
 * - 经典脚本（非 ES module），兼容 file:// 双击打开；
 * - 浏览器：挂到 window，名字与旧内联全局一致，调用点无需改动；
 * - Node：CommonJS 导出，供 tests/engine.test.js 单测；
 * - 依赖全局状态（adaptiveState/selectedBand/currentQ/currentType/
 *   questionSignature）的函数均通过 env 参数注入，浏览器下自动
 *   懒解析默认 env，Node 下由测试显式传入，保证可测性。
 * ============================================================ */
(function (root) {
  'use strict';

  // ---------------- 基础工具 ----------------
  function clamp(n, min, max) { return Math.max(min, Math.min(max, n)); }
  function bandMid(b) { return b === '60' ? 75 : b === '90' ? 105 : b === '120' ? 140 : 105; }
  function gaussianNoise() {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  const DIFFICULTY_BANDS = ['60', '90', '120'];

  // ---------------- DET 分数换算 ----------------
  function round5(n) {
    if (n == null || n === '') return null;
    n = Number(n); if (!Number.isFinite(n)) return null; if (n <= 0) return 0;
    return Math.max(10, Math.min(160, Math.round(n / 5) * 5));
  }
  function cefrOf(d) { if (d == null) return '—'; if (d <= 55) return 'A1/A2'; if (d <= 85) return 'B1'; if (d <= 115) return 'B2'; return 'C1/C2'; }
  const IELTS_CONC = [[10, 1.5], [15, 2], [20, 2.5], [30, 3], [45, 3.5], [55, 4], [65, 4.5], [75, 5], [85, 5.5], [95, 6], [105, 6.5], [115, 7], [125, 7.5], [135, 8], [145, 8.5], [155, 9]];
  function ieltsOf(d) { let r = '—'; for (const [k, v] of IELTS_CONC) { if (d >= k) r = v; else break; } return r; }
  function scale100To160(n) {
    // 分段映射：0-30%→10-30、30-50%→30-60、50-70%→60-85、70-90%→85-115、90-100%→115-160
    n = Number(n); if (!Number.isFinite(n) || n <= 0) return 0;
    if (n <= 30) return round5(10 + (n / 30) * 20);
    if (n <= 50) return round5(30 + ((n - 31) / 19) * 30);
    if (n <= 70) return round5(60 + ((n - 51) / 19) * 25);
    if (n <= 90) return round5(85 + ((n - 71) / 19) * 30);
    return round5(115 + ((n - 91) / 9) * 45);
  }
  function detFromScore(pct) { return scale100To160(pct); }
  function scoreToBand(score) {
    const s = Number(score);
    if (!Number.isFinite(s)) return '90';
    if (s < 100) return '60';
    if (s < 125) return '90';
    return '120';
  }
  function normalizeHistoryScore(item) {
    if (item && typeof item === 'object') return item.scale === 100 ? scale100To160(item.score) : round5(item.score);
    return round5(item);
  }

  // ---------------- CAT 自适应（IRT/EAP） ----------------
  function logistic(x) { return 1 / (1 + Math.exp(-x)); }
  function typeDiscrimination(type) {
    if (['rs', 'fib', 'fibw', 'lt'].includes(type)) return 1.18;
    if (['ra'].includes(type)) return 1.05;
    if (['ir', 'il'].includes(type)) return 1.05;
    if (['sp', 'rtsp', 'isp', 'ss', 'wp', 'iw', 'ws'].includes(type)) return 0.82;
    return 1;
  }
  // env = { items:{题型参数} , selectedBand:()=>'90', keyFn:(type,q)=>唯一键 }
  function getItemRecord(type, q, env) {
    env = env || defaultEnv();
    const key = typeof env.keyFn === 'function' ? env.keyFn(type, q) : (type + '::' + String((q && (q.sentence || q.topic || q.prompt)) || ''));
    const rec = (env.items && env.items[key]) || {};
    const base = bandMid(String((q && q.band) || (typeof env.selectedBand === 'function' ? env.selectedBand() : '90')));
    return {
      key,
      attempts: Number(rec.attempts || 0),
      exposure: Number(rec.exposure || 0),
      avg: Number.isFinite(Number(rec.avg)) ? Number(rec.avg) : null,
      difficulty: clamp(Number.isFinite(Number(rec.difficulty)) ? Number(rec.difficulty) : base, 45, 160),
      discrimination: clamp(Number.isFinite(Number(rec.discrimination)) ? Number(rec.discrimination) : typeDiscrimination(type), 0.45, 2.2),
      uncertainty: clamp(Number.isFinite(Number(rec.uncertainty)) ? Number(rec.uncertainty) : (q && q.source === 'ai' ? 30 : 20), 6, 38),
      quality: clamp(Number.isFinite(Number(rec.quality)) ? Number(rec.quality) : (q && q.source === 'ai' ? 0.68 : 0.86), 0.2, 1),
      status: rec.status || (q && q.source === 'ai' ? 'uncalibrated' : 'seeded')
    };
  }
  function responseProb(theta, item) {
    const c = 0.02;
    return clamp(c + (1 - c) * logistic(item.discrimination * (theta - item.difficulty) / 24), 0.01, 0.99);
  }
  function itemInformation(theta, item) {
    const p = responseProb(theta, item), q = 1 - p;
    return Math.max(0.0001, item.discrimination * item.discrimination * p * q);
  }
  function eapUpdate(mu, se, item, softScore) {
    const y = clamp(Number(softScore), 0.02, 0.98);
    const priorSd = clamp(Number(se) || 28, 10, 36);
    const weight = clamp(item.quality * (item.status === 'uncalibrated' ? 0.72 : 1) * (item.attempts < 3 ? 0.85 : 1), 0.35, 1.15);
    const grid = []; let maxLog = -Infinity;
    for (let theta = 10; theta <= 160; theta += 5) {
      const p = responseProb(theta, item);
      const ll = weight * (y * Math.log(p) + (1 - y) * Math.log(1 - p));
      const lp = -0.5 * Math.pow((theta - mu) / priorSd, 2) + ll;
      grid.push([theta, lp]); if (lp > maxLog) maxLog = lp;
    }
    let sum = 0, mean = 0;
    grid.forEach(g => { const w = Math.exp(g[1] - maxLog); g.push(w); sum += w; mean += g[0] * w; });
    mean /= sum || 1;
    let variance = 0; grid.forEach(g => { variance += Math.pow(g[0] - mean, 2) * g[2]; });
    return { ability: clamp(mean, 10, 160), se: clamp(Math.sqrt(variance / (sum || 1)), 8, 34) };
  }

  // ---------------- 客观题评分 ----------------
  // env 可选：{ selectedBand, currentQ, currentType, getItemRecord }
  function questionDifficultyValue(type, q, env) {
    env = env || defaultEnv();
    q = q || env.currentQ || {};
    const b = String((q && q.band) || (typeof env.selectedBand === 'function' ? env.selectedBand() : '90') || '90');
    let d = DIFFICULTY_BANDS.includes(b) ? bandMid(b) : 105;
    try {
      const recFn = typeof env.getItemRecord === 'function' ? env.getItemRecord : getItemRecord;
      const rec = recFn(type || env.currentType || 'unknown', q, env);
      if (rec && Number.isFinite(Number(rec.difficulty))) d = Number(rec.difficulty);
    } catch (e) { /* 兜底：用 bandMid */ }
    return clamp(d, 55, 150);
  }
  // opts = { type, attempted, question }；env 可选（见 questionDifficultyValue）
  function objectiveDetScore(correct, total, opts, env) {
    // 练习估分：准确率线性映射 10~160（0%→10、100%→160），80% ≈ 130；
    // 全对难题有奖（d-90 每分 +0.30）；漏题难题少扣、简单题多扣。
    opts = opts || {}; env = env || defaultEnv();
    total = Math.max(1, Number(total) || 1);
    correct = clamp(Number(correct) || 0, 0, total);
    const d = questionDifficultyValue(opts.type, opts.question || env.currentQ, env);
    const acc = correct / total;
    let det = 10 + 150 * acc;
    if (correct === total && d > 90) {
      det += (d - 90) * 0.30;
    } else if (correct < total) {
      const missed = total - correct;
      if (d > 90) det -= (d - 90) * 0.10 * missed;
      else if (d < 70) det -= (70 - d) * 0.30 * missed;
    }
    det = clamp(det, 10, 160);
    return round5(det);
  }

  // ---------------- RS 词汇加权 ----------------
  function wordDifficultyWeight(item, band) {
    const raw = String((item && item.w) || '').toLowerCase();
    const real = item && (item.real === true || item.real === 1 || item.real === 'true' || item.real === '1');
    const len = raw.length;
    const base = band === '120' ? 1.28 : band === '90' ? 1.08 : .9;
    let w = base;
    if (len >= 11) w += .32; else if (len >= 8) w += .18; else if (len <= 4) w -= .12;
    if (!real) {
      const looksAcademic = /(tion|sion|ment|ance|ence|ive|ate|ize|ous|ity|al|ent|ant|ly)$/.test(raw);
      w += looksAcademic ? .28 : .12;
    } else {
      const advanced = /(sub|inter|pre|con|hypo|meta|ambi|inev|pers|sequ|stantial|comprehensive|implementation)/.test(raw);
      if (advanced) w += .24;
    }
    return clamp(w, .65, 1.85);
  }
  // ans: [{w, real, val}]（val 为 null/undefined 表示未作答）
  function rsWeightedStats(q, ans, band) {
    band = String(band || (q && q.band) || '90');
    const words = (q && Array.isArray(q.words)) ? q.words : [];
    const an = Array.isArray(ans) ? ans : [];
    let total = 0, earned = 0, attempted = 0;
    const weights = words.map(item => wordDifficultyWeight(item, band));
    words.forEach((item, i) => {
      const weight = weights[i] || 1;
      const a = an[i];
      total += weight;
      if (a && a.val !== null && a.val !== undefined) attempted += weight;
      if (a && a.val === a.real) earned += weight;
    });
    const grade = total ? Math.round(earned / total * 100) : 0;
    const avgWeight = weights.length ? weights.reduce((x, y) => x + y, 0) / weights.length : 1;
    return { earned, total, attempted, grade, avgWeight };
  }

  // ---------------- 听写/朗读评估（Listen & Type 官方规则） ----------------
  function normWords(s) { return String(s || '').toLowerCase().replace(/[^a-z'\s]/g, ' ').split(/\s+/).filter(Boolean); }
  function editDistance(a, b) {
    const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let left = i, diag = prev[0]; prev[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const up = prev[j], cost = a[i - 1] === b[j - 1] ? 0 : 1;
        const next = Math.min(up + 1, left + 1, diag + cost); diag = up; prev[j] = next; left = next;
      }
    }
    return prev[b.length];
  }
  function wordAccuracy(expected, actual) { return listenTypeAssessment(expected, actual).score; }
  function listenTypeWordCost(expectedWord, actualWord) {
    if (expectedWord === actualWord) return 0;
    const len = Math.max(expectedWord.length, actualWord.length, 1);
    const ratio = editDistance([...expectedWord], [...actualWord]) / len;
    return Math.min(1, 0.16 + 0.72 * ratio);
  }
  function listenTypeAssessment(expected, actual) {
    const a = normWords(expected), b = normWords(actual);
    const expectedCount = Math.max(a.length, 1);
    if (!b.length) return { score: 0, weighted: 0, spelling: 0, orthography: 0, wordDelta: -a.length, missingWords: a.slice() };
    const compactA = a.join(''), compactB = b.join('');
    const charBase = Math.max(compactA.length, compactB.length, 1);
    const compact = Math.max(0, (1 - editDistance([...compactA], [...compactB]) / charBase) * 100);
    const n = a.length, m = b.length;
    // 官方规则：漏词比拼写错误扣得更重；答了且接近给部分分
    const MISSING_COST = 1.6, EXTRA_COST = 0.7;
    const dp = Array.from({ length: n + 1 }, () => Array(m + 1).fill(Infinity));
    dp[0][0] = 0;
    for (let i = 1; i <= n; i++) dp[i][0] = dp[i - 1][0] + MISSING_COST;
    for (let j = 1; j <= m; j++) dp[0][j] = dp[0][j - 1] + EXTRA_COST;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const wa = a[i - 1], wb = b[j - 1];
        dp[i][j] = Math.min(
          dp[i - 1][j] + MISSING_COST,
          dp[i][j - 1] + EXTRA_COST,
          dp[i - 1][j - 1] + listenTypeWordCost(wa, wb)
        );
        if (i >= 2) {
          const mergedExpected = a[i - 2] + a[i - 1];
          const mergeCost = listenTypeWordCost(mergedExpected, wb);
          if (mergeCost <= 0.24) dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 1] + 0.18 + 0.45 * mergeCost);
        }
        if (j >= 2) {
          const mergedActual = b[j - 2] + b[j - 1];
          const splitCost = listenTypeWordCost(wa, mergedActual);
          if (splitCost <= 0.24) dp[i][j] = Math.min(dp[i][j], dp[i - 1][j - 2] + 0.18 + 0.45 * splitCost);
        }
      }
    }
    const weighted = Math.max(0, (1 - dp[n][m] / (MISSING_COST * expectedCount)) * 100);
    const wordDelta = m - a.length;
    const compactAdjusted = Math.max(0, compact - (Math.abs(wordDelta) / expectedCount) * 25);
    const expTrim = (expected || '').trim(), actTrim = (actual || '').trim();
    const expFirst = (expTrim.match(/[A-Za-z]/) || [''])[0], actFirst = (actTrim.match(/[A-Za-z]/) || [''])[0];
    const firstCasePenalty = expFirst && actFirst && expFirst !== actFirst && expFirst.toLowerCase() === actFirst.toLowerCase() ? 1.5 : 0;
    const expEnd = (expTrim.match(/[.!?]$/) || [''])[0], actEnd = (actTrim.match(/[.!?]$/) || [''])[0];
    const endPunctPenalty = expEnd && expEnd !== actEnd ? 2.5 : 0;
    const commaPenalty = Math.min(2, Math.abs((expTrim.match(/,/g) || []).length - (actTrim.match(/,/g) || []).length) * 1);
    const orthography = Math.max(0, 100 - firstCasePenalty - endPunctPenalty - commaPenalty);
    const raw = 0.70 * weighted + 0.25 * compactAdjusted + 0.05 * orthography;
    return {
      score: Math.max(0, Math.min(100, Math.round(raw))),
      weighted: Math.round(weighted),
      spelling: Math.round(compactAdjusted),
      orthography: Math.round(orthography),
      wordDelta
    };
  }

  // ---------------- 官方化反馈（2024-07 平均规则） ----------------
  const DIRECT_SKILL_BY_TYPE = {
    rs: ['reading'], fib: ['reading'], fibw: ['reading'], ir: ['reading'],
    lt: ['listening'], il: ['listening'], ra: ['speaking'],
    sp: ['speaking'], rtsp: ['speaking'], isp: ['speaking'], ss: ['speaking'],
    wp: ['writing'], iw: ['writing'], ws: ['writing']
  };
  const DERIVED_SCORE_PAIRS = {
    literacy: ['reading', 'writing'],
    comprehension: ['reading', 'listening'],
    conversation: ['listening', 'speaking'],
    production: ['speaking', 'writing']
  };
  function averageRound5(vals) {
    const xs = (Array.isArray(vals) ? vals : []).filter(v => v != null && v !== '').map(Number).filter(Number.isFinite);
    if (!xs.length) return null;
    return round5(xs.reduce((a, b) => a + b, 0) / xs.length);
  }
  function officializeFeedback(type, score, dims) {
    const out = (dims && typeof dims === 'object') ? Object.assign({}, dims) : {};
    const s = score != null ? round5(score) : (out.overall != null ? round5(out.overall) : null);
    const direct = DIRECT_SKILL_BY_TYPE[type] || [];
    if (s != null) {
      direct.forEach(k => { if (out[k] == null) out[k] = s; });
    }
    ['reading', 'writing', 'listening', 'speaking'].forEach(k => { if (out[k] != null) out[k] = round5(out[k]); });
    Object.entries(DERIVED_SCORE_PAIRS).forEach(([k, pair]) => {
      const vals = pair.map(x => out[x]).filter(v => v != null);
      out[k] = vals.length === pair.length ? averageRound5(vals) : null;
    });
    const single = ['reading', 'writing', 'listening', 'speaking'].map(k => out[k]).filter(v => v != null);
    out.overall = single.length === 4 ? averageRound5(single) : s;
    out._official_note = '官方公开规则：2024-07-01 后 Overall 是 Reading/Writing/Listening/Speaking 四个单项平均后按 5 分档取整；Literacy/Comprehension/Conversation/Production 分别是相关两个单项的平均。本页是单题练习估分，缺失的单项不会被硬凑。';
    return out;
  }

  // ---------------- 浏览器默认 env（懒解析，避免与内联脚本初始化顺序耦合） ----------------
  function defaultEnv() {
    return {
      items: (typeof adaptiveState !== 'undefined' && adaptiveState) ? adaptiveState.items : {},
      selectedBand: (typeof selectedBand === 'function') ? selectedBand : (() => '90'),
      keyFn: (typeof questionSignature === 'function')
        ? ((t, q) => t + '::' + questionSignature(q))
        : ((t, q) => t + '::' + String((q && (q.sentence || q.topic || q.prompt)) || '')),
      currentQ: (typeof currentQ !== 'undefined') ? currentQ : undefined,
      currentType: (typeof currentType !== 'undefined') ? currentType : undefined,
      getItemRecord: getItemRecord
    };
  }

  // ---------------- 导出 ----------------
  const E = {
    clamp, bandMid, gaussianNoise, DIFFICULTY_BANDS,
    round5, cefrOf, IELTS_CONC, ieltsOf, scale100To160, detFromScore, scoreToBand, normalizeHistoryScore,
    logistic, typeDiscrimination, getItemRecord, responseProb, itemInformation, eapUpdate,
    questionDifficultyValue, objectiveDetScore,
    wordDifficultyWeight, rsWeightedStats,
    normWords, editDistance, wordAccuracy, listenTypeWordCost, listenTypeAssessment,
    DIRECT_SKILL_BY_TYPE, DERIVED_SCORE_PAIRS, averageRound5, officializeFeedback,
    defaultEnv
  };
  root.DETEngine = E;
  // 浏览器（经典脚本）：暴露同名全局，保持 index.html 内联调用点不变
  if (typeof window !== 'undefined') {
    for (const k in E) { if (!(k in window)) window[k] = E[k]; }
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = E; }
})(typeof globalThis !== 'undefined' ? globalThis : this);