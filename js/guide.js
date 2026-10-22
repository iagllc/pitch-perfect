/* Guided first game: 7 tiny steps on a real pitch. Opponents are passive, the ball waits for the kid. */
(function () {
  'use strict';
  const L = Logic, F = L.FIELD;
  class Guide {
    constructor(c) {
      this.c = c; this.sim = c.sim; this.me = c.me; this.app = c.app; this.i = -1; this.t = 0; this.hold = 0; this.flags = {}; this.retryT = 0;
      this.cm = this.sim.players.find(p => p.team === 0 && p.role === 'CM'); this.mate = this.sim.players.find(p => p.team === 0 && p.role === 'RW');
      this.app.showScoreboard(false); document.getElementById('scoreChip').style.display = 'none';
      this.steps = [
        { text: (Touch.isTouchDevice() ? '👋 This is YOU — the glowing player. Drag on the left side of the screen to run into your glowing ring!' : '👋 This is YOU — the glowing player. Run into your glowing ring! (arrow keys or WASD)'), target: () => this.me.target, done: () => L.dist(this.me, this.me.target) < L.GOOD_RADIUS, holdFor: 0.8, enter: () => this.sim.giveBall(this.cm.i) },
        { text: '⚽ Your teammate is passing to you. Run to the ball and take it!', enter: () => this.sim.kickPass(this.cm.i, this.me.i), target: () => this.sim.ball, done: () => this.sim.ball.holder === this.me.i, fix: () => this.repass() },
        { text: (Touch.isTouchDevice() ? '👍 You have the ball! Point the joystick at a teammate and tap PASS.' : '👍 You have the ball! Hold a direction toward a teammate and press SPACE to pass.'), done: () => this.flags.passed, keep: true },
        { text: '🔁 Nice pass! He is giving it back — go and get it.', enter: () => { this.sim.passiveTarget = this.me.i; }, target: () => this.sim.ball, done: () => this.sim.ball.holder === this.me.i, fix: () => this.repass() },
        { text: '🏃 Dribble! Run with the ball to the RIGHT ➡️ until you are inside the big box.', target: () => ({ x: 92, y: 34 }), done: () => this.sim.ball.holder === this.me.i && this.me.x > 88.5, fix: () => { if (this.sim.ball.holder !== this.me.i) this.repass(); } },
        { text: (Touch.isTouchDevice() ? '🎯 SHOOT! Tap the SHOOT button.' : '🎯 SHOOT! Press X.'), done: () => this.flags.goal, fix: () => { if (this.sim.ball.holder !== this.me.i && !this.sim.ball.inFlight && this.sim.phase === 'play') { this.me.x = 88; this.me.y = 34; this.sim.giveBall(this.me.i); this.app.coach('Keeper got it — have another go! Press X.', 'info'); } } },
        { text: '🚩 Last thing: the dashed OFFSIDE LINE. If you are PAST it when a pass is kicked, the whistle goes. Stand just BEFORE the line (on its left) and hold still…', enter: () => { this.sim.phase = 'play'; this.cm.x = 55; this.cm.y = 34; this.sim.giveBall(this.cm.i); this.me.x = 66; this.me.y = 28; }, done: () => { const j = this.judge(); return j.ok && j.margin < 7; }, holdFor: 2.5, target: () => { const j = this.judge(); return { x: j.lineX - 2.5, y: this.me.y }; } },
        { text: '✅ Perfect timing — the pass comes and NO whistle! Take it.', enter: () => this.sim.kickPass(this.cm.i, this.me.i), done: () => this.sim.ball.holder === this.me.i, fix: () => this.repass() },
        { text: '🎉 You are READY! Hit the button to play a real match.', end: true },
      ];
      this.next();
    }
    judge() { const opp = this.sim.teamPlayers(1); const j = L.judgeOffside({ attacker: this.me, ball: this.sim.ball, opponents: opp, dir: 1 }); return { ok: !j.offside && this.me.x > F.halfway, margin: j.margin, lineX: j.lineX }; }
    repass() { const b = this.sim.ball; if (b.inFlight) return; if (b.holder === this.me.i) return; const h = b.holder >= 0 ? this.sim.players[b.holder] : null; if (!h || h !== this.cm) { this.cm.x = L.clamp(this.me.x - 12, 5, 95); this.cm.y = this.me.y; this.sim.giveBall(this.cm.i); } this.sim.kickPass(this.cm.i, this.me.i); this.app.coach('Here it comes again — go get it!', 'info'); }
    next() {
      this.i++; const s = this.steps[this.i]; this.t = 0; this.hold = 0; this.retryT = 0; this.app.setTimerText(`Step ${Math.min(this.i + 1, this.steps.length - 1)}/${this.steps.length - 1}`);
      if (s.end) { this.app.coach(s.text, 'good'); this.app.sfx.perfect(); this.app.fx.confetti(F.halfway, 20, 120); setTimeout(() => this.c.app.finish({ title: 'Tutorial complete! 🎓', score: 100, pct: 100, stars: 3, feedback: { face: '🧢', text: 'You can move, pass, dribble, shoot and stay onside. Now play a real match and I will coach you along the way.' }, stats: [{ k: 'Steps', v: '7/7' }], next: 'match', nextLabel: 'Play a real match ▶' }), 1800); return; }
      if (s.enter) s.enter(); this.app.coach(s.text, 'info'); this.app.sfx.pop();
    }
    onEvent(e) {
      if (e.type === 'pass' && e.from === this.me.i && this.i === 2) this.flags.passed = true;
      if (e.type === 'goal' && e.team === 0) this.flags.goal = true;
      if (e.type === 'shot' && e.from === this.me.i && this.i === 5) this.app.coach('Shot! 🤞', 'info');
    }
    update(dt) {
      const s = this.steps[this.i]; if (!s || s.end) return; this.t += dt; this.retryT += dt;
      if (s.done && s.done()) { this.hold += dt; if (this.hold >= (s.holdFor || 0)) { if (this.i !== 2) this.app.sfx.good(); this.app.fx.burst(this.me.x, this.me.y, ['#b6ff3b', '#fff'], 14, 7); this.next(); } }
      else { this.hold = 0; if (s.fix && this.retryT > 2.5) { const b = this.sim.ball; const speed = Math.hypot(b.vx, b.vy); if (!b.inFlight || speed < 0.5) { s.fix(); this.retryT = 0; } } }
      if (this.i === 6) { const j = this.judge(); this.app.setRules({ half: this.me.x > F.halfway, ball: this.me.x > this.sim.ball.x, line: this.me.x > j.lineX + 0.05, offside: !j.ok && this.me.x > F.halfway, who: 'You' }); } else this.app.setRules(null);
    }
    draw(P) {
      const s = this.steps[this.i]; if (!s || s.end) return;
      if (s.target) { const t = s.target(); const pulse = 0.7 + Math.sin(P.t * 6) * 0.3; P.ring(t.x, t.y, 2.2 + pulse, '#ffd23f', { width: 4, glow: 'rgba(255,210,63,.35)' }); if (L.dist(this.me, t) > 4) { const dx = t.x - this.me.x, dy = t.y - this.me.y, n = Math.hypot(dx, dy); P.arrow({ x: this.me.x + dx / n * 3, y: this.me.y + dy / n * 3 }, { x: t.x - dx / n * 2.5, y: t.y - dy / n * 2.5 }, '#ffd23f', 5); } }
      if (this.i === 2 || this.i === 5) { const [px, py] = P.toPx(this.me.x, this.me.y - 4); P.ctx.font = `700 ${P.scale * 2.2}px ${getComputedStyle(document.body).fontFamily}`; P.ctx.textAlign = 'center'; P.ctx.fillStyle = '#ffd23f'; P.ctx.strokeStyle = 'rgba(0,0,0,.6)'; P.ctx.lineWidth = 4; const w = this.i === 2 ? 'SPACE = PASS' : 'X = SHOOT'; P.ctx.strokeText(w, px, py + Math.sin(P.t * 5) * 4); P.ctx.fillText(w, px, py + Math.sin(P.t * 5) * 4); }
    }
  }
  window.Guide = Guide;
})();
