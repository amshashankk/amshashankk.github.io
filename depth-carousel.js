/* ============================================================
   Depth carousel for the featured case studies.

   Port of the ReactBits "DepthCarousel" component
   (https://reactbits.dev, MIT) to plain JS. The layout maths —
   how far each card is pushed back, across, tilted, blurred and
   veiled for its distance from focus — is theirs, transcribed
   from src/content/Components/DepthCarousel/DepthCarousel.jsx.

   What changed, and why:

   - No GSAP. The one tween it needs is a rAF loop with the same
     power3.out curve, so the site stays dependency-free.
   - Cards hold markup, not an <img>. ReactBits sizes cards in
     fixed pixels and scales the whole stage down to fit narrow
     screens, which is fine for photos and illegible for text.
     Here the card WIDTH responds instead and the stage never
     scales, so type stays at its designed size.
   - The receding-card cue is a themed veil rather than a
     brightness() cut. Dimming works on their dark demo; on a
     near-white card it just looks broken. The veil paints toward
     the page background, so it recedes correctly in both themes.
   - The wheel only drives the carousel on horizontal intent.
     ReactBits calls preventDefault() on every wheel event, which
     traps a visitor mid-page trying to scroll past it.
   ============================================================ */
(function () {
  'use strict';

  var root = document.querySelector('[data-depth-carousel]');
  if (!root) return;

  var stage = root.querySelector('.depth-carousel__stage');
  var cards = Array.prototype.slice.call(root.querySelectorAll('.depth-carousel__card'));
  var dots = Array.prototype.slice.call(root.querySelectorAll('.depth-carousel__dot'));
  var count = cards.length;
  if (!stage || count < 2) return;

  /* ReactBits' defaults, minus the ones that only make sense for photos. */
  var DEPTH = 220;       /* px pushed back per step */
  var SPREAD_RATIO = 0.3;  /* sideways offset per step, as a share of card width */
  var TILT = 22;         /* deg of rotateY on the outgoing card */
  var FALLOFF = 0.2;     /* how fast cards behind fade into the page */
  var BLUR = 6;          /* max px of blur at the back of the stack */
  var DURATION = 700;    /* ms */
  var VISIBLE = 4;
  var MAX_CARD_W = 520;
  var MIN_CARD_W = 260;
  var STACK_BELOW = 640;  /* px of carousel width below which we stack instead */

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  var pos = 0;      /* fractional carousel position; 0 = first card focused */
  var focus = 0;    /* the settled index */
  var cardW = MAX_CARD_W;
  var spread = 0;
  var raf = 0;

  function clamp(v, lo, hi) { return Math.min(Math.max(v, lo), hi); }
  /* False while stacked in flow on narrow screens: no dragging a plain list. */
  function active() { return root.classList.contains('is-ready'); }

  /* ---- layout: ReactBits' per-card transform, verbatim ---- */
  function layout(p) {
    for (var i = 0; i < count; i++) {
      var el = cards[i];

      var d = i - p;
      /* Shortest way round the loop, so card 0 can sit in front of card 2. */
      d = ((d % count) + count) % count;
      if (d > count / 2) d -= count;

      var back = Math.max(0, d);
      var shown = Math.abs(d) <= VISIBLE + 0.5;

      var tz = -DEPTH * d;
      var tx = spread * d;
      var ry = TILT * clamp(d, 0, 1);

      var opacity = d < 0 ? Math.max(0, 1 + d) : 1;
      if (!shown) opacity = 0;

      var blurPx = BLUR > 0 ? Math.min(BLUR, (back / VISIBLE) * BLUR) : 0;

      el.style.transform =
        'translate(-50%, -50%)' +
        ' translateX(' + tx.toFixed(2) + 'px)' +
        ' translateZ(' + tz.toFixed(2) + 'px)' +
        ' rotateY(' + ry.toFixed(3) + 'deg)';
      el.style.opacity = opacity.toFixed(3);
      el.style.filter = blurPx > 0.01 ? 'blur(' + blurPx.toFixed(2) + 'px)' : '';
      el.style.zIndex = String(Math.round(2000 - d * 20));

      var live = shown && opacity > 0.05;
      el.style.pointerEvents = live ? 'auto' : 'none';

      var veil = el.querySelector('.depth-carousel__veil');
      if (veil) veil.style.opacity = clamp(back * FALLOFF * 1.25, 0, 0.86).toFixed(3);

      /* Only the focused card is reachable; the stack behind it is decoration. */
      var isFocus = Math.abs(d) < 0.5;
      el.setAttribute('aria-hidden', isFocus ? 'false' : 'true');
      var link = el.querySelector('a');
      if (link) link.tabIndex = isFocus ? 0 : -1;
    }
  }

  function setDots(idx) {
    for (var i = 0; i < dots.length; i++) {
      var on = i === idx;
      dots[i].classList.toggle('is-active', on);
      dots[i].setAttribute('aria-selected', on ? 'true' : 'false');
    }
  }

  /* ---- tween: power3.out on rAF, standing in for gsap.to ---- */
  function tweenTo(target, animate) {
    cancelAnimationFrame(raf);
    var from = pos;
    var dist = target - from;
    if (!animate || reduced.matches || Math.abs(dist) < 0.0005) {
      pos = ((target % count) + count) % count;
      layout(pos);
      return;
    }
    var t0 = performance.now();
    (function step(now) {
      var t = clamp((now - t0) / DURATION, 0, 1);
      var e = 1 - Math.pow(1 - t, 3);           /* power3.out */
      pos = from + dist * e;
      layout(pos);
      if (t < 1) raf = requestAnimationFrame(step);
      else { pos = ((target % count) + count) % count; layout(pos); }
    })(t0);
  }

  function setFocus(rawIndex, animate) {
    var idx = ((rawIndex % count) + count) % count;
    var delta = idx - pos;
    delta = ((delta % count) + count) % count;
    if (delta > count / 2) delta -= count;
    tweenTo(pos + delta, animate !== false);
    if (idx !== focus) { focus = idx; setDots(idx); }
  }

  function navigateBy(step) { setFocus(focus + step, true); }

  /* ---- sizing: width responds, the stage never scales ---- */
  function measure() {
    var avail = root.clientWidth;
    if (!avail) return;

    /* Below this the stack costs more width than it buys: a phone shows one
       card either way, and stacked-in-flow cards get the full column. So hand
       the layout back to CSS rather than shrinking type to fit a 3D stage. */
    if (avail < STACK_BELOW) {
      if (root.classList.contains('is-ready')) {
        root.classList.remove('is-ready');
        for (var k = 0; k < count; k++) {
          cards[k].style.cssText = '';
          cards[k].setAttribute('aria-hidden', 'false');
          var a = cards[k].querySelector('a');
          if (a) a.tabIndex = 0;
        }
        stage.style.height = '';
      }
      return;
    }
    root.classList.add('is-ready');

    /* Upstream hard-codes spread at 90px against a 300px card — roughly 0.3
       of its width. Held at 90 on a 620px card the offset is only 0.13, and
       perspective shrink eats the rest, so the stack collapses into one card.
       Both dimensions are derived from the container instead. */
    cardW = Math.round(clamp(avail * 0.62, MIN_CARD_W, MAX_CARD_W));
    spread = Math.round(clamp((avail - cardW) / 2 - 16, 40, cardW * SPREAD_RATIO));

    var i, maxH = 0;
    for (i = 0; i < count; i++) {
      cards[i].style.width = cardW + 'px';
      cards[i].style.height = 'auto';
    }
    /* Equal heights read better in a stack than ragged ones. */
    for (i = 0; i < count; i++) maxH = Math.max(maxH, cards[i].offsetHeight);
    for (i = 0; i < count; i++) cards[i].style.height = maxH + 'px';
    stage.style.height = maxH + 'px';

    layout(pos);
  }

  /* ---- pointer drag ---- */
  var drag = null;

  root.addEventListener('pointerdown', function (e) {
    if (!active()) return;
    if (e.button != null && e.button !== 0) return;
    cancelAnimationFrame(raf);
    drag = {
      x: e.clientX, y: e.clientY, startPos: pos,
      lastX: e.clientX, lastT: performance.now(), v: 0,
      moved: false, id: e.pointerId
    };
  });

  root.addEventListener('pointermove', function (e) {
    if (!drag) return;
    var stepPx = Math.max(cardW * 0.55, 40);
    var dx = e.clientX - drag.x;
    if (!drag.moved) {
      /* Let a vertical gesture scroll the page instead of turning the stack. */
      if (Math.abs(e.clientY - drag.y) > Math.abs(dx) && Math.abs(e.clientY - drag.y) > 6) {
        drag = null;
        return;
      }
      if (Math.abs(dx) <= 4) return;
      drag.moved = true;
      try { root.setPointerCapture(drag.id); } catch (err) {}
    }
    var now = performance.now();
    drag.v = (e.clientX - drag.lastX) / Math.max(now - drag.lastT, 1);
    drag.lastX = e.clientX;
    drag.lastT = now;
    pos = drag.startPos - dx / stepPx;
    layout(pos);
  });

  /* Set for the click that a finished drag fires on release, cleared right
     after it, so dragging across a card never follows its link. */
  var suppressClick = false;

  function endDrag() {
    if (!drag) return;
    var d = drag;
    drag = null;
    if (!d.moved) return;
    suppressClick = true;
    setTimeout(function () { suppressClick = false; }, 0);
    var stepPx = Math.max(cardW * 0.55, 40);
    setFocus(Math.round(pos - (d.v * 180) / stepPx), true);
  }
  root.addEventListener('pointerup', endDrag);
  root.addEventListener('pointercancel', endDrag);

  /* Clicking a card behind the front one brings it forward instead of
     navigating; only the focused card actually follows its link. */
  cards.forEach(function (card, i) {
    var link = card.querySelector('a');
    if (!link) return;
    link.addEventListener('click', function (e) {
      if (!active()) return;
      if (suppressClick || i !== focus) {
        e.preventDefault();
        if (!suppressClick) setFocus(i, true);
      }
    });
  });

  /* ---- horizontal wheel / trackpad swipe ---- */
  var wheelTimer = 0;
  root.addEventListener('wheel', function (e) {
    if (!active()) return;
    /* Vertical intent belongs to the page, not the carousel. */
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault();
    cancelAnimationFrame(raf);
    var delta = e.deltaMode === 1 ? e.deltaX * 24 : e.deltaX;
    pos += clamp(delta / (cardW * 0.9), -0.6, 0.6);
    layout(pos);
    clearTimeout(wheelTimer);
    wheelTimer = setTimeout(function () { setFocus(Math.round(pos), true); }, 130);
  }, { passive: false });

  /* ---- keyboard + controls ---- */
  root.addEventListener('keydown', function (e) {
    if (!active()) return;
    if (e.key === 'ArrowLeft') { e.preventDefault(); navigateBy(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); navigateBy(1); }
  });

  var prev = root.querySelector('.depth-carousel__arrow--prev');
  var next = root.querySelector('.depth-carousel__arrow--next');
  if (prev) prev.addEventListener('click', function () { navigateBy(-1); });
  if (next) next.addEventListener('click', function () { navigateBy(1); });

  dots.forEach(function (dot, i) {
    dot.addEventListener('click', function () { setFocus(i, true); });
  });

  /* A tween mid-wipe would animate under the frozen snapshot. Settle it. */
  document.addEventListener('themetransition:start', function () {
    cancelAnimationFrame(raf);
    if (active()) { pos = focus; layout(pos); }
  });

  /* ---- boot ---- */
  measure();
  setDots(0);

  if ('ResizeObserver' in window) {
    new ResizeObserver(measure).observe(root);
  } else {
    window.addEventListener('resize', measure);
  }

  /* Card heights move when webfonts land and rewrap the titles. */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);

})();
