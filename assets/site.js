/* MDM site behaviour: menus, phone navigation, search, the help box, card rails and quote hand-off. */
(function () {
  'use strict';
  const script = document.currentScript;
  const ROOT = script ? script.src.replace(/assets\/site\.js.*$/, '') : '/';
  const AR = document.documentElement.lang === 'ar';

  /* Pages people can search for or be sent to from the help box. */
  const PAGES = [
    ['Check My Part', 'apps/check-my-part.html', 'Open your STL in 3D, get size, volume, mass and a quote', 'stl 3d model cad file check upload part quote estimate mass weight volume ملف قطعة نموذج'],
    ['3D Machining Simulation', 'apps/machining-simulator.html', 'Watch G-code cut a block in 3D', 'gcode g-code cnc milling simulation toolpath machining cycle time محاكاة تشغيل'],
    ['3D Part Viewer', 'apps/part-viewer.html', 'Adjust, section and export parametric parts', '3d viewer part model stl export section mass عارض'],
    ['3D Parts Library', 'apps/parts-library.html', 'Eleven adjustable parts with previews', 'library parts impeller flange gear shaft pulley elbow nut coupling bracket housing مكتبة'],
    ['Fits Calculator', 'apps/fits-calculator.html', 'ISO 286 hole and shaft fits', 'fit fits h7 g6 p6 k6 iso 286 clearance interference bore shaft توافق'],
    ['Cutting Data Calculator', 'apps/cutting-data.html', 'Speed, feed, removal rate and power', 'cutting speed feed rpm vc fz power milling data سرعة تغذية'],
    ['Bolt Circle Calculator', 'apps/bolt-circle.html', 'Hole positions on a pitch circle', 'bolt circle pcd hole pattern coordinates دائرة براغي'],
    ['Thread and Drill Chart', 'apps/thread-chart.html', 'Tap drills and clearance holes, M3 to M24', 'thread tap drill clearance hole metric m6 m8 m10 m12 spanner لولب'],
    ['Tolerance Guide', 'apps/tolerance-guide.html', 'Which process can hold your tolerance', 'tolerance process grinding edm casting machining accuracy تفاوت'],
    ['Sheet Metal Bend Calculator', 'apps/sheet-metal.html', 'Bend allowance, bend deduction and flat length', 'sheet metal bend allowance deduction k-factor flat pattern blank brake press ثني صاج'],
    ['Beam Calculator', 'apps/beam-calculator.html', 'Bending stress and deflection of beams', 'beam deflection stress bending cantilever rhs i-beam section steel structure كمرة انحراف'],
    ['Bolt Torque Calculator', 'apps/bolt-torque.html', 'Tightening torque and clamp force for metric bolts', 'bolt torque preload tightening clamp force fastener 8.8 10.9 12.9 nut factor عزم ربط براغي'],
    ['Pump Calculator', 'apps/pump-calculator.html', 'Pump power, motor size and affinity laws', 'pump power motor kw head flow affinity laws speed impeller trim efficiency مضخة قدرة محرك'],
    ['Engineering apps', 'apps/', 'All free browser apps', 'apps tools calculators تطبيقات'],
    ['Services', 'services.html', 'Design, analysis, reverse engineering, prototyping, manufacturing, inspection', 'services خدمات'],
    ['Mechanical design', 'services.html#design', 'Concept to released CAD and drawings', 'design cad drawing 3d modelling gd&t bom تصميم'],
    ['Engineering analysis', 'services.html#analysis', 'FEA, fatigue and tolerance stack-ups', 'analysis fea stress thermal fatigue simulation stack-up تحليل'],
    ['Reverse engineering', 'services.html#reverse', 'Rebuild parts from samples and scans', 'reverse engineering scan scanning measure old part replacement هندسة عكسية'],
    ['Prototyping', 'services.html#prototyping', '3D printing, machined one-offs, soft tooling', 'prototype prototyping 3d printing نموذج أولي'],
    ['Manufacturing', 'services.html#manufacturing', 'CNC machining, sheet metal, fabrication, casting', 'manufacturing cnc machining turning milling sheet metal welding casting production تصنيع'],
    ['Inspection and documentation', 'services.html#inspection', 'Dimensional inspection and reports', 'inspection cmm measurement quality report first article فحص'],
    ['Materials', 'services.html#materials', 'Common materials and densities', 'materials aluminium steel stainless iron bronze titanium peek pom مواد'],
    ['Steel fabrication', 'industries/steel-fabrication.html', 'Frames, brackets and welded assemblies', 'steel fabrication welding frame structure bracket chassis platform حديد تصنيع معدني'],
    ['Pumps and fluid handling', 'industries/pumps.html', 'Impellers, housings, shafts and seals', 'pump pumps impeller casing housing fluid water مضخة مضخات'],
    ['Oil, gas and piping', 'industries/oil-gas-piping.html', 'Flanges, fittings and threaded pipe work', 'oil gas pipe piping flange fitting elbow thread valve نفط غاز أنابيب'],
    ['Industrial machinery', 'industries/industrial-machinery.html', 'Gears, shafts, pulleys and machine parts', 'machinery machine gear gearbox shaft pulley bearing conveyor آلات'],
    ['Automotive and transport', 'industries/automotive.html', 'Vehicle, truck and off-highway parts', 'automotive car truck vehicle transport off-highway hub bracket سيارات نقل'],
    ['Insights', 'insights/', 'Practical engineering articles', 'insights articles guide blog مقالات'],
    ['Choosing the right tolerance', 'insights/choosing-tolerances.html', 'Article: tighter is not always better', 'tolerance cost article'],
    ['Preparing an STL for a quote', 'insights/preparing-stl-for-quote.html', 'Article: export a model that quotes cleanly', 'stl export mesh article quote'],
    ['Hole and shaft fits explained', 'insights/understanding-fits.html', 'Article: clearance, transition and interference', 'fits h7 article'],
    ['Request a quote', '#quote', 'Tell us what you need to make', 'quote price cost request contact email order عرض سعر تواصل'],
  ];
  const home = AR ? 'ar/' : '';
  const href = u => (u.startsWith('#') ? ROOT + home + u : ROOT + u);
  function rank(q) {
    const words = q.toLowerCase().split(/[^\p{L}\p{N}&.-]+/u).filter(w => w.length > 1);
    if (!words.length) return [];
    return PAGES.map(p => {
      const hay = `${p[0]} ${p[2]} ${p[3]}`.toLowerCase();
      let score = 0;
      words.forEach(w => { if (hay.includes(w)) score += p[0].toLowerCase().includes(w) ? 3 : 1; });
      return [score, p];
    }).filter(r => r[0] > 0).sort((a, b) => b[0] - a[0]).map(r => r[1]);
  }

  /* ---------- Menus ---------- */
  const header = document.getElementById('site-header');
  const nav = document.getElementById('main-nav');
  const menuBtn = document.getElementById('menu-open');
  const megaItems = [...document.querySelectorAll('.has-mega')];
  function closeAll(except) {
    megaItems.forEach(li => {
      if (li === except) return;
      li.classList.remove('open');
      const b = li.querySelector('.nav-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }
  megaItems.forEach(li => {
    const btn = li.querySelector('.nav-btn');
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const open = !li.classList.contains('open');
      closeAll(li);
      li.classList.toggle('open', open);
      btn.setAttribute('aria-expanded', String(open));
    });
  });
  document.addEventListener('click', e => { if (header && !header.contains(e.target)) closeAll(); });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = megaItems.find(li => li.classList.contains('open'));
    closeAll();
    if (open) open.querySelector('.nav-btn').focus();
    closeSearch();
  });
  if (menuBtn && nav) {
    menuBtn.addEventListener('click', () => {
      const open = !nav.classList.contains('open');
      nav.classList.toggle('open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    nav.addEventListener('click', e => {
      if (e.target.closest('a')) { nav.classList.remove('open'); menuBtn.setAttribute('aria-expanded', 'false'); document.body.style.overflow = ''; }
    });
  }

  /* ---------- Search ---------- */
  const search = document.getElementById('search');
  const searchInput = document.getElementById('search-input');
  const results = document.getElementById('search-results');
  let lastFocus = null;
  function render(q) {
    const list = q.trim() ? rank(q).slice(0, 8) : PAGES.slice(0, 6);
    results.innerHTML = '';
    if (!list.length) {
      const p = document.createElement('p');
      p.className = 'search-empty';
      p.textContent = AR ? 'لا توجد نتائج. جرّب كلمة أخرى أو اطلب عرض سعر.' : 'Nothing matches. Try another word, or request a quote.';
      results.append(p);
      return;
    }
    list.forEach(p => {
      const a = document.createElement('a');
      a.href = href(p[1]);
      a.innerHTML = '<b></b><span></span>';
      a.querySelector('b').textContent = p[0];
      a.querySelector('span').textContent = p[2];
      results.append(a);
    });
  }
  function openSearch() {
    if (!search) return;
    lastFocus = document.activeElement;
    search.hidden = false;
    render('');
    searchInput.value = '';
    searchInput.focus();
  }
  function closeSearch() {
    if (!search || search.hidden) return;
    search.hidden = true;
    if (lastFocus) lastFocus.focus();
  }
  const searchBtn = document.getElementById('search-open');
  if (searchBtn && search) {
    searchBtn.addEventListener('click', openSearch);
    search.addEventListener('click', e => { if (e.target === search) closeSearch(); });
    document.getElementById('search-close').addEventListener('click', closeSearch);
    searchInput.addEventListener('input', () => render(searchInput.value));
    searchInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') { const first = results.querySelector('a'); if (first) location.href = first.href; }
      if (e.key === 'ArrowDown') { const first = results.querySelector('a'); if (first) { e.preventDefault(); first.focus(); } }
    });
  }

  /* ---------- Help box: send people to the right page, or to the quote form ---------- */
  const help = document.getElementById('help-form');
  if (help) {
    help.addEventListener('submit', e => {
      e.preventDefault();
      const q = document.getElementById('help-input').value.trim();
      const note = document.getElementById('help-note');
      if (!q) { note.textContent = AR ? 'اكتب ما تحتاجه، مثل «قطعة مضخة» أو «فحص ملف STL».' : 'Type what you need, such as "pump part" or "check my STL file".'; return; }
      const best = rank(q).filter(p => p[1] !== '#quote')[0];
      if (best) { location.href = href(best[1]); return; }
      try { sessionStorage.setItem('mdm-prefill', JSON.stringify({ message: q })); } catch (err) { /* prefill is optional */ }
      location.href = href('#quote');
      const box = document.getElementById('f-msg');
      if (box) { box.value = q; box.focus(); }
    });
  }

  /* ---------- Rails ---------- */
  document.querySelectorAll('[data-rail]').forEach(wrap => {
    const rail = wrap.querySelector('.rail');
    const step = () => (rail.firstElementChild ? rail.firstElementChild.getBoundingClientRect().width + 20 : 300) * (AR ? -1 : 1);
    const prev = wrap.querySelector('[data-prev]'), next = wrap.querySelector('[data-next]');
    if (prev) prev.addEventListener('click', () => rail.scrollBy({ left: -step(), behavior: 'smooth' }));
    if (next) next.addEventListener('click', () => rail.scrollBy({ left: step(), behavior: 'smooth' }));
  });

  /* ---------- Quote form prefill from other pages ---------- */
  let prefill = null;
  try { prefill = JSON.parse(sessionStorage.getItem('mdm-prefill') || 'null'); } catch (err) { prefill = null; }
  if (prefill && document.getElementById('rfq')) {
    if (prefill.message && document.getElementById('f-msg') && !document.getElementById('f-msg').value) document.getElementById('f-msg').value = prefill.message;
    if (prefill.tolerance && document.getElementById('f-tol')) document.getElementById('f-tol').value = prefill.tolerance;
    try { sessionStorage.removeItem('mdm-prefill'); } catch (err) { /* nothing to clear */ }
  }

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });
})();
