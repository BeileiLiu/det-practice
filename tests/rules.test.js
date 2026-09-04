'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Rules = require('../js/rules.js');

test('当前规则带版本、核对日期和来源', () => {
  assert.deepEqual(Rules.validate(Rules.CURRENT), []);
  assert.match(Rules.CURRENT.source, /^https:\/\/testcenter\.zendesk\.com\//);
});

test('当前规则包含互动口说并排除朗读', () => {
  assert.equal(Rules.isCurrentType('isp'), true);
  assert.equal(Rules.isCurrentType('ra'), false);
  assert.equal(Rules.CURRENT.removedTypes.ra, 'removed-2025-07');
});

test('关键频次与计时固化为契约', () => {
  assert.deepEqual([Rules.CURRENT.types.rs.min, Rules.CURRENT.types.rs.max, Rules.CURRENT.types.rs.seconds], [15, 18, 5]);
  assert.deepEqual([Rules.CURRENT.types.fibw.min, Rules.CURRENT.types.fibw.max, Rules.CURRENT.types.fibw.seconds], [6, 9, 20]);
  assert.equal(Rules.CURRENT.types.lt.maxPlays, 3);
  assert.deepEqual([Rules.CURRENT.types.isp.minQuestionsPerSet, Rules.CURRENT.types.isp.maxQuestionsPerSet], [6, 8]);
});
