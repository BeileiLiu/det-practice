'use strict';
// DET 数据层单测（node:test，零依赖）
// 运行：node --test --test-isolation=none tests/storage.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/storage.js');

function mockBackend() {
  const data = {};
  return {
    data,
    getItem(k) { return k in data ? data[k] : null; },
    setItem(k, v) { data[k] = String(v); },
    removeItem(k) { delete data[k]; }
  };
}

test('Node 无 localStorage 时默认 backend 为 null，读函数返回安全默认值', () => {
  assert.ok(S.backend() === null);
  assert.deepEqual(S.readStoredSettings(), {});
  assert.deepEqual(S.readBook('x'), []);
  assert.deepEqual(S.getHistory(), []);
});

test('设置读写：空/损坏 JSON → {} 兜底，写入可回读', () => {
  const bk = mockBackend();
  assert.deepEqual(S.readStoredSettings(bk), {});
  bk.setItem(S.KEYS.settings, 'not json{{{');
  assert.deepEqual(S.readStoredSettings(bk), {});
  S.saveSettings({ apiKey: 'sk-1', goal: '130' }, bk);
  assert.deepEqual(S.readStoredSettings(bk), { apiKey: 'sk-1', goal: '130' });
});

test('自适应状态：默认值与存储值合并，损坏数据安全回退', () => {
  const bk = mockBackend();
  const d = S.readAdaptiveState(bk);
  assert.equal(d.ability, null);
  assert.equal(d.se, 28);
  assert.equal(d.answered, 0);
  S.saveAdaptiveState({ ability: 105, se: 24 }, bk);
  const d2 = S.readAdaptiveState(bk);
  assert.equal(d2.ability, 105);
  assert.equal(d2.se, 24);
  assert.equal(d2.answered, 0); // 默认值仍在
});

test('错题本/收藏：非数组 → []，saveBook 上限 500', () => {
  const bk = mockBackend();
  bk.setItem(S.KEYS.mistakes, '{"a":1}');
  assert.deepEqual(S.readBook(S.KEYS.mistakes, bk), []);
  const big = Array.from({ length: 600 }, (_, i) => ({ i }));
  S.saveBook(S.KEYS.favorites, big, bk);
  assert.equal(S.readBook(S.KEYS.favorites, bk).length, 500);
});

test('练习历史：损坏 → []，读写往返', () => {
  const bk = mockBackend();
  bk.setItem(S.KEYS.history, 'oops');
  assert.deepEqual(S.getHistory(bk), []);
  S.saveHistory([{ id: 1, t: 1, type: 'rs', score: 130 }], bk);
  assert.equal(S.getHistory(bk)[0].score, 130);
});

test('视线守护存储：显式对象写入', () => {
  const bk = mockBackend();
  S.saveGazeStored({ enabled: true, warningCount: 3, criticalCount: 1 }, bk);
  assert.deepEqual(S.readGazeStored(bk), { enabled: true, warningCount: 3, criticalCount: 1 });
});

test('schema 版本化：首次写入当前版本，二次调用幂等', () => {
  const bk = mockBackend();
  assert.equal(bk.getItem(S.KEYS.schema), null);
  S.ensureSchema(bk);
  assert.equal(bk.getItem(S.KEYS.schema), String(S.SCHEMA_VERSION));
  S.ensureSchema(bk); // 不重复写
  assert.equal(bk.getItem(S.KEYS.schema), String(S.SCHEMA_VERSION));
  // 数据 key 不受影响
  S.saveSettings({ connection: 'proxy' }, bk);
  assert.equal(S.readStoredSettings(bk).connection, 'proxy');
});