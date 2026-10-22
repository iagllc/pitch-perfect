/* "Why did that happen?" explainer cards with a mini diagram of the exact moment. */
(function () {
  'use strict';
  const F = Logic.FIELD;
  const COL = { 0: ['#6fb3ff', '#1f5fd6'], 1: ['#ff8a8a', '#e03434'], gk: ['#ffe27a', '#f0a500'] };

  const Explain = {
    lessons: [], queue: [], current: null, timer: 0, onPause: null, onResume: null, paused: false,
    reset() { this.lessons = []; this.queue = []; this.hide(true); },
    show(ex) {
      if (!this.lessons.some(l => l.key === ex.key)) this.lessons.push({ key: ex.key, title: ex.title, lesson: ex.lesson, snap: ex.snap });
      if (this.current && this.current.key === ex.key) return;
      if (this.current) { if (this.queue.length < 3 && !this.queue.some(q => q.key === ex.key)) this.queue.push(ex); return; }
      this.render(ex);
    },
    render(ex) {
      this.current = ex; const card = document.getElementById('explainCard'), ov = document.getElementById('explainModal');
      const host = ex.blocking ? ov : card;
      host.innerHTML = `<div class="explain ${ex.blocking ? 'big' : ''}"><button class="modal-x" aria-label="Close">✕</button>
        <canvas class="ex-canvas" width="${ex.blocking ? 520 : 320}" height="${ex.blocking ? 300 : 190}"></canvas>
        <div class="ex-body"><div class="ex-kicker">What went wrong?</div><h3>${ex.title}</h3><p>${ex.text}</p>
        ${ex.lesson ? `<div class="ex-lesson">💡 ${ex.lesson}</div>` : ''}
        <button class="btn ${ex.blocking ? 'big' : 'small'}">${ex.blocking ? 'Got it ▶' : 'Got it'}</button></div></div>`;
      const cv = host.querySelector('canvas'); if (ex.snap) this.drawSnap(cv, ex.snap); else cv.style.display = 'none';
      host.querySelectorAll('button').forEach(b => b.onclick = () => this.hide());
      host.classList.add('show'); if (ex.blocking) { this.paused = true; this.onPause && this.onPause(); }
      else { clearTimeout(this.timer); this.timer = setTimeout(() => this.hide(), 9000); }
      try { window.SFX && window.SFX.pop(); } catch (e) {}
    },
    hide(all) {
      clearTimeout(this.timer); const card = document.getElementById('explainCard'), ov = document.getElementById('explainModal');
      card.classList.remove('show'); ov.classList.remove('show');
      const wasBlocking = this.current && this.current.blocking; this.current = null;
      if (wasBlocking) { this.paused = false; this.onResume && this.onResume(); }
      if (all) { this.queue = []; return; }
      const next = this.queue.shift(); if (next) setTimeout(() => this.render(next), 250);
    },
    // ---- the mini diagram ----
    drawSnap(cv, snap) {
      const c = cv.getContext('2d'), W = cv.width, H = cv.height;
      const me = snap.players.find(p => p.focus) || snap.players.find(p => p.me) || snap.ball;
      // region of interest
      const pts = [me, snap.ball]; if (snap.ring) pts.push({ x: snap.ring.x - snap.ring.r, y: snap.ring.y - snap.ring.r }, { x: snap.ring.x + snap.ring.r, y: snap.ring.y + snap.ring.r });
      if (snap.arrows) snap.arrows.forEach(a => pts.push(a.from, a.to)); snap.players.forEach(p => { if (p.label) pts.push(p); });
      if (snap.lineX !== undefined) pts.push({ x: snap.lineX, y: me.y });
      let minx = Math.min(...pts.map(p => p.x)) - 8, maxx = Math.max(...pts.map(p => p.x)) + 8, miny = Math.min(...pts.map(p => p.y)) - 7, maxy = Math.max(...pts.map(p => p.y)) + 7;
      let vw = Math.max(maxx - minx, 30), vh = Math.max(maxy - miny, 20); const ar = W / H;
      if (vw / vh < ar) vw = vh * ar; else vh = vw / ar;
      const cx = (minx + maxx) / 2, cy = (miny + maxy) / 2; minx = cx - vw / 2; miny = cy - vh / 2;
      const s = W / vw, X = x => (x - minx) * s, Y = y => (y - miny) * s;
      c.fillStyle = '#1b6b34'; c.fillRect(0, 0, W, H);
      for (let i = 0; i < 14; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)'; c.fillRect(X(i * F.w / 14), 0, F.w / 14 * s + 1, H); }
      c.fillStyle = 'rgba(0,0,0,.35)'; if (minx < 0) c.fillRect(0, 0, X(0), H); if (minx + vw > F.w) c.fillRect(X(F.w), 0, W, H); if (miny < 0) c.fillRect(0, 0, W, Y(0)); if (miny + vh > F.h) c.fillRect(0, Y(F.h), W, H);
      c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 2; c.strokeRect(X(0), Y(0), F.w * s, F.h * s);
      c.beginPath(); c.moveTo(X(F.halfway), Y(0)); c.lineTo(X(F.halfway), Y(F.h)); c.stroke();
      c.beginPath(); c.arc(X(F.halfway), Y(F.h / 2), 9.15 * s, 0, Math.PI * 2); c.stroke();
      c.strokeRect(X(0), Y(F.h / 2 - 20.16), 16.5 * s, 40.32 * s); c.strokeRect(X(F.w - 16.5), Y(F.h / 2 - 20.16), 16.5 * s, 40.32 * s);
      c.strokeRect(X(0), Y(F.h / 2 - 9.16), 5.5 * s, 18.32 * s); c.strokeRect(X(F.w - 5.5), Y(F.h / 2 - 9.16), 5.5 * s, 18.32 * s);
      c.fillStyle = 'rgba(255,255,255,.25)'; c.fillRect(X(-2.4), Y(F.h / 2 - 3.66), 2.4 * s, 7.32 * s); c.fillRect(X(F.w), Y(F.h / 2 - 3.66), 2.4 * s, 7.32 * s);
      const font = (px) => `700 ${px}px ${getComputedStyle(document.body).fontFamily}`;
      if (snap.lineX !== undefined) { c.save(); c.setLineDash([8, 6]); c.strokeStyle = '#ff5a5a'; c.lineWidth = 3; c.shadowColor = '#ff5a5a'; c.shadowBlur = 10; c.beginPath(); c.moveTo(X(snap.lineX), 0); c.lineTo(X(snap.lineX), H); c.stroke(); c.restore();
        c.fillStyle = '#ff8a8a'; c.font = font(W > 400 ? 13 : 10); c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.6)'; const lbl = W > 400 ? 'OFFSIDE LINE (2nd-last defender)' : 'OFFSIDE LINE'; c.strokeText(lbl, X(snap.lineX), H - 8); c.fillText(lbl, X(snap.lineX), H - 8); }
      if (snap.ring) { c.save(); c.setLineDash([6, 6]); c.strokeStyle = '#b6ff3b'; c.lineWidth = 2.5; c.beginPath(); c.arc(X(snap.ring.x), Y(snap.ring.y), snap.ring.r * s, 0, Math.PI * 2); c.stroke(); c.restore(); }
      (snap.arrows || []).forEach(a => { const ax = X(a.from.x), ay = Y(a.from.y), bx = X(a.to.x), by = Y(a.to.y), ang = Math.atan2(by - ay, bx - ax); c.strokeStyle = '#ffd23f'; c.fillStyle = '#ffd23f'; c.lineWidth = 3; c.setLineDash([6, 4]); c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke(); c.setLineDash([]); c.beginPath(); c.moveTo(bx, by); c.lineTo(bx - 10 * Math.cos(ang - .5), by - 10 * Math.sin(ang - .5)); c.lineTo(bx - 10 * Math.cos(ang + .5), by - 10 * Math.sin(ang + .5)); c.closePath(); c.fill(); });
      const r = Math.max(5, 1.2 * s);
      for (const p of snap.players) { const col = p.gk ? COL.gk : COL[p.team]; const px = X(p.x), py = Y(p.y); if (px < -r || px > W + r || py < -r || py > H + r) continue;
        const g = c.createRadialGradient(px - r * .3, py - r * .3, r * .1, px, py, r); g.addColorStop(0, col[0]); g.addColorStop(1, col[1]); c.fillStyle = g; c.beginPath(); c.arc(px, py, r, 0, Math.PI * 2); c.fill();
        c.lineWidth = p.me ? 3 : 1.5; c.strokeStyle = p.me ? '#b6ff3b' : 'rgba(255,255,255,.8)'; c.stroke();
        if (p.label) { c.font = font(Math.max(10, r * 1.1)); c.textAlign = 'center'; c.lineWidth = 3; c.strokeStyle = 'rgba(0,0,0,.7)'; c.fillStyle = p.me ? '#b6ff3b' : '#fff'; c.strokeText(p.label, px, py - r - 4); c.fillText(p.label, px, py - r - 4); } }
      const bx = X(snap.ball.x), by = Y(snap.ball.y); c.fillStyle = '#fff'; c.beginPath(); c.arc(bx, by, Math.max(3, 0.6 * s), 0, Math.PI * 2); c.fill(); c.strokeStyle = '#222'; c.lineWidth = 1; c.stroke();
    },
  };
  window.Explain = Explain;
})();
