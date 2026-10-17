/**
 * Unlock WebAudio / Howler / PIXI sound after user gesture (Chrome autoplay policy).
 */
export function installAudioUnlock() {
  if (typeof document === "undefined") return;

  function unlockAudio() {
    try {
      if (window.Howl && window.Howler?.ctx?.state === "suspended") {
        window.Howler.ctx.resume();
      }
      if (window.PIXI?.sound) {
        window.PIXI.sound.unmuteAll?.();
      }
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (Ctx && !window.__cZiperrAudioCtx) {
        window.__cZiperrAudioCtx = new Ctx();
        if (window.__cZiperrAudioCtx.state === "suspended") {
          window.__cZiperrAudioCtx.resume();
        }
      }
    } catch (_) {}
    document.removeEventListener("click", unlockAudio);
    document.removeEventListener("touchstart", unlockAudio);
  }

  document.addEventListener("click", unlockAudio);
  document.addEventListener("touchstart", unlockAudio);

  if (!document.getElementById("c-ziperr-tap-overlay")) {
    const overlay = document.createElement("div");
    overlay.id = "c-ziperr-tap-overlay";
    overlay.innerHTML =
      '<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.8);display:flex;align-items:center;justify-content:center;z-index:9999;color:white;font-size:24px;cursor:pointer">TAP TO START GAME</div>';
    overlay.onclick = () => {
      unlockAudio();
      overlay.remove();
    };
    const mount = () => document.body && document.body.appendChild(overlay);
    if (document.body) mount();
    else document.addEventListener("DOMContentLoaded", mount);
  }
}

if (typeof window !== "undefined") {
  installAudioUnlock();
}
