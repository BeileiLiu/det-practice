'use strict';
// DET 引擎层单元测试（node:test，零依赖）
// 运行：node --test tests/engine.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');

// ---------- 基础换算 ----------
test('round5：5 分档取整，越界钳制', () => {
  assert.equal(E.round5(143), 145);
  assert.equal(E.round5(142), 140);
  assert.equal(E.round5(0), 0);
  assert.equal(E.round5(3), 10);   // 下限 10
  assert.equal(E.round5(170), 160); // 上限 160
  assert.equal(E.round5(null), null);
  assert.equal(E.round5(''), null);
  assert.equal(E.round5('abc'), null);
});

test('scale100To160：分段映射', () => {
  assert.equal(E.scale100To160(0), 0);
  assert.equal(E.scale100To160(30), 30);   // 30% → 30
  assert.equal(E.scale100To160(50), 60);   // 50% → 60 (B1 起点)
  assert.equal(E.scale100To160(70), 85);   // 70% → 85
  assert.equal(E.scale100To160(90), 115);  // 90% → 115 (B2 顶)
  assert.equal(E.scale100To160(100), 160); // 100% → 160
  // 单调不减
  for (let p = 0; p <= 100; p += 1) {
    const a = E.scale100To160(p), b = E.scale100To160(p + 1);
    assert.ok(b >= a, `非单调 ${p}: ${a} → ${b}`);
  }
});

test('detFromScore = scale100To160', () => {
  assert.equal(E.detFromScore(80), E.scale100To160(80));
});

test('scoreToBand：分数→难度档', () => {
  assert.equal(E.scoreToBand(80), '60');
  assert.equal(E.scoreToBand(110), '90');
  assert.equal(E.scoreToBand(130), '120');
  assert.equal(E.scoreToBand('abc'), '90'); // 非法输入兜底
});

test('cefrOf / ieltsOf', () => {
  assert.equal(E.cefrOf(55), 'A1/A2');
  assert.equal(E.cefrOf(60), 'B1');
  assert.equal(E.cefrOf(115), 'B2');
  assert.equal(E.cefrOf(120), 'C1/C2');
  assert.equal(E.ieltsOf(145), 8.5);
  assert.equal(E.ieltsOf(130), 7.5);
  assert.equal(E.ieltsOf(135), 8);
  assert.equal(E.ieltsOf(50), 3.5);
});

test('normalizeHistoryScore：100 分旧记录换算', () => {
  assert.equal(E.normalizeHistoryScore({ scale: 100, score: 50 }), 60);
  assert.equal(E.normalizeHistoryScore({ score: 130 }), 130);
  assert.equal(E.normalizeHistoryScore(88), 90);
});

// ---------- 客观题评分 ----------
test('objectiveDetScore：全对满分，难题有奖', () => {
  const env = { selectedBand: () => '90', currentQ: undefined };
  assert.equal(E.objectiveDetScore(9, 9, { type: 'rs', attempted: 9 }, env), 160);
  // 60 档全对：基础 160（无加成也无惩罚）
  assert.equal(E.objectiveDetScore(9, 9, { type: 'rs', question: { band: '60' } }, env), 160);
});

test('objectiveDetScore：7/9 难题不虚高', () => {
  // 120 档 7/9：126.67 - (140-90)*0.1*2 = 116.67 → 115，而不是线性 117 以上
  const det = E.objectiveDetScore(7, 9, { type: 'rs', question: { band: '120' } }, {});
  assert.equal(det, 115);
});

test('objectiveDetScore：0/9 → 10（至少兜底分）', () => {
  assert.equal(E.objectiveDetScore(0, 9, { type: 'rs' }, {}), 10);
});

// ---------- RS 词汇加权 ----------
test('rsWeightedStats：权重加总与答对占比', () => {
  const q = {
    band: '60',
    words: [
      { w: 'weather', real: 1 },
      { w: 'cleam', real: 0 },
    ],
  };
  const ans = [
    { w: 'weather', real: true, val: true },   // 对
    { w: 'cleam', real: false, val: true },    // 错
  ];
  const s = E.rsWeightedStats(q, ans, '60');
  assert.ok(s.total > 1.5 && s.total < 2.2, `total=${s.total}`);
  assert.ok(s.attempted === s.total, 'attempted 应等于 total（都作答了）');
  assert.ok(s.grade > 30 && s.grade < 60, `grade=${s.grade}`);
  // 未作答不计入 attempted
  const s2 = E.rsWeightedStats(q, [{ w: 'weather', real: true, val: null }, {}], '60');
  assert.ok(s2.attempted < s2.total, '未作答不应计入 attempted');
});

// ---------- 听写/朗读评估 ----------
test('listenTypeAssessment：完全一致 = 100 分', () => {
  const r = E.listenTypeAssessment('The library opens early on weekends.', 'The library opens early on weekends.');
  assert.equal(r.score, 100);
  assert.equal(r.wordDelta, 0);
});

test('listenTypeAssessment：空答 = 0 分且列出漏词', () => {
  const r = E.listenTypeAssessment('The library opens early on weekends.', '');
  assert.equal(r.score, 0);
  assert.equal(r.wordDelta, -6); // 句号被归一化剔除，标准句共 6 词
  assert.equal(r.missingWords.length, 6);
});

test('listenTypeAssessment：漏词远比拼写错扣得重', () => {
  const base = 'Please send me the report by Friday afternoon.';
  const missing = E.listenTypeAssessment(base, 'the report by friday');   // 漏 5 个词
  const typo = E.listenTypeAssessment(base, 'Please sand me the report by Friday afternoon.'); // 1 个拼写错
  assert.ok(typo.score > missing.score, `拼写错 ${typo.score} 应高于漏词 ${missing.score}`);
});

test('listenTypeAssessment：大小写/标点只轻扣', () => {
  const base = 'Please send me the report by Friday afternoon.';
  const r = E.listenTypeAssessment(base, 'please send me the report by friday afternoon');
  assert.ok(r.score >= 95, `应几乎满分，实际 ${r.score}`);
});

test('wordAccuracy 等价于 assessment.score', () => {
  assert.equal(E.wordAccuracy('a b c', 'a b c'), 100);
});

// ---------- CAT 自适应（EAP） ----------
test('eapUpdate：先验居中时后验倾向先验', () => {
  const item = { difficulty: 105, discrimination: 1.18, quality: 0.86, status: 'seeded', attempts: 0 };
  const r = E.eapUpdate(105, 28, item, 0.5);
  assert.ok(Math.abs(r.ability - 105) < 20, `ability=${r.ability}`);
  assert.ok(r.se >= 8 && r.se <= 34, `se=${r.se}`);
});

test('eapUpdate：表现远高于难度 → 能力上调', () => {
  const item = { difficulty: 140, discrimination: 1.18, quality: 0.86, status: 'seeded', attempts: 0 };
  const r = E.eapUpdate(105, 28, item, 0.95);
  assert.ok(r.ability > 115, `ability=${r.ability}`);
});

test('getItemRecord：env 注入的题目参数', () => {
  const env = {
    items: { 'lt::sig1': { attempts: 2, difficulty: 118 } },
    selectedBand: () => '90',
    keyFn: (t, q) => t + '::' + q.sig,
  };
  const r = E.getItemRecord('lt', { sig: 'sig1', band: '60' }, env);
  assert.equal(r.attempts, 2);
  assert.equal(r.difficulty, 118);       // 用已校准难度而非 band
  assert.equal(r.discrimination, 1.18);  // lt 题型默认区分度
  const r2 = E.getItemRecord('lt', { sig: 'sig2' }, env);
  assert.equal(r2.difficulty, 105);      // 未校准 → bandMid('90')
  assert.equal(r2.status, 'seeded');
});

test('responseProb / itemInformation：数值范围合理', () => {
  const item = { difficulty: 105, discrimination: 1.18 };
  const p = E.responseProb(105, item);
  assert.ok(p > 0.4 && p < 0.6, `p=${p}`);
  const info = E.itemInformation(120, item);
  assert.ok(info > 0, `info=${info}`);
});

// ---------- 官方化反馈 ----------
test('officializeFeedback：RS 只填 Reading，缺失单项不硬凑', () => {
  const out = E.officializeFeedback('rs', 130, {});
  assert.equal(out.reading, 130);
  // 综合能力需要成对单项齐全才计算（与线上行为一致）；未涉及的单项保持 undefined
  assert.equal(out.literacy, null);
  assert.equal(out.comprehension, null);
  assert.ok(out.writing == null);
  assert.ok(out.speaking == null);
  assert.ok(out.listening == null);
  assert.equal(out.overall, 130);
});

test('officializeFeedback：四项齐全时 Overall 为平均后取整档', () => {
  const dims = { reading: 120, writing: 110, listening: 100, speaking: 95 };
  const out = E.officializeFeedback('ws', null, dims);
  assert.equal(out.overall, E.round5((120 + 110 + 100 + 95) / 4));
  assert.equal(out.literacy, E.round5((120 + 110) / 2));
});

// ---------- 工具函数 ----------
test('clamp / bandMid / gaussianNoise', () => {
  assert.equal(E.clamp(5, 0, 10), 5);
  assert.equal(E.clamp(-1, 0, 10), 0);
  assert.equal(E.clamp(99, 0, 10), 10);
  assert.equal(E.bandMid('60'), 75);
  assert.equal(E.bandMid('90'), 105);
  assert.equal(E.bandMid('120'), 140);
  for (let i = 0; i < 20; i++) {
    const g = E.gaussianNoise();
    assert.ok(Number.isFinite(g), 'gaussianNoise 必须返回有限数');
  }
});