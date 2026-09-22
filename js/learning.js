(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AppLearning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const DAY = 24 * 60 * 60 * 1000;

  function numericScore(item) {
    const value = Number(item && item.score);
    return Number.isFinite(value) ? Math.max(10, Math.min(160, value)) : null;
  }

  function domainSnapshot(history, catalog) {
    const byDomain = new Map();
    for (const item of catalog) {
      if (!byDomain.has(item.domain)) {
        byDomain.set(item.domain, {
          id: item.domain,
          label: item.domainLabel,
          description: item.domainDescription,
          types: [],
          attempted: new Set(),
          scores: [],
        });
      }
      byDomain.get(item.domain).types.push(item.id);
    }
    for (const attempt of history) {
      const item = catalog.find((entry) => entry.id === attempt.type);
      if (!item) continue;
      const domain = byDomain.get(item.domain);
      domain.attempted.add(item.id);
      const score = numericScore(attempt);
      if (score !== null) domain.scores.push(score);
    }
    return [...byDomain.values()].map((domain) => ({
      id: domain.id,
      label: domain.label,
      description: domain.description,
      attempted: domain.attempted.size,
      total: domain.types.length,
      average: domain.scores.length
        ? Math.round(domain.scores.reduce((sum, score) => sum + score, 0) / domain.scores.length)
        : null,
    }));
  }

  function recommendation(history, catalog, settings) {
    const stats = new Map(catalog.map((item) => [item.id, { count: 0, total: 0, latest: 0 }]));
    for (const attempt of history) {
      if (!stats.has(attempt.type)) continue;
      const stat = stats.get(attempt.type);
      stat.count += 1;
      const score = numericScore(attempt);
      if (score !== null) stat.total += score;
      stat.latest = Math.max(stat.latest, Number(attempt.t) || 0);
    }
    const weak = String((settings && settings.weak) || '').toLowerCase();
    const ranked = catalog.map((item, index) => {
      const stat = stats.get(item.id);
      const average = stat.count ? stat.total / stat.count : 0;
      const weakMatch = weak && `${item.label} ${item.domainLabel}`.toLowerCase().includes(weak);
      return {
        item,
        index,
        rank: [weakMatch ? 0 : 1, stat.count ? 1 : 0, stat.count ? average : 0, stat.latest, index],
      };
    });
    ranked.sort((a, b) => {
      for (let i = 0; i < a.rank.length; i += 1) {
        if (a.rank[i] !== b.rank[i]) return a.rank[i] - b.rank[i];
      }
      return 0;
    });
    return ranked[0] ? ranked[0].item : catalog[0];
  }

  function buildPlan(primary, catalog) {
    if (!primary) return [];
    const plan = [primary];
    for (const item of catalog) {
      if (plan.length >= 3) break;
      if (item.id !== primary.id && !plan.some((entry) => entry.domain === item.domain)) plan.push(item);
    }
    for (const item of catalog) {
      if (plan.length >= 3) break;
      if (!plan.some((entry) => entry.id === item.id)) plan.push(item);
    }
    return plan;
  }

  function summarize(history, catalog, settings, now) {
    const safeHistory = Array.isArray(history) ? history : [];
    const safeCatalog = Array.isArray(catalog) ? catalog : [];
    const current = now instanceof Date ? now : new Date(now || Date.now());
    const todayStart = new Date(current.getFullYear(), current.getMonth(), current.getDate()).getTime();
    const scores = safeHistory.map(numericScore).filter((score) => score !== null);
    const recentScores = safeHistory.slice(0, 10).map(numericScore).filter((score) => score !== null);
    const recommended = recommendation(safeHistory, safeCatalog, settings || {});
    return {
      attempts: safeHistory.length,
      today: safeHistory.filter((item) => Number(item.t) >= todayStart).length,
      week: safeHistory.filter((item) => current.getTime() - Number(item.t || 0) <= 7 * DAY).length,
      average: recentScores.length
        ? Math.round(recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length)
        : null,
      best: scores.length ? Math.max(...scores) : null,
      goal: Number(settings && settings.goal) || null,
      recommended,
      plan: buildPlan(recommended, safeCatalog),
      domains: domainSnapshot(safeHistory, safeCatalog),
      recent: safeHistory.slice(0, 5),
    };
  }

  return { numericScore, domainSnapshot, recommendation, buildPlan, summarize };
});
