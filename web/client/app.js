/* Progressive enhancement for the live site. Deferred, self-hosted, no dependencies. Every feature has a no-JS fallback in the HTML.
   Waits for React hydration (nd:hydrated) so DOM changes never race it; falls back after 3 s if the framework JS never runs. */
(function () {
  'use strict';
  var started = false;
  function boot() { if (started) return; started = true; init(); }
  if (window.__ndHydrated) boot(); else { document.addEventListener('nd:hydrated', boot); setTimeout(boot, 3000); }
  function init() {
  var d = document, root = d.documentElement;
  var $ = function (s, c) { return (c || d).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || d).querySelectorAll(s)); };
  var esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  var toastEl = $('[data-toast]'), toastT;
  function toast(msg) { if (!toastEl) return; toastEl.textContent = msg; toastEl.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(function () { toastEl.classList.remove('show'); }, 2600); }

  /* Relative times + NEW / UPDATED badges, from real publishedAt / updatedAt */
  var MIN = 6e4, HR = 36e5, DAY = 864e5;
  function rel(t) {
    var diff = Date.now() - t;
    if (diff < -MIN) return null; // clock skew or future time: keep the absolute time
    if (diff < MIN) return 'just now';
    if (diff < HR) return Math.floor(diff / MIN) + ' min ago';
    if (diff < DAY) return Math.floor(diff / HR) + ' hr ago';
    if (diff < 7 * DAY) { var n = Math.floor(diff / DAY); return n + (n === 1 ? ' day ago' : ' days ago'); }
    return null;
  }
  function badge(pub, upd) {
    var now = Date.now();
    if (upd - pub > 10 * MIN && now - upd < DAY && now >= upd) return 'updated';
    if (now - pub < 6 * HR && now >= pub) return 'new';
    return '';
  }
  function refreshTimes(scope) {
    $$('time[data-rel]', scope).forEach(function (el) {
      if (!el.dataset.abs) el.dataset.abs = el.textContent;
      var r = rel(Date.parse(el.getAttribute('datetime')));
      el.textContent = r || el.dataset.abs;
    });
    $$('[data-badge]', scope).forEach(function (el) {
      var b = badge(Date.parse(el.dataset.published), Date.parse(el.dataset.updated));
      el.textContent = b ? (b === 'new' ? 'New' : 'Updated') : '';
      el.className = 'badge' + (b ? ' badge-' + b : '');
    });
  }
  refreshTimes();
  setInterval(function () { if (!d.hidden) refreshTimes(); }, 60000);

  /* Ticker pause / play (animation only runs with JS and without reduced motion) */
  var tick = $('.ticker'), tbtn = $('[data-ticker-toggle]');
  if (tick && tbtn) {
    tbtn.addEventListener('click', function () {
      var paused = tick.classList.toggle('is-paused');
      tbtn.setAttribute('aria-pressed', String(paused));
      tbtn.setAttribute('aria-label', paused ? 'Play headline ticker' : 'Pause headline ticker');
    });
  }

  /* Filter chips: links to section pages without JS; in-place filter with JS */
  $$('[data-filter-scope]').forEach(function (nav) {
    var sect = nav.closest('[data-feed]'); if (!sect) return;
    var status = $('[data-filter-status]', sect), empty = $('[data-feed-empty]', sect);
    nav.addEventListener('click', function (e) {
      var a = e.target.closest('a[data-filter]'); if (!a) return;
      e.preventDefault();
      var f = a.dataset.filter;
      $$('a[data-filter]', nav).forEach(function (x) { if (x === a) x.setAttribute('aria-current', 'true'); else x.removeAttribute('aria-current'); });
      sect.dataset.activeFilter = f;
      applyFilter(sect);
      var shown = $$('.feed-item', sect).filter(function (li) { return !li.hidden; }).length;
      if (status) status.textContent = 'Showing ' + shown + ' ' + (shown === 1 ? 'story' : 'stories') + (f === 'all' ? '' : ' in ' + a.textContent);
    });
    function applyFilter(s) {
      var f = s.dataset.activeFilter || 'all', shown = 0, list = $('[data-feed-list]', s), limit = list && +list.dataset.feedLimit;
      $$('.feed-item', s).forEach(function (li) { var ok = f === 'all' || li.dataset.topic === f; li.hidden = !ok; if (ok) shown++; });
      if (empty) empty.hidden = shown > 0;
    }
    sect._applyFilter = function () { applyFilter(sect); };
  });

  /* "N new stories" pill: compares /latest.json with what is on the page. Never invents stories. */
  var feedSect = $('[data-feed]'), pill = $('[data-new-pill]'), fresh = [];
  function onPage() { var m = {}; $$('.feed-item', feedSect).forEach(function (li) { m[li.dataset.id] = li.dataset.updated; }); return m; }
  function itemHtml(it) {
    var hl = feedSect && feedSect.querySelector('.feed-title') ? feedSect.querySelector('.feed-title').tagName.slice(1) : '3';
    return '<li class="feed-item" data-id="' + esc(it.id) + '" data-topic="' + esc(it.topic) + '" data-updated="' + esc(it.updatedAt) + '"><div class="feed-time"><time datetime="' + esc(it.updatedAt) + '" data-rel>' + esc(new Date(it.updatedAt).toUTCString().slice(5, 22)) + ' UTC</time><span class="badge" data-badge data-published="' + esc(it.publishedAt) + '" data-updated="' + esc(it.updatedAt) + '"></span></div><div class="feed-body"><p class="kicker"><a href="/topics/' + esc(it.topic) + '/">' + esc(it.topicName) + '</a>' + (it.type === 'liveblog' ? '<span class="chip chip-live">Live blog</span>' : '<span class="chip chip-attributed">Official source</span>') + '</p><h' + hl + ' class="feed-title"><a href="' + esc(it.url) + '">' + esc(it.headline) + '</a></h' + hl + '></div><div class="feed-actions"></div></li>';
  }
  function checkFeed() {
    if (!feedSect || !pill || d.hidden || !window.fetch) return;
    fetch('/latest.json', { cache: 'no-cache', credentials: 'same-origin' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (j) {
      if (!j || !Array.isArray(j.items)) return;
      var have = onPage(), lists = $$('[data-feed-list]', feedSect), cap = lists.length === 1 && +lists[0].dataset.feedLimit;
      var pool = cap ? j.items.slice(0, cap) : j.items;
      fresh = pool.filter(function (it) { return !(it.id in have) || Date.parse(it.updatedAt) > Date.parse(have[it.id]); });
      if (fresh.length) { pill.textContent = fresh.length + (fresh.length === 1 ? ' new story' : ' new stories') + ' — tap to refresh'; pill.hidden = false; }
      else pill.hidden = true;
      pill._items = pool;
    }).catch(function () {});
  }
  if (pill) pill.addEventListener('click', function () {
    var items = pill._items || [], lists = $$('[data-feed-list]', feedSect);
    if (!lists.length) return;
    var first = lists[0], have = {};
    items.forEach(function (it) { have[it.id] = 1; });
    $$('.feed-item', feedSect).forEach(function (li) { if (have[li.dataset.id]) li.remove(); });
    first.insertAdjacentHTML('afterbegin', items.filter(function (it) { return fresh.some(function (f) { return f.id === it.id; }); }).map(itemHtml).join(''));
    refreshTimes(feedSect); if (feedSect._applyFilter) feedSect._applyFilter();
    pill.hidden = true; fresh = [];
    var h = $('h1, h2', feedSect); if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); h.scrollIntoView({ block: 'start' }); }
    toast('Feed refreshed');
  });
  checkFeed();
  setInterval(checkFeed, 120000);
  d.addEventListener('visibilitychange', function () { if (!d.hidden) checkFeed(); });

  /* Search overlay over /search-index.json */
  var dlg = $('[data-search-dialog]'), input = $('[data-search-input]'), results = $('[data-search-results]'), sstatus = $('#search-status'), idx = null, opener = null;
  function loadIdx() { return idx ? Promise.resolve(idx) : fetch('/search-index.json', { credentials: 'same-origin' }).then(function (r) { return r.json(); }).then(function (j) { idx = j.items || []; return idx; }); }
  function search(q) {
    q = q.trim().toLowerCase(); if (!q) return [];
    var terms = q.split(/\s+/);
    return (idx || []).map(function (it) {
      var hay = (it.headline + ' ' + (it.dek || '') + ' ' + (it.topicName || '')).toLowerCase(), score = 0;
      for (var i = 0; i < terms.length; i++) { if (hay.indexOf(terms[i]) < 0) return null; score += it.headline.toLowerCase().indexOf(terms[i]) >= 0 ? 2 : 1; }
      return { it: it, score: score };
    }).filter(Boolean).sort(function (a, b) { return b.score - a.score; }).slice(0, 12).map(function (x) { return x.it; });
  }
  function resultHtml(it) { return '<li><a href="' + esc(it.url) + '"><span class="sr-topic">' + esc(it.topicName || '') + '' + '</span><span class="sr-title">' + esc(it.headline) + '</span></a></li>'; }
  function render() {
    var q = input.value, r = search(q);
    results.innerHTML = r.map(resultHtml).join('');
    sstatus.textContent = q.trim() ? (r.length ? r.length + (r.length === 1 ? ' result' : ' results') : 'No results for "' + q.trim() + '"') : 'Type to search stories and pages.';
  }
  function openSearch(e) {
    if (!dlg || !dlg.showModal) return; // no <dialog> support: follow the /search/ link
    if (e) e.preventDefault();
    opener = d.activeElement;
    dlg.showModal(); root.classList.add('modal-open');
    input.value = ''; render(); input.focus();
    loadIdx().then(render).catch(function () { sstatus.textContent = 'Search is unavailable right now. Try the search page.'; });
  }
  function closeSearch() { if (dlg.open) dlg.close(); }
  if (dlg) {
    $$('[data-search-open]').forEach(function (a) { a.addEventListener('click', openSearch); });
    input.addEventListener('input', render);
    $('[data-search-close]').addEventListener('click', closeSearch);
    dlg.addEventListener('close', function () { root.classList.remove('modal-open'); if (opener && opener.focus) opener.focus(); });
    dlg.addEventListener('click', function (e) { if (e.target === dlg) closeSearch(); });
    dlg.addEventListener('keydown', function (e) {
      var links = $$('a', results), i = links.indexOf(d.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); (links[i + 1] || links[0] || input).focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); (i <= 0 ? input : links[i - 1]).focus(); }
      else if (e.key === 'Tab') { // keep focus inside the dialog
        var f = [input].concat(links, [$('[data-search-close]')]), k = f.indexOf(d.activeElement);
        e.preventDefault(); f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
      }
    });
    d.addEventListener('keydown', function (e) {
      if (e.key === '/' && !dlg.open && !/INPUT|TEXTAREA|SELECT/.test(d.activeElement.tagName)) openSearch(e);
    });
  }
  /* /search/ page: filter the fallback list by ?q= */
  var sp = $('[data-search-page]');
  if (sp) {
    var hint = $('[data-search-hint]'), list = $('[data-search-page-results]'), qi = $('#q', sp);
    var q0 = new URLSearchParams(location.search).get('q') || '';
    qi.value = q0;
    loadIdx().then(function () {
      var run = function () {
        var q = qi.value.trim(), r = q ? search(q) : [];
        var ids = {}; r.forEach(function (it) { ids[it.url] = 1; });
        $$('.feed-item', list).forEach(function (li) { li.hidden = q ? !ids[$('.feed-title a', li).getAttribute('href')] : false; });
        hint.textContent = q ? (r.filter(function (x) { return x.type !== 'page'; }).length + ' stories match "' + q + '".') : 'Type to filter the stories below.';
      };
      run(); qi.addEventListener('input', run);
    });
  }

  /* Share: native share sheet, else copy the link */
  $$('[data-share]').forEach(function (b) {
    b.addEventListener('click', function () {
      var data = { title: b.dataset.title, url: b.dataset.url };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(data.url).then(function () { toast('Link copied'); }, function () { toast('Copy failed — the link is in the address bar'); });
      else toast('Copy the link from the address bar');
    });
  });

  /* Save for later (localStorage only) */
  var KEY = 'saved-stories';
  function getSaved() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch (e) { return []; } }
  function setSaved(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} }
  function syncSave() {
    var s = getSaved(), ids = {}; s.forEach(function (x) { ids[x.slug] = 1; });
    $$('[data-save]').forEach(function (b) { var on = !!ids[b.dataset.save]; b.setAttribute('aria-pressed', String(on)); b.setAttribute('aria-label', (on ? 'Remove from saved: ' : 'Save for later: ') + b.dataset.title); });
  }
  d.addEventListener('click', function (e) {
    var b = e.target.closest('[data-save]'); if (!b) return;
    var s = getSaved(), i = -1;
    s.forEach(function (x, k) { if (x.slug === b.dataset.save) i = k; });
    if (i >= 0) { s.splice(i, 1); toast('Removed from saved'); } else { s.unshift({ slug: b.dataset.save, title: b.dataset.title, url: b.dataset.url, topic: b.dataset.topic, savedAt: new Date().toISOString() }); toast('Saved for later'); }
    setSaved(s); syncSave(); renderSaved();
  });
  var savedList = $('[data-saved-list]'), savedEmpty = $('[data-saved-empty]');
  function renderSaved() {
    if (!savedList) return;
    var s = getSaved();
    savedEmpty.textContent = s.length ? '' : 'Nothing saved yet. Use the bookmark button on any story to save it here.';
    savedEmpty.hidden = !s.length ? false : true;
    savedList.innerHTML = s.map(function (x) { return '<li class="feed-item"><div class="feed-time"><time datetime="' + esc(x.savedAt) + '" data-rel>' + esc(x.savedAt.slice(0, 10)) + '</time><span class="badge">Saved</span></div><div class="feed-body"><p class="kicker">' + esc(x.topic || '') + '</p><h2 class="feed-title"><a href="' + esc(x.url) + '">' + esc(x.title) + '</a></h2></div><div class="feed-actions"><button class="icon-btn" type="button" data-save="' + esc(x.slug) + '" data-title="' + esc(x.title) + '" data-url="' + esc(x.url) + '" data-topic="' + esc(x.topic || '') + '" aria-pressed="true" aria-label="Remove from saved: ' + esc(x.title) + '"><svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false"><path class="bm" d="M7 4h10v16l-5-3.5L7 20z" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg></button></div></li>'; }).join('');
    refreshTimes(savedList);
  }
  syncSave(); renderSaved();
  }
})();
