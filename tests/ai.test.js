'use strict';
// DET AI 客户端层单测（node:test，零依赖）
// 运行：node --test --test-isolation=none tests/ai.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../js/ai.js');

const TC_STUB = {
  rs: { time: 30 }, fib: { time: 180 }, fibw: { time: 180 }, lt: { time: 60 },
  ra: { time: 60 }, ir: { time: 420 }, il: { time: 480 }, sp: { time: 90 },
  rtsp: { time: 90 }, isp: { time: 180 }, ss: { time: 180 }, wp: { time: 60 },
  iw: { time: 600 }, ws: { time: 300 }
};
test('MiMo Token Plan Key 自动选择中国节点与默认模型', () => {
  assert.deepEqual(A.presetForKey(' tp-example '), A.MIMO_TOKEN_PRESET);
  assert.equal(A.presetForKey('sk-example'), null);
  assert.equal(A.MIMO_TOKEN_PRESET.model, 'mimo-v2.5-pro');
  assert.match(A.MIMO_TOKEN_PRESET.endpoint, /token-plan-cn\.xiaomimimo\.com\/v1\/chat\/completions$/);
});
// ---------- parseJSON ----------
test('parseJSON：直接 JSON / markdown 围栏 / 前后杂文 / 非法输入', () => {
  assert.deepEqual(A.parseJSON('{"a":1}'), { a: 1 });
  assert.deepEqual(A.parseJSON('```json\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(A.parseJSON('```\n{"a":1}\n```'), { a: 1 });
  assert.deepEqual(A.parseJSON('  {"a":1}  '), { a: 1 });
  assert.deepEqual(A.parseJSON('前缀文字 {"a": {"b": 2}} 结尾'), { a: { b: 2 } });
  assert.equal(A.parseJSON('完全不是 JSON'), null);
  assert.equal(A.parseJSON(''), null);
  assert.equal(A.parseJSON('{"a": 未闭合'), null);
});

// ---------- validateAI ----------
test('validateAI：rs 要求恰好 9 词且 real 为 boolean', () => {
  const words = Array.from({ length: 9 }, (_, i) => ({ w: 'word' + i, real: i % 2 === 0 }));
  const q = A.validateAI('rs', { words }, TC_STUB);
  assert.ok(q && q.time === 30);
  assert.equal(A.validateAI('rs', { words: words.slice(0, 8) }, TC_STUB), null);
  assert.equal(A.validateAI('rs', { words: words.map(w => ({ w: w.w, real: 'yes' })) }, TC_STUB), null);
});

test('validateAI：fib 至少 2 空；fibw 至少 2 句且每句 1 空', () => {
  const base = n => [{ text: 'a ' }, { gap: { word: 'w' + n } }, { text: ' b' }];
  assert.ok(A.validateAI('fib', { segments: [...base(1), ...base(2)] }, TC_STUB));
  assert.equal(A.validateAI('fib', { segments: base(1) }, TC_STUB), null);
  assert.ok(A.validateAI('fibw', { items: [{ segments: base(1) }, { segments: base(2) }] }, TC_STUB));
  assert.equal(A.validateAI('fibw', { items: [{ segments: [{ text: 'no gap' }] }] }, TC_STUB), null);
});

test('validateAI：lt 非空句子；ra 至少 40 字符', () => {
  assert.ok(A.validateAI('lt', { sentence: 'Hello world.' }, TC_STUB));
  assert.equal(A.validateAI('lt', { sentence: '' }, TC_STUB), null);
  assert.ok(A.validateAI('ra', { text: 'x'.repeat(40) }, TC_STUB));
  assert.equal(A.validateAI('ra', { text: 'x'.repeat(39) }, TC_STUB), null);
});

test('validateAI：ir 六问结构完整才通过', () => {
  const q = {
    paras: ['p1', 'p2'],
    q1: { blanks: [{ p: 0, word: 'a', options: ['a', 'b', 'c', 'd'], answer: 0 }, { p: 0, word: 'b', options: ['a', 'b', 'c', 'd'], answer: 1 }, { p: 1, word: 'c', options: ['a', 'b', 'c', 'd'], answer: 2 }] },
    q2: { options: ['x', 'y', 'z'] }, q3: { question: 'q', answer: 'a' }, q4: { question: 'q', answer: 'a' },
    q5: { options: ['x', 'y', 'z'] }, q6: { options: [] }
  };
  assert.ok(A.validateAI('ir', q, TC_STUB));
  const bad = JSON.parse(JSON.stringify(q)); delete bad.q6;
  assert.equal(A.validateAI('ir', bad, TC_STUB), null);
});

test('validateAI：il 至少 3 回合；sp/wp 场景；iw 阅读材料；未知题型 → null', () => {
  const turn = { speaker: 'P', line: 'Hi', options: ['a', 'b', 'c', 'd'], answer: 0 };
  assert.ok(A.validateAI('il', { scenario: 'S', turns: [turn, turn, turn] }, TC_STUB));
  assert.equal(A.validateAI('il', { scenario: 'S', turns: [turn, turn] }, TC_STUB), null);
  assert.ok(A.validateAI('sp', { scene: '一个公园' }, TC_STUB));
  assert.ok(A.validateAI('wp', { scene: '街边咖啡馆' }, TC_STUB));
  assert.ok(A.validateAI('iw', { prompt: 'Reading passage…' }, TC_STUB));
  assert.equal(A.validateAI('nope', { anything: 1 }, TC_STUB), null);
});

// ---------- callDS ----------
function fetchMock(impl) {
  return async (url, opts) => impl(url, opts);
}
test('callDS：direct 模式带 Authorization 与完整 body', async () => {
  let captured = null;
  const fetcher = fetchMock((url, opts) => {
    captured = { url, opts };
    return { ok: true, json: async () => ({ choices: [{ message: { content: '好的内容' } }] }) };
  });
  const s = { connection: 'direct', apiKey: 'sk-test', model: 'deepseek-chat', endpoint: 'http://api.example/chat' };
  const out = await A.callDS([{ role: 'user', content: 'hi' }], 0.5, { settings: s, fetch: fetcher });
  assert.equal(out, '好的内容');
  assert.equal(captured.url, 'http://api.example/chat');
  assert.equal(captured.opts.headers.Authorization, 'Bearer sk-test');
  const body = JSON.parse(captured.opts.body);
  assert.equal(body.model, 'deepseek-chat');
  assert.equal(body.temperature, 0.5);
  assert.equal(body.max_tokens, 1800);
});

test('callDS：proxy 模式走同源 /v1 且不带 Authorization', async () => {
  let captured = null;
  const fetcher = fetchMock((url, opts) => {
    captured = { url, opts };
    return { ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) };
  });
  const s = { connection: 'proxy', apiKey: '', model: 'deepseek-chat', endpoint: 'http://x' };
  await A.callDS([], 0.2, { settings: s, fetch: fetcher });
  assert.equal(captured.url, '/v1/chat/completions');
  assert.ok(!('Authorization' in captured.opts.headers), '代理模式不得携带前端 Key');
  assert.ok(captured.opts.headers['Content-Type']);
});

test('callDS：无 Key 直连 → 抛错', async () => {
  const s = { connection: 'direct', apiKey: '', model: 'm', endpoint: 'http://x' };
  await assert.rejects(
    A.callDS([], 0.2, { settings: s, fetch: fetchMock(() => ({ ok: true })) }),
    /API Key/
  );
});

test('callDS：非 2xx 透传状态码与错误体', async () => {
  const s = { connection: 'direct', apiKey: 'k', model: 'm', endpoint: 'http://x' };
  await assert.rejects(
    A.callDS([], 0.2, {
      settings: s,
      fetch: fetchMock(() => ({ ok: false, status: 429, text: async () => 'rate limited' }))
    }),
    /API 429 rate limited/
  );
});
