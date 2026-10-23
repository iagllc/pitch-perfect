/* MODE 2: Offside Trainer. 'attack' = you are the striker timing your run. 'defend' = you move the back line. */
(function () {
  'use strict';
  const L = Logic, F = L.FIELD;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const ROUNDS = 8;
  const DEF_Y = [14, 27, 41, 54];

  class OffsideTrainer {
    constructor(app) { this.app = app; }

    start(opts) {
      this.variant = opts.variant || 'attack'; this.round = 0; this.points = 0; this.goals = 0; this.offsides = 0; this.sharp = 0; this.traps = 0; this.conceded = 0; this.covered = 0;
      this.keys = {}; this.dragging = false; this.dest = null; this.over = false; this.freezeT = 0;
      this.app.pitch.setView({ x: 36, y: -3, w: 73, h: 74 });
      this.app.setPossession(null); this.app.setCombo(null); this.app.setScore(0);
      this.app.coach(this.variant === 'attack'
        ? (Touch.isTouchDevice() ? 'You are the STRIKER. Stay onside, then tap PASS to call for the ball!' : 'You are the STRIKER. Stay onside, then press SPACE (or the PASS button) to call for the ball!')
        : (Touch.isTouchDevice() ? 'You control the BACK LINE. Drag left to step up, right to drop. Catch the striker offside, or drop to cover!' : 'You control the BACK LINE. Watch the striker — step up to catch him offside, or drop to cover!'), 'info');
      Touch.enable(true, this.variant === 'attack' ? ['pass'] : []); Touch.actions.pass = () => this.requestPass();
      this.explainAfter = null;
      this.nextRound(true);
    }
    rulesNow() { // the three offside questions, answered live
      const a = this.variant === 'attack' ? this.me : this.striker, xs = this.defs.concat([this.gk]).map(o => o.x).sort((p, q) => q - p);
      const half = a.x > F.halfway, ball = a.x > this.ball.x, line = a.x > xs[1] + 0.05;
      return { half, ball, line, offside: half && ball && line, who: this.variant === 'attack' ? 'You' : 'Striker', lineX: Math.max(xs[1], F.halfway) };
    }
    snapNow(extra) {
      const att = this.variant === 'attack' ? this.me : this.striker, atk = this.variant === 'attack';
      const players = [{ ...this.gk, team: atk ? 1 : 0, gk: true }, ...this.defs.map((d, i) => ({ ...d, team: atk ? 1 : 0, me: !atk, label: !atk && i === 0 ? 'YOUR LINE' : '' })), { ...this.passer, team: atk ? 0 : 1, label: 'PASSER' }, { ...att, team: atk ? 0 : 1, me: atk, focus: true, label: atk ? 'YOU' : 'STRIKER' }];
      return { players, ball: { x: this.ball.x, y: this.ball.y }, dir: 1, ...extra };
    }

    nextRound(first) {
      this.round++;
      if (this.round > ROUNDS) return this.finish();
      this.app.setTimerText(`Round ${this.round}/${ROUNDS}`);
      this.phase = 'play'; this.playT = 0; this.verdict = null; this.flight = null; this.app.hideVerdict();
      const lineX = rnd(68, 78);
      this.defs = DEF_Y.map(y => ({ x: lineX, y: y + rnd(-1, 1) }));
      this.gk = { x: 101.5, y: 34 };
      this.passer = { x: rnd(50, 56), y: rnd(22, 46), wind: 0, phase: rnd(0, 6) };
      this.ball = { x: this.passer.x + 0.8, y: this.passer.y, z: 0, spin: 0 };
      if (this.variant === 'attack') {
        this.me = { x: lineX - rnd(6, 10), y: rnd(20, 48) };
        this.wingers = [{ x: lineX - 4, y: 8 }, { x: lineX - 4, y: 60 }];
        this.lineTarget = lineX; this.lineTimer = rnd(1, 2); this.patience = rnd(9, 13);
        this.app.showPass(true);
      } else {
        this.lineX = lineX; this.defs.forEach(d => d.x = lineX);
        this.striker = { x: lineX - rnd(2, 5), y: rnd(22, 46), runSpeed: 0, running: false };
        this.decoys = [{ x: lineX - 6, y: 8 }, { x: lineX - 6, y: 60 }];
        this.kickIn = rnd(3.5, 7); this.windup = 0.9; this.earlyRun = Math.random() < 0.5; this.runLead = this.earlyRun ? rnd(0.35, 0.8) : rnd(-0.05, 0.1);
        this.app.showPass(false);
      }
      if (!first) this.app.toast(`Round ${this.round}`);
      if (this.explainAfter) { Explain.show({ ...this.explainAfter, blocking: true }); this.explainAfter = null; }
    }

    // ---------- input ----------
    onPointer(type, m) {
      if (this.phase !== 'play') return;
      if (type === 'down') { this.dragging = true; this.dest = m; } else if (type === 'move' && this.dragging) this.dest = m; else if (type === 'up') this.dragging = false;
    }
    onKey(code, down) {
      this.keys[code] = down; if (down) this.dest = null;
      if (down && (code === 'Space' || code === 'Enter') && this.variant === 'attack') this.requestPass();
    }
    requestPass() { if (this.phase === 'play' && this.variant === 'attack') this.kick(); }

    // ---------- the moment of the kick ----------
    kick() {
      const attacker = this.variant === 'attack' ? this.me : this.striker;
      const opponents = this.defs.concat([this.gk]);
      const v = L.judgeOffside({ attacker, ball: this.ball, opponents, dir: 1 });
      this.verdict = v; this.phase = 'freeze'; this.freezeT = 0; this.app.showPass(false); this.app.sfx.kick(); this.app.fx.kick(0.3);
      const m = v.margin, mTxt = Math.abs(m).toFixed(1) + ' m';
      let word, why, kind, pts = 0;
      if (this.variant === 'attack') {
        if (v.offside) { word = 'OFFSIDE!'; kind = 'bad'; why = `You were ${mTxt} past the last defender when the ball was kicked. Wait a split second longer!`; this.offsides++; this.outcome = 'flag'; }
        else if (v.reason === 'behind-ball') { word = 'ONSIDE ✓'; kind = 'good'; why = 'You were behind the BALL — you can never be offside there! +100'; pts = 100; this.outcome = 'goal'; }
        else if (v.reason === 'own-half') { word = 'ONSIDE ✓'; kind = 'meh'; why = "In your own half you can't be offside… but that is a long way from goal. +30"; pts = 30; this.outcome = 'pass'; }
        else if (v.reason === 'level') { word = 'LEVEL = ONSIDE ✓'; kind = 'good'; why = 'Exactly level with the defender counts as ONSIDE. Razor sharp! +200'; pts = 200; this.sharp++; this.outcome = 'goal'; }
        else if (m < 1.5) { word = 'RAZOR SHARP!'; kind = 'good'; why = `Only ${mTxt} behind the line — perfect timing! +200`; pts = 200; this.sharp++; this.outcome = 'goal'; }
        else if (m < 5) { word = 'ONSIDE ✓'; kind = 'good'; why = `${mTxt} behind the line. Great timing — go score! +120`; pts = 120; this.outcome = 'goal'; }
        else if (m < 12) { word = 'ONSIDE ✓'; kind = 'good'; why = `${mTxt} behind the line. Safe, but get closer to the line for bonus points. +80`; pts = 80; this.outcome = 'goal'; }
        else { word = 'TOO SAFE'; kind = 'meh'; why = `You were ${mTxt} behind the line — the defenders had time to catch you. +30`; pts = 30; this.outcome = 'caught'; }
      } else {
        if (v.offside) { word = 'OFFSIDE TRAP!'; kind = 'good'; why = `The striker was ${mTxt} past your line when the ball was kicked. Flag up — great defending! +150`; pts = 150; this.traps++; this.outcome = 'flag'; }
        else if (v.reason === 'own-half') { word = 'NO OFFSIDE HERE'; kind = 'meh'; why = "You pushed past halfway — a player can't be offside in his own half! Hold a deeper line."; this.outcome = m < 2.5 ? 'conceded' : 'covered'; pts = this.outcome === 'covered' ? 40 : 0; }
        else if (m < 2.5) { word = v.reason === 'level' ? 'LEVEL = ONSIDE' : 'HE’S THROUGH!'; kind = 'bad'; why = v.reason === 'level' ? 'Level with your last defender counts as ONSIDE. He is in on goal!' : `Only ${mTxt} between him and your line — he beat you to the ball.`; this.outcome = 'conceded'; }
        else { word = 'COVERED ✓'; kind = 'good'; why = `Striker was ${mTxt} behind your line — onside, but your defender gets there first. +60`; pts = 60; this.covered++; this.outcome = 'covered'; }
      }
      if (this.outcome === 'conceded') this.conceded++;
      this.pending = pts;
      const R = this.rulesNow(), snap = this.snapNow({ lineX: R.lineX, arrows: [{ from: { x: this.passer.x, y: this.passer.y }, to: { x: attacker.x, y: attacker.y } }] });
      const checklist = `At the kick: ${R.half ? '✓' : '✗'} other half · ${R.ball ? '✓' : '✗'} ahead of the ball · ${R.line ? '✓' : '✗'} past the 2nd-last defender.`;
      if (this.variant === 'attack') {
        if (v.offside) this.explainAfter = { key: 't-off', title: 'Offside! 🚩', text: `${checklist} All three were true, so the flag went up — you were ${mTxt} past the line when the ball was kicked. Hover ON the line and go the instant the ball is played.`, lesson: 'Start your run when the ball is kicked, not before.', snap };
        else if (this.outcome === 'caught') this.explainAfter = { key: 't-safe', title: 'Too far from the line 🐢', text: `You were onside, but ${mTxt} behind the defenders. By the time the ball arrived they had caught up. Get closer to the line: level with the last defender is still ONSIDE.`, lesson: 'Level = onside. Play on the shoulder of the last defender.', snap };
      } else {
        if (this.outcome === 'conceded') this.explainAfter = { key: 't-through', title: v.reason === 'level' ? 'Level = onside 🟰' : 'He got through 😖', text: `${checklist} ${v.reason === 'level' ? 'He was exactly LEVEL with your line, and level counts as onside.' : `Only ${mTxt} between him and your line, so he was onside and faster.`} Next time: when the PASS COMING bar fills, either STEP UP together so he is past your line, or DROP early to keep 3+ m of cover.`, lesson: 'Decide early: step up to trap, or drop to cover.', snap };
        else if (v.reason === 'own-half') this.explainAfter = { key: 't-half', title: 'The trap cannot work here ⚠️', text: `${checklist} Your line was past the halfway line. A player can never be offside in his own half, so stepping up there does nothing. Keep your line in your own half.`, lesson: 'Never hold your line past halfway.', snap };
      }
      this.app.verdict(word, why, kind);
      if (this.outcome === 'flag') this.app.sfx.whistle(); else if (kind === 'good') this.app.sfx.good(); else this.app.sfx.bad();
    }

    startResolve() {
      this.phase = 'resolve'; this.resT = 0;
      const runner = this.variant === 'attack' ? this.me : this.striker;
      const from = { x: this.ball.x, y: this.ball.y };
      if (this.outcome === 'flag') { this.flight = { from, to: { x: runner.x + 6, y: runner.y }, t: 0, dur: 0.8, loft: 1.2 }; this.resLen = 2.2; }
      else if (this.outcome === 'goal' || this.outcome === 'conceded') { this.flight = { from, to: { x: Math.min(93, runner.x + 9), y: runner.y }, t: 0, dur: 0.9, loft: 1.5 }; this.shot = null; this.resLen = 3.2; }
      else { this.flight = { from, to: { x: runner.x + 4, y: runner.y }, t: 0, dur: 0.8, loft: 1 }; this.resLen = 2.2; }
    }

    // ---------- update ----------
    update(dt) {
      if (this.over) return;
      const P = this.app.pitch; P.t += dt;
      if (Explain.paused) return;
      if (this.phase === 'play') { this.updatePlay(dt); const R = this.rulesNow(); this.app.setRules(R); this.liveOffside = R.offside; }
      else if (this.phase === 'freeze') { this.freezeT += dt; if (this.freezeT > 1.9) this.startResolve(); }
      else if (this.phase === 'resolve') this.updateResolve(dt);
      this.app.setScore(Math.floor(this.points));
    }

    moveMe(p, dt, speed) {
      let vx = 0, vy = 0; const k = this.keys;
      if (k.ArrowLeft || k.KeyA) vx -= 1; if (k.ArrowRight || k.KeyD) vx += 1; if (k.ArrowUp || k.KeyW) vy -= 1; if (k.ArrowDown || k.KeyS) vy += 1;
      if (!vx && !vy && Touch.enabled) { vx = Touch.vec.x; vy = Touch.vec.y; }
      if (vx || vy) { const n = Math.max(1, Math.hypot(vx, vy)); p.x += vx / n * speed * dt; p.y += vy / n * speed * dt; }
      else if (this.dest) { const dx = this.dest.x - p.x, dy = this.dest.y - p.y, d = Math.hypot(dx, dy); if (d < 0.3) this.dest = null; else { const s = Math.min(d, speed * dt); p.x += dx / d * s; p.y += dy / d * s; } }
      p.x = L.clamp(p.x, 40, 100); p.y = L.clamp(p.y, 2, F.h - 2);
    }

    updatePlay(dt) {
      this.playT += dt;
      this.passer.phase += dt; this.passer.y += Math.sin(this.passer.phase) * 1.2 * dt; this.passer.x += Math.cos(this.passer.phase * 0.7) * 0.6 * dt;
      this.ball.x = this.passer.x + 0.8; this.ball.y = this.passer.y + 0.3;
      if (this.variant === 'attack') {
        // defenders' line wanders, sometimes steps up fast
        this.lineTimer -= dt;
        if (this.lineTimer <= 0) { this.lineTarget = L.clamp(this.lineTarget + (Math.random() < 0.35 ? rnd(4, 8) : rnd(-7, 4)), 64, 84); this.lineTimer = rnd(1.2, 2.6); this.lineSpeed = rnd(2.5, 6); }
        for (const d of this.defs) { const dx = this.lineTarget - d.x; d.x += Math.sign(dx) * Math.min(Math.abs(dx), (this.lineSpeed || 3) * dt); }
        // defenders shadow the striker a little
        const lx = this.defs[0].x; this.defs.forEach((d, i) => { d.y += (DEF_Y[i] + (this.me.y - 34) * 0.25 - d.y) * dt * 1.5; });
        this.wingers.forEach(w => { w.x += ((lx - 3.5) - w.x) * dt * 2; });
        this.moveMe(this.me, dt, 7);
        this.patience -= dt;
        if (this.patience <= 0) { this.app.coach('The passer could not wait any longer!', 'info'); this.kick(); }
      } else {
        // my back line
        const k = this.keys; let v = 0;
        if (k.ArrowLeft || k.KeyA || k.ArrowUp || k.KeyW) v -= 1; if (k.ArrowRight || k.KeyD || k.ArrowDown || k.KeyS) v += 1;
        if (!v && Touch.enabled) v = Touch.vec.x;
        if (v) { this.lineX += v * 7 * dt; this.dest = null; } else if (this.dest) { const dx = this.dest.x - this.lineX; this.lineX += Math.sign(dx) * Math.min(Math.abs(dx), 7 * dt); }
        this.lineX = L.clamp(this.lineX, 48, 98);
        this.defs.forEach((d, i) => { d.x = this.lineX; d.y += (DEF_Y[i] + (this.striker.y - 34) * 0.3 - d.y) * dt * 2; });
        // striker: hovers just onside, then bursts
        const s = this.striker, timeToKick = this.kickIn - this.playT;
        if (!s.running && timeToKick <= this.runLead) { s.running = true; }
        if (s.running) { s.x += 7.5 * dt; }
        else { const want = this.lineX - 1.5; s.x += L.clamp(want - s.x, -4 * dt, 4 * dt); s.y += Math.sin(this.playT * 1.3) * 1.5 * dt; }
        s.x = L.clamp(s.x, 45, 100);
        this.decoys.forEach(d => { d.x += ((this.lineX - 6) - d.x) * dt * 2; });
        this.passer.wind = L.clamp(1 - timeToKick / this.windup, 0, 1);
        if (timeToKick <= 0) this.kick();
      }
    }

    updateResolve(dt) {
      this.resT += dt;
      const runner = this.variant === 'attack' ? this.me : this.striker;
      if (this.flight) {
        const f = this.flight; f.t += dt; const k = Math.min(1, f.t / f.dur);
        this.ball.x = f.from.x + (f.to.x - f.from.x) * k; this.ball.y = f.from.y + (f.to.y - f.from.y) * k; this.ball.z = Math.sin(k * Math.PI) * f.loft; this.ball.spin += dt * 14;
        if (this.outcome !== 'flag') { const dx = f.to.x - runner.x, dy = f.to.y - runner.y, d = Math.hypot(dx, dy); if (d > 0.2) { const s = Math.min(d, 7.5 * dt); runner.x += dx / d * s; runner.y += dy / d * s; } }
        if (k >= 1) {
          this.flight = null;
          if (this.outcome === 'goal' || this.outcome === 'conceded') { this.shot = { from: { x: this.ball.x, y: this.ball.y }, to: { x: 104.5, y: 34 + rnd(-2.5, 2.5) }, t: 0, dur: 0.55 }; this.app.sfx.kick(); }
          else if (this.outcome === 'caught' || this.outcome === 'covered') { this.app.sfx.pop(); this.app.fx.text(this.ball.x, this.ball.y - 3, this.outcome === 'caught' ? 'Cleared!' : 'Won it!', '#fff', 2); }
          else if (this.outcome === 'flag') { this.app.fx.text(this.ball.x, this.ball.y - 3, '🚩 Flag!', '#ff5a5a', 2.4); }
        }
      } else if (this.shot) {
        const s = this.shot; s.t += dt; const k = Math.min(1, s.t / s.dur);
        this.ball.x = s.from.x + (s.to.x - s.from.x) * k; this.ball.y = s.from.y + (s.to.y - s.from.y) * k; this.ball.z = Math.sin(k * Math.PI) * 0.8; this.ball.spin += dt * 20;
        if (k >= 1) {
          this.shot = null; this.app.sfx.goal(); this.app.fx.kick(0.8);
          if (this.outcome === 'goal') { this.goals++; this.app.fx.confetti(this.ball.x - 6, this.ball.y, 90); this.app.fx.text(this.ball.x - 8, this.ball.y - 4, 'GOAL!!!', '#ffd23f', 4); }
          else { this.app.fx.burst(this.ball.x, this.ball.y, '#ff5a5a', 30, 10); this.app.fx.text(this.ball.x - 8, this.ball.y - 4, 'GOAL AGAINST 😖', '#ff5a5a', 3); }
        }
      }
      if (this.resT > this.resLen) { if (this.pending) { this.points += this.pending; this.app.fx.text(runner.x, runner.y - 3, `+${this.pending}`, '#b6ff3b', 2.2); this.pending = 0; } this.nextRound(false); }
    }

    finish() {
      this.over = true; const max = ROUNDS * 200; let pct, fb, stats;
      if (this.variant === 'attack') {
        pct = Math.round(100 * this.points / max);
        fb = this.offsides >= 4 ? { face: '⏱️', text: 'Too eager! Wait until the ball is KICKED before you run past the last defender.' }
          : this.sharp >= 3 ? { face: '🔪', text: 'Razor-sharp timing! You hover on the line and go the instant the ball is played. Elite.' }
          : this.goals >= 5 ? { face: '⚽', text: 'Great work — you stayed onside. Now try to hug the line closer for bonus points!' }
          : { face: '👀', text: 'Keep one eye on the last defender and one on the ball. Level is onside!' };
        stats = [{ k: 'Goals', v: this.goals }, { k: 'Razor sharp', v: this.sharp }, { k: 'Offsides', v: this.offsides }];
      } else {
        pct = Math.round(100 * this.points / (ROUNDS * 150));
        fb = this.conceded >= 4 ? { face: '🛡️', text: 'The striker got through too often. When the passer winds up, decide fast: STEP UP together or DROP and cover.' }
          : this.traps >= 4 ? { face: '🪤', text: 'Master of the offside trap! You moved as ONE line at the perfect moment.' }
          : { face: '👍', text: 'Solid defending. The trap works best when the striker is already drifting past your line.' };
        stats = [{ k: 'Offside traps', v: this.traps }, { k: 'Covered', v: this.covered }, { k: 'Conceded', v: this.conceded }];
      }
      this.app.showPass(false); Touch.enable(false); this.app.setRules(null);
      this.app.finish({ lessons: Explain.lessons.slice(0, 4), title: this.variant === 'attack' ? 'Striker Report' : 'Defender Report', score: Math.floor(this.points), pct, stars: L.stars(pct), feedback: fb, stats });
    }

    // ---------- draw ----------
    draw() {
      const P = this.app.pitch, c = P.ctx; P.drawField();
      const attacker = this.variant === 'attack' ? this.me : this.striker;
      const opp = this.defs.concat([this.gk]).map(o => o.x).sort((a, b) => b - a); const liveLine = Math.max(opp[1], F.halfway);
      // live line hint during play (faint), hard line during freeze
      if (this.phase === 'play') {
        const on = attacker.x <= liveLine + 0.05 || attacker.x <= this.ball.x;
        P.vline(liveLine, on ? 'rgba(182,255,59,.5)' : 'rgba(255,90,90,.75)', 2.5, [6, 10], '2ND-LAST DEFENDER');
        if (this.variant === 'defend') { P.textM(this.lineX, -2.2, '◀ STEP UP      DROP ▶', '#fff', 1.5); }
      }
      if (this.verdict && this.phase !== 'play') {
        c.fillStyle = 'rgba(0,0,20,.35)'; c.fillRect(0, 0, P.cssW, P.cssH);
        const col = this.verdict.offside ? '#ff5a5a' : '#b6ff3b';
        P.vline(this.verdict.lineX, col, 4, [12, 8], 'OFFSIDE LINE');
        const y = attacker.y + 3.2; P.line({ x: attacker.x, y }, { x: this.verdict.lineX, y }, '#fff', 2, [4, 4]);
        P.textM((attacker.x + this.verdict.lineX) / 2, y + 1.8, Math.abs(this.verdict.margin).toFixed(1) + ' m', '#fff', 1.6);
        // assistant referee flag
        if (this.verdict.offside) { const fx = this.verdict.lineX, fy = F.h + 2.2; P.line({ x: fx, y: fy }, { x: fx, y: fy - 3 }, '#fff', 3); P.poly([{ x: fx, y: fy - 3 }, { x: fx + 2.4, y: fy - 2.2 }, { x: fx, y: fy - 1.4 }], '#ff5a5a'); }
      }
      // players
      P.drawPlayer(this.gk, { team: 'gk', number: 1 });
      this.defs.forEach((d, i) => P.drawPlayer(d, { team: this.variant === 'attack' ? 'them' : 'us', number: i + 2, me: this.variant === 'defend', label: this.variant === 'defend' && i === 0 ? 'YOUR LINE' : undefined, labelColor: '#b6ff3b' }));
      const attTeam = this.variant === 'attack' ? 'us' : 'them';
      (this.variant === 'attack' ? this.wingers : this.decoys).forEach((w, i) => P.drawPlayer(w, { team: attTeam, number: 7 + i * 4 }));
      P.drawPlayer(this.passer, { team: attTeam, number: 8, hasBall: this.phase === 'play' });
      if (this.variant === 'defend' && this.phase === 'play' && this.passer.wind > 0) { // wind-up meter: pass is coming!
        const [px, py] = P.toPx(this.passer.x, this.passer.y - 3); const w = 4 * P.scale;
        c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(px - w / 2, py - 5, w, 8); c.fillStyle = '#ffd23f'; c.fillRect(px - w / 2, py - 5, w * this.passer.wind, 8);
        P.textM(this.passer.x, this.passer.y - 5, 'PASS COMING!', '#ffd23f', 1.5);
      }
      const liveTag = this.phase === 'play' ? (this.liveOffside ? '🚩 OFFSIDE POSITION' : 'ONSIDE ✓') : null;
      if (this.variant === 'attack') { P.drawPlayer(this.me, { team: 'us', number: 9, me: true, label: 'YOU', labelColor: '#b6ff3b' }); if (liveTag) P.textM(this.me.x, this.me.y + 3.4, liveTag, this.liveOffside ? '#ff5a5a' : '#b6ff3b', 1.5); }
      else { P.drawPlayer(this.striker, { team: 'them', number: 9, label: 'STRIKER', labelColor: '#ff8a8a' }); if (liveTag) P.textM(this.striker.x, this.striker.y + 3.4, liveTag, this.liveOffside ? '#ff5a5a' : '#b6ff3b', 1.5); }
      if (this.dest && this.phase === 'play') P.ring(this.dest.x, this.variant === 'defend' ? attacker.y : this.dest.y, 0.9, 'rgba(255,255,255,.7)', { width: 2 });
      P.drawBall(this.ball);
      if (this.variant === 'attack' && this.phase === 'play' && this.patience < 4) P.textM(this.passer.x, this.passer.y - 3.5, `Passing in ${Math.ceil(this.patience)}…`, '#ffd23f', 1.6);
      this.app.fx.draw(P);
    }
  }
  window.OffsideTrainer = OffsideTrainer;
})();
