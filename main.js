/* MACAN — page behaviour. Works without GSAP; GSAP only adds the hero intro and parallax. */
(() => {
  window.MACAN_READY = true;
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // one rAF-throttled scroll loop shared by nav, steps line and fab
  const onScroll = [];
  let ticking = false;
  const runScroll = () => { ticking = false; onScroll.forEach((fn) => fn()); };
  window.addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(runScroll); } }, { passive: true });
  window.addEventListener('resize', runScroll);

  function initNav() {
    const nav = $('.nav');
    onScroll.push(() => nav.classList.toggle('is-scrolled', window.scrollY > 24));
  }

  function initReveals() {
    const items = $$('.reveal');
    if (reduce || !('IntersectionObserver' in window)) { items.forEach((el) => el.classList.add('is-in')); return; }
    // stagger siblings that enter together
    items.forEach((el) => {
      const sibs = [...el.parentElement.children].filter((c) => c.classList.contains('reveal'));
      el.style.setProperty('--d', `${Math.min(sibs.indexOf(el), 5) * 0.09}s`);
    });
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    items.forEach((el) => io.observe(el));
  }

  function initCounters() {
    const nums = $$('[data-count]');
    if (reduce || !('IntersectionObserver' in window)) return;
    const run = (el) => {
      const end = +el.dataset.count, pre = el.dataset.prefix || '', t0 = performance.now(), dur = 1600;
      const step = (t) => {
        const k = clamp((t - t0) / dur, 0, 1), eased = 1 - Math.pow(1 - k, 3);
        el.textContent = pre + Math.round(end * eased);
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    nums.forEach((el) => io.observe(el));
  }

  function initSlider(root) {
    if (!root) return;
    const range = $('.ba-range', root);
    const set = (pct) => {
      pct = clamp(pct, 0, 100);
      root.style.setProperty('--pos', `${pct}%`);
      range.value = Math.round(pct);
    };
    const fromX = (x) => { const r = root.getBoundingClientRect(); set(((x - r.left) / r.width) * 100); };
    // mouse/pen drag straight away; touch only once the gesture is clearly horizontal,
    // so a vertical page scroll that starts on the photo never moves the divider
    let dragging = false, pending = null;
    const capture = (id) => { try { root.setPointerCapture(id); } catch (_) { /* pointer already gone */ } };
    root.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') { pending = { x: e.clientX, y: e.clientY, id: e.pointerId }; return; }
      dragging = true; capture(e.pointerId); fromX(e.clientX);
    });
    root.addEventListener('pointermove', (e) => {
      if (pending) {
        const dx = Math.abs(e.clientX - pending.x), dy = Math.abs(e.clientY - pending.y);
        if (dx < 6 && dy < 6) return;
        const id = pending.id;
        pending = null;
        if (dx > dy) { dragging = true; capture(id); }
      }
      if (dragging) fromX(e.clientX);
    });
    const stop = () => { dragging = false; pending = null; };
    root.addEventListener('pointerup', stop);
    root.addEventListener('pointercancel', stop);
    range.addEventListener('input', () => set(+range.value));

    // pergola type toggle
    const after = $('.ba-after', root);
    $$('.ba-tabs .tab').forEach((tab, _, tabs) => {
      tab.addEventListener('click', () => {
        if (tab.classList.contains('is-active')) return;
        tabs.forEach((t) => { t.classList.toggle('is-active', t === tab); t.setAttribute('aria-pressed', t === tab); });
        const img = new Image();
        img.src = tab.dataset.after;
        after.classList.add('is-swapping');
        const swap = () => { after.src = img.src; after.classList.remove('is-swapping'); };
        img.decode ? img.decode().then(swap, swap) : (img.onload = swap);
      });
    });

    // a small hint sweep the first time the slider is seen
    if (!reduce && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        io.disconnect();
        const t0 = performance.now();
        const hint = (t) => {
          if (dragging) return;
          const k = clamp((t - t0) / 1800, 0, 1);
          set(50 + Math.sin(k * Math.PI * 2) * 18 * (1 - k));
          if (k < 1) requestAnimationFrame(hint);
        };
        setTimeout(() => requestAnimationFrame(hint), 500);
      }, { threshold: 0.6 });
      io.observe(root);
    }
  }

  function initSteps() {
    const steps = $('.steps');
    if (!steps) return;
    if (reduce) { steps.style.setProperty('--progress', 1); return; }
    onScroll.push(() => {
      const r = steps.getBoundingClientRect(), vh = window.innerHeight;
      steps.style.setProperty('--progress', clamp((vh * 0.8 - r.top) / (r.height + vh * 0.2), 0, 1).toFixed(3));
    });
  }

  function initReels() {
    const reels = $$('.reel');
    reels.forEach((reel) => {
      const video = $('video', reel), btn = $('.play', reel);
      btn.addEventListener('click', () => {
        reels.forEach((other) => { if (other !== reel) $('video', other).pause(); });
        video.controls = true;
        video.play();
      });
      video.addEventListener('play', () => reel.classList.add('is-playing'));
      video.addEventListener('pause', () => reel.classList.remove('is-playing'));
      video.addEventListener('ended', () => { reel.classList.remove('is-playing'); video.controls = false; });
    });
  }

  function initFab() {
    const fab = $('.fab'), hero = $('.hero');
    onScroll.push(() => fab.classList.toggle('is-visible', window.scrollY > hero.offsetHeight * 0.6));
  }

  // GSAP loads after this file (so the hero never waits on the CDN); it only adds parallax
  function initHeroMotion() {
    const { gsap, ScrollTrigger } = window;
    if (reduce || !gsap || !ScrollTrigger) return;
    gsap.registerPlugin(ScrollTrigger);
    const st = { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true };
    gsap.to('.hero-glow', { yPercent: 18, ease: 'none', scrollTrigger: st });
    gsap.to('.hero-logo', { yPercent: -14, ease: 'none', scrollTrigger: { ...st } });
    gsap.to('.mane', { yPercent: 10, opacity: 0.4, ease: 'none', scrollTrigger: { ...st } });
  }

  initNav();
  initReveals();
  initCounters();
  initSlider($('.ba'));
  initSteps();
  initReels();
  initFab();
  runScroll();
  if (document.readyState === 'complete') initHeroMotion();
  else window.addEventListener('load', initHeroMotion);
})();
