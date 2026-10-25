/* Pocket view: on small phones (an iPhone held sideways) the field fills the whole screen, the camera zooms to the zone
   the player needs to be active in, and a tiny radar keeps the full field in view.
   Also: full screen (hides the browser's tabs and bars where the browser allows it) and Home Screen app detection. */
(function () {
  'use strict';
  const PhoneView = {
    active() {
      if (/\bphone=1\b/.test(location.search)) return true; if (/\bphone=0\b/.test(location.search)) return false; // ?phone=1 forces it for testing on a desktop
      // An iPhone 15 in landscape is 393 css px tall (less with Safari's bars); an iPad mini is 744, so tablets keep the normal layout.
      return Touch.isTouchDevice() && Math.min(window.innerWidth, window.innerHeight) <= 480;
    },
    // Opened from the Home Screen (iOS "Add to Home Screen" or an installed web app): already full screen, no tabs or bars.
    standalone() { return navigator.standalone === true || !!(window.matchMedia && window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches); },
    fullscreenSupported() { const d = document, e = d.documentElement; return !!(d.fullscreenEnabled || d.webkitFullscreenEnabled) && !!(e.requestFullscreen || e.webkitRequestFullscreen); },
    isFullscreen() { return !!(document.fullscreenElement || document.webkitFullscreenElement); },
    async enterFullscreen() { // must run inside a tap or click
      if (this.isFullscreen() || !this.fullscreenSupported()) return false;
      const e = document.documentElement;
      try { if (e.requestFullscreen) await e.requestFullscreen({ navigationUI: 'hide' }); else e.webkitRequestFullscreen(); } catch (err) { return false; }
      try { if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape'); } catch (err) { /* iOS has no orientation lock; fine */ }
      return true;
    },
    exitFullscreen() { try { if (document.exitFullscreen) document.exitFullscreen(); else if (document.webkitExitFullscreen) document.webkitExitFullscreen(); } catch (e) {} },
    toggleFullscreen() { if (this.isFullscreen()) { this.exitFullscreen(); return Promise.resolve(false); } return this.enterFullscreen(); },
    // The full-screen buttons show on touch devices that can go full screen and are not already a Home Screen app.
    wantsFullscreenButton() { return Touch.isTouchDevice() && this.fullscreenSupported() && !this.standalone(); },
    apply(pitch) {
      const on = this.active(), fs = this.isFullscreen();
      document.documentElement.toggleAttribute('data-phone', on);
      document.documentElement.toggleAttribute('data-standalone', this.standalone());
      document.documentElement.toggleAttribute('data-fullscreen', fs);
      document.querySelectorAll('.fsBtn').forEach(b => { b.style.display = this.wantsFullscreenButton() ? '' : 'none'; b.textContent = b.classList.contains('icon-btn') ? (fs ? '🗗' : '⛶') : (fs ? '🗗 Exit full screen' : '⛶ Full screen'); b.title = fs ? 'Exit full screen' : 'Full screen'; });
      if (pitch) pitch.setFill(on);
      return on;
    },
  };
  for (const ev of ['fullscreenchange', 'webkitfullscreenchange']) document.addEventListener(ev, () => PhoneView.apply(window.__app && window.__app.pitch));
  window.PhoneView = PhoneView;
})();
