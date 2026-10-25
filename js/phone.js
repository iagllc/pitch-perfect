/* Pocket view: on small phones (an iPhone held sideways) the field fills the whole screen, the camera zooms to the zone
   the player needs to be active in, and a tiny radar keeps the full field in view. */
(function () {
  'use strict';
  const PhoneView = {
    active() {
      if (/\bphone=1\b/.test(location.search)) return true; if (/\bphone=0\b/.test(location.search)) return false; // ?phone=1 forces it for testing on a desktop
      // An iPhone 15 in landscape is 393 css px tall (less with Safari's bars); an iPad mini is 744, so tablets keep the normal layout.
      return Touch.isTouchDevice() && Math.min(window.innerWidth, window.innerHeight) <= 480;
    },
    apply(pitch) { const on = this.active(); document.documentElement.toggleAttribute('data-phone', on); if (pitch) pitch.setFill(on); return on; },
  };
  window.PhoneView = PhoneView;
})();
