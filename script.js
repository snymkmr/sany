const THEME_STORAGE_KEY = "theme-preference";
const root = document.documentElement;
const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");

const storeTheme = (theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (_error) {
    // Ignore storage errors (e.g. private mode restrictions).
  }
};

const currentTheme = () =>
  root.dataset.theme || (darkQuery.matches ? "dark" : "light");

const THEME_LABELS = {
  en: { dark: "Switch to dark mode", light: "Switch to light mode" },
  fr: { dark: "Passer au mode sombre", light: "Passer au mode clair" },
  hi: { dark: "डार्क मोड पर जाएँ", light: "लाइट मोड पर जाएँ" },
};

const toggle = document.querySelector(".theme-toggle");
if (toggle) {
  const syncLabel = () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    const labels = THEME_LABELS[root.lang] || THEME_LABELS.en;
    toggle.setAttribute("aria-label", labels[next]);
  };

  // The 404 page can switch language in place
  document.addEventListener("langchange", syncLabel);

  toggle.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    storeTheme(next);
    syncLabel();
  });

  darkQuery.addEventListener?.("change", syncLabel);
  syncLabel();
}

/* Rotating multilingual greeting */
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const rotate = (el, words, period) => {
  const wrap = document.createElement("span");
  wrap.className = "wrap";
  el.prepend(wrap); // text goes before the cursor

  if (reduceMotion) {
    wrap.textContent = words[0];
    return;
  }

  // Split into whole characters (grapheme clusters) so scripts like
  // Devanagari or Gurmukhi never show half-formed glyphs while typing.
  const segmenter = window.Intl?.Segmenter ? new Intl.Segmenter(undefined, { granularity: "grapheme" }) : null;
  const split = (word) => (segmenter ? [...segmenter.segment(word)].map((s) => s.segment) : [...word]);
  const glyphs = words.map(split);

  let index = 0;
  let count = 0;
  let deleting = false;

  const tick = () => {
    const full = glyphs[index % glyphs.length];
    count += deleting ? -1 : 1;
    wrap.textContent = full.slice(0, count).join("");
    el.classList.add("typing");

    let delay = deleting ? 60 : 140 - Math.random() * 50;
    if (!deleting && count >= full.length) {
      delay = period;
      deleting = true;
      el.classList.remove("typing");
    } else if (deleting && count <= 0) {
      count = 0;
      deleting = false;
      index++;
      delay = 400;
    }
    setTimeout(tick, delay);
  };

  tick();
};

document.querySelectorAll(".txt-rotate").forEach((el) => {
  try {
    const words = JSON.parse(el.dataset.rotate || "[]");
    if (words.length) rotate(el, words, parseInt(el.dataset.period, 10) || 1400);
  } catch (_error) {
    // Ignore malformed data.
  }
});

/* Soft glow that follows the pointer */
const glow = document.querySelector(".glow");
if (glow && !reduceMotion && window.matchMedia("(hover: hover)").matches) {
  let frame = 0;
  window.addEventListener("pointermove", (e) => {
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      glow.style.setProperty("--mx", `${e.clientX}px`);
      glow.style.setProperty("--my", `${e.clientY}px`);
    });
  });
}

/* No scroll, at any screen size: shrink everything until it fits */
const main = document.querySelector(".home main");
if (main) {
  const h1 = main.querySelector("h1");

  // Measure layout boxes (offset*), which ignore transforms, so the
  // entrance animation's translate never registers as overflow.
  const fits = () => {
    const kids = [...main.children].filter((el) => el.offsetHeight);
    if (!kids.length) return true;
    const first = kids[0];
    const last = kids[kids.length - 1];
    const cs = getComputedStyle(main);
    const needed =
      last.offsetTop + last.offsetHeight - first.offsetTop +
      parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const nameFits = !h1 || h1.scrollWidth <= h1.clientWidth + 1;
    return needed <= main.clientHeight + 1 && nameFits;
  };

  const apply = (k) => {
    root.style.setProperty("--fit", k);
    root.style.fontSize = `${k * 100}%`;
  };

  const fit = () => {
    apply(1);
    if (fits()) return;
    let lo = 0.35;
    let hi = 1;
    for (let i = 0; i < 10; i++) {
      const mid = (lo + hi) / 2;
      apply(mid);
      if (fits()) lo = mid;
      else hi = mid;
    }
    apply(lo);
  };

  let pending = 0;
  const schedule = () => {
    cancelAnimationFrame(pending);
    pending = requestAnimationFrame(fit);
  };

  fit();
  window.addEventListener("resize", schedule);
  document.fonts?.ready.then(fit);
}
