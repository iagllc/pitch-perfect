/* iPad / touch controls: a floating joystick on the left, action buttons on the right. */
(function () {
  'use strict';
  const Touch = {
    vec: { x: 0, y: 0 }, enabled: false, actions: {},
    isTouchDevice() {
      if (/touch=1/.test(location.search)) return true; if (/touch=0/.test(location.search)) return false;
      const ua = navigator.userAgent || '';
      const ipadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; // iPad Safari pretending to be a Mac
      return /iPad|iPhone|iPod|Android/i.test(ua) || ipadDesktopMode || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
    },
    init(stage) {
      this.stage = stage; this.layer = document.getElementById('touchLayer'); this.base = this.layer.querySelector('.joy-base'); this.knob = this.layer.querySelector('.joy-knob');
      this.btnPass = document.getElementById('tPass'); this.btnShoot = document.getElementById('tShoot');
      let active = null; const R = 56;
      const onDown = e => { if (!this.enabled || e.target.closest('.tbtn')) return; const r = stage.getBoundingClientRect(); if (e.clientX - r.left > r.width * 0.55) return; active = e.pointerId; this.ox = e.clientX; this.oy = e.clientY; this.base.style.display = this.knob.style.display = 'block'; this.base.style.left = (e.clientX - r.left) + 'px'; this.base.style.top = (e.clientY - r.top) + 'px'; move(e); e.preventDefault(); };
      const move = e => { if (e.pointerId !== active) return; const r = stage.getBoundingClientRect(); let dx = e.clientX - this.ox, dy = e.clientY - this.oy; const d = Math.hypot(dx, dy); if (d > R) { dx *= R / d; dy *= R / d; } this.vec = { x: dx / R, y: dy / R }; this.knob.style.left = (this.ox + dx - r.left) + 'px'; this.knob.style.top = (this.oy + dy - r.top) + 'px'; };
      const onUp = e => { if (e.pointerId !== active) return; active = null; this.vec = { x: 0, y: 0 }; this.base.style.display = this.knob.style.display = 'none'; };
      stage.addEventListener('pointerdown', onDown, { capture: true }); window.addEventListener('pointermove', move); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
      const bind = (btn, name) => { btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); btn.classList.add('down'); this.actions[name] && this.actions[name](); btn.blur(); }); btn.addEventListener('pointerup', () => btn.classList.remove('down')); btn.addEventListener('pointercancel', () => btn.classList.remove('down')); };
      bind(this.btnPass, 'pass'); bind(this.btnShoot, 'shoot');
    },
    enable(on, buttons = [], opts = {}) {
      this.enabled = on && this.isTouchDevice(); const showButtons = on && (this.enabled || opts.buttonsAlways);
      this.layer.classList.toggle('on', showButtons); this.layer.classList.toggle('joy', this.enabled);
      this.btnPass.style.display = showButtons && buttons.includes('pass') ? '' : 'none'; this.btnShoot.style.display = showButtons && buttons.includes('shoot') ? '' : 'none';
      if (!on) this.vec = { x: 0, y: 0 };
    },
  };
  window.Touch = Touch;
})();
