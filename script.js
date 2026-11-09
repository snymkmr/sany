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

const toggle = document.querySelector(".theme-toggle");
if (toggle) {
  const syncLabel = () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    toggle.setAttribute("aria-label", `Switch to ${next} mode`);
  };

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
      el.dispatchEvent(new CustomEvent("greeting", { bubbles: true }));
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
  // How much room there is relative to what's needed: >= 1 means it fits.
  const room = () => {
    const kids = [...main.children].filter((el) => el.offsetHeight);
    if (!kids.length) return Infinity;
    const first = kids[0];
    const last = kids[kids.length - 1];
    const cs = getComputedStyle(main);
    const needed =
      last.offsetTop + last.offsetHeight - first.offsetTop +
      parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    const height = (main.clientHeight + 1) / needed;
    const width = h1 ? (h1.clientWidth + 1) / h1.scrollWidth : Infinity;
    return Math.min(height, width);
  };
  const fits = () => room() >= 1;

  const apply = (k) => {
    root.style.setProperty("--fit", k);
    root.style.fontSize = `${k * 100}%`;
  };

  // Every measurement forces a layout, so keep them few: nearly everything
  // scales with the root font size, so the first measurement predicts the
  // answer closely. Bisect only a narrow bracket around that guess (falling
  // back to the full range if the guess is off), to 0.4% precision.
  const fit = () => {
    apply(1);
    const r = room();
    if (r >= 1) return;
    let lo = 0.35;
    let hi = 1;
    const guessHi = Math.min(hi, r * 1.08);
    const guessLo = Math.max(lo, r * 0.92);
    apply(guessHi);
    if (fits()) lo = guessHi;
    else {
      hi = guessHi;
      apply(guessLo);
      if (fits()) lo = guessLo;
      else hi = guessLo;
    }
    for (let i = 0; i < 10 && hi - lo > 0.004; i++) {
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

  // If the web font is already in (e.g. from cache), this first fit is final;
  // otherwise refit once it swaps in, since its metrics change the layout.
  const fontReady = document.fonts?.check('1em "Geist Mono"') ?? true;
  fit();
  window.addEventListener("resize", schedule);
  if (!fontReady) document.fonts.ready.then(fit);
}

/* Home portrait: eyes follow the cursor (mouse/trackpad only) */
const face = document.querySelector(".h1-icon.face");
const look = face?.querySelector(".look");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const calm = window.matchMedia("(prefers-reduced-motion: reduce)");
if (face && look) {
  // Pupils rest a little up and to the right of each lens centre (in SVG units)
  const REST_X = 0.5;
  const REST_Y = -0.3;
  const REACH = 0.9; // how far a pupil may travel from the lens centre
  let frame = 0;
  let px = 0;
  let py = 0;
  let peeking = false;
  let peekBack = 0;
  let lastMove = -Infinity;

  // Point the pupils at a spot on screen (in client pixels)
  const lookAt = (tx, ty) => {
    const box = face.getBoundingClientRect();
    if (!box.width) return;
    const scale = box.width / 24;
    // Midpoint between the two lenses, in screen pixels
    const cx = box.left + 12 * scale;
    const cy = box.top + 12.4 * scale;
    const dx = tx - cx;
    const dy = ty - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const pull = Math.min(1, dist / (40 * scale)) * REACH;
    const x = (dx / dist) * pull - REST_X;
    const y = (dy / dist) * pull - REST_Y;
    look.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`;
  };

  const aim = () => {
    frame = 0;
    if (!peeking) lookAt(px, py);
  };

  // Cursor stops: blink, look the viewer in the eye and smile, then after a
  // moment look away like a person would, instead of staring.
  const IDLE_MS = 1200;
  const GAZE_MS = 2500;
  let idle = 0;
  let gaze = 0;

  // The mouth bends between a half smile and a full one. Both curves share
  // the same commands, so we tween their numbers; a tween starts from wherever
  // the mouth is now, so interrupting it never jumps.
  const mouth = face.querySelector(".mouth");
  const SMIRK = [11, 18.7, 0.9, 0.5, 2.2, 0.5, 3.1, -0.1];
  const GRIN = [10.4, 18.35, 1.2, 1.15, 3.3, 1.15, 4.4, -0.15];
  let mood = 0; // 0 = smirk, 1 = grin
  let tween = 0;

  const drawMouth = (k) => {
    const v = SMIRK.map((a, i) => (a + (GRIN[i] - a) * k).toFixed(2));
    mouth?.setAttribute("d", `M${v[0]} ${v[1]}c${v[2]} ${v[3]} ${v[4]} ${v[5]} ${v[6]} ${v[7]}`);
  };

  const smile = (to, ms) => {
    cancelAnimationFrame(tween);
    const from = mood;
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / ms);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      mood = from + (to - from) * eased;
      drawMouth(mood);
      if (t < 1) tween = requestAnimationFrame(step);
    };
    tween = requestAnimationFrame(step);
  };

  const eyes = face.querySelector(".eyes");
  const blink = () =>
    eyes?.animate?.(
      [{ transform: "scaleY(1)" }, { transform: "scaleY(0.1)" }, { transform: "scaleY(1)" }],
      { duration: 180, easing: "ease-in-out" },
    );

  const unhappy = (ms = 350) => {
    clearTimeout(gaze);
    if (!face.classList.contains("happy")) return;
    face.classList.remove("happy");
    smile(0, ms);
  };

  // Back to the idle side-eye loop (also used when the cursor leaves)
  const settle = () => {
    clearTimeout(idle);
    unhappy(500);
    face.classList.remove("tracking");
    look.style.transform = "";
  };

  const contact = () => {
    blink();
    face.classList.add("happy");
    look.style.transform = `translate(${-REST_X}px, ${-REST_Y}px)`;
    smile(1, 600);
    gaze = setTimeout(settle, GAZE_MS);
  };

  document.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse" || !finePointer.matches || calm.matches) return;
    px = e.clientX;
    py = e.clientY;
    lastMove = performance.now();
    if (peeking) {
      peeking = false;
      clearTimeout(peekBack);
      face.classList.remove("peek");
    }
    face.classList.add("tracking");
    unhappy();
    clearTimeout(idle);
    idle = setTimeout(contact, IDLE_MS);
    if (!frame) frame = requestAnimationFrame(aim);
  });
  // Cursor over the face: take the glasses off; put them back when it leaves.
  // (Touch screens use press-and-hold instead; see below.)
  const over = (x, y) => {
    const b = face.getBoundingClientRect();
    return x >= b.left && x <= b.right && y >= b.top && y <= b.bottom;
  };
  // Glasses off = the world goes blurry (see .myopic in the CSS)
  new MutationObserver(() => root.classList.toggle("myopic", face.classList.contains("bare")))
    .observe(face, { attributes: true, attributeFilter: ["class"] });

  // In light mode it's too bright out: after a couple of seconds of hovering
  // the sunglasses go back on by themselves (until the cursor leaves).
  const BRIGHT_MS = 2000;
  const sunny = () => getComputedStyle(root).getPropertyValue("--shades").trim() === "1";
  let hovering = false;
  let brightTimer = 0;
  const hover = (on, { tooBright = true } = {}) => {
    if (on === hovering) return;
    hovering = on;
    face.classList.toggle("hover", on);
    face.classList.toggle("bare", on);
    clearTimeout(brightTimer);
    if (on && tooBright) {
      brightTimer = setTimeout(() => {
        if (hovering && sunny()) face.classList.remove("bare");
      }, BRIGHT_MS);
    }
  };
  document.addEventListener("pointermove", (e) => {
    if (e.pointerType === "mouse") hover(over(e.clientX, e.clientY));
  });
  // Touch screens have no cursor to follow, so touches stand in for it:
  // press on the face and the glasses stay off (page blurred) for as long as
  // the finger is down, going back on a moment after it lifts;
  // tap anywhere else and the eyes glance over to where you tapped.
  const RELEASE_MS = 700;
  const TAP_LOOK_MS = 1200;
  let tapTimer = 0;
  let holdId = null;
  document.addEventListener("pointerdown", (e) => {
    if (e.pointerType === "mouse") return;
    clearTimeout(tapTimer);
    if (over(e.clientX, e.clientY)) {
      holdId = e.pointerId;
      hover(false); // restart, so each press nods again
      void face.getBoundingClientRect();
      hover(true, { tooBright: false }); // held = stays off, even in light mode
      return;
    }
    if (calm.matches) return;
    clearTimeout(peekBack);
    peeking = true;
    face.classList.add("peek");
    lookAt(e.clientX, e.clientY);
    peekBack = setTimeout(() => {
      peeking = false;
      face.classList.remove("peek");
      settle();
    }, TAP_LOOK_MS);
  });
  const release = (e) => {
    if (e.pointerId !== holdId) return;
    holdId = null;
    tapTimer = setTimeout(() => hover(false), RELEASE_MS);
  };
  document.addEventListener("pointerup", release);
  document.addEventListener("pointercancel", release);
  // A long press would otherwise open the phone's context menu on the face
  face.addEventListener("contextmenu", (e) => e.preventDefault());
  document.documentElement.addEventListener("pointerleave", (e) => {
    if (e.pointerType === "mouse") hover(false);
  });

  document.documentElement.addEventListener("pointerleave", settle);
  window.addEventListener("blur", () => {
    settle();
    hover(false); // don't leave the page blurred while the window is in the background
  });

  // Now and then, glance up at the greeting when a new word finishes typing,
  // then look back. Never while the eyes are busy following a moving cursor.
  const greeting = document.querySelector(".home .txt-rotate");
  const PEEK_CHANCE = 0.4;
  const PEEK_MS = 1300;
  let lastPeek = -Infinity;
  greeting?.addEventListener("greeting", () => {
    const now = performance.now();
    if (calm.matches || peeking || document.hidden) return;
    if (now - lastMove < IDLE_MS || now - lastPeek < 5000) return;
    if (Math.random() > PEEK_CHANCE) return;
    lastPeek = now;
    peeking = true;
    unhappy(500); // a glance away also ends any eye contact
    face.classList.add("peek");
    const word = greeting.getBoundingClientRect();
    lookAt(word.right, word.top + word.height / 2);
    peekBack = setTimeout(() => {
      peeking = false;
      face.classList.remove("peek");
      settle();
    }, PEEK_MS);
  });
}

// Disable the context menu (right click) site-wide.
document.addEventListener("contextmenu", (event) => event.preventDefault());
