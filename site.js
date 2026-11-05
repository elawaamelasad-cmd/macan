/* MACAN — page behaviour. Progressive enhancement: without this file every CTA is a working WhatsApp link,
 * every section is visible and the hero shows the finished pergola. No dependencies. */
import { SERVICES, COMMON, buildMessage, buildWhatsAppUrl } from './quote.js';

window.__macan = true;

const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const saveData = Boolean(navigator.connection && navigator.connection.saveData);
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const store = {
  get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode etc. */ } },
};

/* one rAF-throttled scroll loop for everything that tracks scroll position */
const scrollFns = [];
let ticking = false;
const runScroll = () => { ticking = false; const y = window.scrollY; scrollFns.forEach((fn) => fn(y)); };
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } }, { passive: true });
addEventListener('resize', () => requestAnimationFrame(runScroll), { passive: true });

const inView = (el, cb, opts = {}) => {
  if (!('IntersectionObserver' in window)) { cb(el, true); return () => {}; }
  const io = new IntersectionObserver((entries) => entries.forEach((e) => cb(e.target, e.isIntersecting, e)), opts);
  io.observe(el);
  return () => io.disconnect();
};

/* ------------------------------------------------------------------ nav */
function initNav() {
  const nav = $('[data-nav]');
  let lastY = window.scrollY;
  scrollFns.push((y) => {
    nav.classList.toggle('is-scrolled', y > 12);
    const goingDown = y > lastY + 4, goingUp = y < lastY - 4;
    if (goingDown && y > 420) nav.classList.add('is-hidden');
    else if (goingUp || y < 200) nav.classList.remove('is-hidden');
    if (goingDown || goingUp) lastY = y;
  });
  // highlight the section being read
  const links = new Map($$('.nav-links a').map((a) => [a.getAttribute('href').slice(1), a]));
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        const a = links.get(e.target.id);
        if (a && e.isIntersecting) { links.forEach((l) => l.classList.remove('is-current')); a.classList.add('is-current'); }
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    links.forEach((_, id) => { const s = document.getElementById(id); if (s) io.observe(s); });
  }
}

function initMenu() {
  const menu = $('#menu');
  const openBtn = $('[data-menu-open]');
  if (!menu || typeof menu.showModal !== 'function') return;
  openBtn.addEventListener('click', () => { menu.showModal(); openBtn.setAttribute('aria-expanded', 'true'); });
  menu.addEventListener('close', () => openBtn.setAttribute('aria-expanded', 'false'));
  $('[data-menu-close]', menu).addEventListener('click', () => menu.close());
  $$('.menu-links a', menu).forEach((a) => a.addEventListener('click', (e) => {
    const target = document.querySelector(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    menu.close();
    target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
    history.replaceState(null, '', a.getAttribute('href'));
  }));
}

/* ------------------------------------------------------------------ reveal + counters */
function initReveal() {
  const items = $$('.reveal');
  if (reduce || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
  items.forEach((el) => {
    const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
    el.style.setProperty('--d', `${Math.min(sibs.indexOf(el), 5) * 0.08}s`);
  });
  const io = new IntersectionObserver((entries) => entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
  }), { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
  items.forEach((el) => io.observe(el));
}

function initCounters() {
  if (reduce) return;
  $$('[data-count]').forEach((el) => {
    const end = +el.dataset.count;
    const stop = inView(el, (_, seen) => {
      if (!seen) return;
      stop();
      const t0 = performance.now(), dur = 1500;
      const tick = (t) => {
        const k = clamp((t - t0) / dur, 0, 1);
        el.textContent = String(Math.round(end * (1 - Math.pow(1 - k, 3))));
        if (k < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.6 });
  });
}

/* ------------------------------------------------------------------ hero: drawing → gold sweep → reality */
function initStage() {
  const stage = $('[data-stage]');
  if (!stage) return;
  const frame = $('.stage-frame', stage);
  const after = $('.stage-after', stage);
  const sweep = $('.stage-sweep', stage);
  const chip = $('[data-chip]', stage);
  const replay = $('[data-replay]', stage);
  const SLANT = 24; // the reveal edge leans by this % of the width
  let raf = 0, timers = [], running = false;

  const setPhase = (phase, label) => { stage.dataset.phase = phase; chip.textContent = label; };
  const cancel = () => { cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers = []; };
  const finish = () => {
    cancel(); running = false;
    stage.classList.remove('is-draft');
    stage.classList.add('is-done');
    after.style.clipPath = '';
    sweep.style.opacity = '0';
    setPhase('after', matchMedia('(min-width: 960px)').matches ? 'بعد' : 'بعد · من شغلنا');
    replay.hidden = false;
  };

  function sweepIn() {
    const W = frame.clientWidth, H = frame.clientHeight, bandW = sweep.offsetWidth;
    const skew = -Math.atan(((SLANT / 100) * W) / H); // band leans exactly like the reveal edge
    const dur = 1500, t0 = performance.now();
    sweep.style.opacity = '1';
    const tick = (t) => {
      const k = clamp((t - t0) / dur, 0, 1), e = easeInOut(k);
      const top = lerp(100 + SLANT + 6, -8, e), bottom = top - SLANT;
      after.style.clipPath = `polygon(${top}% 0, 100% 0, 100% 100%, ${bottom}% 100%)`;
      const mid = (((top + bottom) / 2) / 100) * W;
      sweep.style.transform = `translateX(${mid - bandW / 2}px) skewX(${skew}rad)`;
      if (k > 0.5 && stage.dataset.phase !== 'after') setPhase('after', 'بعد');
      if (k < 1) raf = requestAnimationFrame(tick); else finish();
    };
    raf = requestAnimationFrame(tick);
  }

  function play() {
    cancel(); running = true;
    replay.hidden = true;
    stage.classList.remove('is-done', 'is-draft');
    after.style.clipPath = 'inset(0 0 0 100%)';
    sweep.style.opacity = '0';
    setPhase('before', 'قبل');
    void stage.offsetWidth; // restart CSS transitions
    timers.push(setTimeout(() => { stage.classList.add('is-draft'); setPhase('draft', 'الرسمة'); }, 500));
    timers.push(setTimeout(sweepIn, 500 + 2350));
  }

  replay.addEventListener('click', play);
  frame.addEventListener('click', (e) => { if (running && !e.target.closest('[data-replay]')) finish(); }); // tap to skip

  if (reduce) { finish(); return; }
  const rect = frame.getBoundingClientRect();
  if (rect.bottom < 80 || rect.top > innerHeight) { finish(); return; } // page restored mid-way: no show
  setPhase('before', 'قبل');
  const ready = $$('img', stage).slice(0, 2).map((img) => (img.decode ? img.decode().catch(() => {}) : Promise.resolve()));
  const timeout = new Promise((r) => setTimeout(r, 2600));
  Promise.race([Promise.all(ready), timeout]).then(play);
}

/* ------------------------------------------------------------------ service line drawings */
function initDrawings() {
  $$('[data-draw]').forEach((card) => {
    if (reduce) { card.classList.add('is-drawn'); return; }
    const stop = inView(card, (_, seen) => { if (seen) { card.classList.add('is-drawn'); stop(); } }, { threshold: 0.35 });
  });
}

/* ------------------------------------------------------------------ before / after */
const BA = {
  wood: { before: 'roof-before', after: 'roof-wood', desc: 'برجولة خشب بإضاءة مدفونة', alt: 'السطح بعد تركيب برجولة خشب بإضاءة مدفونة' },
  shade: { before: 'roof-before-orig', after: 'roof-shade', desc: 'مظلة قماش للسطح', alt: 'السطح بعد تركيب مظلة قماش' },
};
const srcset = (base, ext) => [480, 640, 820, 933].map((w) => `${base}-${w}.${ext} ${w}w`).join(', ');
function setPicture(picture, base, alt) {
  const source = $('source', picture), img = $('img', picture);
  source.srcset = srcset(base, 'avif');
  img.srcset = srcset(base, 'webp');
  img.src = `${base}-820.webp`;
  if (alt) img.alt = alt;
  return img.decode ? img.decode().catch(() => {}) : Promise.resolve();
}

function initSlider() {
  const root = $('[data-ba-root]');
  if (!root) return;
  const range = $('.ba-range', root);
  const set = (pct) => {
    pct = clamp(pct, 0, 100);
    root.style.setProperty('--pos', `${pct}%`);
    range.value = String(Math.round(pct));
    range.setAttribute('aria-valuetext', `${Math.round(100 - pct)}٪ قبل`);
  };
  const fromX = (x) => { const r = root.getBoundingClientRect(); set(((x - r.left) / r.width) * 100); };

  // mouse/pen drag immediately; touch only once the gesture is clearly horizontal (vertical scroll stays scroll)
  let dragging = false, pending = null, hintRaf = 0;
  const capture = (id) => { try { root.setPointerCapture(id); } catch { /* pointer gone */ } };
  root.addEventListener('pointerdown', (e) => {
    cancelAnimationFrame(hintRaf);
    if (e.pointerType === 'touch') { pending = { x: e.clientX, y: e.clientY, id: e.pointerId }; return; }
    dragging = true; root.classList.add('is-dragging'); capture(e.pointerId); fromX(e.clientX);
  });
  root.addEventListener('pointermove', (e) => {
    if (pending) {
      const dx = Math.abs(e.clientX - pending.x), dy = Math.abs(e.clientY - pending.y);
      if (dx < 6 && dy < 6) return;
      const id = pending.id; pending = null;
      if (dx > dy) { dragging = true; root.classList.add('is-dragging'); capture(id); }
    }
    if (dragging) fromX(e.clientX);
  });
  const stop = () => { dragging = false; pending = null; root.classList.remove('is-dragging'); };
  root.addEventListener('pointerup', stop);
  root.addEventListener('pointercancel', stop);
  range.addEventListener('input', () => set(+range.value));

  // wood / fabric toggle
  const seg = $('.seg'), btns = $$('[data-ba]'), desc = $('[data-ba-desc]');
  const afterPic = $('.ba-after', root), beforePic = $('.ba-before picture', root);
  btns.forEach((btn) => btn.addEventListener('click', async () => {
    const key = btn.dataset.ba;
    if (btn.classList.contains('is-on')) return;
    btns.forEach((b) => { const on = b === btn; b.classList.toggle('is-on', on); b.setAttribute('aria-pressed', String(on)); });
    seg.dataset.on = key;
    desc.textContent = BA[key].desc;
    root.classList.add('is-swapping');
    await Promise.all([setPicture(afterPic, BA[key].after, BA[key].alt), setPicture(beforePic, BA[key].before)]);
    root.classList.remove('is-swapping');
  }));

  // a gentle hint sweep the first time the slider is seen
  if (!reduce) {
    const stopHint = inView(root, (_, seen) => {
      if (!seen) return;
      stopHint();
      setTimeout(() => {
        const t0 = performance.now();
        const hint = (t) => {
          if (dragging) return;
          const k = clamp((t - t0) / 1900, 0, 1);
          set(50 + Math.sin(k * Math.PI * 2) * 20 * (1 - k));
          if (k < 1) hintRaf = requestAnimationFrame(hint);
        };
        hintRaf = requestAnimationFrame(hint);
      }, 450);
    }, { threshold: 0.6 });
  }
}

/* ------------------------------------------------------------------ reels */
function initReels() {
  const reels = $$('[data-reel]');
  const autoplay = !reduce && !saveData;
  reels.forEach((reel) => {
    const video = $('video', reel), playBtn = $('[data-reel-play]', reel), soundBtn = $('[data-reel-sound]', reel), bar = $('.reel-bar i', reel);
    let raf = 0, userPaused = false;
    const load = () => { if (!video.src) { video.src = video.dataset.src; } };
    const progress = () => { if (video.duration) bar.style.setProperty('--p', (video.currentTime / video.duration).toFixed(4)); raf = requestAnimationFrame(progress); };
    const play = () => { load(); const p = video.play(); if (p) p.catch(() => {}); };
    video.addEventListener('play', () => { reel.classList.add('is-playing'); cancelAnimationFrame(raf); raf = requestAnimationFrame(progress); });
    video.addEventListener('pause', () => { reel.classList.remove('is-playing'); cancelAnimationFrame(raf); });
    playBtn.addEventListener('click', () => { userPaused = false; play(); });
    video.addEventListener('click', () => { if (video.paused) { userPaused = false; play(); } else { userPaused = true; video.pause(); } });
    soundBtn.addEventListener('click', () => {
      const on = video.muted;
      reels.forEach((r) => { const v = $('video', r); if (v !== video) { v.muted = true; $('[data-reel-sound]', r).setAttribute('aria-pressed', 'false'); } });
      video.muted = !on;
      soundBtn.setAttribute('aria-pressed', String(on));
      soundBtn.setAttribute('aria-label', on ? 'اكتم الصوت' : 'شغّل الصوت');
    });
    const stopPoster = inView(reel, (_, near) => { if (near) { video.poster = video.dataset.poster; stopPoster(); } }, { rootMargin: '900px 0px' });
    inView(reel, (_, seen) => {
      if (seen && autoplay && !userPaused) play();
      else if (!seen && !video.paused) video.pause();
    }, { threshold: 0.55 });
  });
}

/* ------------------------------------------------------------------ story rail (phones) */
function initStory() {
  const root = $('[data-story]');
  if (!root) return;
  const rail = $('.story-rail', root), cards = $$('.story-card', root), bars = $$('.story-bars i', root);
  let active = 0, auto = !reduce, timer = 0, t0 = 0;
  const DUR = 4800;
  const scrollable = () => rail.scrollWidth > rail.clientWidth + 4;
  const paint = (fill) => bars.forEach((b, i) => b.style.setProperty('--fill', i < active ? 1 : i === active ? fill : 0));
  // align a card's start (right edge, RTL) with the rail's padded start — works whatever sign scrollLeft uses
  const goTo = (i) => {
    active = clamp(i, 0, cards.length - 1);
    const rr = rail.getBoundingClientRect(), cr = cards[active].getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(rail).paddingRight) || 0;
    rail.scrollBy({ left: cr.right - (rr.right - pad), behavior: reduce ? 'auto' : 'smooth' });
  };
  const stopAuto = () => { auto = false; cancelAnimationFrame(timer); paint(1); };
  const tick = (t) => {
    if (!auto) return;
    const k = clamp((t - t0) / DUR, 0, 1);
    paint(k);
    if (k >= 1) {
      if (active >= cards.length - 1) { stopAuto(); return; }
      goTo(active + 1); t0 = t;
    }
    timer = requestAnimationFrame(tick);
  };
  // which card is in front
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => {
      if (e.isIntersecting) { const i = cards.indexOf(e.target); if (i !== active) { active = i; if (!auto) paint(1); t0 = performance.now(); } }
    }), { root: rail, threshold: 0.6 });
    cards.forEach((c) => io.observe(c));
  }
  ['pointerdown', 'wheel', 'keydown', 'touchstart'].forEach((ev) => rail.addEventListener(ev, stopAuto, { passive: true }));
  $('[data-story-prev]', root).addEventListener('click', () => { stopAuto(); goTo(active - 1); });
  $('[data-story-next]', root).addEventListener('click', () => { stopAuto(); goTo(active + 1); });
  inView(root, (_, seen) => {
    cancelAnimationFrame(timer);
    if (seen && auto && scrollable()) { t0 = performance.now(); timer = requestAnimationFrame(tick); }
  }, { threshold: 0.5 });
  paint(0);
}

/* ------------------------------------------------------------------ process line */
function initSteps() {
  const steps = $('[data-steps]');
  if (!steps) return;
  if (reduce) { steps.style.setProperty('--progress', 1); return; }
  scrollFns.push(() => {
    const r = steps.getBoundingClientRect(), vh = innerHeight;
    steps.style.setProperty('--progress', clamp((vh * 0.78 - r.top) / (r.height + vh * 0.1), 0, 1).toFixed(3));
  });
}

/* ------------------------------------------------------------------ quote anatomy: legend ↔ pins */
function initAnatomy() {
  const legend = $$('[data-legend]');
  if (!legend.length) return;
  const pins = $$('.doc .pin');
  let tour = 0, touring = false;
  const hot = (n) => {
    legend.forEach((li) => li.classList.toggle('is-hot', li.dataset.legend === n));
    pins.forEach((p) => p.classList.toggle('is-hot', p.dataset.pin === n));
  };
  const endTour = () => { touring = false; clearTimeout(tour); };
  legend.forEach((li) => {
    li.addEventListener('pointerenter', () => { endTour(); hot(li.dataset.legend); });
    li.addEventListener('pointerleave', () => hot(null));
    li.addEventListener('click', () => { endTour(); hot(li.dataset.legend); });
  });
  if (reduce) return;
  const doc = $('.doc');
  const stop = inView(doc, (_, seen) => {
    if (!seen) return;
    stop(); touring = true;
    let n = 1;
    const next = () => {
      if (!touring) return;
      if (n > legend.length) { hot(null); touring = false; return; }
      hot(String(n++));
      tour = setTimeout(next, 1100);
    };
    tour = setTimeout(next, 600);
  }, { threshold: 0.45 });
}

/* ------------------------------------------------------------------ statement: words fill as you scroll */
function initStatement() {
  const el = $('[data-statement]');
  if (!el) return;
  const sr = document.createElement('span'); // screen readers get the sentence once; the animated words are hidden
  sr.className = 'sr-only';
  sr.textContent = el.textContent.replace(/\s+/g, ' ').trim();
  let n = 0;
  [...el.childNodes].forEach((node) => {
    if (node.nodeType !== Node.TEXT_NODE) return; // keep the <br>
    const frag = document.createDocumentFragment();
    node.textContent.split(/ +/).filter(Boolean).forEach((w, i) => { // plain spaces only: nbsp keeps «مش أي مكان» whole
      if (i) frag.append(' ');
      const s = document.createElement('span');
      s.className = n++ < 3 ? 'w is-gold' : 'w';
      s.setAttribute('aria-hidden', 'true');
      s.textContent = w;
      frag.append(s);
    });
    node.replaceWith(frag);
  });
  $$('br', el).forEach((br) => br.setAttribute('aria-hidden', 'true'));
  el.prepend(sr);
  const spans = $$('.w', el);
  if (reduce) { spans.forEach((s) => s.classList.add('is-lit')); return; }
  scrollFns.push(() => {
    const r = el.getBoundingClientRect(), vh = innerHeight;
    const k = clamp((vh * 0.82 - r.top) / (r.height + vh * 0.32), 0, 1);
    const lit = Math.round(k * spans.length);
    spans.forEach((s, i) => s.classList.toggle('is-lit', i < lit));
  });
}

/* ------------------------------------------------------------------ FAQ: smooth single-open accordion */
function initFaq() {
  const items = $$('[data-faq] details');
  items.forEach((d) => {
    const summary = $('summary', d), body = $('.faq-a', d);
    let anim = null;
    const run = (from, to, done) => {
      if (anim) anim.cancel();
      if (reduce || !body.animate) { done && done(); return; }
      anim = body.animate([{ height: `${from}px`, opacity: from ? 1 : 0 }, { height: `${to}px`, opacity: to ? 1 : 0 }], { duration: 380, easing: 'cubic-bezier(.2,.7,.1,1)' });
      anim.onfinish = () => { anim = null; done && done(); };
    };
    const close = () => { const h = body.offsetHeight; run(h, 0, () => { d.open = false; }); };
    summary.addEventListener('click', (e) => {
      e.preventDefault();
      if (d.open) { close(); return; }
      items.forEach((o) => { if (o !== d && o.open) o.querySelector('summary').click(); });
      d.open = true;
      run(0, body.scrollHeight);
    });
  });
}

/* ------------------------------------------------------------------ phone dock */
function initDock() {
  const dock = $('[data-dock]'), hero = $('.hero'), contact = $('#contact'), footer = $('.footer');
  if (!dock) return;
  let nearEnd = false;
  const update = (y) => dock.classList.toggle('is-on', y > hero.offsetHeight * 0.65 && !nearEnd);
  if ('IntersectionObserver' in window) {
    const seen = new Set();
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => (e.isIntersecting ? seen.add(e.target) : seen.delete(e.target)));
      nearEnd = seen.size > 0; update(window.scrollY);
    }, { threshold: 0.15 });
    [contact, footer].forEach((el) => el && io.observe(el));
  }
  scrollFns.push(update);
}

/* ------------------------------------------------------------------ quote dialog */
const ICONS = {
  finishing: '<path d="M8 40V20L24 8l16 12v20"/><path d="M18 40V28h12v12"/><path d="M4 40h40"/>',
  pergola: '<path d="M6 14h36"/><path d="M10 14v28M38 14v28"/><path d="M10 20h28M14 14v6M20 14v6M26 14v6M32 14v6"/><path d="M4 42h40"/>',
  renovation: '<path d="M30 6l12 12-20 20H10V26z"/><path d="M26 10l12 12"/><path d="M6 42h36"/>',
};
const STEP_TITLES = ['عايز تعمل إيه؟', 'شوية تفاصيل', 'فين وإمتى؟', 'رسالتك جاهزة 👌'];
const STORE_KEY = 'macan-quote-v1';

function chipsHTML(field, saved) {
  const multi = field.type === 'multi';
  const opts = Object.entries(field.options).map(([v, label]) => {
    const checked = multi ? (saved[field.key] || []).includes(v) : saved[field.key] === v;
    return `<label class="chip"><input type="${multi ? 'checkbox' : 'radio'}" name="${field.key}" value="${v}"${checked ? ' checked' : ''}><span class="chip-face">${label}</span></label>`;
  }).join('');
  return `<fieldset class="qd-field"><legend class="qd-q">${field.q}${multi ? ' <small>(اختار أكتر من حاجة)</small>' : ''}</legend><div class="chips">${opts}</div></fieldset>`;
}
function fieldHTML(field, saved) {
  if (field.type === 'toggle') {
    return `<label class="switch qd-field"><span class="qd-q" style="margin:0">${field.q}</span><input type="checkbox" name="${field.key}"${saved[field.key] ? ' checked' : ''}><span class="switch-ui" aria-hidden="true"></span></label>`;
  }
  return chipsHTML(field, saved);
}

function initQuote() {
  const dlg = $('#quote');
  if (!dlg || typeof dlg.showModal !== 'function') return; // very old browsers: the WhatsApp links still work
  const form = $('form', dlg);
  const title = $('[data-step-title]', dlg), stepNum = $('[data-step-num]', dlg), bar = $('[data-progress]', dlg);
  const steps = $$('.qd-step', dlg), body = $('[data-qd-body]', dlg);
  const back = $('[data-qd-back]', dlg), next = $('[data-qd-next]', dlg), send = $('[data-qd-send]', dlg);
  const preview = $('[data-preview]', dlg), note = $('.qd-note', dlg), fieldsBox = $('[data-fields]', dlg);
  const saved = store.get(STORE_KEY) || {};
  let step = 1, pushed = false, opener = null;

  // step 1: services
  $('[data-services]', dlg).innerHTML = Object.entries(SERVICES).map(([key, s]) => `
    <label class="opt-card"><input type="radio" name="service" value="${key}"${saved.service === key ? ' checked' : ''}>
      <span class="opt-ico" aria-hidden="true"><svg viewBox="0 0 48 48">${ICONS[key]}</svg></span>
      <span><span class="opt-title">${s.title}</span><span class="opt-hint">${s.hint}</span></span>
      <span class="opt-check" aria-hidden="true"><svg class="ico"><use href="#i-check"/></svg></span></label>`).join('');
  // step 3: timing chips (area + name inputs live in the HTML)
  $('[data-common]', dlg).innerHTML = COMMON.filter((f) => f.type !== 'text').map((f) => chipsHTML(f, saved)).join('');
  form.elements.area.value = saved.area || '';
  form.elements.name.value = saved.name || '';

  const answers = () => {
    const fd = new FormData(form);
    const a = { service: fd.get('service') || undefined, area: fd.get('area') || '', name: fd.get('name') || '', timing: fd.get('timing') || undefined };
    const svc = SERVICES[a.service];
    if (svc) svc.fields.forEach((f) => {
      if (f.type === 'single') a[f.key] = fd.get(f.key) || undefined;
      else if (f.type === 'multi') a[f.key] = fd.getAll(f.key);
      else if (f.type === 'toggle') a[f.key] = fd.get(f.key) === 'on';
    });
    return a;
  };
  const persist = () => store.set(STORE_KEY, { ...store.get(STORE_KEY), ...answers() });
  const renderFields = () => {
    const svc = SERVICES[form.elements.service.value];
    const now = { ...(store.get(STORE_KEY) || {}), ...answers() };
    fieldsBox.innerHTML = svc ? svc.fields.map((f) => fieldHTML(f, now)).join('') : '';
  };

  function show(n, dir = 1) {
    step = n;
    steps.forEach((s) => {
      const on = +s.dataset.step === n;
      s.hidden = !on;
      if (on) { s.classList.toggle('is-back', dir < 0); s.style.animation = 'none'; void s.offsetWidth; s.style.animation = ''; }
    });
    title.textContent = STEP_TITLES[n - 1];
    stepNum.textContent = String(n);
    bar.style.width = `${n * 25}%`;
    back.hidden = n === 1;
    next.hidden = n === 4;
    send.hidden = n !== 4;
    next.textContent = n === 3 ? 'شوف الرسالة' : 'التالي';
    next.disabled = n === 1 && !form.elements.service.value;
    if (n === 4) {
      const a = answers();
      preview.textContent = buildMessage(a);
      send.href = buildWhatsAppUrl(a);
      note.classList.remove('is-sent');
      note.textContent = 'ده اللي هيتبعت — تقدر تعدّل عليه في واتساب قبل ما تبعته.';
    }
    body.scrollTop = 0;
    title.focus({ preventScroll: true });
  }

  let closeGen = 0, swallowPops = 0;
  function open(service) {
    closeGen++; // cancels any close animation still pending from a quick close → reopen
    dlg.classList.remove('is-closing');
    opener = document.activeElement;
    const menu = $('#menu');
    if (menu && menu.open) menu.close();
    if (service && SERVICES[service]) {
      form.elements.service.value = service;
      renderFields();
      show(2);
    } else {
      renderFields();
      show(1);
    }
    if (!dlg.open) dlg.showModal();
    title.focus({ preventScroll: true });
    if (!pushed) { history.pushState({ macanQuote: true }, ''); pushed = true; }
  }
  function animateClose() {
    if (!dlg.open) return;
    const gen = ++closeGen;
    const done = () => { if (gen !== closeGen || !dlg.open) return; dlg.classList.remove('is-closing'); dlg.close(); };
    if (reduce) { done(); return; }
    dlg.classList.add('is-closing');
    dlg.addEventListener('animationend', done, { once: true });
    setTimeout(done, 500);
  }
  // The dialog owns one history entry so the phone's back button closes it. Our own history.back()
  // (after ✕ / Esc / backdrop) is swallowed, so a quick reopen is never closed by a late popstate.
  const requestClose = () => {
    if (pushed) { pushed = false; swallowPops++; history.back(); }
    animateClose();
  };
  addEventListener('popstate', () => {
    if (swallowPops) { swallowPops--; return; }
    if (pushed) { pushed = false; animateClose(); }
  });
  dlg.addEventListener('close', () => { if (opener && opener.focus) opener.focus({ preventScroll: true }); });
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); requestClose(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) requestClose(); });
  $('[data-qd-close]', dlg).addEventListener('click', requestClose);

  // «التالي» is the submit button, so Enter in a field (or on a chosen service) moves on natively
  form.addEventListener('submit', (e) => { e.preventDefault(); if (step < 4) show(step + 1); });
  form.addEventListener('change', (e) => {
    persist();
    if (e.target.name === 'service') { renderFields(); next.disabled = false; }
  });
  // tapping a service card moves on — even if it was already the chosen one (radios don't fire `change` then).
  // Keyboard users browse with arrows (no jump) and continue with Enter (submit) or «التالي».
  const advance = () => setTimeout(() => { if (step === 1 && form.elements.service.value) show(2); }, reduce ? 0 : 260);
  $('[data-services]', dlg).addEventListener('click', (e) => { if (e.detail > 0 && !e.target.matches('input')) advance(); });
  form.addEventListener('input', (e) => { if (e.target.matches('input[type="text"]')) persist(); });
  back.addEventListener('click', () => { if (step > 1) show(step - 1, -1); });
  send.addEventListener('click', () => {
    send.href = buildWhatsAppUrl(answers());
    note.classList.add('is-sent');
    note.textContent = 'تمام! كمّل في واتساب ودوس إرسال 👌 — لو واتساب مفتحش، دوس الزرار تاني.';
  });

  document.addEventListener('click', (e) => {
    const a = e.target.closest('[data-quote]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    open(a.dataset.service);
  });
}

/* ------------------------------------------------------------------ misc */
function initYear() { const y = $('[data-year]'); if (y) y.textContent = String(new Date().getFullYear()); }

for (const init of [initNav, initMenu, initReveal, initCounters, initStage, initDrawings, initSlider, initReels, initStory, initSteps, initAnatomy, initStatement, initFaq, initDock, initQuote, initYear]) {
  try { init(); } catch (err) { console.error(`[macan] ${init.name} failed`, err); }
}
runScroll();
