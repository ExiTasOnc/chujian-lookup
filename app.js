/* 楚簡構形·讀音檢索 — 前端（純靜態，無依賴；數據來自 data/db.js） */
'use strict';
window.addEventListener('error', e => { const a = document.getElementById('app'); if (a && /載入數據/.test(a.textContent)) a.innerHTML = '<p class="err">頁面腳本出錯：' + (e.message || e) + '<br>請強制重新整理（Mac：Cmd+Shift+R；Windows：Ctrl+F5）讓瀏覽器丟掉舊快取；若仍出錯請回報這行文字。</p>'; });
(function () {
  const $app = document.getElementById('app');
  const DB = window.CHUDB;
  if (!DB) { $app.innerHTML = '<p class="err">找不到 data/db.js。請先在 build/ 目錄執行 <code>python3 build_site.py</code>。</p>'; return; }
  const M = DB.meta, SYS = M.systems, T = DB.types, C = DB.chars, DOCS = DB.docs, SERIES = DB.series || {};
  const KIND = { brace: '拆分', circ: '未拆分', plain: '本字', hewen: '合文／多字' };
  const ST = { chubs: 'CHUBS', manual: '人工', model: '模型', verified: '已核' };
  const FLAG = { uncertain: '部件不確定', placeholder: '部件缺', bracket: '附記號', alt_split: '兩種拆法', minus: '減筆', single: '單部件', hewen: '合文／重文', read_uncertain: '釋讀不確定', read_multi: '多字釋讀', variant_note: '訛／異體附註', scribal: '訛字' };
  const CAT_COLOR = { '形聲型': '#b45309', '反切型': '#b91c1c', '只中聲': '#0369a1', '只中韻': '#15803d', '全不中': '#6b7280' };
  const TIERNAME = { R0I0: '嚴格：韻串同＋主輔音同', R1I0: '韻部級：同韻部＋主輔音同', R1I1: '韻部＋聲類（不分送氣清濁）', R2I1: '對轉組＋聲類' };
  const PAGE = 120;

  // ---------- 字體 ----------
  (function () {
    const f = M.fonts || {}; let css = '';
    if (f.ipa) css += `@font-face{font-family:"CharisSub";src:url(assets/fonts/${f.ipa});font-display:swap}`;
    if (f.extb) css += `@font-face{font-family:"HanaMinSub";src:url(assets/fonts/${f.extb});unicode-range:U+20000-3134F;font-display:swap}`;
    if (css) { const s = document.createElement('style'); s.textContent = css; document.head.appendChild(s); }
  })();
  document.title = M.title || document.title;
  const $bt = document.querySelector('.brand .t'); if ($bt) $bt.textContent = M.title;
  if (M.internal && document.getElementById('banner')) document.getElementById('banner').textContent = '內部版（含鄭張數據，勿公開）';
  if (document.getElementById('foot')) document.getElementById('foot').innerHTML = '';

  // ---------- 索引 ----------
  const byId = new Map(), byRead = new Map(), byComp = new Map(), byKey = new Map(), byBase = new Map(), byJie = new Map();
  function push(m, k, v) { if (!k) return; let a = m.get(k); if (!a) { a = []; m.set(k, a); } a.push(v); }
  for (const t of T) {
    byId.set(t.id, t);
    const reads = new Set([t.r, ...(t.ra || []), ...(t.ih || [])].filter(Boolean));
    if (t.k === 'plain' || t.k === 'hewen') { if (t.z) push(byBase, t.z, t); if (t.r && t.r !== t.z) push(byJie, t.r, t); if (!t.r && t.z) reads.add(t.z); }
    for (const r of reads) push(byRead, r, t);
    if (t.c) { for (const c of new Set(t.c)) push(byComp, c, t); if (t.c.length) push(byKey, t.c.join(''), t); }
  }
  for (const m of [byRead, byComp, byKey, byBase, byJie]) for (const a of m.values()) a.sort((x, y) => y.n - x.n);
  const SOURCES = Object.keys(M.counts.sources || {});

  // ---------- 工具 ----------
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
  const enc = encodeURIComponent;
  const normIPA = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[*\s]/g, '');
  const isCJK = ch => /[⺀-⿟㐀-䶿一-鿿豈-﫿-]|[\uD840-\uDBFF][\uDC00-\uDFFF]/.test(ch);
  const chars = s => Array.from(s);
  function imgFile(im) { if (typeof im === 'string') return im; const [di, slip, rest] = im; const [src, doc] = DOCS[di].split('|'); return `${src}_${doc}_${slip}_${rest}.png`; }
  function imgUrl(t, im) { return `img/${t.h}/${enc(imgFile(im))}`; }
  function imgSrcName(im) { return typeof im === 'string' ? '' : DOCS[im[0]].split('|')[0]; }
  function imgCap(im) { if (typeof im === 'string') return im; const [di, slip] = im; const [src, doc] = DOCS[di].split('|'); return `${src}·${doc}·簡${slip}`; }
  function zi(ch, link = true, cls = '') { return link ? `<a class="zi ${cls}" href="#/z/${enc(ch)}">${esc(ch)}</a>` : `<span class="zi ${cls}">${esc(ch)}</span>`; }
  function readOf(t) { return t.r || t.z || null; }
  function ph(s) { return s ? `<span class="ph">${esc(s)}</span>` : '<span class="mut">—</span>'; }
  function rdLine(ch) {
    const c = C[ch]; if (!c) return '<span class="mut">無擬音</span>';
    const parts = SYS.map(s => { const p = c.ph[s.id]; return p && p.has ? `<span class="sysl">${esc(s.short)}</span>${ph(p.str)}` : ''; }).filter(Boolean);
    return parts.join('<span class="sep">·</span>') || '<span class="mut">無擬音</span>';
  }
  function buOf(ch, sysId) { const c = C[ch]; return c && c.bu && c.bu[sysId] ? c.bu[sysId] : []; }
  const ZZMAIN = new Set(M.zzmain || []);
  function zzLabel(yb) { return ZZMAIN.has(yb) ? esc(yb) + '部' : `${esc(yb)}<span class="mut small">（去聲小類）</span>`; }
  function buLabel(b, sysId) { return sysId === 'ZZ' ? (ZZMAIN.has(b) ? b + '部' : b) : b; }
  function tlabel(t, link = false) {
    const gap = '<span class="gap"></span>';
    const arrow = '<span class="arrow">→</span>';
    const rdPart = t.r ? `${arrow}<span class="rd">${zi(t.r, link)}</span>`
      : (t.ih ? `${arrow}<span class="rd inf" title="同拆法推定，未經核實">${t.ih.map(x => zi(x, link)).join('<span class="mut">／</span>')}</span><span class="inftag">推定</span>` : '');
    if (t.k === 'brace') return `<span class="comps">${(t.c || []).map(c => zi(c, link)).join(gap)}</span>${rdPart || `${arrow}<span class="rd none">未釋</span>`}`;
    if (t.k === 'circ') return t.r ? `<span class="rd">${zi(t.r, link)}</span>` : `<span class="rd none">${t.nt ? esc(t.nt) : '未釋'}</span>`;
    return `<span class="comps">${t.z ? zi(t.z, link) : ''}</span>${t.r && t.r !== t.z ? `${arrow}<span class="rd">${zi(t.r, link)}</span>` : ''}`;
  }
  function badges(t) {
    let h = `<span class="badge k">${KIND[t.k] || t.k}</span>`;
    if (t.st && t.st !== 'chubs') h += `<span class="badge st">${ST[t.st] || t.st}拆分</span>`;
    if (t.rst === 'manual') h += `<span class="badge st">人工釋讀</span>`;
    for (const f of (t.f || [])) { if (f.startsWith('variant:')) h += `<span class="badge">異體 ${esc(f.slice(8))}</span>`; else if (FLAG[f]) h += `<span class="badge ${['uncertain', 'placeholder', 'alt_split', 'minus', 'bracket', 'read_uncertain'].includes(f) ? 'warn' : ''}">${FLAG[f]}</span>`; }
    return h;
  }
  function srcLinksOf(t, max = 4) {
    const href = `#/t/${enc(t.id)}`; const srcs = Object.entries(t.s || {}).sort((a, b) => b[1] - a[1]);
    return srcs.slice(0, max).map(([k, v]) => `<a class="srcl" href="${href}?src=${enc(k)}&at=gallery" title="看 ${esc(k)} 的 ${v} 例字形">${esc(k)} ${v}</a>`).join('') + (srcs.length > max ? `<a class="srcl" href="${href}?at=gallery" title="全部材料">…</a>` : '');
  }
  function readForCard(t) { return t.r || t.z || (t.ih && t.ih[0]) || null; }
  function rdTable(ch, inferred) {
    const c = ch && C[ch];
    if (!ch) return '<div class="rdnone">無釋讀（待補）</div>';
    if (!c) return `<div class="rdnone">${esc(ch)}：三套擬音表都查不到</div>`;
    return `<table class="rdt">${inferred ? `<caption>讀音按推定釋讀 ${esc(ch)}</caption>` : ''}${SYS.map(s => { const p = c.ph[s.id]; const bu = buOf(ch, s.id).map(b => buLabel(b, s.id)).join('/'); return `<tr><th>${esc(s.en || s.short)}</th><td>${p && p.has ? `${ph(p.str)}${bu ? `<span class="bu">${esc(bu)}</span>` : ''}` : '<span class="mut">—</span>'}</td></tr>`; }).join('')}</table>`;
  }
  function card(t) {
    const im = t.im && t.im[0]; const href = `#/t/${enc(t.id)}`; const r = readForCard(t);
    const flagged = (t.f || []).some(f => ['uncertain', 'placeholder', 'alt_split'].includes(f));
    return `<div class="card"><a class="thumb" href="${href}" title="打開字形頁">${im ? `<img loading="lazy" src="${imgUrl(t, im)}" alt="">` : '<span class="noimg">無圖</span>'}</a>
      <div class="cbody"><div class="ttl"><a class="tl" href="${href}">${tlabel(t)}</a><span class="tags"><span class="badge k">${KIND[t.k]}</span>${(t.f || []).includes('hewen') ? '<span class="badge">合文</span>' : ''}${t.st !== 'chubs' ? `<span class="badge st">${ST[t.st]}</span>` : ''}${flagged ? '<span class="badge warn">部件記號</span>' : ''}</span></div>
      ${rdTable(r, !t.r && !t.z && t.ih)}
      <div class="meta">${srcLinksOf(t) || '<span class="mut">無圖</span>'}</div></div></div>`;
  }
  function row(t) {
    const im = t.im && t.im[0]; const href = `#/t/${enc(t.id)}`; const r = readForCard(t); const c = r && C[r];
    return `<tr><td class="th"><a href="${href}">${im ? `<img loading="lazy" src="${imgUrl(t, im)}" alt="">` : ''}</a></td><td><a class="tl" href="${href}">${tlabel(t)}</a>${t.st !== 'chubs' ? ` <span class="badge st">${ST[t.st]}</span>` : ''}</td>
      ${SYS.map(s => { const p = c && c.ph[s.id]; const bu = r ? buOf(r, s.id).map(b => buLabel(b, s.id)).join('/') : ''; return `<td>${p && p.has ? `${ph(p.str)}${bu ? `<span class="bu">${esc(bu)}</span>` : ''}` : '<span class="mut">—</span>'}</td>`; }).join('')}
      <td class="small">${srcLinksOf(t, 3)}</td></tr>`;
  }
  const VIEW = () => { try { return localStorage.getItem('chu_view') || 'cards'; } catch (e) { return 'cards'; } };
  function cards(list) {
    const id = 'g' + Math.random().toString(36).slice(2, 8); LISTS[id] = list;
    const more = list.length > PAGE ? `<button class="more" data-more="${id}" data-off="${PAGE}">顯示更多（還有 ${list.length - PAGE} 條）</button>` : '';
    if (VIEW() === 'table') return `<div class="scroll"><table class="rlist"><thead><tr><th></th><th>字形 → 釋讀</th>${SYS.map(s => `<th>${esc(s.en || s.short)}</th>`).join('')}<th>材料</th></tr></thead><tbody id="${id}">${list.slice(0, PAGE).map(row).join('')}</tbody></table></div>${more}`;
    return `<div class="cards" id="${id}">${list.slice(0, PAGE).map(card).join('')}</div>${more}`;
  }
  const LISTS = {};
  $app.addEventListener('click', e => {
    const g = e.target.closest('[data-lb]'); if (g) { e.preventDefault(); openLB(+g.dataset.lb); return; }
    const sc = e.target.closest('[data-scroll]'); if (sc) { const el = document.getElementById(sc.dataset.scroll); if (el) el.scrollIntoView({ behavior: 'smooth' }); return; }
    const b = e.target.closest('button[data-more]'); if (!b) return;
    const list = LISTS[b.dataset.more]; let off = +b.dataset.off; const box = document.getElementById(b.dataset.more);
    box.insertAdjacentHTML('beforeend', list.slice(off, off + PAGE).map(box.tagName === 'TBODY' ? row : card).join('')); off += PAGE; b.dataset.off = off;
    if (off >= list.length) b.remove(); else b.textContent = `顯示更多（還有 ${list.length - off} 條）`;
  });
  function setNav(seg) { document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.dataset.nav === seg)); }
  function notFound(what) { return `<h1>找不到</h1><p class="mut">${esc(what)} 不在數據裡。<a href="#/">回首頁</a></p>`; }

  // ---------- 路由 ----------
  function route() {
    const h = location.hash || '#/'; const [path, qs] = h.slice(1).split('?');
    const seg = path.split('/').filter(Boolean).map(x => { try { return decodeURIComponent(x); } catch (e) { return x; } });
    const q = new URLSearchParams(qs || '');
    setNav(seg[0] || '');
    let html;
    try {
      if (!seg.length) html = viewHome();
      else if (seg[0] === 's') html = viewSearch(q);
      else if (seg[0] === 't') html = viewType(seg.slice(1).join('/'), q);
      else if (seg[0] === 'z') html = viewChar(seg[1]);
      else if (seg[0] === 'comps') html = viewComps(q);
      else if (seg[0] === 'rimes') html = viewRimes(seg[1], seg[2]);
      else if (seg[0] === 'series') html = viewSeries(seg[1]);
      else html = viewHome();
    } catch (err) { html = `<h1>出錯了</h1><pre>${esc(err.stack || err)}</pre>`; console.error(err); }
    $app.innerHTML = html; window.scrollTo({ top: 0, behavior: 'instant' });
    const at = q.get('at'); if (at) { const el = document.getElementById(at); if (el) el.scrollIntoView({ behavior: 'instant', block: 'start' }); }
    const $hq = document.getElementById('hq'); if ($hq) $hq.value = seg[0] === 's' ? (q.get('q') || '') : '';
    bindSearchForms();
  }
  window.addEventListener('hashchange', route);
  const $hs = document.getElementById('hsearch');
  if ($hs) $hs.addEventListener('submit', e => { e.preventDefault(); go(document.getElementById('hq').value, 'auto'); });
  function go(q, m, extra) { q = (q || '').trim(); if (!q) return; const p = new URLSearchParams(); p.set('q', q); if (m && m !== 'auto') p.set('m', m); if (extra) for (const [k, v] of Object.entries(extra)) if (v) p.set(k, v); location.hash = '#/s?' + p.toString(); }
  function bindSearchForms() {
    document.querySelectorAll('form[data-search]').forEach(f => f.addEventListener('submit', e => {
      e.preventDefault(); const fd = new FormData(f); const extra = {};
      for (const k of ['src', 'k', 'st', 'nc', 'sys', 'op', 'sort']) if (fd.get(k)) extra[k] = fd.get(k);
      go(fd.get('q'), fd.get('m') || 'auto', extra);
    }));
    document.querySelectorAll('select[data-gfilter]').forEach(sel => sel.addEventListener('change', () => {
      const v = sel.value; document.querySelectorAll('.gitem[data-src]').forEach(el => { el.style.display = (!v || el.dataset.src === v) ? '' : 'none'; });
    }));
  }
  const MODES = [['auto', '自動判斷'], ['read', '釋讀字'], ['comp', '部件'], ['oc', '整字讀音'], ['coc', '部件讀音'], ['bu', '韻部'], ['cat', '判定類別']];
  function modeSelect(cur) { return `<select name="m">${MODES.map(([v, l]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${l}</option>`).join('')}</select>`; }

  // ---------- 首頁 ----------
  function viewHome() {
    const c = M.counts;
    const ex = [['始', 'auto'], ['㠯', 'comp'], ['虍', 'comp'], ['古 欠', 'comp'], ['之部', 'bu'], ['kʰ-', 'oc'], ['-ak', 'coc'], ['牙喉', 'coc'], ['反切型', 'cat']];
    return `<div class="hero"><h1>${esc(M.title)}</h1><div class="en">${esc(M.subtitle || '')}</div>
      <form class="bigsearch" data-search><input name="q" placeholder="釋讀字、部件、擬音、聲母（k-）、韻部（之部）…" autofocus>${modeSelect('auto')}<button type="submit">查詢</button></form>
      <div class="examples">${ex.map(([q, m]) => `<a href="#/s?q=${enc(q)}${m !== 'auto' ? '&m=' + m : ''}">${esc(q)}<span class="mut small"> ${MODES.find(x => x[0] === m)[1]}</span></a>`).join('')}</div></div>
      <div class="grid">
        <div class="stat"><div class="k">拆分類型</div><div class="v">${c.brace.types} <small>/ ${c.brace.imgs} 圖</small></div></div>
        <div class="stat"><div class="k">有釋讀</div><div class="v">${c.brace.read} <small>無釋讀 ${c.brace.unread}</small></div></div>
        <div class="stat"><div class="k">未拆分／本字／合文</div><div class="v">${c.circ.types} <small>/ ${c.plain.types} / ${c.hewen.types}</small></div></div>
        <div class="stat"><div class="k">有擬音的字</div><div class="v">${c.chars.any} <small>/ ${c.chars.total}</small></div></div>
      </div>`;
  }

  // ---------- 檢索 ----------
  function parsePhon(raw) {
    let q = raw.trim();
    if (/^(牙喉|舌|齒|齿|唇)$/.test(q)) return { kind: 'place', v: q.replace('齿', '齒') };
    let m = q.match(/^([A-Za-zʔ]{1,2})類$/); if (m) return { kind: 'cls', v: m[1].toUpperCase() };
    if (chars(q).every(isCJK)) return { kind: 'bu', v: q.replace(/部$/, '') };
    if (/^\*?\S+-$/.test(q)) return { kind: 'ini', v: normIPA(q.slice(0, -1)) };
    if (/^-\S+$/.test(q)) return { kind: 'rime', v: normIPA(q.slice(1)) };
    return { kind: 'str', v: normIPA(q) };
  }
  function charPhonMatch(ch, pq, sysId) {
    const c = C[ch]; if (!c) return false;
    for (const s of SYS) {
      if (sysId && s.id !== sysId) continue; const p = c.ph[s.id]; if (!p || !p.has) continue;
      switch (pq.kind) {
        case 'bu': if ((c.bu[s.id] || []).some(b => b.replace(/部/g, '').includes(pq.v))) return true; break;
        case 'ini': if (p.C[0].some(x => normIPA(x) === pq.v)) return true; break;
        case 'cls': if ((p.C[1] || []).includes(pq.v)) return true; break;
        case 'place': if ((p.C[2] || []).includes(pq.v)) return true; break;
        case 'rime': if (p.R[0].some(x => { const n = normIPA(x); return n === pq.v || n.endsWith(pq.v); })) return true; break;
        default: if (normIPA(p.str).includes(pq.v)) return true;
      }
    }
    if (pq.kind === 'str') { if ((c.py || '').toLowerCase().replace(/\s/g, '').includes(pq.v)) return true; for (const e of (c.rd.BS || [])) if ((e.mc || '').toLowerCase().includes(pq.v)) return true; }
    return false;
  }
  function phonDesc(pq) { return { bu: `韻部含「${pq.v}」`, ini: `主輔音＝${pq.v}`, cls: `聲類＝${pq.v}`, place: `聲母部位＝${pq.v}`, rime: `韻串＝-${pq.v}`, str: `擬音／拼音含「${pq.v}」` }[pq.kind]; }
  function applyFilters(list, q) {
    const src = q.get('src'), k = q.get('k'), st = q.get('st'), nc = q.get('nc'), sort = q.get('sort');
    let out = list;
    if (src) out = out.filter(t => t.s && t.s[src]);
    if (k) { const ks = k.split(','); out = out.filter(t => ks.includes(t.k)); }
    if (st) out = out.filter(t => st === 'added' ? t.st !== 'chubs' || t.rst : t.st === st);
    if (nc) out = out.filter(t => t.c && (nc === '4' ? t.c.length >= 4 : t.c.length === +nc));
    if (sort === 'id') out = out.slice().sort((a, b) => a.id.localeCompare(b.id, 'zh-Hant'));
    return out;
  }
  function filterBar(q, mode) {
    const opt = (name, cur, items) => `<select name="${name}"><option value="">${items[0]}</option>${items.slice(1).map(([v, l]) => `<option value="${v}"${cur === v ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
    return `<div class="filters">
      <label>材料 ${opt('src', q.get('src'), ['全部', ...SOURCES.map(s => [s, `${s} ${M.counts.sources[s]}`])])}</label>
      <label>類型 ${opt('k', q.get('k'), ['全部', ['brace', '拆分'], ['circ', '未拆分'], ['plain', '本字'], ['hewen', '合文'], ['brace,circ', '拆分＋未拆分']])}</label>
      <label>來源 ${opt('st', q.get('st'), ['全部', ['chubs', '原始'], ['added', '人工／模型補充'], ['manual', '人工'], ['model', '模型'], ['verified', '已核']])}</label>
      <label>部件數 ${opt('nc', q.get('nc'), ['不限', ['2', '2'], ['3', '3'], ['4', '≥4']])}</label>
      ${['oc', 'coc', 'bu', 'auto'].includes(mode) ? `<label>擬音系統 ${opt('sys', q.get('sys'), ['任一套', ...SYS.map(s => [s.id, s.name])])}</label>` : ''}
      ${['comp', 'auto'].includes(mode) ? `<label>多部件 ${opt('op', q.get('op'), ['同時含（AND）', ['or', '含任一（OR）']])}</label>` : ''}
      <label>排序 ${opt('sort', q.get('sort'), ['圖數多→少', ['id', '目錄名']])}</label></div>`;
  }
  function group(title, list, q, sub) {
    return `<section class="group"><h2>${title} <span class="n">${list.length} 型 · ${list.reduce((a, t) => a + t.n, 0)} 圖</span></h2>${sub ? `<div class="sub">${sub}</div>` : ''}${list.length ? cards(list) : '<p class="mut">無</p>'}</section>`;
  }
  function viewSearch(q) {
    const raw = (q.get('q') || '').trim(); const mode = q.get('m') || 'auto'; const sysId = q.get('sys') || '';
    let body = ''; const F = l => applyFilters(l, q);
    const cj = chars(raw).filter(isCJK); const allCJK = cj.length > 0 && chars(raw.replace(/[\s,，、]/g, '')).every(isCJK);
    const compSearch = (cs, op) => {
      const lists = cs.map(c => byComp.get(c) || []);
      if (!lists.length) return [];
      if (op === 'or') { const seen = new Set(); return lists.flat().filter(t => !seen.has(t.id) && seen.add(t.id)).sort((a, b) => b.n - a.n); }
      const ids = lists.slice(1).map(l => new Set(l.map(t => t.id)));
      return lists[0].filter(t => ids.every(s => s.has(t.id)));
    };
    const readSearch = cs => { const seen = new Set(); return cs.flatMap(c => byRead.get(c) || []).filter(t => !seen.has(t.id) && seen.add(t.id)).sort((a, b) => b.n - a.n); };
    const phonSearch = (pq, onComp) => T.filter(t => onComp ? (t.c || []).some(c => charPhonMatch(c, pq, sysId)) : (readOf(t) && charPhonMatch(readOf(t), pq, sysId)));
    if (!raw) body = '<p class="mut">請輸入檢索詞。</p>';
    else if (mode === 'cat') { const cats = Object.keys(CAT_COLOR); const want = cats.includes(raw) ? raw : (cats.find(k => k.startsWith(raw[0])) || raw); body = `<div class="tabs">${cats.map(k => `<a href="#/s?q=${enc(k)}&m=cat" class="${k === want ? 'on' : ''}">${k}</a>`).join('')}</div>` + group(`自動判定＝${esc(want)}（嚴格層級，任一套）`, F(T.filter(t => t.an && Object.values(t.an).some(a => a.cov && a.t.R0I0[0] === want))), q); }
    else if (mode === 'read') body = group(`釋讀為 ${cj.map(c => zi(c)).join('／')}`, F(readSearch(cj)), q);
    else if (mode === 'comp') body = group(`${q.get('op') === 'or' ? '含任一部件' : '同時含部件'} ${cj.map(c => zi(c)).join(' ')}`, F(compSearch(cj, q.get('op'))), q);
    else if (mode === 'oc' || mode === 'coc' || mode === 'bu') {
      const pq = mode === 'bu' ? { kind: 'bu', v: raw.replace(/部$/, '') } : parsePhon(raw);
      if (mode === 'bu' || mode === 'oc') body += group(`整字讀音：${phonDesc(pq)}`, F(phonSearch(pq, false)), q);
      if (mode === 'bu' || mode === 'coc') body += group(`部件讀音：${phonDesc(pq)}`, F(phonSearch(pq, true)), q);
    } else { // auto
      if (allCJK) {
        if (cj.length === 1) {
          const ch = cj[0]; const c = C[ch];
          body += `<div class="note">${zi(ch, true, 'big')} <a href="#/z/${enc(ch)}">字頁</a>${c ? `　${rdLine(ch)}` : ''}</div>`;
          body += group(`釋讀為 ${zi(ch)} 的字形`, F(readSearch([ch])), q);
          body += group(`含部件 ${zi(ch)} 的字形`, F(compSearch([ch])), q);
          if (byBase.get(ch) && byBase.get(ch).some(t => t.r && t.r !== t.z)) body += group(`字形作 ${zi(ch)} 而借讀為他字`, F(byBase.get(ch).filter(t => t.r && t.r !== t.z)), q);
        } else {
          body += group(`同時含部件 ${cj.map(c => zi(c)).join(' ')} 的字形`, F(compSearch(cj, q.get('op'))), q);
          const whole = byRead.get(raw) || []; if (whole.length) body += group(`釋讀為「${esc(raw)}」（合文）`, F(whole), q);
          body += group(`釋讀為其中任一字`, F(readSearch(cj)), q);
        }
      } else {
        const pq = parsePhon(raw);
        body += group(`整字讀音：${phonDesc(pq)}`, F(phonSearch(pq, false)), q);
        body += group(`部件讀音：${phonDesc(pq)}`, F(phonSearch(pq, true)), q);
      }
    }
    return `<form class="sbar" data-search><input class="q" name="q" value="${esc(raw)}">${modeSelect(mode)}<button type="submit">查詢</button>${filterBar(q, mode)}</form>${body}`;
  }

  // ---------- 字形頁 ----------
  function hitmark(fl) { return fl ? `<span class="${fl[0] ? 'hit' : 'miss'}">聲</span><span class="${fl[1] ? 'hit' : 'miss'}">韻</span>` : ''; }
  function viewType(id, q) {
    q = q || new URLSearchParams(); const only = q.get('src') || '';
    const t = byId.get(id); if (!t) return notFound(id);
    const r = readOf(t);
    const srcs = Object.entries(t.s || {}).sort((a, b) => b[1] - a[1]);
    let h = `<div class="thead"><div><div class="big">${tlabel(t, true)}</div><div>${badges(t)}</div>
      <div class="meta">目錄名 <code>${esc(t.id)}</code></div><div class="meta" style="border:0;padding:0;margin:4px 0 0">${srcLinksOf(t, 99)}${t.sr && t.sr !== 'CHUBS' ? `<span class="badge st">來源 ${esc(t.sr)}</span>` : ''}${t.by ? `<span class="badge">整理 ${esc(t.by)}</span>` : ''}${t.dt ? `<span class="badge">${esc(t.dt)}</span>` : ''}</div>
      ${t.nt ? `<div class="meta">目錄附註：${esc(t.nt)}</div>` : ''}${t.ev ? `<div class="meta">依據：${esc(t.ev)}</div>` : ''}${t.no ? `<div class="meta">備註：${esc(t.no)}</div>` : ''}</div></div>`;
    // 字形
    const order = new Map(srcs.map(([k], i) => [k, i]));
    const shown = (t.im || []).slice().sort((a, b) => (order.get(imgSrcName(a)) ?? 99) - (order.get(imgSrcName(b)) ?? 99) || imgFile(a).localeCompare(imgFile(b)));
    LB.list = shown.map(im => ({ url: imgUrl(t, im), cap: imgCap(im), file: imgFile(im) }));
    const nOnly = only ? shown.filter(im => imgSrcName(im) === only).length : 0;
    h += `<h2 id="gallery">字形 <span class="mut small">${shown.length < t.n ? `${shown.length} / ${t.n} 例` : `${t.n} 例`}</span>
      ${srcs.length > 1 ? `<select data-gfilter class="small"><option value="">全部材料</option>${srcs.map(([k, v]) => `<option value="${esc(k)}"${k === only ? ' selected' : ''}>${esc(k)} ${v}</option>`).join('')}</select>` : ''}</h2>
      ${only ? `<div class="note small">只顯示 <b>${esc(only)}</b> ${nOnly} 例${(t.s && t.s[only] || 0) > nOnly ? `（共 ${t.s[only]} 例）` : ''}　<a href="#/t/${enc(t.id)}?at=gallery">全部材料</a></div>` : ''}
      <div class="gallery">${shown.map((im, i) => `<div class="gitem" data-src="${esc(imgSrcName(im))}"${only && imgSrcName(im) !== only ? ' style="display:none"' : ''}><a href="${imgUrl(t, im)}" data-lb="${i}" title="放大"><img loading="lazy" src="${imgUrl(t, im)}" alt=""></a>${esc(imgCap(im))}</div>`).join('') || '<p class="mut">無圖片</p>'}</div>`;
    // 釋讀
    if (t.k === 'brace' && !t.r) {
      h += `<h2>釋讀 <span class="mut small">無</span></h2>${t.ih ? `<div class="note small">同拆法目錄釋讀為 ${t.ih.map(x => zi(x)).join('／')}（推定）</div>` : ''}`;
    }
    if (r) h += `<h2>釋讀字 ${zi(r)}${t.ra && t.ra.length ? `<span class="mut small">　又：${t.ra.map(x => zi(x)).join('／')}</span>` : ''}</h2>${kaomTable(r)}`;
    // 部件
    if (t.c && t.c.length) {
      const cov = t.an ? SYS.filter(s => t.an[s.id] && t.an[s.id].cov) : [];
      h += `<h2>部件 <span class="mut small">${t.c.length} 個</span></h2><div class="scroll"><table class="tb"><tr><th></th><th>部件</th>${SYS.map(s => `<th>${esc(s.short)}</th>`).join('')}<th>韻符（Schuessler 系列頭字）</th></tr>`;
      t.c.forEach((c, i) => {
        const cc = C[c]; const g = cc && cc.g;
        const yf = (t.yf || []).find(y => y[0] === c);
        h += `<tr><td class="glyph">${g ? `<img src="img/${g[0]}/${enc(g[1])}" alt="" title="該字的楚簡獨體寫法">` : ''}</td><td>${zi(c, true, 'big')}${cc && cc.nm ? `<div class="mut small">歸一為 ${zi(cc.nm)}</div>` : ''}<div class="mut small">${cc && cc.py ? esc(cc.py) : ''}</div></td>`;
        for (const s of SYS) {
          const p = cc && cc.ph[s.id]; const fl = t.an && t.an[s.id] && t.an[s.id].cov ? t.an[s.id].t.R0I0[1][i] : null;
          h += `<td>${p && p.has ? `${ph(p.str)}<div class="small">聲 <span class="ph">${esc(p.C[0].join('/'))}</span> · 韻 ${esc(buOf(c, s.id).map(b => buLabel(b, s.id)).join('/'))}${hitmark(fl)}</div>` : '<span class="mut">無</span>'}</td>`;
        }
        h += `<td>${yf ? `K.${yf[1]} · ${esc(yf[2])} ${esc(yf[3])}${yf[4] === 'same' ? '<span class="hit">與釋讀同韻部</span>' : yf[4] === 'diff' ? '<span class="miss">與釋讀不同韻部</span>' : ''}` : '<span class="mut">—</span>'}</td></tr>`;
      });
      h += `</table></div>`;
      if (t.an) h += verdictBlock(t);
    }
    // 相關
    const same = (byKey.get((t.c || []).join('')) || []).filter(x => x.id !== t.id);
    if (same.length) h += `<h2>同拆法的其他目錄 <span class="mut small">${same.length}</span></h2>${cards(same)}`;
    if (r) {
      const others = (byRead.get(r) || []).filter(x => x.id !== t.id);
      if (others.length) h += `<h2>釋讀為 ${zi(r)} 的其他字形 <span class="mut small">${others.length}</span></h2>${cards(others)}`;
    }
    return h;
  }
  function verdictBlock(t) {
    const sys = SYS.filter(s => t.an[s.id]);
    let h = `<h3>自動判定</h3>
      <div class="scroll"><table class="tb"><tr><th>層級</th>${sys.map(s => `<th>${esc(s.short)}</th>`).join('')}</tr>`;
    for (const key of (M.tiers || ['R0I0', 'R1I0', 'R1I1', 'R2I1'])) {
      h += `<tr><td>${TIERNAME[key] || key}</td>${sys.map(s => { const a = t.an[s.id]; if (!a.cov) return '<td class="mut">部件或整字缺音</td>'; const [cat, fl] = a.t[key]; return `<td><span class="cat" style="--c:${CAT_COLOR[cat] || '#888'}">${cat}</span> <span class="small">${fl.map((f, i) => `${esc(t.c[i])}${hitmark(f)}`).join(' ')}</span></td>`; }).join('')}</tr>`;
    }
    h += `</table></div>`;
    const ct = t.ct || {}; const ctrls = [];
    if (ct.ident) ctrls.push('部件裡含釋讀字本身');
    if (ct.gsr) ctrls.push('某部件與釋讀字同 GSR 諧聲系列（傳統聲符）');
    if (ct.sf) ctrls.push('某部件在鄭張聲符鏈上');
    if (ctrls.length) h += `<div class="note small"><b>控制項：</b>${ctrls.join('；')}</div>`;
    if (t.nb) h += `<div class="note"><b>逐例核對備註：</b>${esc(t.nb)}</div>`;
    return h;
  }

  // ---------- 字頁 ----------
  function kaomTable(ch) {
    const c = C[ch]; if (!c) return `<p class="mut">「${esc(ch)}」查無擬音</p>`;
    const rows = [];
    for (const s of SYS) {
      const p = c.ph[s.id]; const rd = c.rd[s.id] || [];
      if (!rd.length && !(p && p.has)) { rows.push(`<tr><td class="sys">${esc(s.name)}</td><td class="mut" colspan="5">無</td></tr>`); continue; }
      if (s.id === 'BS') rd.forEach((e, i) => rows.push(`<tr><td class="sys">${i ? '' : esc(s.name)}</td><td>${ph(e.oc)}</td><td>${esc(buOf(ch, 'BS').join('/'))}</td><td>聲 <span class="ph">${esc((p.C[0] || []).join('/'))}</span>　類 ${esc((p.C[1] || []).join('/'))}　${esc((p.C[2] || []).join('/'))}</td><td>中古 <span class="ph">${esc(e.mc)}</span> · ${esc(e.py)} · ${esc(e.gl)}</td><td>GSR ${e.gsr ? `<a href="#/series/${enc(e.gsr.replace(/[a-z']+$/, ''))}">${esc(e.gsr)}</a>` : '—'}</td></tr>`));
      else if (s.id === 'SCH') rd.forEach((e, i) => rows.push(`<tr><td class="sys">${i ? '' : esc(s.name)}</td><td>${ph(e.o.join(' ; '))}</td><td>${esc(e.bu)} <span class="ph">${esc(e.rime)}</span> <span class="mut small">第 ${e.sec} 節</span></td><td>聲 <span class="ph">${esc((p.C[0] || []).join('/'))}</span>　類 ${esc((p.C[1] || []).join('/'))}　${esc((p.C[2] || []).join('/'))}</td><td class="mut small">${e.via === 'mandarin' ? '經 Mand. 列回收' : ''}</td><td>K. <a href="#/series/${enc(String(+e.key.replace(/[a-z']+$/, '')))}">${esc(e.key.replace(/^0+/, ''))}</a></td></tr>`));
      else if (s.id === 'ZZ') rd.forEach((e, i) => rows.push(`<tr><td class="sys">${i ? '' : esc(s.name)}</td><td>${ph(e.oc)}</td><td>${zzLabel(e.yb)}</td><td>聲 <span class="ph">${esc((p.C[0] || []).join('/'))}</span>　類 ${esc((p.C[1] || []).join('/'))}　${esc((p.C[2] || []).join('/'))}</td><td>${esc(e.gy)} · ${esc(e.fq)}</td><td>聲符 ${e.sf ? zi(e.sf) : '—'}</td></tr>`));
      else rd.forEach((e, i) => rows.push(`<tr><td class="sys">${i ? '' : esc(s.name)}</td><td>${ph(e.oc)}</td><td>${esc(e.bu)}</td><td>${esc(e.sys)}</td><td>${esc(e.src)} ${esc(e.no)}</td><td>${e.sf ? zi(e.sf) : '—'}</td></tr>`));
    }
    return `<div class="scroll"><table class="kaom"><tr><th>系統</th><th>擬音</th><th>韻部</th><th>聲母／聲類／部位</th><th>其他</th><th>諧聲／聲符</th></tr>${rows.join('')}</table></div>
      ${c.nm ? `<p class="mut small">讀音取自歸一字 ${zi(c.nm)}</p>` : ''}${c.hd ? `<p class="small">韻符：Schuessler K. ${c.hd.ser} 系列頭字，${esc(c.hd.bu)} <span class="ph">${esc(c.hd.rime)}</span>（第 ${c.hd.sec} 節）</p>` : ''}`;
  }
  function viewChar(ch) {
    if (!ch) return notFound('');
    const c = C[ch];
    const asRead = (byRead.get(ch) || []).filter(t => t.k === 'brace'), asCirc = (byRead.get(ch) || []).filter(t => t.k === 'circ'), asComp = byComp.get(ch) || [];
    const base = (byBase.get(ch) || []), jie = byJie.get(ch) || [], own = base.filter(t => !t.r || t.r === t.z), asOther = base.filter(t => t.r && t.r !== t.z);
    const inferred = (byRead.get(ch) || []).filter(t => t.k === 'brace' && !t.r && t.ih && t.ih.includes(ch));
    if (!c && !asRead.length && !asComp.length && !base.length && !jie.length && !asCirc.length) return notFound(ch);
    let h = `<div class="zhead">${c && c.g ? `<a class="glyphbox" href="${own.length ? `#/t/${enc(own[0].id)}?at=gallery` : '#p'}" title="楚簡獨體寫法，點開看全部"><img src="img/${c.g[0]}/${enc(c.g[1])}" alt=""></a>` : ''}<div><div class="huge">${esc(ch)}</div><div class="mut">${c ? esc(c.py || '') : ''} ${c && c.gl ? '· ' + esc(c.gl) : ''} <span class="small">U+${ch.codePointAt(0).toString(16).toUpperCase()}</span></div></div>
      <div class="roles"><a data-scroll="r">釋讀為此字的拆分字形 <b>${asRead.filter(t => t.r === ch).length}</b></a><a data-scroll="c">作為部件 <b>${asComp.length}</b> 型</a><a data-scroll="o">未拆分 <b>${asCirc.length}</b></a><a data-scroll="p">本字寫法 <b>${own.length}</b></a>${jie.length ? `<a data-scroll="j">他字借讀為此字 <b>${jie.length}</b></a>` : ''}</div></div>`;
    h += `<h2>擬音對照</h2>${kaomTable(ch)}`;
    if (c && c.ser && c.ser.length) h += `<h2>GSR 諧聲系列</h2>${c.ser.map(s => seriesChips(s, ch)).join('')}`;
    if (c && c.root && c.root !== ch) h += `<p class="small">鄭張聲符鏈：${esc(ch)} → … → ${zi(c.root)}（根）${c.sf ? `；直接聲符 ${zi(c.sf)}` : ''}</p>`;
    h += `<h2 id="r">釋讀為 ${esc(ch)} 的拆分字形 <span class="mut small">${asRead.filter(t => t.r === ch).length}${inferred.length ? `＋推定 ${inferred.length}` : ''}</span></h2>${cards(asRead.filter(t => t.r === ch))}`;
    if (inferred.length) h += `<h3>同拆法推定（目錄本身無釋讀）</h3>${cards(inferred)}`;
    const alt = asRead.filter(t => t.r !== ch && !(t.ih && t.ih.includes(ch))); if (alt.length) h += `<h3>釋讀附註裡提到 ${esc(ch)}（訛／通／異體）</h3>${cards(alt)}`;
    h += `<h2 id="o">未拆分、釋讀為 ${esc(ch)} <span class="mut small">${asCirc.length}</span></h2>${asCirc.length ? cards(asCirc) : '<p class="mut">無</p>'}`;
    h += `<h2 id="p">本字寫法 <span class="mut small">${own.length} 型${asOther.length ? `；另有 ${asOther.length} 型字形作 ${esc(ch)} 而借讀為他字` : ''}</span></h2>${own.length ? cards(own) : '<p class="mut">無</p>'}${asOther.length ? `<h3>字形作 ${esc(ch)} 而借讀為他字</h3>${cards(asOther)}` : ''}`;
    if (jie.length) h += `<h2 id="j">他字借讀為 ${esc(ch)} <span class="mut small">${jie.length}</span></h2>${cards(jie)}`;
    h += `<h2 id="c">作為部件出現於 <span class="mut small">${asComp.length} 型 · ${asComp.reduce((a, t) => a + t.n, 0)} 圖</span></h2>${asComp.length ? cards(asComp) : '<p class="mut">無</p>'}`;
    return h;
  }
  function seriesChips(ser, cur) {
    const s = SERIES[ser]; if (!s) return '';
    const list = chars(s);
    return `<div class="small mut">K. ${esc(ser)} · ${list.length} 字 <a href="#/series/${enc(ser)}">系列頁</a></div><div class="chips">${list.map(x => `<a href="#/z/${enc(x)}" class="${x === cur ? 'in' : (C[x] ? 'in' : '')}" style="${x === cur ? 'font-weight:700' : ''}">${esc(x)}</a>`).join('')}</div>`;
  }
  function viewSeries(ser) {
    const s = SERIES[ser]; if (!s) return notFound('K. ' + ser);
    const list = chars(s); const inCorpus = list.filter(x => C[x]);
    const types = T.filter(t => (readOf(t) && list.includes(readOf(t))) || (t.c || []).some(c => list.includes(c)));
    return `<h1>GSR 諧聲系列 K. ${esc(ser)}</h1><div class="sub">${list.length} 字 · 本庫 ${inCorpus.length} 字</div>
      <div class="chips">${list.map(x => `<a href="#/z/${enc(x)}" class="${C[x] ? 'in' : ''}">${esc(x)}</a>`).join('')}</div>
      <h2>本庫涉及的字 <span class="mut small">${inCorpus.length}</span></h2><div class="scroll"><table class="list"><tr><th>字</th><th>擬音</th><th>釋讀型</th><th>作部件</th></tr>${inCorpus.map(x => `<tr><td>${zi(x)}</td><td>${rdLine(x)}</td><td>${(byRead.get(x) || []).length}</td><td>${(byComp.get(x) || []).length}</td></tr>`).join('')}</table></div>
      <h2>釋讀或部件屬於此系列的字形 <span class="mut small">${types.length}</span></h2>${cards(types.sort((a, b) => b.n - a.n))}`;
  }

  // ---------- 部件表 ----------
  function viewComps(q) {
    const f = (q.get('f') || '').trim();
    let rows = [...byComp.entries()].map(([c, l]) => ({ c, types: l.length, imgs: l.reduce((a, t) => a + t.n, 0) })).sort((a, b) => b.types - a.types);
    if (f) rows = rows.filter(r => r.c.includes(f) || (C[r.c] && ((C[r.c].py || '').includes(f) || SYS.some(s => normIPA(C[r.c].ph[s.id].str).includes(normIPA(f))))));
    return `<h1>部件表</h1><div class="sub">${byComp.size} 個部件</div>
      <form onsubmit="event.preventDefault();location.hash='#/comps?f='+encodeURIComponent(this.f.value)" class="sbar"><input name="f" value="${esc(f)}" placeholder="篩選：部件字／拼音／擬音片段"><button type="submit">篩選</button></form>
      <div class="scroll"><table class="list"><tr><th>部件</th><th>獨體寫法</th><th>型</th><th>圖</th><th>擬音</th><th>韻部</th></tr>
      ${rows.map(r => { const c = C[r.c]; return `<tr><td>${zi(r.c, true, 'big')}${c && c.nm ? `<span class="mut small"> →${esc(c.nm)}</span>` : ''}</td><td>${c && c.g ? `<img src="img/${c.g[0]}/${enc(c.g[1])}" alt="" style="width:34px;height:40px;object-fit:contain;background:#fff;border:1px solid var(--line);border-radius:4px">` : ''}</td><td><a href="#/s?q=${enc(r.c)}&m=comp">${r.types}</a></td><td>${r.imgs}</td><td class="small">${rdLine(r.c)}</td><td class="small">${SYS.map(s => buOf(r.c, s.id).map(b => buLabel(b, s.id)).join('/')).filter(Boolean).join(' · ')}</td></tr>`; }).join('')}</table></div>`;
  }

  // ---------- 韻部表 ----------
  function rimeIndex(sysId) {
    const m = new Map();
    for (const [ch, c] of Object.entries(C)) for (const b of (c.bu && c.bu[sysId]) || []) push(m, b, ch);
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length);
  }
  function viewRimes(sysId, bu) {
    sysId = sysId || SYS[0].id; const s = SYS.find(x => x.id === sysId) || SYS[0];
    const TABN = { BS: 'Baxter–Sagart（按韻尾折算）', SCH: 'Schuessler（原書 38 節）', ZZ: 'Zhengzhang（原表韻部）', SUP: 'Supplement' };
    let h = `<h1>韻部表</h1><div class="tabs">${SYS.map(x => `<a href="#/rimes/${x.id}" class="${x.id === sysId ? 'on' : ''}">${esc(TABN[x.id] || x.name)}</a>`).join('')}</div>`;
    const idx = rimeIndex(sysId);
    const cell = ([b, l]) => `<a href="#/rimes/${sysId}/${enc(b)}">${esc(buLabel(b, sysId))}<span>${l.length} 字</span></a>`;
    if (!bu) {
      if (sysId === 'ZZ') { const main = idx.filter(([b]) => ZZMAIN.has(b)), sub = idx.filter(([b]) => !ZZMAIN.has(b)); return h + `<div class="rimegrid">${main.map(cell).join('')}</div><h2>去聲小類</h2><div class="rimegrid">${sub.map(cell).join('')}</div>`; }
      return h + `<div class="rimegrid">${idx.map(cell).join('')}</div>`;
    }
    const list = idx.find(([b]) => b === bu); if (!list) return h + notFound(bu);
    const set = new Set(list[1]);
    const whole = T.filter(t => readOf(t) && set.has(readOf(t))).sort((a, b) => b.n - a.n), comp = T.filter(t => (t.c || []).some(c => set.has(c))).sort((a, b) => b.n - a.n);
    return h + `<h2>${esc(s.short)} · ${esc(buLabel(bu, sysId))} <span class="mut small">${list[1].length} 字</span></h2><div class="chips">${list[1].sort().map(x => `<a href="#/z/${enc(x)}">${esc(x)}</a>`).join('')}</div>
      <h2>整字在此韻部 <span class="mut small">${whole.length}</span></h2>${cards(whole)}
      <h2>部件在此韻部 <span class="mut small">${comp.length}</span></h2>${cards(comp)}`;
  }

  // ---------- 放大查看 ----------
  const LB = { list: [], i: 0 };
  function openLB(i) { if (!LB.list.length) return; LB.i = Math.max(0, Math.min(i, LB.list.length - 1)); renderLB(); }
  function closeLB() { const box = document.getElementById('lb'); if (box) box.hidden = true; }
  function stepLB(d) { LB.i = (LB.i + d + LB.list.length) % LB.list.length; renderLB(); }
  function renderLB() {
    let box = document.getElementById('lb');
    if (!box) {
      box = document.createElement('div'); box.id = 'lb'; box.className = 'lb'; document.body.appendChild(box);
      box.addEventListener('click', e => { const nav = e.target.closest('[data-lbnav]'); if (nav) { stepLB(+nav.dataset.lbnav); return; } if (e.target.closest('[data-lbclose]') || !e.target.closest('.lbin')) closeLB(); });
    }
    const it = LB.list[LB.i]; if (!it) return;
    box.innerHTML = `<div class="lbin"><div class="lbimg"><img src="${it.url}" alt=""></div><div class="lbcap">${esc(it.cap)}<div class="mut small">${esc(it.file)} · ${LB.i + 1} / ${LB.list.length}　<a href="${it.url}" target="_blank" rel="noopener">原圖</a></div></div>
      ${LB.list.length > 1 ? '<button class="lbbtn prev" data-lbnav="-1" title="上一張（←）">‹</button><button class="lbbtn next" data-lbnav="1" title="下一張（→）">›</button>' : ''}<button class="lbbtn close" data-lbclose title="關閉（Esc）">×</button></div>`;
    box.hidden = false;
  }
  document.addEventListener('keydown', e => { const box = document.getElementById('lb'); if (!box || box.hidden) return; if (e.key === 'Escape') closeLB(); else if (e.key === 'ArrowLeft') stepLB(-1); else if (e.key === 'ArrowRight') stepLB(1); });
  window.addEventListener('hashchange', closeLB);

  // ---------- 卡片／表格切換 ----------
  function syncVT() { document.querySelectorAll('#vt button').forEach(b => b.classList.toggle('on', b.dataset.view === VIEW())); }
  const $vt = document.getElementById('vt');
  if ($vt) $vt.addEventListener('click', e => { const b = e.target.closest('button[data-view]'); if (!b) return; try { localStorage.setItem('chu_view', b.dataset.view); } catch (e2) { } syncVT(); route(); });
  syncVT();
  route();
})();
