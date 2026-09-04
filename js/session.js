/* ============================================================
 * DET 练习站 · 答题会话层（纯逻辑，无 DOM）
 * ------------------------------------------------------------
 * 统一保存一次作答的生命周期。题型渲染器负责显示；会话负责答案、
 * 开始时间和幂等提交，避免按钮与超时重复记分。
 * ============================================================ */
(function (root) {
  'use strict';

  function create(options) {
    const opts = options || {};
    const now = Number(opts.now == null ? Date.now() : opts.now);
    return {
      id: String(opts.id || (now + '-' + Math.random().toString(36).slice(2, 8))),
      type: String(opts.type || ''),
      questionId: String(opts.questionId || ''),
      durationSec: Math.max(0, Number(opts.durationSec) || 0),
      status: 'ready',
      answer: opts.answer == null ? '' : opts.answer,
      createdAt: now,
      startedAt: null,
      submittedAt: null,
      submitReason: null
    };
  }

  function start(session, now) {
    if (!session || session.status !== 'ready') return false;
    session.status = 'active';
    session.startedAt = Number(now == null ? Date.now() : now);
    return true;
  }

  function updateAnswer(session, answer) {
    if (!session || session.status === 'submitted') return false;
    session.answer = answer == null ? '' : answer;
    return true;
  }

  function submit(session, reason, now) {
    if (!session || session.status === 'submitted') return null;
    const submittedAt = Number(now == null ? Date.now() : now);
    if (session.startedAt == null) start(session, submittedAt);
    session.status = 'submitted';
    session.submittedAt = submittedAt;
    session.submitReason = reason || 'manual';
    return {
      id: session.id,
      type: session.type,
      questionId: session.questionId,
      answer: session.answer,
      startedAt: session.startedAt,
      submittedAt,
      durationMs: Math.max(0, submittedAt - session.startedAt),
      reason: session.submitReason
    };
  }

  const api = { create, start, updateAnswer, submit };
  root.AppSession = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
