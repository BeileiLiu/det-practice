'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Learning = require('../js/learning.js');

const catalog = [
  { id: 'rs', label: '词汇判断', domain: 'reading', domainLabel: '阅读' },
  { id: 'lt', label: '听写', domain: 'listening', domainLabel: '听力' },
  { id: 'sp', label: '看图说话', domain: 'speaking', domainLabel: '口语' },
  { id: 'wp', label: '看图写作', domain: 'writing', domainLabel: '写作' },
];

test('首次使用优先推荐目录第一项', () => {
  assert.equal(Learning.recommendation([], catalog, {}).id, 'rs');
});

test('优先推荐尚未练过的题型', () => {
  const history = [{ type: 'rs', score: 120, t: 10 }];
  assert.equal(Learning.recommendation(history, catalog, {}).id, 'lt');
});

test('弱项设置优先影响推荐', () => {
  const history = catalog.map((item, index) => ({ type: item.id, score: 100 + index * 5, t: index + 1 }));
  assert.equal(Learning.recommendation(history, catalog, { weak: '口语' }).id, 'sp');
});

test('汇总今日、近七天和分项进度', () => {
  const now = new Date('2026-09-22T12:00:00+08:00');
  const history = [
    { type: 'rs', score: 120, t: new Date('2026-09-22T09:00:00+08:00').getTime() },
    { type: 'lt', score: 100, t: new Date('2026-09-20T09:00:00+08:00').getTime() },
  ];
  const summary = Learning.summarize(history, catalog, { goal: 130 }, now);
  assert.equal(summary.today, 1);
  assert.equal(summary.week, 2);
  assert.equal(summary.average, 110);
  assert.equal(summary.best, 120);
  assert.equal(summary.goal, 130);
  assert.equal(summary.domains.find((item) => item.id === 'reading').attempted, 1);
  assert.equal(summary.plan.length, 3);
});
