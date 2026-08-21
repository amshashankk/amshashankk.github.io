/* ============================================================
   Company marquee, running along a wave.

   Port of the ReactBits "TextLoop" text animation
   (https://reactbits.dev, MIT) to plain JS. The path builder and
   the two-textPath leapfrog that makes the loop seamless are
   theirs, from src/content/TextAnimations/TextLoop/TextLoop.jsx.

   What changed, and why:

   - No GSAP. The tween is linear and endless, so a rAF loop
     advancing one offset does the same job.
   - Colours come from CSS, not props. Ribbon and type are painted
     with var(--accent) / var(--accent-text) in the stylesheet, so
     the band follows the theme toggle with no JS listener.
   - A much shorter viewBox. Upstream is 1200x520, which at this
     column width renders a 478px-tall band — taller than the hero
     CTA. VIEW_H and curviness are dialled down to suit a strip.
   - It replaces a working CSS marquee rather than mounting into an
     empty node, so with JS off the original flat track still runs.
   - No pause-on-hover. It runs continuously.
   ============================================================ */
(function () {
  'use strict';

  var host = document.querySelector('[data-text-loop]');
  if (!host) return;

  var NAMES = (host.getAttribute('data-names') || '').split(',')
                .map(function (s) { return s.trim(); }).filter(Boolean);
  if (NAMES.length < 2) return;

  /* --- config ------------------------------------------------ */
  var VIEW_W = 1200;
  var VIEW_H = 180;          /* upstream 520; a strip, not a hero */
  var CURVINESS = 26;        /* upstream 90, scaled to the shorter box */
  var RIBBON_WIDTH = 54;   /* the one knob: thinner ribbon, thinner type */
  /* Upstream ships these as independent props (86 / 46). Tying the type to
     the ribbon at their ratio means changing RIBBON_WIDTH alone keeps the
     text correctly proportioned inside the band. */
  var FONT_RATIO = 46 / 86;
  var FONT_SIZE = Math.round(RIBBON_WIDTH * FONT_RATIO);
  var LETTER_SPACING = 2;
  var SEPARATOR = '✦';  /* ✦, the component's own separator */
  var SPEED = 70;            /* user units per second */
  var EDGE_PAD = 6;

  var CX = VIEW_W / 2, CY = VIEW_H / 2;
  var NS = 'http://www.w3.org/2000/svg';

  /* --- path: ReactBits' 'wave' branch ------------------------ */
  function wavePath() {
    var room = Math.max(20, CY - RIBBON_WIDTH / 2 - EDGE_PAD);
    var a = Math.min(CURVINESS * 2.2, room * 2);
    return 'M -320 ' + CY + ' Q -160 ' + (CY - a) + ' 0 ' + CY +
           ' T 320 ' + CY + ' T 640 ' + CY + ' T 960 ' + CY +
           ' T 1280 ' + CY + ' T ' + (VIEW_W + 320) + ' ' + CY;
  }

  function el(name, attrs) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) if (attrs.hasOwnProperty(k)) n.setAttribute(k, attrs[k]);
    return n;
  }

  /* Upstream pads the separator with one NBSP each side (ordinary spaces
     collapse in SVG text). Two each side here: it widens the unit so the
     repeat count below lands just under a whole number, which turns the
     inevitable textLength fit into a slight squeeze instead of a 15%
     letter-spread. The words stay tight; only the gaps give. */
  var GAP = '  ' + SEPARATOR + '  ';
  var unit = NAMES.join(GAP).toUpperCase() + GAP;
  var pathId = 'text-loop-path';

  var svg = el('svg', {
    'class': 'text-loop__svg',
    viewBox: '0 0 ' + VIEW_W + ' ' + VIEW_H,
    /* 'slice' so the narrow-screen rule below can pin a height and crop the
       sides instead of scaling the type down to nothing. The loop is endless,
       so losing the outer stretch of wave costs nothing. */
    preserveAspectRatio: 'xMidYMid slice',
    'aria-hidden': 'true',
    focusable: 'false'
  });

  var path = el('path', {
    id: pathId, d: wavePath(), fill: 'none',
    'class': 'text-loop__ribbon',
    'stroke-width': RIBBON_WIDTH,
    'stroke-linecap': 'round', 'stroke-linejoin': 'round'
  });
  svg.appendChild(path);

  var style = 'font-size:' + FONT_SIZE + 'px;letter-spacing:' + LETTER_SPACING + 'px';

  /* Hidden copy, measured to work out how many repeats fill the path. */
  var measure = el('text', { 'class': 'text-loop__measure', style: style, 'aria-hidden': 'true' });
  measure.textContent = unit;
  svg.appendChild(measure);

  function makeRun() {
    var t = el('text', { 'class': 'text-loop__text', style: style, 'dominant-baseline': 'central' });
    var tp = el('textPath', { startOffset: 0, lengthAdjust: 'spacing' });
    tp.setAttributeNS('http://www.w3.org/1999/xlink', 'href', '#' + pathId);
    tp.setAttribute('href', '#' + pathId);
    t.appendChild(tp);
    svg.appendChild(t);
    return tp;
  }
  var head = makeRun();
  var tail = makeRun();

  host.textContent = '';           /* drop the plain-CSS fallback track */
  host.appendChild(svg);
  host.classList.add('is-loop');
  var section = host.closest('.marquee');
  if (section) section.classList.add('is-loop');

  /* --- measure ----------------------------------------------- */
  var length = 0;

  function fit() {
    var unitWidth;
    try {
      length = path.getTotalLength();
      unitWidth = measure.getComputedTextLength();
    } catch (e) { return; }
    if (!length || !unitWidth) return;

    /* Round, as upstream does — it minimises the distortion that textLength +
       lengthAdjust then applies to make the loop tile seamlessly. */
    var reps = Math.max(1, Math.round(length / unitWidth));
    var loopText = new Array(reps + 1).join(unit);
    [head, tail].forEach(function (tp) {
      tp.textContent = loopText;
      tp.setAttribute('textLength', length);
    });
    apply(offset);
  }

  /* --- animation --------------------------------------------- */
  var offset = 0;
  var raf = 0, last = 0, running = false;

  function apply(o) {
    head.setAttribute('startOffset', o);
    tail.setAttribute('startOffset', o >= 0 ? o - length : o + length);
  }

  function step(now) {
    if (last) {
      offset += ((now - last) / 1000) * SPEED;
      if (length && offset >= length) offset -= length;
      apply(offset);
    }
    last = now;
    raf = requestAnimationFrame(step);
  }

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
  /* Held still through the theme wipe: writing startOffset every frame forces
     SVG layout, which competes with the main-thread clip-path animation. */
  var frozen = false;

  function play() {
    if (running || frozen || reduced.matches) return;
    running = true; last = 0;
    raf = requestAnimationFrame(step);
  }
  function pause() {
    if (!running) return;
    running = false;
    cancelAnimationFrame(raf);
  }

  fit();
  apply(0);
  play();

  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);

  /* Upstream pauses on hover (pauseOnHover); deliberately not carried over —
     the band should keep moving. The pauses below are purely about not
     burning frames when nobody can see it. */

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (e) {
      e[0].isIntersecting ? play() : pause();
    }, { threshold: 0 }).observe(host);
  }
  document.addEventListener('themetransition:start', function () {
    frozen = true;
    pause();
  });
  document.addEventListener('themetransition:end', function () {
    frozen = false;
    play();
  });
  document.addEventListener('visibilitychange', function () {
    document.hidden ? pause() : play();
  });
  if (reduced.addEventListener) {
    reduced.addEventListener('change', function () {
      reduced.matches ? pause() : play();
    });
  }
})();
