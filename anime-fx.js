/* =============================================================
   anime-fx.js — anime.js-powered enhancements
   Requires: animejs@3.2.2 loaded before this script
   All decorative effects respect prefers-reduced-motion.
   If the CDN fails, effects are gracefully skipped.
   ============================================================= */

(function () {
  'use strict';

  // --- Guard: bail if anime.js failed to load ---
  if (typeof anime === 'undefined') {
    return;
  }

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var touchOnly    = window.matchMedia('(hover: none)').matches;

  function domReady(fn) {
    if (document.readyState !== 'loading') { fn(); return; }
    document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  domReady(function () {

    // ==========================================================
    // A. ELASTIC MAGNETIC HOVER on [data-magnetic]
    // Replaces the plain translate in script.js (script.js skips
    // its own magnetic block when animeAvailable is true).
    // ==========================================================
    if (!touchOnly && !reducedMotion) {
      document.querySelectorAll('[data-magnetic]').forEach(function (el) {
        el.addEventListener('mousemove', function (e) {
          var rect = el.getBoundingClientRect();
          var cx   = rect.left + rect.width  / 2;
          var cy   = rect.top  + rect.height / 2;
          var dx   = (e.clientX - cx) / (rect.width  / 2);
          var dy   = (e.clientY - cy) / (rect.height / 2);
          anime({
            targets:    el,
            translateX: dx * 15,
            translateY: dy * 15,
            duration:   600,
            easing:     'easeOutElastic(1, .5)'
          });
        });

        el.addEventListener('mouseleave', function () {
          anime({
            targets:    el,
            translateX: 0,
            translateY: 0,
            duration:   900,
            easing:     'easeOutElastic(1, .3)'
          });
        });
      });
    }

    // ==========================================================
    // B. SCROLL-TRIGGERED STAGGER REVEAL for card/section groups
    // Works alongside the existing [data-reveal] single-element
    // observer in script.js — targets groups specifically.
    // ==========================================================
    // Carousel cards are handled by section F (auto-scroll + clone).
    // Skip them in the stagger group to avoid opacity conflicts with the clone logic.
    var carouselExists = !!document.getElementById('carouselTrack');
    var groupSelectors = [
      '.case',
      '.essay',
      '.panel',
      '.featured-card',
      '.timeline__entry',
      '.principle'
    ];
    if (!carouselExists) {
      groupSelectors.unshift('.carousel__card');
    }

    groupSelectors.forEach(function (sel) {
      var elements = Array.from(document.querySelectorAll(sel));
      if (!elements.length) return;

      // Group elements by their closest parent so siblings stagger together
      var groups = {};
      elements.forEach(function (el) {
        var parent = el.parentElement;
        var key    = parent ? (parent.id || parent.className || 'root') : 'root';
        if (!groups[key]) groups[key] = [];
        groups[key].push(el);
      });

      Object.keys(groups).forEach(function (key) {
        var group   = groups[key];
        var observed = false;

        // Set initial hidden state (CSS opacity is 0 anyway via data-reveal,
        // but for groups not using data-reveal we set it explicitly)
        if (!reducedMotion) {
          group.forEach(function (el) {
            // Only prime elements that don't already have data-reveal
            // (those are handled by script.js's revealObserver already)
            if (!el.hasAttribute('data-reveal')) {
              el.style.opacity  = '0';
              el.style.transform = 'translateY(24px)';
            }
          });
        }

        var sentinel = group[0];
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting && !observed) {
              observed = true;
              io.disconnect();

              if (reducedMotion) {
                group.forEach(function (el) {
                  el.style.opacity   = '';
                  el.style.transform = '';
                  el.classList.add('is-visible');
                });
                return;
              }

              anime({
                targets:    group,
                opacity:    [0, 1],
                translateY: [24, 0],
                delay:      anime.stagger(80),
                duration:   900,
                easing:     'easeOutCubic',
                complete:   function () {
                  group.forEach(function (el) {
                    el.style.transform = '';
                    el.classList.add('is-visible');
                  });
                }
              });
            }
          });
        }, { threshold: 0.1 });

        if (sentinel) io.observe(sentinel);
      });
    });

    // ==========================================================
    // C. PROOF BAR COUNTERS — anime.js smooth count-up
    // script.js skips its own counter block when animeAvailable.
    // ==========================================================
    var counterObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          counterObserver.unobserve(entry.target);
          var el           = entry.target;
          var targetNumber = parseInt(el.getAttribute('data-count'), 10);
          if (isNaN(targetNumber)) return;

          if (reducedMotion) {
            el.textContent = targetNumber;
            return;
          }

          var obj = { val: 0 };
          anime({
            targets:  obj,
            val:      targetNumber,
            round:    1,
            duration: 1800,
            easing:   'easeOutExpo',
            update:   function () {
              el.textContent = obj.val;
            }
          });
        }
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('[data-count]').forEach(function (el) {
      counterObserver.observe(el);
    });

    // ==========================================================
    // D. BUTTON HOVER MICRO-MORPHS (scale only — no CSS override)
    // ==========================================================
    if (!touchOnly && !reducedMotion) {
      var hoverTargets = document.querySelectorAll('.btn--primary, .btn--ghost, .carousel__card');
      hoverTargets.forEach(function (el) {
        el.addEventListener('mouseenter', function () {
          anime({
            targets:  el,
            scale:    1.03,
            duration: 350,
            easing:   'easeOutQuart'
          });
        });
        el.addEventListener('mouseleave', function () {
          anime({
            targets:  el,
            scale:    1,
            duration: 350,
            easing:   'easeOutQuart'
          });
        });
      });
    }

    // ==========================================================
    // E. HERO FLAIR "BREATH" IDLE LOOPS
    // Started after ~3500ms to let the intro animation clear.
    // Skip the spinning-i star (hero__flair--i already has CSS spin).
    // ==========================================================
    if (!reducedMotion) {
      setTimeout(function () {

        // Star (non-spinning — the star that is NOT hero__flair--i)
        var starFlair = document.querySelector('.hero__flair--star:not(.hero__flair--i)');
        if (starFlair) {
          anime({
            targets:  starFlair,
            scale:    [1, 1.08, 1],
            duration: 2400,
            loop:     true,
            easing:   'easeInOutSine'
          });
        }

        // Dots — each SVG circle gets a staggered tiny breathe
        var dotsFlair = document.querySelector('.hero__flair--dots');
        if (dotsFlair) {
          var circles = dotsFlair.querySelectorAll('circle');
          circles.forEach(function (circle, i) {
            anime({
              targets:    circle,
              translateY: [0, -2, 0],
              duration:   2000 + i * 300,
              delay:      i * 160,
              loop:       true,
              easing:     'easeInOutSine'
            });
          });
        }

        // Bolt — gentle wobble
        var boltFlair = document.querySelector('.hero__flair--bolt');
        if (boltFlair) {
          anime({
            targets:  boltFlair,
            rotate:   [0, -6, 0, 6, 0],
            duration: 3200,
            loop:     true,
            easing:   'easeInOutQuad'
          });
        }

      }, 3500);
    }

    // ==========================================================
    // F. CAROUSEL SMOOTH SCROLL with anime.js
    // script.js's carousel click handlers are replaced here when
    // animeAvailable is true (script.js skips its own handlers).
    // ==========================================================
    var carouselTrack = document.getElementById('carouselTrack');
    var carouselPrev  = document.getElementById('carouselPrev');
    var carouselNext  = document.getElementById('carouselNext');

    function getCardWidth() {
      if (!carouselTrack) return 0;
      var firstCard = carouselTrack.querySelector('.carousel__card');
      if (!firstCard) return 0;
      var style = window.getComputedStyle(carouselTrack);
      var gap   = parseFloat(style.gap) || 20;
      return firstCard.offsetWidth + gap;
    }

    function updateCarouselButtons() {
      // Infinite scroll — buttons are always enabled. No-op.
      if (!carouselTrack || !carouselPrev || !carouselNext) return;
      carouselPrev.disabled = false;
      carouselNext.disabled = false;
    }

    if (carouselTrack) {
      // Prev/next click handlers live in F.2 below with infinite-wrap logic.
      updateCarouselButtons();

      // ==========================================================
      // F.2 CONTINUOUS AUTO-SCROLL (marquee-style)
      // Constant-speed, seamless loop. Duplicates the card set once
      // so scroll wraps invisibly when scrollLeft passes the width
      // of the original set. Pauses on hover / touch / tab hidden.
      // Manual arrow click or wheel scroll stops it.
      // ==========================================================
      if (!reducedMotion) {
        // Disable snap so continuous pixel-level scrolling stays fluid
        carouselTrack.style.scrollSnapType = 'none';
        carouselTrack.style.scrollBehavior = 'auto';

        // Clone the original cards as many times as needed so the strip is
        // always wider than 2× the viewport. Required for seamless infinite
        // scroll: if scrollWidth ≤ clientWidth, scrollLeft can never advance
        // and the auto-scroll appears "stopped". Previously cloned only once,
        // which broke after we removed cards from the carousel.
        var originalCards = Array.from(carouselTrack.querySelectorAll('.carousel__card'));
        originalCards.forEach(function (card) {
          card.style.opacity  = '';
          card.style.transform = '';
          card.classList.add('is-visible');
        });

        function appendOneCloneSet() {
          originalCards.forEach(function (card) {
            var clone = card.cloneNode(true);
            clone.setAttribute('aria-hidden', 'true');
            clone.classList.add('carousel__card--clone');
            clone.style.opacity  = '';
            clone.style.transform = '';
            carouselTrack.appendChild(clone);
          });
        }

        // We want exactly the 3 original cards cycling — so we clone in
        // FULL ORIGINAL-SET passes (3 cards each). One pass usually does it.
        // Add more passes only if a single clone-set still doesn't push
        // total width past viewport (rare on small screens). Cap at 2.
        appendOneCloneSet();
        if (carouselTrack.scrollWidth < carouselTrack.clientWidth + 1) {
          appendOneCloneSet();
        }

        // The "loop unit" is one ORIGINAL set (not the entire scrollWidth).
        // We wrap by exactly one original-set width so the visible content
        // appears identical before and after the wrap.
        function getOriginalSetWidth() {
          if (!originalCards.length) return 0;
          var firstClone = carouselTrack.querySelector('.carousel__card--clone');
          if (firstClone) {
            return firstClone.offsetLeft;
          }
          return carouselTrack.scrollWidth / 2;
        }

        var SPEED = 40; // px per second — tweak to taste
        var isPaused = false;
        var userInteracted = false;
        var lastTs = null;
        var rafId = null;

        function loopWidth() {
          // Width of one original-cards set. Must NOT be scrollWidth/2 anymore
          // because we may now have 3+ clone sets, not just one.
          return getOriginalSetWidth();
        }

        function tick(ts) {
          if (!lastTs) lastTs = ts;
          var dt = (ts - lastTs) / 1000;
          lastTs = ts;

          if (!isPaused && !userInteracted) {
            var lw = loopWidth();
            if (lw > 0) {
              carouselTrack.scrollLeft += SPEED * dt;
              if (carouselTrack.scrollLeft >= lw) {
                // Seamless wrap — jump back by exactly one original-set width
                carouselTrack.scrollLeft -= lw;
              }
            }
          }
          rafId = requestAnimationFrame(tick);
        }

        function start() {
          if (rafId) return;
          lastTs = null;
          rafId = requestAnimationFrame(tick);
        }
        function stop() {
          if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
        }

        // INFINITE SCROLL — also wrap when the user scrolls manually.
        // If they scroll past the end of the original set, teleport back
        // by loopWidth. If they scroll into negative territory, jump forward.
        function wrapManualScroll() {
          var lw = loopWidth();
          if (!lw) return;
          if (carouselTrack.scrollLeft >= lw) {
            carouselTrack.scrollLeft -= lw;
          } else if (carouselTrack.scrollLeft < 0) {
            carouselTrack.scrollLeft += lw;
          }
        }
        carouselTrack.addEventListener('scroll', wrapManualScroll, { passive: true });

        carouselTrack.addEventListener('mouseenter', function () { isPaused = true;  });
        carouselTrack.addEventListener('mouseleave', function () { isPaused = false; });
        carouselTrack.addEventListener('pointerdown', function () { isPaused = true;  });
        carouselTrack.addEventListener('pointerup',   function () { isPaused = false; });

        // Manual wheel: pause auto for a moment, then resume so the
        // carousel stays infinite even after user interaction
        var resumeTimer = null;
        function bumpResume() {
          isPaused = true;
          clearTimeout(resumeTimer);
          resumeTimer = setTimeout(function () { isPaused = false; }, 1500);
        }
        carouselTrack.addEventListener('wheel', bumpResume, { passive: true });

        // Arrow buttons: advance/retreat by one card, with wrap
        function nudge(direction) {
          var cw = getCardWidth();
          var lw = loopWidth();
          if (!cw || !lw) return;
          var target = carouselTrack.scrollLeft + direction * cw;
          if (target < 0) target += lw;
          if (target >= lw) target -= lw;
          anime.remove(carouselTrack);
          anime({
            targets: carouselTrack,
            scrollLeft: target,
            duration: 600,
            easing: 'easeInOutCubic'
          });
          bumpResume();
        }
        if (carouselPrev) carouselPrev.addEventListener('click', function (e) { e.preventDefault(); nudge(-1); });
        if (carouselNext) carouselNext.addEventListener('click', function (e) { e.preventDefault(); nudge( 1); });

        document.addEventListener('visibilitychange', function () {
          if (document.hidden) isPaused = true;
          else if (!userInteracted) isPaused = false;
        });

        start();
      }
    }


    // ==========================================================
    // H. CASE STUDY FILTER CHIPS
    // Wires up .filter-chip buttons on case-studies.html.
    // Tags are stored in data-tags on .case and .featured-card.
    // Active chip updates URL hash for bookmark/share support.
    // Newly shown items get a quick anime.js fade-in stagger.
    // ==========================================================
    (function () {
      var chips    = document.querySelectorAll('.filter-chip');
      var cases    = document.querySelectorAll('.case[data-tags], .featured-card[data-tags]');
      if (!chips.length || !cases.length) return;

      function getActive() {
        var active = document.querySelector('.filter-chip--active');
        return active ? active.getAttribute('data-filter') : 'all';
      }

      function applyFilter(tag) {
        var toShow = [];
        var toHide = [];

        cases.forEach(function (el) {
          var tags = (el.getAttribute('data-tags') || '').split(' ');
          var show = (tag === 'all') || tags.indexOf(tag) !== -1;
          if (show) {
            toShow.push(el);
          } else {
            toHide.push(el);
          }
        });

        // Hide non-matching immediately
        toHide.forEach(function (el) {
          el.style.display = 'none';
          el.classList.add('case--filtered-out');
        });

        // Show matching with anime stagger if available
        toShow.forEach(function (el) {
          el.style.display = '';
          el.classList.remove('case--filtered-out');
          if (!reducedMotion) {
            el.style.opacity = '0';
          }
        });

        if (!reducedMotion && toShow.length) {
          anime({
            targets:  toShow,
            opacity:  [0, 1],
            translateY: [8, 0],
            delay:    anime.stagger(50),
            duration: 350,
            easing:   'easeOutCubic',
            complete: function () {
              toShow.forEach(function (el) { el.style.transform = ''; });
            }
          });
        } else {
          toShow.forEach(function (el) { el.style.opacity = ''; });
        }
      }

      function setChip(filterValue) {
        chips.forEach(function (chip) {
          var isTarget = chip.getAttribute('data-filter') === filterValue;
          chip.classList.toggle('filter-chip--active', isTarget);
          chip.setAttribute('aria-pressed', isTarget ? 'true' : 'false');
        });
        applyFilter(filterValue);
      }

      // Wire up chip clicks
      chips.forEach(function (chip) {
        chip.addEventListener('click', function () {
          var tag = chip.getAttribute('data-filter');
          setChip(tag);
          // URL hash sync
          if (tag === 'all') {
            history.replaceState(null, '', window.location.pathname + window.location.search);
          } else {
            history.replaceState(null, '', '#filter=' + tag);
          }
        });
      });

      // On load: check hash and apply
      var hash = window.location.hash;
      var initialFilter = 'all';
      if (hash && hash.startsWith('#filter=')) {
        var hashTag = hash.replace('#filter=', '');
        // Validate against known chips
        var chipExists = Array.from(chips).some(function (c) {
          return c.getAttribute('data-filter') === hashTag;
        });
        if (chipExists) initialFilter = hashTag;
      }
      setChip(initialFilter);
    }());

  }); // end DOMContentLoaded

})();
