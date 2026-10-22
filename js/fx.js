/* Particles, floating text, confetti, screen shake. */
(function () {
  'use strict';
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MAX = reduce ? 60 : 320;

  class FX {
    constructor() { this.parts = []; this.texts = []; this.shake = 0; }
    burst(x, y, color, n = 14, speed = 10, life = 0.8, size = 0.5) {
      if (reduce) n = Math.ceil(n / 4);
      for (let i = 0; i < n && this.parts.length < MAX; i++) {
        const a = Math.random() * Math.PI * 2, s = speed * (0.4 + Math.random() * 0.8);
        this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life, max: life, color: Array.isArray(color) ? color[i % color.length] : color, size: size * (0.6 + Math.random() * 0.8), g: 0, shape: 'dot' });
      }
    }
    confetti(x, y, n = 80) {
      if (reduce) n = 16;
      const colors = ['#b6ff3b', '#38e8ff', '#ff4fa3', '#ffd23f', '#ffffff', '#3d8bff'];
      for (let i = 0; i < n && this.parts.length < MAX; i++) {
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.6, s = 14 + Math.random() * 18;
        this.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 2.2, max: 2.2, color: colors[i % colors.length], size: 0.7 + Math.random() * 0.6, g: 22, shape: 'rect', rot: Math.random() * 6, vr: (Math.random() - 0.5) * 10 });
      }
    }
    sparkle(x, y, color = '#ffffff') { this.burst(x, y, color, 4, 3, 0.5, 0.35); }
    dust(x, y) { if (this.parts.length < MAX) this.parts.push({ x, y, vx: (Math.random() - .5) * 2, vy: (Math.random() - .5) * 2, life: 0.5, max: 0.5, color: 'rgba(255,255,255,0.35)', size: 0.5, g: 0, shape: 'dot' }); }
    text(x, y, str, color = '#fff', size = 1.6) { this.texts.push({ x, y, str, color, size, life: 1.3, max: 1.3, vy: -4 }); }
    kick(amount = 0.6) { if (!reduce) this.shake = Math.max(this.shake, amount); }
    update(dt) {
      for (const p of this.parts) { p.life -= dt; p.vy += (p.g || 0) * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.985; if (p.rot !== undefined) p.rot += p.vr * dt; }
      this.parts = this.parts.filter(p => p.life > 0);
      for (const t of this.texts) { t.life -= dt; t.y += t.vy * dt; }
      this.texts = this.texts.filter(t => t.life > 0);
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    draw(pitch) {
      const c = pitch.ctx;
      for (const p of this.parts) {
        const [px, py] = pitch.toPx(p.x, p.y); const a = Math.max(0, p.life / p.max); const r = p.size * pitch.scale;
        c.globalAlpha = a; c.fillStyle = p.color;
        if (p.shape === 'rect') { c.save(); c.translate(px, py); c.rotate(p.rot); c.fillRect(-r, -r * 0.5, r * 2, r); c.restore(); }
        else { c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill(); }
      }
      c.globalAlpha = 1;
      for (const t of this.texts) {
        const [px, py] = pitch.toPx(t.x, t.y); const a = Math.min(1, t.life / 0.4); const k = 1 + (1 - Math.min(1, (t.max - t.life) / 0.25)) * 0.6;
        c.globalAlpha = a; c.font = `700 ${t.size * pitch.scale * k}px ${getComputedStyle(document.body).fontFamily}`; c.textAlign = 'center'; c.textBaseline = 'middle';
        c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.55)'; c.strokeText(t.str, px, py); c.fillStyle = t.color; c.fillText(t.str, px, py);
      }
      c.globalAlpha = 1;
    }
  }
  window.FX = FX;
})();
