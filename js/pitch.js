/* Pitch renderer: converts meters -> pixels and draws the field, players and ball. */
(function () {
  'use strict';
  const F = Logic.FIELD;
  const MARGIN = 4; // meters of grass around the lines

  class Pitch {
    constructor(canvas, container) {
      this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.container = container;
      this.view = { x: -MARGIN, y: -MARGIN, w: F.w + MARGIN * 2, h: F.h + MARGIN * 2 };
      this.scale = 1; this.baseScale = 1; this.cam = null; this.cache = null; this.cacheKey = ''; this.t = 0;
      this.resize();
    }
    setView(v) { this.view = v; this.resize(); }
    fullView() { this.setView({ x: -MARGIN, y: -MARGIN, w: F.w + MARGIN * 2, h: F.h + MARGIN * 2 }); }
    resize() {
      const r = this.container.getBoundingClientRect();
      const pad = this.fill ? 0 : 24; // fill mode (Pocket view on small phones): the canvas takes the whole stage instead of keeping the field's shape
      const availW = Math.max(200, r.width - pad), availH = Math.max(150, r.height - pad);
      this.baseScale = Math.min(availW / this.view.w, availH / this.view.h);
      if (this.fill) { this.cssW = Math.floor(availW); this.cssH = Math.floor(availH); if (!this.cam || this.cam.auto) this.cam = this.centerCam(); }
      else { this.cssW = Math.floor(this.view.w * this.baseScale); this.cssH = Math.floor(this.view.h * this.baseScale); }
      this.scale = this.baseScale * (this.cam ? this.cam.zoom : 1);
      this.dpr = Math.min(2, window.devicePixelRatio || 1);
      this.canvas.style.width = this.cssW + 'px'; this.canvas.style.height = this.cssH + 'px';
      this.canvas.width = Math.floor(this.cssW * this.dpr); this.canvas.height = Math.floor(this.cssH * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    }
    setFill(on) { on = !!on; if (this.fill === on) return; this.fill = on; if (!on && this.cam && this.cam.auto) this.cam = null; this.resize(); }
    centerCam() { return { cx: this.view.x + this.view.w / 2, cy: this.view.y + this.view.h / 2, zoom: 1, auto: true }; } // fill mode with no camera: the whole view, centered
    setCamera(cam) { if (!cam) this.camPos = null; this.cam = cam || (this.fill ? this.centerCam() : null); this.scale = this.baseScale * (this.cam ? this.cam.zoom : 1); }
    toPx(x, y) { if (this.cam) return [(x - this.cam.cx) * this.scale + this.cssW / 2, (y - this.cam.cy) * this.scale + this.cssH / 2]; return [(x - this.view.x) * this.scale, (y - this.view.y) * this.scale]; }
    toM(px, py) { if (this.cam) return { x: (px - this.cssW / 2) / this.scale + this.cam.cx, y: (py - this.cssH / 2) / this.scale + this.cam.cy }; return { x: px / this.scale + this.view.x, y: py / this.scale + this.view.y }; }
    camHalf() { return { w: this.cssW / (2 * this.scale), h: this.cssH / (2 * this.scale) }; }
    eventToM(e) { const r = this.canvas.getBoundingClientRect(); return this.toM(e.clientX - r.left, e.clientY - r.top); }

    // ---- static field (cached) ----
    buildCache() {
      const key = `${this.canvas.width}x${this.canvas.height}|${this.view.x},${this.view.y},${this.view.w},${this.view.h}|${document.documentElement.dataset.theme}`;
      if (this.cacheKey === key) return;
      this.cacheKey = key;
      const off = document.createElement('canvas'); off.width = this.canvas.width; off.height = this.canvas.height;
      const c = off.getContext('2d'); c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      const cam = this.cam; this.setCamera(null); this.renderField(c); this.setCamera(cam);
      this.cache = off;
    }
    renderField(c) {
      const s = this.scale, P = (x, y) => this.toPx(x, y);
      // grass (the Teen+ theme plays under cooler, darker lights)
      const teen = document.documentElement.dataset.theme === 'teen';
      const kid = document.documentElement.dataset.theme === 'kid';
      c.fillStyle = teen ? '#185a2d' : kid ? '#20803e' : '#1d6b35'; c.fillRect(0, 0, this.cssW, this.cssH);
      const stripes = 14, sw = F.w / stripes;
      for (let i = -1; i <= stripes; i++) {
        c.fillStyle = teen ? (i % 2 ? '#1a6231' : '#15532a') : kid ? (i % 2 ? '#26923f' : '#1f7f38') : (i % 2 ? '#1f7a3c' : '#1a6a32');
        const [x0] = P(i * sw, 0); c.fillRect(x0, 0, sw * s + 1, this.cssH);
      }
      // outer margin darker
      const [mx0, my0] = P(0, 0), [mx1, my1] = P(F.w, F.h);
      c.fillStyle = 'rgba(0,0,0,.18)';
      c.fillRect(0, 0, this.cssW, my0); c.fillRect(0, my1, this.cssW, this.cssH - my1);
      c.fillRect(0, my0, mx0, my1 - my0); c.fillRect(mx1, my0, this.cssW - mx1, my1 - my0);
      // mowing sheen
      const g = c.createRadialGradient(this.cssW * .5, this.cssH * .4, 10, this.cssW * .5, this.cssH * .5, this.cssW * .75);
      g.addColorStop(0, 'rgba(255,255,255,.07)'); g.addColorStop(1, 'rgba(0,0,0,.28)'); c.fillStyle = g; c.fillRect(0, 0, this.cssW, this.cssH);
      // stadium floodlights (four corners) + vignette
      for (const [fx, fy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const lx = fx * this.cssW, ly = fy * this.cssH, lg = c.createRadialGradient(lx, ly, 0, lx, ly, Math.max(this.cssW, this.cssH) * 0.55);
        lg.addColorStop(0, 'rgba(255,255,230,.22)'); lg.addColorStop(0.35, 'rgba(255,255,230,.06)'); lg.addColorStop(1, 'rgba(255,255,230,0)'); c.fillStyle = lg; c.fillRect(0, 0, this.cssW, this.cssH);
      }
      const vg = c.createRadialGradient(this.cssW / 2, this.cssH / 2, this.cssH * 0.35, this.cssW / 2, this.cssH / 2, this.cssW * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, kid ? 'rgba(0,0,0,.22)' : 'rgba(0,0,0,.35)'); c.fillStyle = vg; c.fillRect(0, 0, this.cssW, this.cssH);
      // lines
      c.strokeStyle = 'rgba(255,255,255,.92)'; c.lineWidth = Math.max(1.5, 0.14 * s); c.lineJoin = 'round';
      const rect = (x, y, w, h) => { const [a, b] = P(x, y); c.strokeRect(a, b, w * s, h * s); };
      rect(0, 0, F.w, F.h);
      const [hx0, hy0] = P(F.halfway, 0), [, hy1] = P(F.halfway, F.h); c.beginPath(); c.moveTo(hx0, hy0); c.lineTo(hx0, hy1); c.stroke();
      const [cx, cy] = P(F.halfway, F.h / 2); c.beginPath(); c.arc(cx, cy, 9.15 * s, 0, Math.PI * 2); c.stroke();
      c.fillStyle = '#fff'; c.beginPath(); c.arc(cx, cy, 0.3 * s, 0, Math.PI * 2); c.fill();
      for (const side of [0, 1]) {
        const gx = side ? F.w : 0, d = side ? -1 : 1;
        rect(side ? F.w - 16.5 : 0, F.h / 2 - 20.16, 16.5, 40.32);
        rect(side ? F.w - 5.5 : 0, F.h / 2 - 9.16, 5.5, 18.32);
        const [px, py] = P(gx + d * 11, F.h / 2); c.beginPath(); c.arc(px, py, 0.3 * s, 0, Math.PI * 2); c.fill();
        c.beginPath(); c.arc(px, py, 9.15 * s, side ? Math.PI * 0.705 : -Math.PI * 0.295, side ? Math.PI * 1.295 : Math.PI * 0.295); c.stroke();
        // goal
        const [gx0, gy0] = P(gx - (side ? 0 : 2.4), F.h / 2 - 3.66);
        c.fillStyle = 'rgba(255,255,255,.18)'; c.fillRect(gx0, gy0, 2.4 * s, 7.32 * s); c.strokeRect(gx0, gy0, 2.4 * s, 7.32 * s);
        c.save(); c.strokeStyle = 'rgba(255,255,255,.35)'; c.lineWidth = 1;
        for (let i = 1; i < 6; i++) { c.beginPath(); c.moveTo(gx0, gy0 + i * 7.32 * s / 6); c.lineTo(gx0 + 2.4 * s, gy0 + i * 7.32 * s / 6); c.stroke(); }
        for (let i = 1; i < 3; i++) { c.beginPath(); c.moveTo(gx0 + i * 2.4 * s / 3, gy0); c.lineTo(gx0 + i * 2.4 * s / 3, gy0 + 7.32 * s); c.stroke(); }
        c.restore(); c.fillStyle = '#fff';
        for (const cy2 of [0, F.h]) { const [ax, ay] = P(gx, cy2); c.beginPath(); c.arc(ax, ay, 1 * s, 0, Math.PI * 2); c.stroke(); }
      }
    }
    buildZoomCache(zoom) { // the whole view rendered once at the zoomed scale (device-pixel-ratio 1), then cropped (and scaled, if the camera zoom differs) per frame
      const v = this.view, key = `${this.baseScale.toFixed(3)}|${zoom.toFixed(3)}|${v.x},${v.y},${v.w},${v.h}|${document.documentElement.dataset.theme}`; if (this.zoomKey === key) return;
      this.zoomKey = key; const W = Math.ceil(v.w * this.baseScale * zoom), H = Math.ceil(v.h * this.baseScale * zoom);
      const off = document.createElement('canvas'); off.width = W; off.height = H; const c = off.getContext('2d');
      const saved = { cam: this.cam, scale: this.scale, cssW: this.cssW, cssH: this.cssH, dpr: this.dpr };
      this.cam = null; this.scale = this.baseScale * zoom; this.cssW = W; this.cssH = H; this.dpr = 1;
      this.renderField(c); Object.assign(this, saved); this.zoomCache = off;
    }
    drawField() {
      if (this.cam) {
        // The cache is built at cacheZoom (the camera's maximum zoom, so a zooming camera never rebuilds it) and scaled by k on the way to the screen.
        const cz = this.cam.cacheZoom || this.cam.zoom; this.buildZoomCache(cz);
        const Z = this.zoomCache, zsC = this.baseScale * cz, k = this.cam.zoom / cz, h = this.camHalf(), c = this.ctx;
        let sx = (this.cam.cx - h.w - this.view.x) * zsC, sy = (this.cam.cy - h.h - this.view.y) * zsC, sw = this.cssW / k, sh = this.cssH / k, dx = 0, dy = 0;
        c.fillStyle = '#163b22'; c.fillRect(0, 0, this.cssW, this.cssH);
        if (sx < 0) { dx = -sx * k; sw += sx; sx = 0; } if (sy < 0) { dy = -sy * k; sh += sy; sy = 0; } // beyond the view: dark grass
        sw = Math.min(sw, Z.width - sx); sh = Math.min(sh, Z.height - sy);
        if (sw > 0 && sh > 0) c.drawImage(Z, sx, sy, sw, sh, dx, dy, sw * k, sh * k); return;
      }
      this.buildCache(); this.ctx.save(); this.ctx.setTransform(1, 0, 0, 1, 0, 0); this.ctx.drawImage(this.cache, 0, 0); this.ctx.restore();
    }

    // ---- dynamic things ----
    drawShadow(x, y, r) { const c = this.ctx, [px, py] = this.toPx(x, y); c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(px + r * .25, py + r * .55, r * 1.05, r * .5, 0, 0, Math.PI * 2); c.fill(); }
    drawPlayer(p, o = {}) {
      const c = this.ctx, s = this.scale, r = (o.radius || 1.25) * s, [px, py] = this.toPx(p.x, p.y);
      if (px < -4 * r || px > this.cssW + 4 * r || py < -4 * r || py > this.cssH + 4 * r) return;
      const key = o.key || `${o.team}-${o.number}`;
      const mine = o.me && window.__myAvatar;
      const av = o.avatar || mine || Avatars.forKey(key, window.__avatarSet || 'kid');
      const A = Avatars.anim(key, p.x, p.y, performance.now(), { hasBall: o.hasBall, faceTo: o.faceTo });
      Avatars.draw(c, px, py, r, av, o.team || 'us', A, { me: !!o.me, hasBall: !!o.hasBall, number: o.number === undefined ? '' : o.number });
      const fontFam = getComputedStyle(document.body).fontFamily;
      if (o.name) { c.font = `600 ${Math.max(9, r * .72)}px ${fontFam}`; c.textAlign = 'center'; c.textBaseline = 'top'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.55)'; c.fillStyle = o.nameColor || 'rgba(255,255,255,.9)'; c.strokeText(o.name, px, py + r * 1.5); c.fillText(o.name, px, py + r * 1.5); c.textBaseline = 'middle'; }
      if (o.label) { c.font = `700 ${Math.max(10, r * .8)}px ${fontFam}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; c.fillStyle = o.labelColor || '#fff'; c.strokeText(o.label, px, py - r * 2.1); c.fillText(o.label, px, py - r * 2.1); }
    }
    drawBall(b) {
      const c = this.ctx, s = this.scale, z = b.z || 0, r = 0.55 * s * (1 + z * 0.08), [px, py] = this.toPx(b.x, b.y);
      c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(px + z * s * .25, py + z * s * .35 + r * .4, r * 1.1, r * .55, 0, 0, Math.PI * 2); c.fill();
      const by = py - z * s * 0.6;
      const g = c.createRadialGradient(px - r * .3, by - r * .3, r * .1, px, by, r); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#c9ced8');
      c.fillStyle = g; c.beginPath(); c.arc(px, by, r, 0, Math.PI * 2); c.fill();
      c.fillStyle = '#222b3d'; const spin = b.spin || 0;
      for (let i = 0; i < 5; i++) { const a = spin + i * Math.PI * 2 / 5; c.beginPath(); c.arc(px + Math.cos(a) * r * .5, by + Math.sin(a) * r * .5, r * .22, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(px, by, r, 0, Math.PI * 2); c.stroke();
    }
    ring(x, y, rM, color, opts = {}) {
      const c = this.ctx, [px, py] = this.toPx(x, y), r = rM * this.scale;
      if (opts.glow) { const g = c.createRadialGradient(px, py, r * .2, px, py, r * 1.3); g.addColorStop(0, opts.glow); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.beginPath(); c.arc(px, py, r * 1.3, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = color; c.lineWidth = opts.width || 3; c.setLineDash(opts.dash || []); c.lineDashOffset = -(this.t * 40) % 1000;
      c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
    }
    line(a, b, color, width = 2, dash = []) {
      const c = this.ctx, [ax, ay] = this.toPx(a.x, a.y), [bx, by] = this.toPx(b.x, b.y);
      c.strokeStyle = color; c.lineWidth = width; c.setLineDash(dash); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.setLineDash([]);
    }
    poly(points, fill, stroke, width = 2) {
      if (points.length < 3) return; const c = this.ctx; c.beginPath();
      points.forEach((p, i) => { const [x, y] = this.toPx(p.x, p.y); i ? c.lineTo(x, y) : c.moveTo(x, y); }); c.closePath();
      if (fill) { c.fillStyle = fill; c.fill(); } if (stroke) { c.strokeStyle = stroke; c.lineWidth = width; c.stroke(); }
    }
    vline(x, color, width = 3, dash = [10, 8], label) {
      const c = this.ctx, [px] = this.toPx(x, 0), [, y0] = this.toPx(0, -MARGIN), [, y1] = this.toPx(0, F.h + MARGIN);
      c.save(); c.shadowColor = color; c.shadowBlur = 16; this.line({ x, y: -MARGIN }, { x, y: F.h + MARGIN }, color, width, dash); c.restore();
      if (label) { c.font = `700 ${Math.max(12, this.scale * 1.6)}px ${getComputedStyle(document.body).fontFamily}`; c.textAlign = 'center'; c.textBaseline = 'top'; c.fillStyle = color; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(label, px, y0 + 4 + this.scale * 0.6); c.fillText(label, px, y0 + 4 + this.scale * 0.6); }
      void y1;
    }
    arrow(a, b, color, width = 3) {
      const c = this.ctx, [ax, ay] = this.toPx(a.x, a.y), [bx, by] = this.toPx(b.x, b.y), ang = Math.atan2(by - ay, bx - ax), h = 10;
      c.strokeStyle = color; c.fillStyle = color; c.lineWidth = width; c.setLineDash([]);
      c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
      c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - h * Math.cos(ang - .5), by - h * Math.sin(ang - .5)); c.lineTo(bx - h * Math.cos(ang + .5), by - h * Math.sin(ang + .5)); c.closePath(); c.fill();
    }
    textM(x, y, str, color = '#fff', sizeM = 1.6, align = 'center') {
      const c = this.ctx, [px, py] = this.toPx(x, y); c.font = `700 ${sizeM * this.scale}px ${getComputedStyle(document.body).fontFamily}`; c.textAlign = align; c.textBaseline = 'middle';
      c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.6)'; c.strokeText(str, px, py); c.fillStyle = color; c.fillText(str, px, py);
    }
    netRipple(side, t) { // side 0 = left goal, 1 = right goal; t in seconds since the goal
      if (t > 1.3) return; const c = this.ctx, s = this.scale, k = 1 - t / 1.3, gx = side ? F.w : -2.4, [x0, y0] = this.toPx(gx, F.h / 2 - 3.66), w = 2.4 * s, h = 7.32 * s;
      c.save(); c.strokeStyle = `rgba(255,255,255,${0.9 * k})`; c.lineWidth = 1.5; c.shadowColor = '#fff'; c.shadowBlur = 10 * k;
      for (let i = 0; i <= 6; i++) { const yy = y0 + i * h / 6; c.beginPath(); for (let xx = 0; xx <= w; xx += 3) { const off = Math.sin(t * 28 + xx * 0.12 + i) * 4 * k * (side ? (xx / w) : (1 - xx / w)); c.lineTo(x0 + xx + off, yy + Math.cos(t * 22 + i) * 2 * k); } c.stroke(); }
      for (let i = 0; i <= 3; i++) { const xx = x0 + i * w / 3; c.beginPath(); for (let yy = 0; yy <= h; yy += 3) { c.lineTo(xx + Math.sin(t * 28 + yy * 0.1) * 4 * k, y0 + yy); } c.stroke(); }
      const g = c.createRadialGradient(x0 + w / 2, y0 + h / 2, 2, x0 + w / 2, y0 + h / 2, h); g.addColorStop(0, `rgba(255,255,255,${0.5 * k})`); g.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(x0 - h, y0 - h / 2, w + 2 * h, h * 2); c.restore();
    }
    // ---- Pocket view (small phones) ----
    // Frame the zone the player needs to be active in: every point in `pts` stays on screen when it can, the camera zooms between
    // minScale and maxScale pixels per meter so players stay readable, and `focus` (the player you control) never leaves the screen.
    actionCam(dt, pts, opts = {}) {
      const minS = opts.minScale || 7.5, maxS = opts.maxScale || 13, pad = opts.pad || 7, v = this.view, cl = (a, lo, hi) => Math.max(lo, Math.min(hi, a));
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (const p of pts) { if (!p || typeof p.x !== 'number') continue; x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y); }
      if (x0 === Infinity) return;
      const fit = Math.min(this.cssW / (x1 - x0 + pad * 2), this.cssH / (y1 - y0 + pad * 2));
      const scale = Math.max(minS, Math.min(maxS, fit)), hw = this.cssW / (2 * scale), hh = this.cssH / (2 * scale);
      let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      const f = opts.focus; if (f) { cx = cl(cx, f.x - hw + 5, f.x + hw - 5); cy = cl(cy, f.y - hh + 4, f.y + hh - 4); }
      cx = v.w <= hw * 2 ? v.x + v.w / 2 : cl(cx, v.x + hw, v.x + v.w - hw); cy = v.h <= hh * 2 ? v.y + v.h / 2 : cl(cy, v.y + hh, v.y + v.h - hh);
      const zoom = scale / this.baseScale;
      if (!this.camPos) this.camPos = { x: cx, y: cy, zoom };
      const cp = this.camPos, kp = Math.min(1, dt * 4), kz = Math.min(1, dt * 2.5);
      cp.x += (cx - cp.x) * kp; cp.y += (cy - cp.y) * kp; cp.zoom += (zoom - cp.zoom) * kz;
      this.setCamera({ cx: cp.x, cy: cp.y, zoom: cp.zoom, cacheZoom: maxS / this.baseScale });
    }
    drawRadar(players, ball) { // tiny full-field map: every player, the ball and the camera window
      const c = this.ctx, w = Math.round(Math.min(120, Math.max(84, this.cssW * 0.15))), h = Math.round(w * F.h / F.w), x0 = Math.round((this.cssW - w) / 2), y0 = 6, k = w / F.w;
      c.save(); c.fillStyle = 'rgba(6,16,31,.62)'; c.fillRect(x0 - 4, y0 - 4, w + 8, h + 8);
      c.beginPath(); c.rect(x0, y0, w, h); c.clip();
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1; c.strokeRect(x0 + .5, y0 + .5, w - 1, h - 1); c.beginPath(); c.moveTo(x0 + w / 2, y0); c.lineTo(x0 + w / 2, y0 + h); c.stroke();
      if (this.cam) { const hh = this.camHalf(); c.strokeStyle = 'rgba(255,255,255,.9)'; c.strokeRect(x0 + (this.cam.cx - hh.w) * k, y0 + (this.cam.cy - hh.h) * k, hh.w * 2 * k, hh.h * 2 * k); }
      for (const p of players) { c.fillStyle = p.me ? '#b6ff3b' : p.team === 0 ? '#5aa0ff' : '#ff6b6b'; c.beginPath(); c.arc(x0 + p.x * k, y0 + p.y * k, p.me ? 3 : 2, 0, Math.PI * 2); c.fill(); }
      if (ball) { c.fillStyle = '#fff'; c.beginPath(); c.arc(x0 + ball.x * k, y0 + ball.y * k, 2, 0, Math.PI * 2); c.fill(); }
      c.restore();
    }
    hull(points) { // convex hull (monotone chain) for the team-shape blob
      const pts = points.slice().sort((a, b) => a.x - b.x || a.y - b.y); if (pts.length < 3) return pts;
      const cross = (o, a, b) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
      const lower = []; for (const p of pts) { while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop(); lower.push(p); }
      const upper = []; for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop(); upper.push(p); }
      upper.pop(); lower.pop(); return lower.concat(upper);
    }
  }
  window.Pitch = Pitch;
})();
