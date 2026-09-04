/* ============================================================
 * DET 练习站 · 当前考试规则清单（纯数据 + 校验）
 * 核对来源见 docs/CURRENT_DET_RULES.md。
 * ============================================================ */
(function (root) {
  'use strict';

  const CURRENT = Object.freeze({
    version: 'det-current-2025-07',
    verifiedAt: '2026-09-04',
    source: 'https://testcenter.zendesk.com/hc/en-us/articles/39104891663245-Test-Structure',
    approximateMinutes: 60,
    types: Object.freeze({
      rs: Object.freeze({ name: 'Read and Select', min: 15, max: 18, seconds: 5 }),
      fibw: Object.freeze({ name: 'Fill in the Blanks', min: 6, max: 9, seconds: 20 }),
      fib: Object.freeze({ name: 'Read and Complete', min: 3, max: 6, seconds: 180 }),
      lt: Object.freeze({ name: 'Listen and Type', min: 6, max: 9, seconds: 60, maxPlays: 3 }),
      ir: Object.freeze({ name: 'Interactive Reading', sets: 2, questionsPerSet: 6 }),
      il: Object.freeze({ name: 'Interactive Listening', sets: 2, minQuestionsPerSet: 8, maxQuestionsPerSet: 10 }),
      wp: Object.freeze({ name: 'Write About the Photo', count: 3 }),
      iw: Object.freeze({ name: 'Interactive Writing', sets: 1, questionsPerSet: 2 }),
      sp: Object.freeze({ name: 'Speak About the Photo', count: 1 }),
      rtsp: Object.freeze({ name: 'Read, Then Speak', count: 1 }),
      isp: Object.freeze({ name: 'Interactive Speaking', sets: 1, minQuestionsPerSet: 6, maxQuestionsPerSet: 8, secondsPerAnswer: 35 }),
      ws: Object.freeze({ name: 'Writing Sample', count: 1 }),
      ss: Object.freeze({ name: 'Speaking Sample', count: 1 })
    }),
    removedTypes: Object.freeze({ ra: 'removed-2025-07' })
  });

  function isCurrentType(type) {
    return Object.prototype.hasOwnProperty.call(CURRENT.types, type);
  }

  function validate(rules) {
    const errors = [];
    if (!rules || !rules.version || !rules.verifiedAt || !rules.source) errors.push('规则缺少版本、核对日期或来源');
    const types = rules && rules.types;
    if (!types || typeof types !== 'object') errors.push('规则缺少题型清单');
    if (types && Object.prototype.hasOwnProperty.call(types, 'ra')) errors.push('当前考试不得包含 Read Aloud');
    if (types && !Object.prototype.hasOwnProperty.call(types, 'isp')) errors.push('当前考试必须包含 Interactive Speaking');
    return errors;
  }

  const api = { CURRENT, isCurrentType, validate };
  root.AppRules = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
