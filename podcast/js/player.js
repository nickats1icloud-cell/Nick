/*
 * Global audio player.
 * ------------------------------------------------------------------
 * Ένα singleton που ζει σε κάθε σελίδα: κρατάει το <audio>, φτιάχνει το
 * sticky mini-player κάτω-κάτω, θυμάται πού σταμάτησες (localStorage) και
 * ενημερώνει όποιο κομμάτι του UI έχει κάνει subscribe.
 *
 * DEMO λειτουργία: αν ένα επεισόδιο δεν έχει `audio` URL (ή το αρχείο δεν
 * φορτώνει), τρέχουμε εικονικό ρολόι με την ίδια ακριβώς λογική, ώστε να
 * δουλεύουν seek, chapters, ταχύτητα και αποθήκευση προόδου. Το UI το
 * δηλώνει καθαρά με ένδειξη "DEMO" — δεν προσποιούμαστε ότι παίζει ήχος.
 */

import { EPISODES_SORTED, getEpisode } from "./data/episodes.js";
import { icon } from "./icons.js";
import { timecode } from "./format.js";
import { getPlayerPrefs, savePlayerPrefs, saveProgress, getProgress } from "./store.js";

const RATES = [0.8, 1, 1.2, 1.5, 1.75, 2];
const SKIP_BACK = 15;
const SKIP_FWD = 30;

const state = {
  episode: null,
  playing: false,
  time: 0,
  duration: 0,
  demo: false,
  ready: false,
};

const listeners = new Set();
const prefs = getPlayerPrefs();

let audio = null;
let demoTimer = null;
let lastSaved = 0;
let dom = null;

/* ---------------- subscribe / notify ---------------- */

export function onPlayerChange(fn) {
  listeners.add(fn);
  fn(snapshot());
  return () => listeners.delete(fn);
}

function snapshot() {
  return { ...state };
}

function notify() {
  const snap = snapshot();
  for (const fn of listeners) {
    try {
      fn(snap);
    } catch (err) {
      console.error("player listener", err);
    }
  }
}

/* ---------------- public API ---------------- */

export const Player = {
  get state() {
    return snapshot();
  },

  /** Ξεκινάει (ή κάνει pause/resume αν είναι ήδη το τρέχον) ένα επεισόδιο. */
  play(episodeOrId, { seek = null, autoplay = true } = {}) {
    const episode =
      typeof episodeOrId === "string" ? getEpisode(episodeOrId) : episodeOrId;
    if (!episode) return;

    if (state.episode?.id === episode.id) {
      if (seek !== null) this.seek(seek);
      if (autoplay) this.toggle();
      return;
    }

    load(episode, seek);
    if (autoplay) start();
    notify();
  },

  /** Play/pause στο τρέχον επεισόδιο. */
  toggle() {
    if (!state.episode) return;
    state.playing ? stop() : start();
  },

  pause() {
    if (state.playing) stop();
  },

  seek(seconds) {
    if (!state.episode) return;
    const target = Math.max(0, Math.min(state.duration || 0, seconds));
    state.time = target;
    if (!state.demo && audio) audio.currentTime = target;
    persist(true);
    render();
    notify();
  },

  skip(delta) {
    this.seek(state.time + delta);
  },

  setRate(rate) {
    prefs.rate = rate;
    if (audio) audio.playbackRate = rate;
    savePlayerPrefs({ rate });
    render();
  },

  cycleRate() {
    const next = RATES[(RATES.indexOf(prefs.rate) + 1) % RATES.length] ?? 1;
    this.setRate(next);
  },

  setVolume(volume) {
    prefs.volume = volume;
    prefs.muted = volume === 0;
    if (audio) {
      audio.volume = volume;
      audio.muted = prefs.muted;
    }
    savePlayerPrefs({ volume, muted: prefs.muted });
    render();
  },

  toggleMute() {
    prefs.muted = !prefs.muted;
    if (audio) audio.muted = prefs.muted;
    savePlayerPrefs({ muted: prefs.muted });
    render();
  },

  /** Επόμενο/προηγούμενο επεισόδιο με βάση τη χρονολογική λίστα. */
  step(direction) {
    if (!state.episode) return;
    const index = EPISODES_SORTED.findIndex((ep) => ep.id === state.episode.id);
    const next = EPISODES_SORTED[index + direction];
    if (next) this.play(next);
  },

  isCurrent(id) {
    return state.episode?.id === id;
  },

  isPlaying(id) {
    return state.playing && state.episode?.id === id;
  },
};

/* ---------------- εσωτερικά ---------------- */

function ensureAudio() {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = "metadata";
  audio.volume = prefs.volume;
  audio.muted = prefs.muted;
  audio.playbackRate = prefs.rate;

  audio.addEventListener("loadedmetadata", () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      state.duration = audio.duration;
    }
    state.ready = true;
    render();
    notify();
  });

  audio.addEventListener("timeupdate", () => {
    if (state.demo) return;
    state.time = audio.currentTime;
    persist();
    render();
  });

  audio.addEventListener("progress", renderBuffered);

  audio.addEventListener("ended", () => {
    state.playing = false;
    state.time = state.duration;
    persist(true);
    render();
    notify();
  });

  // Δεν υπάρχει (ακόμα) αρχείο ήχου → πέφτουμε σε demo χωρίς να σπάσει τίποτα.
  audio.addEventListener("error", () => {
    if (!state.episode) return;
    enterDemo();
  });

  return audio;
}

function load(episode, seek) {
  stopDemoTimer();
  state.episode = episode;
  state.duration = episode.duration || 0;
  state.demo = !episode.audio;
  state.ready = state.demo;

  const stored = getProgress(episode.id);
  // Αν είχε τελειώσει σχεδόν, ξεκινάμε από την αρχή.
  const resume =
    seek !== null && seek !== undefined
      ? seek
      : stored && stored.time < (episode.duration || 0) - 30
        ? stored.time
        : 0;
  state.time = resume;

  if (!state.demo) {
    const el = ensureAudio();
    el.src = episode.audio;
    el.load();
    if (resume > 0) {
      el.addEventListener("loadedmetadata", () => (el.currentTime = resume), {
        once: true,
      });
    }
  }

  document.body.classList.add("has-player");
  dom?.root.classList.add("is-active");
  render();
  updateMediaSession();
}

function enterDemo() {
  if (state.demo) return;
  state.demo = true;
  state.ready = true;
  state.duration = state.episode?.duration || state.duration;
  if (state.playing) startDemoTimer();
  render();
  notify();
}

function start() {
  if (!state.episode) return;
  state.playing = true;

  if (state.demo) {
    startDemoTimer();
  } else {
    const el = ensureAudio();
    el.playbackRate = prefs.rate;
    const promise = el.play();
    if (promise?.catch) promise.catch(() => enterDemo());
  }

  render();
  notify();
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "playing";
}

function stop() {
  state.playing = false;
  stopDemoTimer();
  if (!state.demo && audio) audio.pause();
  persist(true);
  render();
  notify();
  if ("mediaSession" in navigator) navigator.mediaSession.playbackState = "paused";
}

function startDemoTimer() {
  stopDemoTimer();
  let last = performance.now();
  demoTimer = setInterval(() => {
    const now = performance.now();
    const delta = ((now - last) / 1000) * prefs.rate;
    last = now;
    state.time = Math.min(state.duration, state.time + delta);
    if (state.time >= state.duration) {
      stop();
      return;
    }
    persist();
    render();
  }, 250);
}

function stopDemoTimer() {
  if (demoTimer) clearInterval(demoTimer);
  demoTimer = null;
}

function persist(force = false) {
  if (!state.episode) return;
  const now = Date.now();
  if (!force && now - lastSaved < 4000) return;
  lastSaved = now;
  saveProgress(state.episode.id, state.time, state.duration);
}

function updateMediaSession() {
  if (!("mediaSession" in navigator) || !state.episode) return;
  navigator.mediaSession.metadata = new window.MediaMetadata({
    title: state.episode.title,
    artist: "Greek SimRacers Podcast",
    album: `Σεζόν ${state.episode.season} · Επεισόδιο ${state.episode.number}`,
  });
  const handlers = {
    play: () => Player.toggle(),
    pause: () => Player.pause(),
    seekbackward: () => Player.skip(-SKIP_BACK),
    seekforward: () => Player.skip(SKIP_FWD),
    previoustrack: () => Player.step(1), // "προηγούμενο" = παλαιότερο
    nexttrack: () => Player.step(-1),
  };
  for (const [action, handler] of Object.entries(handlers)) {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      /* ο browser δεν το υποστηρίζει */
    }
  }
}

/* ---------------- mini player UI ---------------- */

function build() {
  const root = document.createElement("div");
  root.className = "player";
  root.setAttribute("role", "region");
  root.setAttribute("aria-label", "Αναπαραγωγή επεισοδίου");
  root.innerHTML = `
    <div class="player__seek" role="slider" tabindex="0" aria-label="Θέση αναπαραγωγής"
         aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-valuetext="0:00">
      <div class="player__seek-buffered"></div>
      <div class="player__seek-fill"></div>
      <div class="player__seek-knob"></div>
    </div>
    <div class="container player__inner">
      <div class="player__now">
        <div class="art art--sm" data-art><span class="art__num"></span></div>
        <div style="min-width:0">
          <div class="player__title"><a data-link href="#"></a></div>
          <div class="player__sub"><span data-sub></span> <span class="player__demo" hidden>demo</span></div>
        </div>
      </div>
      <div class="player__controls">
        <button class="icon-btn" data-act="prev" aria-label="Προηγούμενο επεισόδιο">${icon("prev")}</button>
        <button class="icon-btn" data-act="back" aria-label="Πίσω ${SKIP_BACK} δευτερόλεπτα">${icon("back15")}</button>
        <button class="play-btn" data-act="toggle" aria-label="Αναπαραγωγή">
          <span class="icon-play">${icon("play")}</span><span class="icon-pause">${icon("pause")}</span>
        </button>
        <button class="icon-btn" data-act="fwd" aria-label="Μπροστά ${SKIP_FWD} δευτερόλεπτα">${icon("fwd30")}</button>
        <button class="icon-btn" data-act="next" aria-label="Επόμενο επεισόδιο">${icon("next")}</button>
      </div>
      <div class="player__extra">
        <span class="player__time" data-time>0:00 / 0:00</span>
        <button class="btn btn--sm speed-btn" data-act="rate" aria-label="Ταχύτητα αναπαραγωγής">1x</button>
        <div class="volume">
          <button class="icon-btn" data-act="mute" aria-label="Σίγαση">${icon("volume")}</button>
          <input type="range" min="0" max="1" step="0.05" aria-label="Ένταση" data-volume>
        </div>
        <button class="icon-btn" data-act="close" aria-label="Κλείσιμο player">${icon("close")}</button>
      </div>
    </div>`;
  document.body.appendChild(root);

  dom = {
    root,
    seek: root.querySelector(".player__seek"),
    fill: root.querySelector(".player__seek-fill"),
    buffered: root.querySelector(".player__seek-buffered"),
    knob: root.querySelector(".player__seek-knob"),
    art: root.querySelector("[data-art]"),
    artNum: root.querySelector(".art__num"),
    link: root.querySelector("[data-link]"),
    sub: root.querySelector("[data-sub]"),
    demo: root.querySelector(".player__demo"),
    toggle: root.querySelector('[data-act="toggle"]'),
    time: root.querySelector("[data-time]"),
    rate: root.querySelector('[data-act="rate"]'),
    mute: root.querySelector('[data-act="mute"]'),
    volume: root.querySelector("[data-volume]"),
  };

  dom.volume.value = prefs.muted ? 0 : prefs.volume;

  root.addEventListener("click", (event) => {
    const button = event.target.closest("[data-act]");
    if (!button) return;
    const actions = {
      toggle: () => Player.toggle(),
      back: () => Player.skip(-SKIP_BACK),
      fwd: () => Player.skip(SKIP_FWD),
      prev: () => Player.step(1),
      next: () => Player.step(-1),
      rate: () => Player.cycleRate(),
      mute: () => Player.toggleMute(),
      close: () => closePlayer(),
    };
    actions[button.dataset.act]?.();
  });

  dom.volume.addEventListener("input", (event) =>
    Player.setVolume(Number(event.target.value))
  );

  /* Seek με ποντίκι/αφή + drag */
  const seekTo = (clientX) => {
    const rect = dom.seek.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    Player.seek(ratio * state.duration);
  };

  let dragging = false;
  dom.seek.addEventListener("pointerdown", (event) => {
    dragging = true;
    dom.seek.setPointerCapture(event.pointerId);
    seekTo(event.clientX);
  });
  dom.seek.addEventListener("pointermove", (event) => {
    if (dragging) seekTo(event.clientX);
  });
  dom.seek.addEventListener("pointerup", () => (dragging = false));
  dom.seek.addEventListener("pointercancel", () => (dragging = false));

  dom.seek.addEventListener("keydown", (event) => {
    const step = event.shiftKey ? 60 : 10;
    const map = {
      ArrowRight: () => Player.skip(step),
      ArrowLeft: () => Player.skip(-step),
      Home: () => Player.seek(0),
      End: () => Player.seek(state.duration),
      " ": () => Player.toggle(),
    };
    if (map[event.key]) {
      event.preventDefault();
      map[event.key]();
    }
  });

  return dom;
}

function closePlayer() {
  stop();
  state.episode = null;
  document.body.classList.remove("has-player");
  dom.root.classList.remove("is-active");
  notify();
}

function currentChapter() {
  const chapters = state.episode?.chapters || [];
  let current = null;
  for (const chapter of chapters) {
    if (state.time >= chapter.t) current = chapter;
  }
  return current;
}

function renderBuffered() {
  if (!dom || state.demo || !audio || !state.duration) return;
  try {
    if (audio.buffered.length) {
      const end = audio.buffered.end(audio.buffered.length - 1);
      dom.buffered.style.width = `${(end / state.duration) * 100}%`;
    }
  } catch {
    /* buffered μπορεί να πετάξει πριν φορτώσει */
  }
}

function render() {
  if (!dom || !state.episode) return;
  const ep = state.episode;
  const ratio = state.duration ? state.time / state.duration : 0;
  const percent = `${(ratio * 100).toFixed(2)}%`;

  dom.fill.style.width = percent;
  dom.knob.style.left = percent;
  dom.seek.setAttribute("aria-valuenow", Math.round(ratio * 100));
  dom.seek.setAttribute(
    "aria-valuetext",
    `${timecode(state.time)} από ${timecode(state.duration)}`
  );

  dom.art.style.setProperty("--art-h", ep.hue ?? 243);
  dom.artNum.textContent = `#${ep.number}`;
  dom.link.textContent = ep.title;
  dom.link.href = `episode.html?id=${encodeURIComponent(ep.id)}`;

  const chapter = currentChapter();
  dom.sub.textContent = chapter
    ? `${timecode(state.time)} · ${chapter.title}`
    : `Επεισόδιο ${ep.number} · ${timecode(state.time)}`;
  dom.demo.hidden = !state.demo;

  dom.toggle.dataset.playing = String(state.playing);
  dom.toggle.setAttribute("aria-label", state.playing ? "Παύση" : "Αναπαραγωγή");
  dom.time.textContent = `${timecode(state.time)} / ${timecode(state.duration)}`;
  dom.rate.textContent = `${prefs.rate}x`;
  dom.mute.innerHTML = prefs.muted || prefs.volume === 0 ? icon("mute") : icon("volume");
  renderBuffered();
}

/* ---------------- keyboard shortcuts ---------------- */

function isTyping(target) {
  return (
    target instanceof HTMLElement &&
    (target.matches("input, textarea, select") || target.isContentEditable)
  );
}

function bindShortcuts() {
  window.addEventListener("keydown", (event) => {
    if (isTyping(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (!state.episode) return;
    if (document.querySelector(".palette.is-open")) return;

    const map = {
      " ": () => Player.toggle(),
      k: () => Player.toggle(),
      ArrowLeft: () => Player.skip(-SKIP_BACK),
      ArrowRight: () => Player.skip(SKIP_FWD),
      j: () => Player.skip(-SKIP_BACK),
      l: () => Player.skip(SKIP_FWD),
      m: () => Player.toggleMute(),
    };
    const handler = map[event.key];
    if (handler) {
      event.preventDefault();
      handler();
    }
  });

  // Αποθήκευση προόδου όταν φεύγει ο χρήστης από τη σελίδα.
  window.addEventListener("pagehide", () => persist(true));
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") persist(true);
  });
}

/** Καλείται μία φορά ανά σελίδα (από το ui.js). */
export function initPlayer() {
  if (dom) return Player;
  build();
  bindShortcuts();
  return Player;
}
