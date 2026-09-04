/* ============================================================
 * DET 练习站 · 数据层（localStorage 封装 + schema 版本化）
 * ------------------------------------------------------------
 * 从 index.html 内联脚本抽离的 9 个 key 的读写函数。
 * - 经典脚本 + UMD：浏览器挂同名全局（调用点不变），Node 可测；
 * - 存储后端可注入（bk 参数）：浏览器默认 localStorage，
 *   Node 单测注入内存 Map 模拟；
 * - SCHEMA_VERSION + MIGRATIONS 迁移钩子：为将来 IndexedDB /
 *   云端同步留升级口，浏览器加载时自动 ensureSchema()。
 * 约束：API Key 只存本地、绝不写入项目文件。
 * ============================================================ */
(function (root) {
  'use strict';

  const KEYS = {
    settings: 'detSettings',
    history: 'detHistory',
    ui: 'detUiState',
    adaptive: 'detAdaptiveState',
    qstore: 'detQuestionBank',
    mistakes: 'detMistakes',
    favorites: 'detFavorites',
    gaze: 'detGazeState',
    setup: 'detSetupSkipped',
    schema: 'detSchemaVersion'
  };
  // 当前 schema 版本；升版时：改这里 + 在 MIGRATIONS 里补低版本的 up 迁移钩子
  const SCHEMA_VERSION = 1;
  const MIGRATIONS = {};

  function backend() {
    try { if (typeof localStorage !== 'undefined') return localStorage; } catch (e) { /* noop */ }
    try { if (typeof globalThis !== 'undefined' && globalThis.localStorage) return globalThis.localStorage; } catch (e) { /* noop */ }
    return null;
  }

  function getJSON(key, fallback, bk) {
    const b = bk || backend();
    if (!b) return fallback;
    try {
      const raw = b.getItem(key);
      if (raw == null) return fallback;
      const v = JSON.parse(raw);
      return v || fallback;
    } catch (e) { return fallback; }
  }
  function setJSON(key, val, bk) {
    const b = bk || backend();
    if (!b) return;
    try { b.setItem(key, JSON.stringify(val)); } catch (e) { /* 配额等错误静默，与旧行为一致 */ }
  }
  // 浏览器环境下取内联脚本的顶层 let 全局（typeof 守卫；Node 下由测试注入实参）
  function globalVal(name) {
    try {
      // 直接标识符查找：浏览器生效，Node 下 typeof 守卫避免 ReferenceError
      if (name === 'settings') return typeof settings !== 'undefined' ? settings : undefined;
      if (name === 'uiState') return typeof uiState !== 'undefined' ? uiState : undefined;
      if (name === 'adaptiveState') return typeof adaptiveState !== 'undefined' ? adaptiveState : undefined;
      if (name === 'questionStore') return typeof questionStore !== 'undefined' ? questionStore : undefined;
      if (name === 'gazeState') return typeof gazeState !== 'undefined' ? gazeState : undefined;
    } catch (e) { return undefined; }
    return undefined;
  }

  // ---------------- 设置 ----------------
  function readStoredSettings(bk) { return getJSON(KEYS.settings, {}, bk); }
  function saveSettings(s, bk) {
    const v = (s !== undefined) ? s : globalVal('settings');
    if (v !== undefined && v !== null) setJSON(KEYS.settings, v, bk);
  }

  // ---------------- UI 状态 ----------------
  function readUiState(bk) { return getJSON(KEYS.ui, {}, bk); }
  function saveUiState(s, bk) {
    const v = (s !== undefined) ? s : globalVal('uiState');
    if (v !== undefined && v !== null) setJSON(KEYS.ui, v, bk);
  }

  // ---------------- 自适应状态 ----------------
  const ADAPTIVE_DEFAULTS = { ability: null, se: 28, answered: 0, items: {}, types: {}, last: null };
  function readAdaptiveState(bk) {
    const v = getJSON(KEYS.adaptive, null, bk);
    return Object.assign({}, ADAPTIVE_DEFAULTS, v && typeof v === 'object' ? v : {});
  }
  function saveAdaptiveState(s, bk) {
    const v = (s !== undefined) ? s : globalVal('adaptiveState');
    if (v !== undefined && v !== null) setJSON(KEYS.adaptive, v, bk);
  }

  // ---------------- AI 题库 ----------------
  function readQuestionStore(bk) { const v = getJSON(KEYS.qstore, {}, bk); return v && typeof v === 'object' ? v : {}; }
  function saveQuestionStore(s, bk) {
    const v = (s !== undefined) ? s : globalVal('questionStore');
    if (v !== undefined && v !== null) setJSON(KEYS.qstore, v, bk);
  }

  // ---------------- 错题本 / 收藏夹（saveBook 上限 500） ----------------
  function readBook(key, bk) {
    const v = getJSON(key, [], bk);
    return Array.isArray(v) ? v : [];
  }
  function saveBook(key, items, bk) {
    if (!items) items = [];
    setJSON(key, items.slice(0, 500), bk);
  }

  // ---------------- 视线守护 ----------------
  function readGazeStored(bk) { return getJSON(KEYS.gaze, {}, bk); }
  function saveGazeStored(g, bk) {
    const v = (g !== undefined) ? g : globalVal('gazeState');
    if (!v) return;
    setJSON(KEYS.gaze, { enabled: !!v.enabled, warningCount: v.warningCount, criticalCount: v.criticalCount }, bk);
  }

  // ---------------- 练习历史 ----------------
  function getHistory(bk) {
    const v = getJSON(KEYS.history, [], bk);
    return Array.isArray(v) ? v : [];
  }
  function saveHistory(h, bk) { setJSON(KEYS.history, h || [], bk); }

  // ---------------- schema 版本化 ----------------
  function ensureSchema(bk) {
    const b = bk || backend();
    if (!b) return;
    try {
      const cur = b.getItem(KEYS.schema);
      if (String(cur) === String(SCHEMA_VERSION)) return;
      for (let v = 1; v < SCHEMA_VERSION; v++) {
        const m = MIGRATIONS[v];
        if (m && typeof m.up === 'function') m.up(b);
      }
      b.setItem(KEYS.schema, String(SCHEMA_VERSION));
    } catch (e) { /* 迁移失败不阻塞使用 */ }
  }

  const S = {
    KEYS, SCHEMA_VERSION, MIGRATIONS, backend,
    readStoredSettings, saveSettings,
    readUiState, saveUiState,
    readAdaptiveState, saveAdaptiveState,
    readQuestionStore, saveQuestionStore,
    readBook, saveBook,
    readGazeStored, saveGazeStored,
    getHistory, saveHistory, ensureSchema
  };
  root.AppStorage = S;
  if (typeof window !== 'undefined') {
    for (const k in S) { if (!(k in window)) window[k] = S[k]; }
  }
  if (typeof module !== 'undefined' && module.exports) { module.exports = S; }
  // 浏览器加载即做 schema 检查（Node 下由测试注入 backend 调用）
  try { if (typeof localStorage !== 'undefined') ensureSchema(); } catch (e) { /* noop */ }
})(typeof globalThis !== 'undefined' ? globalThis : this);