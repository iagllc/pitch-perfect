/* iPad / phone touch controls: a joystick on the left, action buttons on the right.
   Tablets: the joystick appears wherever the thumb lands (floating). Pocket view (small phones): a resting joystick sits at thumb
   height on the left, full speed needs only a short slide, and the base follows the thumb when it overshoots, so changing
   direction never takes a big swing. */
(function () {
  'use strict';
  const Touch = {
    vec: { x: 0, y: 0 }, enabled: false, actions: {},
    R: 56, dead: 6, rest: false, fixed: false, active: null, // R = thumb travel for full speed (px); rest = show a resting joystick; fixed = the stick never moves: any press on the left half steers relative to it
    isTouchDevice() {
      if (/touch=1/.test(location.search)) return true; if (/touch=0/.test(location.search)) return false;
      const ua = navigator.userAgent || '';
      const ipadDesktopMode = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1; // iPad Safari pretending to be a Mac
      return /iPad|iPhone|iPod|Android/i.test(ua) || ipadDesktopMode || (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
    },
    tune(opts) { Object.assign(this, opts); if (this.layer) { this.layer.classList.toggle('rest', !!this.rest); this.showRest(); } },
    restPos() { // where the resting joystick sits: left edge (past the notch), a little below the middle, where a thumb rests in landscape
      const r = this.stage.getBoundingClientRect(), sal = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sal')) || 0;
      return { x: 26 + sal + 42, y: r.height * 0.58 };
    },
    place(el, x, y) { el.style.left = x + 'px'; el.style.top = y + 'px'; },
    showRest() {
      if (!this.layer || this.active !== null) return;
      const idle = this.rest && this.enabled;
      this.base.classList.toggle('idle', idle); this.knob.classList.toggle('idle', idle);
      if (idle) { const p = this.restPos(); this.place(this.base, p.x, p.y); this.place(this.knob, p.x, p.y); this.base.style.display = this.knob.style.display = 'block'; }
      else this.base.style.display = this.knob.style.display = 'none';
    },
    init(stage) {
      this.stage = stage; this.layer = document.getElementById('touchLayer'); this.base = this.layer.querySelector('.joy-base'); this.knob = this.layer.querySelector('.joy-knob');
      this.btnPass = document.getElementById('tPass'); this.btnShoot = document.getElementById('tShoot');
      const onDown = e => {
        if (!this.enabled || e.target.closest('.tbtn')) return; const r = stage.getBoundingClientRect(); if (e.clientX - r.left > r.width * 0.55) return;
        this.active = e.pointerId; this.ox = e.clientX; this.oy = e.clientY;
        if (this.rest) { const p = this.restPos(); if (this.fixed || Math.hypot(e.clientX - r.left - p.x, e.clientY - r.top - p.y) < 64) { this.ox = r.left + p.x; this.oy = r.top + p.y; } } // fixed stick: every press steers from its center; floating: only a press near it does
        this.base.classList.remove('idle'); this.knob.classList.remove('idle'); this.base.style.display = this.knob.style.display = 'block';
        this.place(this.base, this.ox - r.left, this.oy - r.top); move(e); e.preventDefault();
      };
      const move = e => {
        if (e.pointerId !== this.active) return; const r = stage.getBoundingClientRect(), R = this.R;
        let dx = e.clientX - this.ox, dy = e.clientY - this.oy, d = Math.hypot(dx, dy);
        if (d > R) {
          if (this.fixed) { dx *= R / d; dy *= R / d; d = R; } // fixed stick: full speed in that direction, the base stays put
          else { const k = (d - R) / d; this.ox += dx * k; this.oy += dy * k; dx *= R / d; dy *= R / d; d = R; this.place(this.base, this.ox - r.left, this.oy - r.top); } // floating: the base follows the thumb
        }
        const mag = d <= this.dead ? 0 : Math.min(1, (d - this.dead) / (R - this.dead));
        this.vec = d > 0 ? { x: dx / d * mag, y: dy / d * mag } : { x: 0, y: 0 };
        this.place(this.knob, this.ox + dx - r.left, this.oy + dy - r.top);
      };
      const onUp = e => { if (e.pointerId !== this.active) return; this.active = null; this.vec = { x: 0, y: 0 }; this.base.style.display = this.knob.style.display = 'none'; this.showRest(); };
      stage.addEventListener('pointerdown', onDown, { capture: true }); window.addEventListener('pointermove', move); window.addEventListener('pointerup', onUp); window.addEventListener('pointercancel', onUp);
      const bind = (btn, name) => { btn.addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); btn.classList.add('down'); this.actions[name] && this.actions[name](); btn.blur(); }); btn.addEventListener('pointerup', () => btn.classList.remove('down')); btn.addEventListener('pointercancel', () => btn.classList.remove('down')); };
      bind(this.btnPass, 'pass'); bind(this.btnShoot, 'shoot');
    },
    enable(on, buttons = [], opts = {}) {
      this.enabled = on && this.isTouchDevice(); const showButtons = on && (this.enabled || opts.buttonsAlways);
      this.layer.classList.toggle('on', showButtons); this.layer.classList.toggle('joy', this.enabled);
      this.btnPass.style.display = showButtons && buttons.includes('pass') ? '' : 'none'; this.btnShoot.style.display = showButtons && buttons.includes('shoot') ? '' : 'none';
      if (!on) { this.vec = { x: 0, y: 0 }; this.active = null; }
      this.showRest();
    },
  };
  window.Touch = Touch;
})();
