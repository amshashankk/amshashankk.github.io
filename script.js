(function () {
  'use strict';

  // When anime.js is available, anime-fx.js owns counters, magnetic, and carousel.
  var animeAvailable = typeof anime !== 'undefined';

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const touchOnly = window.matchMedia('(hover: none)').matches;

  // ============================================================
  // LENIS SMOOTH-SCROLL — buttery scroll lag (MindMarket-style).
  // Wait for the CDN script to actually be loaded; defer scripts can
  // execute slightly out of order on some browsers, so poll briefly.
  // ============================================================
  function initLenis() {
    if (typeof window.Lenis === 'undefined') return false;
    if (reducedMotion) return true; // bail silently — no smooth needed
    try {
      var lenis = new window.Lenis({
        // lerp = how smooth (lower = smoother + laggier). 0.1 is the sweet spot.
        lerp: 0.09,
        wheelMultiplier: 1.0,
        smoothWheel: true,
        syncTouch: false           // touch keeps native momentum
      });
      function raf(time) {
        lenis.raf(time);
        requestAnimationFrame(raf);
      }
      requestAnimationFrame(raf);
      window.__lenis = lenis;
      document.documentElement.classList.add('lenis-active');
      console.log('[Lenis] active, lerp=0.09');

      // Anchor smooth-scroll
      document.addEventListener('click', function (e) {
        var a = e.target.closest('a[href^="#"]');
        if (!a) return;
        var href = a.getAttribute('href');
        if (!href || href === '#' || href.length < 2) return;
        var target = document.querySelector(href);
        if (!target) return;
        e.preventDefault();
        lenis.scrollTo(target, { offset: -88, duration: 1.4 });
      });
      return true;
    } catch (err) {
      console.warn('[Lenis] init failed:', err);
      return true;
    }
  }
  // Try now, otherwise poll for up to 2 seconds
  if (!initLenis()) {
    var lenisTries = 0;
    var lenisPoll = setInterval(function () {
      lenisTries++;
      if (initLenis() || lenisTries > 40) clearInterval(lenisPoll);
    }, 50);
  }

  // --- Theme toggle ---
  const html = document.documentElement;
  const themeBtn = document.querySelector('.theme-toggle');

  function applyTheme(theme) {
    html.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme) applyTheme(savedTheme);

  function rippleThemeSwitch(targetTheme, originX, originY) {
    // Compute radius to farthest viewport corner from origin
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var r = Math.ceil(Math.sqrt(
      Math.pow(Math.max(originX, vw - originX), 2) +
      Math.pow(Math.max(originY, vh - originY), 2)
    ));

    // --- Primary path: View Transitions API ---
    if (!reducedMotion && document.startViewTransition) {
      html.style.setProperty('--vt-x', originX + 'px');
      html.style.setProperty('--vt-y', originY + 'px');
      html.style.setProperty('--vt-r', r + 'px');

      var transition = document.startViewTransition(function () {
        applyTheme(targetTheme);
      });

      transition.ready.catch(function () {
        // If transition prep fails, just apply theme
        applyTheme(targetTheme);
      });
      return;
    }

    // --- Fallback: clip-path div animation ---
    if (!reducedMotion) {
      // Pick background color of the incoming theme
      var fallbackBg = targetTheme === 'dark' ? '#0a0a0b' : '#f7f7f5';

      var ripple = document.createElement('div');
      ripple.setAttribute('aria-hidden', 'true');
      ripple.className = 'theme-ripple-fallback';
      ripple.style.cssText = [
        'position:fixed',
        'inset:0',
        'z-index:9998',
        'pointer-events:none',
        'background:' + fallbackBg,
        'clip-path:circle(0px at ' + originX + 'px ' + originY + 'px)',
        'will-change:clip-path'
      ].join(';');

      document.body.appendChild(ripple);

      // Force reflow then animate
      ripple.getBoundingClientRect();
      ripple.style.transition = 'clip-path 1600ms cubic-bezier(0.65, 0, 0.35, 1)';
      ripple.style.clipPath = 'circle(' + r + 'px at ' + originX + 'px ' + originY + 'px)';

      ripple.addEventListener('transitionend', function () {
        applyTheme(targetTheme);
        document.body.removeChild(ripple);
      }, { once: true });
      return;
    }

    // --- Reduced-motion: instant swap ---
    applyTheme(targetTheme);
  }

  if (themeBtn) {
    themeBtn.addEventListener('click', function () {
      var current = html.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      var rect = themeBtn.getBoundingClientRect();
      var cx = Math.round(rect.left + rect.width / 2);
      var cy = Math.round(rect.top + rect.height / 2);
      rippleThemeSwitch(next, cx, cy);
    });
  }

  // --- Nav scroll state ---
  const nav = document.querySelector('.nav');

  function onScroll() {
    if (!nav) return;
    if (window.scrollY > 20) {
      nav.classList.add('nav--scrolled');
    } else {
      nav.classList.remove('nav--scrolled');
    }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // --- Counter animation (fallback — skipped when anime.js is available) ---
  if (!animeAvailable) {
    (function () {
      function easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
      }

      function animateCounter(el) {
        const target = parseInt(el.getAttribute('data-count'), 10);
        if (isNaN(target)) return;

        if (reducedMotion) {
          el.textContent = target;
          return;
        }

        const duration = 1400;
        const start = performance.now();

        function tick(now) {
          const elapsed = now - start;
          const progress = Math.min(elapsed / duration, 1);
          const value = Math.round(easeOutCubic(progress) * target);
          el.textContent = value;
          if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
      }

      const counterObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCounter(entry.target);
              counterObserver.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );

      document.querySelectorAll('[data-count]').forEach(function (el) {
        counterObserver.observe(el);
      });
    }());
  }

  // --- Reveal on scroll ---
  const revealObserver = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          revealObserver.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 }
  );

  document.querySelectorAll('[data-reveal]').forEach(function (el) {
    revealObserver.observe(el);
  });

  // --- Custom cursor ---
  var cursor = document.querySelector('.cursor');
  var cursorX = 0;
  var cursorY = 0;
  var mouseX = 0;
  var mouseY = 0;
  var cursorRunning = false;

  if (cursor && !touchOnly) {
    document.addEventListener('mousemove', function (e) {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (!cursorRunning) {
        cursorRunning = true;
        requestAnimationFrame(moveCursor);
      }
    });

    function moveCursor() {
      if (reducedMotion) {
        cursorX = mouseX;
        cursorY = mouseY;
      } else {
        cursorX += (mouseX - cursorX) * 0.15;
        cursorY += (mouseY - cursorY) * 0.15;
      }
      cursor.style.left = cursorX + 'px';
      cursor.style.top = cursorY + 'px';

      var dist = Math.abs(mouseX - cursorX) + Math.abs(mouseY - cursorY);
      if (dist > 0.1) {
        requestAnimationFrame(moveCursor);
      } else {
        cursorRunning = false;
      }
    }

    var interactiveSelectors = '[data-magnetic], a, button';

    document.querySelectorAll(interactiveSelectors).forEach(function (el) {
      el.addEventListener('mouseenter', function () {
        document.body.classList.add('cursor--lg');
      });
      el.addEventListener('mouseleave', function () {
        document.body.classList.remove('cursor--lg');
      });
    });
  }

  // --- Magnetic hover (fallback — skipped when anime.js is available) ---
  if (!animeAvailable && !touchOnly && !reducedMotion) {
    document.querySelectorAll('[data-magnetic]').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var rect = el.getBoundingClientRect();
        var cx = rect.left + rect.width / 2;
        var cy = rect.top + rect.height / 2;
        var dx = (e.clientX - cx) / (rect.width / 2);
        var dy = (e.clientY - cy) / (rect.height / 2);
        var strength = 10;
        el.style.transform = 'translate(' + dx * strength + 'px, ' + dy * strength + 'px)';
      });

      el.addEventListener('mouseleave', function () {
        el.style.transform = '';
      });
    });
  }

  // --- Carousel (fallback — skipped when anime.js is available, handled in anime-fx.js) ---
  if (!animeAvailable) {
    var carouselTrack = document.getElementById('carouselTrack');
    var carouselPrev = document.getElementById('carouselPrev');
    var carouselNext = document.getElementById('carouselNext');

    function getCardWidth() {
      if (!carouselTrack) return 0;
      var firstCard = carouselTrack.querySelector('.carousel__card');
      if (!firstCard) return 0;
      var style = window.getComputedStyle(carouselTrack);
      var gap = parseFloat(style.gap) || 20;
      return firstCard.offsetWidth + gap;
    }

    function updateCarouselButtons() {
      if (!carouselTrack || !carouselPrev || !carouselNext) return;
      var atStart = carouselTrack.scrollLeft <= 4;
      var atEnd = carouselTrack.scrollLeft + carouselTrack.offsetWidth >= carouselTrack.scrollWidth - 4;
      carouselPrev.disabled = atStart;
      carouselNext.disabled = atEnd;
    }

    if (carouselTrack) {
      if (carouselPrev) {
        carouselPrev.addEventListener('click', function () {
          carouselTrack.scrollBy({ left: -getCardWidth(), behavior: 'smooth' });
        });
      }
      if (carouselNext) {
        carouselNext.addEventListener('click', function () {
          carouselTrack.scrollBy({ left: getCardWidth(), behavior: 'smooth' });
        });
      }
      carouselTrack.addEventListener('scroll', updateCarouselButtons, { passive: true });
      updateCarouselButtons();
    }
  }

  // --- Page enter transition ---
  var mainEl = document.querySelector('main');

  // Page-wipe bar disabled per user request — keep variable as null so the
  // existing guarded `if (wipeEl)` branches below simply skip.
  var wipeEl = null;

  // Run page-enter animation on load
  if (mainEl && !reducedMotion) {
    mainEl.classList.add('page--entering');
    mainEl.addEventListener('animationend', function () {
      mainEl.classList.remove('page--entering');
    }, { once: true });
  }

  // --- Nav sliding indicator ---
  var navLinks = document.querySelector('.nav__links');
  var indicator = navLinks && navLinks.querySelector('.nav__indicator');

  function positionIndicator(linkEl, animate) {
    if (!indicator || !navLinks || !linkEl) return;
    var navRect = navLinks.getBoundingClientRect();
    var linkRect = linkEl.getBoundingClientRect();
    var left = linkRect.left - navRect.left;
    if (!animate) {
      // Disable transitions momentarily for instant snap
      indicator.style.transition = 'none';
    }
    indicator.style.width = linkRect.width + 'px';
    indicator.style.transform = 'translateX(' + left + 'px)';
  }

  var activeLink = navLinks && navLinks.querySelector('a[aria-current="page"]');

  // Initial snap: place under active link with no animation, then enable transitions
  if (indicator && activeLink) {
    requestAnimationFrame(function () {
      positionIndicator(activeLink, false);
      // One more frame so the browser paints the snap position before transitions turn on
      requestAnimationFrame(function () {
        if (navLinks) navLinks.classList.add('is-ready');
      });
    });
  } else if (indicator && navLinks) {
    // No active link (e.g. case-study page) — still enable transitions
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        navLinks.classList.add('is-ready');
      });
    });
  }

  // Re-measure on window resize — no animation during resize
  var resizeTimer = null;
  window.addEventListener('resize', function () {
    if (navLinks) navLinks.classList.remove('is-ready');
    if (activeLink) positionIndicator(activeLink, false);
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(function () {
      if (navLinks) navLinks.classList.add('is-ready');
    }, 150);
  }, { passive: true });

  // Indicator stays on the active link only. On hover we just glow the text
  // (handled in CSS) — no bar movement. The bar slides only on click when
  // the user switches pages (see click handler below).

  // --- Page transition: wipe-in / exit / wipe-out / enter ---
  // Timing:
  //   0ms:    exit animation on <main> begins (600ms, power3.inOut)
  //   0ms:    wipe sweeps in from right (500ms, power3.out)
  //   500ms:  wipe fully covers viewport; navigate
  //   navigate: new page loads, wipe is still at translateX(0)
  //   on load: enter animation plays (700ms, power3.out)
  //            wipe sweeps out to left simultaneously (500ms, power3.in)

  var EASE_OUT  = 'cubic-bezier(0.22, 1, 0.36, 1)';
  var EASE_IN   = 'cubic-bezier(0.76, 0, 0.24, 1)';
  var EASE_INOUT = 'cubic-bezier(0.76, 0, 0.24, 1)';

  // On page load: if wipeEl exists, start it already at translateX(0) then
  // animate out left to simulate the second half of the wipe
  if (wipeEl && !reducedMotion) {
    // Snap to covering position (no transition)
    wipeEl.style.transition = 'none';
    wipeEl.style.transform = 'translateX(0)';

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        // Animate wipe out to the left
        wipeEl.style.transition = 'transform 500ms ' + EASE_IN;
        wipeEl.style.transform = 'translateX(-100%)';
      });
    });
  }

  function isSameOriginLink(href) {
    try {
      var url = new URL(href, window.location.href);
      return url.origin === window.location.origin;
    } catch (e) {
      return false;
    }
  }

  function shouldIntercept(anchor) {
    var href = anchor.getAttribute('href');
    if (!href) return false;
    if (anchor.target === '_blank') return false;
    if (href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (href.startsWith('#')) return false;
    try {
      var url = new URL(href, window.location.href);
      if (url.hash && url.pathname === window.location.pathname) return false;
    } catch (e) {}
    if (!isSameOriginLink(href)) return false;
    try {
      var targetUrl = new URL(href, window.location.href);
      var currentUrl = new URL(window.location.href);
      if (targetUrl.pathname === currentUrl.pathname && !targetUrl.hash) return false;
    } catch (e) {}
    return true;
  }

  document.addEventListener('click', function (e) {
    // Bypass on modifier keys or middle-click
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

    var anchor = e.target.closest('a');
    if (!anchor) return;
    if (!shouldIntercept(anchor)) return;

    e.preventDefault();
    var href = anchor.href;

    // Slide indicator to clicked nav link first
    if (indicator && navLinks && navLinks.contains(anchor)) {
      positionIndicator(anchor, true);
    }

    if (reducedMotion || !mainEl) {
      window.location.href = href;
      return;
    }

    var navigated = false;
    function doNavigate() {
      if (navigated) return;
      navigated = true;
      window.location.href = href;
    }

    // Exit animation on <main>, then navigate when it completes
    mainEl.classList.remove('page--entering');
    mainEl.classList.add('page--leaving');

    // Navigate after the exit animation duration (600ms)
    setTimeout(doNavigate, 500);
    mainEl.addEventListener('animationend', doNavigate, { once: true });
  });

  // --- Footer time ---
  var yearTimeEl = document.getElementById('yearTime');

  function updateTime() {
    if (!yearTimeEl) return;
    var now = new Date();
    var h = String(now.getHours()).padStart(2, '0');
    var m = String(now.getMinutes()).padStart(2, '0');
    yearTimeEl.textContent = h + ':' + m + ' · IST';
  }

  updateTime();
  setInterval(updateTime, 60000);

})();

/* ============================================================
   HERO CHAR REVEAL — orchestrates animation-delay per character
   Plays AFTER the page-enter transition (700ms) with a 350ms offset
   ============================================================ */
(function () {
  'use strict';

  var heroTitle = document.querySelector('.hero__title');
  if (!heroTitle) return;

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Grab all .char elements in DOM order
  var chars = heroTitle.querySelectorAll('.char');

  if (reducedMotion) {
    // Skip delays — reset transforms and show immediately
    chars.forEach(function (ch) {
      ch.style.transform = 'none';
    });
    heroTitle.classList.add('is-ready');
    return;
  }

  // Base delay: 350ms (lets the 700ms page-enter animation clear halfway)
  // Each char gets an additional stagger of 38ms
  var BASE_DELAY = 350;
  var STAGGER    = 38; // ms between each character

  chars.forEach(function (ch, i) {
    ch.style.animationDelay = (BASE_DELAY + i * STAGGER) + 'ms';
  });

  // Trigger: add is-ready to start the CSS keyframes
  // Use rAF to ensure inline styles are painted before the class lands
  requestAnimationFrame(function () {
    heroTitle.classList.add('is-ready');
  });

})();

// ============================================================
// FOOTER VISIT COUNTER — subtle, opt-out friendly.
// Hits a free public counter (abacus.jasoncameron.dev) on each
// page load and appends a quiet "· N visits" line to the footer.
// Skips local/dev hosts so only real production traffic counts.
// Fails silently if the API is down. No PII, just a hit count.
// ============================================================
(function () {
  var footer = document.querySelector('.footer');
  if (!footer) return;
  var divs = footer.querySelectorAll('div');
  if (!divs.length) return;
  var target = divs[divs.length - 1];

  // Local / dev hosts — read count without incrementing, no append.
  var host = window.location.hostname;
  var isLocal = (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local') ||
    host === ''
  );
  if (isLocal) return;

  fetch('https://abacus.jasoncameron.dev/hit/shashankkesarwani-com/prod')
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (d) {
      if (!d || typeof d.value !== 'number') return;
      var span = document.createElement('span');
      span.className = 'footer__visits';
      span.textContent = ' · ' + d.value.toLocaleString() + ' visits';
      target.appendChild(span);
    })
    .catch(function () {});
})();
