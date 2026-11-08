(function () {
  'use strict';

  var root = document.documentElement;
  var STORAGE_KEY = 'theme-preference';
  var systemDark = window.matchMedia('(prefers-color-scheme: dark)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- Theme toggle ---------- */

  var toggle = document.querySelector('.theme-toggle');

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set === 'light' || set === 'dark') return set;
    return systemDark.matches ? 'dark' : 'light';
  }

  function syncToggleLabel() {
    if (!toggle) return;
    var next = currentTheme() === 'dark' ? 'light' : 'dark';
    toggle.setAttribute('aria-label', 'Switch to ' + next + ' mode');
  }

  function setThemeColor(theme) {
    var color = theme === 'dark' ? '#0a0a0a' : '#fafaf9';
    var metas = document.querySelectorAll('meta[name="theme-color"]');
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', color);
  }

  if (toggle) {
    toggle.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem(STORAGE_KEY, next); } catch (e) { }
      syncToggleLabel();
      setThemeColor(next);
    });
  }

  if (systemDark.addEventListener) {
    systemDark.addEventListener('change', syncToggleLabel);
  } else if (systemDark.addListener) {
    systemDark.addListener(syncToggleLabel);
  }

  syncToggleLabel();
  if (root.hasAttribute('data-theme')) setThemeColor(root.getAttribute('data-theme'));

  /* ---------- Entrance reveal ---------- */

  var blocks = Array.prototype.slice.call(document.querySelectorAll('.reveal'));
  var STAGGER = 80; // ms

  function showAll() {
    blocks.forEach(function (el) { el.classList.add('in'); });
  }

  if (reducedMotion.matches || !('IntersectionObserver' in window)) {
    showAll();
  } else {
    var observer = new IntersectionObserver(function (entries) {
      var visible = entries
        .filter(function (e) { return e.isIntersecting; })
        .map(function (e) { return e.target; })
        .sort(function (a, b) { return blocks.indexOf(a) - blocks.indexOf(b); });

      visible.forEach(function (el, i) {
        el.style.animationDelay = Math.min(i * STAGGER, 600) + 'ms';
        el.classList.add('in');
        observer.unobserve(el);
      });
    }, { rootMargin: '0px 0px -6% 0px', threshold: 0 });

    blocks.forEach(function (el) { observer.observe(el); });
  }

  // Never leave content hidden when printing / saving as PDF.
  window.addEventListener('beforeprint', showAll);

  /* ---------- Cursor glow ---------- */

  var glow = document.querySelector('.glow');
  var canHover = window.matchMedia('(hover: hover)').matches;

  if (glow && canHover && !reducedMotion.matches) {
    var x = 0, y = 0, frame = 0;

    function paint() {
      frame = 0;
      glow.style.transform = 'translate3d(' + x + 'px,' + y + 'px,0)';
    }

    window.addEventListener('pointermove', function (e) {
      if (e.pointerType && e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!frame) frame = requestAnimationFrame(paint);
      glow.classList.add('is-active');
    }, { passive: true });

    document.documentElement.addEventListener('pointerleave', function () {
      glow.classList.remove('is-active');
    });
  }

  /* ---------- Save as PDF ---------- */

  // Browsers suggest document.title as the PDF filename, so swap in a clean,
  // ASCII-only name while printing (button or Ctrl/Cmd+P) and restore it after.
  var PDF_NAME = 'Sanyam-Kumar-Resume';
  var pageTitle = document.title;

  window.addEventListener('beforeprint', function () { document.title = PDF_NAME; });
  window.addEventListener('afterprint', function () { document.title = pageTitle; });

  var pdfBtn = document.querySelector('.pdf-btn');
  if (pdfBtn && typeof window.print === 'function') {
    pdfBtn.hidden = false;
    pdfBtn.addEventListener('click', function () {
      showAll();
      document.title = PDF_NAME; // some browsers read the title before beforeprint fires
      window.print();
    });
  }
})();

// Disable the context menu (right click) site-wide.
document.addEventListener("contextmenu", (event) => event.preventDefault());

// Disable zooming: Ctrl/Cmd + wheel/trackpad pinch, Ctrl/Cmd + +/-/0, and touch pinch/double-tap.
document.addEventListener(
  "wheel",
  (event) => {
    if (event.ctrlKey || event.metaKey) event.preventDefault();
  },
  { passive: false }
);
document.addEventListener("keydown", (event) => {
  if (
    (event.ctrlKey || event.metaKey) &&
    ["+", "=", "-", "_", "0"].includes(event.key)
  ) {
    event.preventDefault();
  }
});
["gesturestart", "gesturechange", "gestureend"].forEach((type) =>
  document.addEventListener(type, (event) => event.preventDefault())
);
document.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches.length > 1) event.preventDefault();
  },
  { passive: false }
);
let lastTouchEnd = 0;
document.addEventListener(
  "touchend",
  (event) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) event.preventDefault();
    lastTouchEnd = now;
  },
  { passive: false }
);
