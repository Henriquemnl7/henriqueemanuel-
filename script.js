const introLayer = document.querySelector(".intro-layer");
const heroContent = document.querySelector(".hero-content");
const cta = document.querySelector(".cta");
const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const hasFinePointer = window.matchMedia("(pointer: fine)").matches;

function returnToStart(event) {
  event.preventDefault();
  if (window.location.hash !== "#inicio") history.pushState(null, "", "#inicio");
  window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
}

document.querySelectorAll('a[href="#inicio"]').forEach((link) => {
  link.addEventListener("click", returnToStart);
});

window.addEventListener("hashchange", () => {
  if (window.location.hash === "#inicio") {
    window.scrollTo({ top: 0, behavior: prefersReducedMotion ? "auto" : "smooth" });
  }
});

if (window.location.hash === "#inicio") window.scrollTo(0, 0);

requestAnimationFrame(() => {
  requestAnimationFrame(() => document.body.classList.add("is-ready"));
});

let cursorFrame = 0;
let cursorX = window.innerWidth / 2;
let cursorY = window.innerHeight / 2;

function paintCursorGlow() {
  document.documentElement.style.setProperty("--cursor-x", cursorX + "px");
  document.documentElement.style.setProperty("--cursor-y", cursorY + "px");
  document.body.classList.add("cursor-active");
  cursorFrame = 0;
}

if (hasFinePointer && !prefersReducedMotion) {
  document.addEventListener("pointermove", (event) => {
    cursorX = event.clientX;
    cursorY = event.clientY;
    if (!cursorFrame) cursorFrame = requestAnimationFrame(paintCursorGlow);
  }, { passive: true });
  document.addEventListener("pointerleave", () => document.body.classList.remove("cursor-active"));

  cta.addEventListener("pointermove", (event) => {
    const bounds = cta.getBoundingClientRect();
    cta.style.setProperty("--cta-x", event.clientX - bounds.left + "px");
    cta.style.setProperty("--cta-y", event.clientY - bounds.top + "px");
    cta.classList.add("cursor-active");
  }, { passive: true });
  cta.addEventListener("pointerleave", () => cta.classList.remove("cursor-active"));
}

let transitionFrame = 0;
let transitionViewportHeight = Math.max(window.innerHeight, 1);
let transitionViewportWidth = window.innerWidth;

function updateTransition() {
  transitionFrame = 0;
  const progress = Math.min(1, Math.max(0, window.scrollY / transitionViewportHeight));
  const mobileMotion = window.innerWidth <= 800;
  if (progress === 0 || (prefersReducedMotion && !mobileMotion)) {
    introLayer.style.filter = "";
    introLayer.style.removeProperty("transform");
    introLayer.style.opacity = "";
    heroContent.style.filter = "";
    return;
  }

  if (mobileMotion) {
    introLayer.style.setProperty("filter", `blur(${(progress * 22).toFixed(2)}px)`, "important");
    introLayer.style.setProperty("transform", `translateZ(0) scale(${(1 - progress * 0.055).toFixed(4)})`, "important");
    introLayer.style.opacity = String(1 - progress * 0.45);
    heroContent.style.filter = "";
    return;
  }

  const blurAmount = hasFinePointer ? 22 : 20;
  const scaleAmount = hasFinePointer ? 0.055 : 0.05;
  const opacityAmount = hasFinePointer ? 0.45 : 0.5;

  introLayer.style.filter = `blur(${(progress * blurAmount).toFixed(2)}px)`;
  introLayer.style.transform = `translateZ(0) scale(${(1 - progress * scaleAmount).toFixed(4)})`;
  introLayer.style.opacity = String(1 - progress * opacityAmount);
}

function requestTransitionUpdate() {
  if (!transitionFrame) transitionFrame = requestAnimationFrame(updateTransition);
}

window.addEventListener("scroll", requestTransitionUpdate, { passive: true });
window.addEventListener("resize", () => {
  const nextWidth = window.innerWidth;
  if (Math.abs(nextWidth - transitionViewportWidth) > 2) {
    transitionViewportWidth = nextWidth;
    transitionViewportHeight = Math.max(window.innerHeight, 1);
  }
  requestTransitionUpdate();
});
updateTransition();

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add("revealed");
    revealObserver.unobserve(entry.target);
  });
}, { threshold: 0.08, rootMargin: "0px 0px -40px 0px" });

document.querySelectorAll("[data-reveal]").forEach((element) => {
  if (prefersReducedMotion && window.innerWidth > 800) element.classList.add("revealed");
  else revealObserver.observe(element);
});

let youtubeApiPromise;
let activePlayback;

function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (youtubeApiPromise) return youtubeApiPromise;

  youtubeApiPromise = new Promise((resolve, reject) => {
    const previousReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      if (typeof previousReady === "function") previousReady();
      resolve(window.YT);
    };

    const script = document.createElement("script");
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = () => reject(new Error("Não foi possível carregar o player."));
    document.head.appendChild(script);
  });

  return youtubeApiPromise;
}

function removePlayback(playback) {
  if (!playback) return;
  if (playback.placeholder) {
    playback.card.classList.remove("is-expanded");
    playback.placeholder.replaceWith(playback.card);
    playback.placeholder = null;
    document.body.classList.remove("player-expanded");
  }
  window.clearInterval(playback.timer);
  window.clearTimeout(playback.controlsTimer);
  playback.fullscreenObserver?.disconnect();
  if (playback.windowBlurHandler) window.removeEventListener("blur", playback.windowBlurHandler);
  if (playback.player?.destroy) playback.player.destroy();
  playback.shell.remove();
  playback.card.classList.remove("is-playing", "is-loading");
  const launch = playback.card.querySelector(".play");
  launch.disabled = false;
  launch.textContent = "▶";
  if (activePlayback === playback) activePlayback = null;
}

function createControlShell(title) {
  const shell = document.createElement("div");
  shell.className = "inline-player";
  shell.innerHTML = `
    <div class="player-mount"></div>
    <div class="controls-wake-area" aria-hidden="true"></div>
    <button class="playback-hit-area" type="button" aria-label="Pausar ou reproduzir vídeo"></button>
    <button class="fullscreen-capture" type="button" aria-hidden="true" tabindex="-1"></button>
    <div class="audio-control">
      <button class="control-button mute-toggle" type="button" aria-label="Desativar som"></button>
      <input class="volume-range" type="range" min="0" max="100" value="80" aria-label="Volume">
    </div>
    <button class="control-button expanded-fullscreen-toggle" type="button" aria-label="Sair da tela cheia"></button>
    <div class="video-controls" aria-label="Controles de ${title}">
      <input class="video-progress" type="range" min="0" max="1000" value="0" aria-label="Progresso do vídeo">
      <button class="control-button fullscreen-toggle" type="button" aria-label="Ver em tela cheia"></button>
    </div>`;
  return shell;
}

const fullscreenIcons = {
  enter: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M3 16v5h5M21 16v5h-5"/></svg>`,
  exit: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h5V3M21 8h-5V3M3 16h5v5M21 16h-5v5"/></svg>`
};

const volumeIcons = {
  on: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="M15 9a4 4 0 0 1 0 6M17.5 6.5a7.5 7.5 0 0 1 0 11"/></svg>`,
  off: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 5 6.5 9H3v6h3.5L11 19V5Z"/><path d="m15 10 5 5M20 10l-5 5"/></svg>`
};

function setMuteButton(button, muted) {
  button.innerHTML = muted ? volumeIcons.off : volumeIcons.on;
  button.setAttribute("aria-label", muted ? "Ativar som" : "Desativar som");
}

function setFullscreenButton(button, expanded) {
  if (!button) return;
  button.innerHTML = expanded ? fullscreenIcons.exit : fullscreenIcons.enter;
  button.setAttribute("aria-label", expanded ? "Sair da tela cheia" : "Ver em tela cheia");
}

function setPlaybackFullscreenButtons(playback, expanded) {
  playback?.shell?.querySelectorAll(".fullscreen-toggle, .expanded-fullscreen-toggle")
    .forEach((button) => setFullscreenButton(button, expanded));
}

function lockIframeFullscreen(iframe) {
  if (!iframe) return;
  const safeAllow = "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share";
  if (iframe.allowFullscreen) iframe.allowFullscreen = false;
  if (iframe.getAttribute("allow") !== safeAllow) iframe.setAttribute("allow", safeAllow);
  if (iframe.hasAttribute("allowfullscreen")) iframe.removeAttribute("allowfullscreen");
}

function disableYouTubeCaptions(player) {
  if (!player) return;
  try { player.unloadModule?.("captions"); } catch {}
  try { player.unloadModule?.("cc"); } catch {}
  try { player.setOption?.("captions", "track", {}); } catch {}
}

function enforceCaptionsOff(player) {
  disableYouTubeCaptions(player);
  [120, 500, 1200].forEach((delay) => {
    window.setTimeout(() => disableYouTubeCaptions(player), delay);
  });
}

function expandPlayback(playback) {
  if (!playback || playback.card.classList.contains("is-expanded")) return;
  playback.placeholder = document.createComment("posição do player");
  playback.card.before(playback.placeholder);
  document.body.appendChild(playback.card);
  playback.card.classList.add("is-expanded");
  document.body.classList.add("player-expanded");
  playback.shell?.classList.add("controls-visible");
  setPlaybackFullscreenButtons(playback, true);
}

function collapsePlayback(playback) {
  if (!playback || !playback.card.classList.contains("is-expanded")) return;
  playback.card.classList.remove("is-expanded");
  playback.placeholder?.replaceWith(playback.card);
  playback.placeholder = null;
  document.body.classList.remove("player-expanded");
  playback.shell?.classList.add("controls-visible");
  setPlaybackFullscreenButtons(playback, false);
}

async function playInline(card) {
  if (activePlayback?.card === card) return;
  if (activePlayback) removePlayback(activePlayback);

  const launch = card.querySelector(".play");
  launch.disabled = true;
  launch.textContent = "…";
  card.classList.add("is-loading");

  try {
    const YT = await loadYouTubeApi();
    const shell = createControlShell(card.dataset.title);
    const mount = shell.querySelector(".player-mount");
    const wakeArea = shell.querySelector(".controls-wake-area");
    const playbackHitArea = shell.querySelector(".playback-hit-area");
    const muteToggle = shell.querySelector(".mute-toggle");
    const volumeRange = shell.querySelector(".volume-range");
    const progress = shell.querySelector(".video-progress");
    const fullscreenToggle = shell.querySelector(".fullscreen-toggle");
    const expandedFullscreenToggle = shell.querySelector(".expanded-fullscreen-toggle");
    const fullscreenCapture = shell.querySelector(".fullscreen-capture");
    let player;
    let seeking = false;

    card.appendChild(shell);
    card.classList.add("is-playing");

    const playback = {
      card,
      shell,
      player: null,
      timer: 0,
      controlsTimer: 0,
      controlsHeld: false,
      muted: false,
      fullscreenObserver: null,
      windowBlurHandler: null,
      placeholder: null
    };
    activePlayback = playback;
    setPlaybackFullscreenButtons(playback, false);
    setMuteButton(muteToggle, false);

    const hideControls = () => {
      if (playback.controlsHeld) return;
      shell.classList.remove("controls-visible");
    };

    const scheduleControlsHide = () => {
      window.clearTimeout(playback.controlsTimer);
      playback.controlsTimer = window.setTimeout(hideControls, 4200);
    };

    const revealControls = () => {
      shell.classList.add("controls-visible");
      scheduleControlsHide();
    };

    const holdControls = () => {
      playback.controlsHeld = true;
      revealControls();
      window.clearTimeout(playback.controlsTimer);
    };

    const releaseControls = () => {
      playback.controlsHeld = false;
      scheduleControlsHide();
    };

    shell.addEventListener("pointerenter", revealControls);
    shell.addEventListener("pointermove", revealControls, { passive: true });
    shell.addEventListener("pointerdown", revealControls);
    shell.addEventListener("keydown", revealControls);

    wakeArea.addEventListener("pointermove", revealControls, { passive: true });
    wakeArea.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      event.stopPropagation();
      revealControls();
      if (!player?.getPlayerState) return;
      if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
      else player.playVideo();
    });

    playbackHitArea.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!player?.getPlayerState) return;
      if (player.getPlayerState() === YT.PlayerState.PLAYING) player.pauseVideo();
      else player.playVideo();
      revealControls();
    });

    [volumeRange, progress].forEach((control) => {
      control.addEventListener("pointerdown", holdControls);
      control.addEventListener("pointerup", releaseControls);
      control.addEventListener("pointercancel", releaseControls);
      control.addEventListener("change", releaseControls);
    });

    playback.windowBlurHandler = () => {
      window.setTimeout(() => {
        if (document.activeElement === player?.getIframe?.()) revealControls();
      }, 0);
    };
    window.addEventListener("blur", playback.windowBlurHandler);

    player = new YT.Player(mount, {
      videoId: card.dataset.videoId,
      playerVars: {
        autoplay: 1,
        controls: 0,
        modestbranding: 1,
        showinfo: 0,
        disablekb: 0,
        fs: 0,
        playsinline: 1,
        rel: 0,
        iv_load_policy: 3,
        cc_load_policy: 0,
        origin: window.location.origin
      },
      events: {
        onReady(event) {
          playback.player = event.target;
          event.target.setVolume(80);
          event.target.unMute();
          enforceCaptionsOff(event.target);
          event.target.playVideo();
          const iframe = event.target.getIframe();
          iframe.title = card.dataset.title;
          lockIframeFullscreen(iframe);
          playback.fullscreenObserver = new MutationObserver(() => lockIframeFullscreen(iframe));
          playback.fullscreenObserver.observe(iframe, { attributes: true, attributeFilter: ["allow", "allowfullscreen"] });
          shell.classList.add("is-ready");
          revealControls();
          card.classList.remove("is-loading");

          playback.timer = window.setInterval(() => {
            if (seeking || !playback.player?.getDuration) return;
            const duration = playback.player.getDuration();
            if (duration > 0) progress.value = String((playback.player.getCurrentTime() / duration) * 1000);
          }, 250);
        },
        onStateChange(event) {
          enforceCaptionsOff(event.target);
          event.target.getIframe?.().blur?.();
          revealControls();
        },
        onApiChange(event) {
          enforceCaptionsOff(event.target);
        },
        onError() {
          removePlayback(playback);
        }
      }
    });
    playback.player = player;

    muteToggle.addEventListener("click", () => {
      revealControls();
      if (!player?.mute) return;
      if (playback.muted) {
        player.unMute();
        if (Number(volumeRange.value) === 0) volumeRange.value = "80";
        player.setVolume(Number(volumeRange.value));
        playback.muted = false;
      } else {
        player.mute();
        playback.muted = true;
      }
      setMuteButton(muteToggle, playback.muted);
    });

    volumeRange.addEventListener("input", () => {
      revealControls();
      if (!player?.setVolume) return;
      const volume = Number(volumeRange.value);
      player.setVolume(volume);
      if (volume === 0) player.mute();
      else player.unMute();
      playback.muted = volume === 0;
      setMuteButton(muteToggle, playback.muted);
    });

    progress.addEventListener("pointerdown", () => { seeking = true; });
    progress.addEventListener("input", () => {
      revealControls();
      const duration = player?.getDuration?.() || 0;
      if (duration > 0) player.seekTo(duration * Number(progress.value) / 1000, true);
    });
    progress.addEventListener("change", () => { seeking = false; });
    progress.addEventListener("pointerup", () => { seeking = false; });

    const toggleFullscreen = (event) => {
      event?.preventDefault();
      event?.stopPropagation();
      revealControls();
      if (card.classList.contains("is-expanded")) {
        collapsePlayback(playback);
        return;
      }

      expandPlayback(playback);
    };

    fullscreenToggle.addEventListener("click", toggleFullscreen);
    expandedFullscreenToggle.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
      collapsePlayback(playback);
    });
    fullscreenCapture.addEventListener("click", toggleFullscreen);
  } catch (error) {
    card.classList.remove("is-loading", "is-playing");
    launch.disabled = false;
    launch.textContent = "▶";
  }
}

document.querySelectorAll(".reel-card").forEach((card) => {
  card.querySelector(".play").addEventListener("click", () => playInline(card));
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !activePlayback?.card.classList.contains("is-expanded")) return;
  collapsePlayback(activePlayback);
});

document.addEventListener("fullscreenchange", () => {
  const playback = activePlayback;
  const iframe = playback?.player?.getIframe?.();
  if (!iframe || document.fullscreenElement !== iframe) return;
  document.exitFullscreen?.().catch(() => {});
  expandPlayback(playback);
});
