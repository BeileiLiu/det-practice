'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const Session = require('../js/session.js');

test('答题会话：从准备到作答再提交', () => {
  const s = Session.create({ id: 's1', type: 'lt', questionId: 'q1', durationSec: 60, now: 1000 });
  assert.equal(s.status, 'ready');
  assert.equal(Session.start(s, 1500), true);
  assert.equal(Session.updateAnswer(s, 'hello world'), true);
  assert.deepEqual(Session.submit(s, 'manual', 4000), {
    id: 's1', type: 'lt', questionId: 'q1', answer: 'hello world',
    startedAt: 1500, submittedAt: 4000, durationMs: 2500, reason: 'manual'
  });
});

test('答题会话：提交幂等，提交后不能改答案', () => {
  const s = Session.create({ id: 's2', type: 'lt', now: 1000 });
  Session.updateAnswer(s, 'first');
  const first = Session.submit(s, 'timeout', 2000);
  assert.equal(first.reason, 'timeout');
  assert.equal(Session.submit(s, 'manual', 3000), null);
  assert.equal(Session.updateAnswer(s, 'second'), false);
  assert.equal(s.answer, 'first');
});

test('答题会话：未显式开始时以提交时刻开始', () => {
  const s = Session.create({ type: 'lt', now: 1000 });
  const result = Session.submit(s, 'manual', 2500);
  assert.equal(result.durationMs, 0);
  assert.equal(s.status, 'submitted');
});
