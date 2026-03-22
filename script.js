const sunMoonContainer = document.querySelector(".sun-moon-container");
const chk = document.getElementById("chk");
const THEME_STORAGE_KEY = "theme-preference";

const getStoredTheme = () => {
  try {
    const theme = localStorage.getItem(THEME_STORAGE_KEY);
    return theme === "dark" || theme === "light" ? theme : null;
  } catch (_error) {
    return null;
  }
};

const storeTheme = (theme) => {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch (_error) {
    // Ignore storage errors (e.g. private mode restrictions).
  }
};

if (chk) {
  const isDarkTheme = getStoredTheme() === "dark";
  chk.checked = isDarkTheme;
  document.body.classList.toggle("dark", isDarkTheme);

  if (sunMoonContainer) {
    sunMoonContainer.style.setProperty("--rotation", isDarkTheme ? "180" : "0");
  }

  chk.addEventListener("change", () => {
    const isDarkThemeSelected = chk.checked;
    document.body.classList.toggle("dark", isDarkThemeSelected);
    storeTheme(isDarkThemeSelected ? "dark" : "light");

    if (!sunMoonContainer) {
      return;
    }

    const currentRotation = parseInt(
      getComputedStyle(sunMoonContainer).getPropertyValue("--rotation"),
      10
    );
    const safeRotation = Number.isNaN(currentRotation) ? 0 : currentRotation;
    sunMoonContainer.style.setProperty("--rotation", safeRotation + 180);
  });
}

const TxtRotate = function (el, toRotate, period) {
  this.toRotate = toRotate;
  this.el = el;
  this.loopNum = 0;
  this.period = parseInt(period, 10) || 1000;
  this.txt = "";
  this.isDeleting = false;
  this.wrap = document.createElement("span");
  this.wrap.className = "wrap";
  this.el.appendChild(this.wrap);
  this.tick();
};

TxtRotate.prototype.tick = function () {
  const i = this.loopNum % this.toRotate.length;
  const fullTxt = this.toRotate[i];

  if (this.isDeleting) {
    this.txt = fullTxt.substring(0, this.txt.length - 1);
  } else {
    this.txt = fullTxt.substring(0, this.txt.length + 1);
  }

  this.wrap.textContent = this.txt;

  let delta = 300 - Math.random() * 100;
  if (this.isDeleting) {
    delta /= 2;
  }

  if (!this.isDeleting && this.txt === fullTxt) {
    delta = this.period;
    this.isDeleting = true;
  } else if (this.isDeleting && this.txt === "") {
    this.isDeleting = false;
    this.loopNum++;
    delta = 500;
  }

  setTimeout(() => {
    this.tick();
  }, delta);
};

window.addEventListener("DOMContentLoaded", () => {
  const elements = document.getElementsByClassName("txt-rotate");
  for (let i = 0; i < elements.length; i++) {
    const toRotate = elements[i].getAttribute("data-rotate");
    const period = elements[i].getAttribute("data-period");
    if (toRotate) {
      new TxtRotate(elements[i], JSON.parse(toRotate), period);
    }
  }

  const css = document.createElement("style");
  css.type = "text/css";
  css.textContent = ".txt-rotate > .wrap { border-right: 0.08em solid #666; }";
  document.head.appendChild(css);
});
