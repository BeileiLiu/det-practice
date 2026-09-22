(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.AppViews = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const esc = (value) => String(value == null ? '' : value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const domainIcon = { reading: 'R', listening: 'L', speaking: 'S', writing: 'W' };

  function home(snapshot, labels) {
    const recommended = snapshot.recommended || { id: 'rs', label: '词汇判断', sub: 'Read & Select', minutes: 2 };
    const plan = snapshot.plan.map((item, index) => `
      <button class="today-plan-item" type="button" data-start-type="${esc(item.id)}">
        <span class="plan-index">${String(index + 1).padStart(2, '0')}</span>
        <span><strong>${esc(item.label)}</strong><small>${esc(item.sub)} · 约 ${esc(item.minutes)} 分钟</small></span>
        <span class="plan-arrow" aria-hidden="true">→</span>
      </button>`).join('');
    const domains = snapshot.domains.map((domain) => {
      const progress = domain.total ? Math.round((domain.attempted / domain.total) * 100) : 0;
      return `<button class="domain-card domain-${esc(domain.id)}" type="button" data-domain="${esc(domain.id)}">
        <span class="domain-mark">${domainIcon[domain.id] || '?'}</span>
        <span class="domain-copy"><strong>${esc(domain.label)}</strong><small>${esc(domain.description)}</small></span>
        <span class="domain-meta"><b>${domain.average == null ? '—' : domain.average}</b><small>最近均分</small></span>
        <span class="domain-progress"><i style="width:${progress}%"></i></span>
        <span class="domain-count">${domain.attempted} / ${domain.total} 个题型练过</span>
      </button>`;
    }).join('');
    return `<section class="learning-home" aria-labelledby="homeTitle">
      <div class="home-heading">
        <div><span class="eyebrow">YOUR DET JOURNEY</span><h1 id="homeTitle">今天，稳稳地进步一点。</h1><p>先完成一小组，再决定要不要继续。每一道题都会留下可复习的反馈。</p></div>
        <span class="home-date">${esc(labels.date)}</span>
      </div>
      <section class="home-hero">
        <div class="home-hero-copy">
          <span class="hero-chip">今日建议 · ${esc(recommended.domainLabel)}</span>
          <h2>从 <em>${esc(recommended.label)}</em> 开始，<br>完成今天的第一小步。</h2>
          <p>${snapshot.attempts ? '根据你最近的练习记录，为你优先安排较少练习或分数较低的题型。' : '第一次使用，从短练习开始熟悉节奏。完成后再逐步进入听说写。'}</p>
          <div class="hero-actions"><button id="homeStartBtn" class="primary big-action" type="button" data-start-type="${esc(recommended.id)}">开始今日练习 <span>→</span></button><button id="homeBrowseBtn" class="quiet-action" type="button">自己选题</button></div>
          <small class="hero-note">点击开始后先看任务说明，确认后才计时</small>
        </div>
        <div class="home-hero-visual" aria-hidden="true">
          <div class="score-orbit"><span>${snapshot.goal || 120}</span><small>目标分</small></div>
          <div class="skill-float skill-one">READ</div><div class="skill-float skill-two">SPEAK</div>
          <div class="visual-caption"><i></i>${snapshot.today ? `今天已完成 ${snapshot.today} 次练习` : '第一题，等你开始'}</div>
        </div>
      </section>
      <div class="home-grid">
        <section class="today-plan"><div class="section-title"><div><span class="eyebrow">TODAY</span><h2>今天的小计划</h2></div><span>${snapshot.today} 次已完成</span></div>${plan}</section>
        <aside class="progress-card"><span class="eyebrow">THIS WEEK</span><strong>${snapshot.week}</strong><span>次练习</span><div class="progress-stats"><div><b>${snapshot.average == null ? '—' : snapshot.average}</b><small>最近均分</small></div><div><b>${snapshot.best == null ? '—' : snapshot.best}</b><small>历史最佳</small></div></div><button id="homeReviewBtn" type="button">打开错题复习 <span>→</span></button></aside>
      </div>
      <section class="domain-section"><div class="section-title"><div><span class="eyebrow">FOUR SKILLS</span><h2>按能力选择练习</h2></div><button id="homeAllTypesBtn" class="text-action" type="button">查看全部题型 →</button></div><div class="domain-grid">${domains}</div></section>
    </section>`;
  }

  function library(snapshot, catalog, selectedDomain) {
    const filtered = selectedDomain ? catalog.filter((item) => item.domain === selectedDomain) : catalog;
    const scoreByType = new Map();
    for (const attempt of snapshot.recent.concat([])) {
      if (!scoreByType.has(attempt.type)) scoreByType.set(attempt.type, attempt.score);
    }
    const cards = filtered.map((item) => `<button class="type-library-card" type="button" data-start-type="${esc(item.id)}">
      <span class="type-card-top"><span class="type-domain domain-${esc(item.domain)}">${esc(item.domainLabel)}</span><span class="type-time">约 ${esc(item.minutes)} 分钟</span></span>
      <strong>${esc(item.label)}</strong><small>${esc(item.sub)}</small>
      <span class="type-card-foot"><span>${scoreByType.has(item.id) ? `最近 ${esc(scoreByType.get(item.id))} 分` : '还未练习'}</span><b>开始 →</b></span>
    </button>`).join('');
    return `<section class="practice-library" aria-labelledby="libraryTitle">
      <div class="library-heading"><div><span class="eyebrow">PRACTICE LIBRARY</span><h1 id="libraryTitle">选一项，专心练完。</h1><p>进入题目前先查看任务说明；只有点击“开始本题”后才会计时。</p></div><button id="libraryHomeBtn" class="quiet-action" type="button">返回首页</button></div>
      <div class="domain-filters" role="group" aria-label="按能力筛选"><button type="button" data-filter-domain="" class="${selectedDomain ? '' : 'active'}">全部</button>${snapshot.domains.map((domain) => `<button type="button" data-filter-domain="${esc(domain.id)}" class="${selectedDomain === domain.id ? 'active' : ''}">${esc(domain.label)} <span>${domain.total}</span></button>`).join('')}</div>
      <div class="type-library-grid">${cards}</div>
    </section>`;
  }

  return { esc, home, library };
});
