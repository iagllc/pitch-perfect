/* MODE 1: Shape Shift - 11 v 11 spacing game. You control one player; keep the team's shape. */
(function () {
  'use strict';
  const L = Logic, F = L.FIELD;
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];

  const TIPS = [
    'Spread out when WE have the ball. Make the field BIG! 🌍',
    'Lost the ball? Squeeze together. Make the field SMALL! 🧲',
    'Slide with your team toward the ball, like you are tied with a rope. 🪢',
    'Never stand right next to a teammate. Give them space to work. 📏',
    'Make triangles! Two options for the passer = easy passes. 🔺',
    'Stay in your lane. Chasing the ball leaves a hole behind you. 🕳️',
  ];

  class SpacingGame {
    constructor(app) { this.app = app; }

    start(opts) {
      const { role = 'CM', difficulty = 'rookie', duration = 90 } = opts;
      this.difficulty = difficulty; this.timeLeft = duration; this.duration = duration;
      this.us = L.formation('433', 1).map(p => ({ ...p, x: p.home.x, y: p.home.y, target: { ...p.home } }));
      this.them = L.formation('433', -1).map(p => ({ ...p, x: p.home.x, y: p.home.y, target: { ...p.home } }));
      this.meIdx = Math.max(1, this.us.findIndex(p => p.role === role));
      this.me = this.us[this.meIdx];
      this.poss = 'us'; this.holder = { team: 'us', idx: this.us.findIndex(p => p.role === 'CM') };
      this.ball = { x: 0, y: 0, z: 0, spin: 0, flight: null };
      this.holdTimer = 2.2; this.theirPasses = 0;
      this.keys = {}; this.dest = null; this.dragging = false;
      this.points = 0; this.shapeTime = 0; this.totalTime = 0; this.zoneTime = 0; this.outTime = 0; this.combo = 1; this.bestCombo = 1;
      this.received = 0; this.crowdCount = 0; this.crowdTimer = 0; this.crowdCool = 0; this.triTime = 0; this.triCount = 0;
      this.offX = 0; this.offBall = 0; this.farTime = 0; this.msgCool = 0; this.tipTimer = 12; this.openUpCool = 0;
      this.lastBallSide = 0; this.countdown = 3.9; this.over = false;
      this.app.pitch.fullView();
      this.app.setPossession('us'); this.app.setCombo(1); this.app.setScore(0); this.app.setTimer(duration);
      this.app.coach(`You are the ${this.me.name}. Stay in your spot as the ball moves!`, 'info');
      this.explained = {}; Touch.enable(true, []);
      this.updateBallPos();
    }
    snap(extra) { return { players: [...this.us.map(p => ({ x: p.x, y: p.y, team: 0, gk: p.role === 'GK', me: p === this.me, label: p === this.me ? 'YOU' : (extra && extra.labels && extra.labels[p.index]) || '' })), ...this.them.map(p => ({ x: p.x, y: p.y, team: 1, gk: p.role === 'GK' }))], ball: { x: this.ball.x, y: this.ball.y }, dir: 1, ...extra }; }
    teach(key, title, text, lesson, extra) { const first = !this.explained[key]; this.explained[key] = true; Explain.show({ key, title, text, lesson, snap: this.snap(extra), blocking: first }); }

    // ---------- input ----------
    onPointer(type, m) {
      if (type === 'down') { this.dragging = true; this.dest = m; }
      else if (type === 'move' && this.dragging) this.dest = m;
      else if (type === 'up') this.dragging = false;
    }
    onKey(code, down) { this.keys[code] = down; if (down) this.dest = null; }

    // ---------- helpers ----------
    holderPlayer() { return this.holder ? (this.holder.team === 'us' ? this.us : this.them)[this.holder.idx] : null; }
    updateBallPos() {
      const h = this.holderPlayer(); if (!h) return;
      const dir = this.holder.team === 'us' ? 1 : -1; this.ball.x = h.x + dir * 0.9; this.ball.y = h.y + 0.4; this.ball.z = 0;
    }
    moveToward(p, t, speed, dt) {
      const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy); if (d < 0.05) return;
      const step = Math.min(d, speed * Math.min(1, d / 2.5 + 0.2) * dt); p.x += dx / d * step; p.y += dy / d * step;
    }
    setPossession(team) {
      if (this.poss === team) return; this.poss = team; this.theirPasses = 0; this.app.setPossession(team);
      if (team === 'us') { this.app.coach("We've got it! SPREAD OUT — make the field big! 🌍", 'good'); this.app.sfx.good(); }
      else { this.app.coach('Lost it! SQUEEZE IN — get compact! 🧲', 'bad'); this.app.sfx.bad(); }
      this.msgCool = 4;
    }

    // ---------- passing AI ----------
    choosePass() {
      const team = this.holder.team, mates = team === 'us' ? this.us : this.them, dir = team === 'us' ? 1 : -1, h = mates[this.holder.idx];
      const cands = mates.map((p, i) => ({ p, i })).filter(c => c.i !== this.holder.idx && c.p.role !== 'GK')
        .map(c => ({ ...c, d: L.dist(c.p, h) })).filter(c => c.d > 7 && c.d < 40);
      if (!cands.length) return null;
      for (const c of cands) c.w = 1 + Math.max(0, (c.p.x - h.x) * dir) / 15 + (c.d < 25 ? 1 : 0) + Math.random() * 1.5;
      cands.sort((a, b) => b.w - a.w);
      if (team === 'us') {
        const meC = cands.find(c => c.i === this.meIdx);
        if (meC) {
          const dMe = L.dist(this.me, this.me.target);
          if (dMe <= L.GOOD_RADIUS * 1.2 && Math.random() < 0.7) return meC;      // reward good spacing
          if (dMe > L.GOOD_RADIUS * 2) {
            if (cands[0] === meC && this.openUpCool <= 0) { this.app.coach(`${h.name} wanted to pass to you — but you were out of position!`, 'bad'); this.openUpCool = 8; this.teach('drill-open', 'You missed a pass 📭', `${h.name} looked up to pass to you, but you were ${dMe.toFixed(0)} m away from your spot (the ring). Teammates pass to players who are where they expect them to be.`, 'Be in your spot and the ball will find you.', { ring: { ...this.me.target, r: L.GOOD_RADIUS }, arrows: [{ from: { x: h.x, y: h.y }, to: { ...this.me.target } }], labels: { [h.index]: 'PASSER' } }); }
            return cands.find(c => c !== meC) || null;
          }
        }
      }
      return cands[0];
    }
    kickPass() {
      const team = this.holder.team, c = this.choosePass(); if (!c) { this.holdTimer = 0.6; return; }
      const from = { x: this.ball.x, y: this.ball.y };
      // aim a little ahead of the receiver, toward his spot, but never more than 3 m from where he stands: a player who stays put must still be able to receive it
      const lx = c.p.target.x - c.p.x, ly = c.p.target.y - c.p.y, ld = Math.hypot(lx, ly) || 1, lead = Math.min(3, ld * 0.35);
      let to = { x: c.p.x + lx / ld * lead, y: c.p.y + ly / ld * lead };
      let receiver = { team, idx: c.i }, intercepted = false;
      // interceptions: teach that possession changes happen
      const stealChance = team === 'us' ? 0.14 : (this.theirPasses >= 3 ? 1 : 0.3);
      if (Math.random() < stealChance) {
        const others = team === 'us' ? this.them : this.us, mid = { x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 };
        let best = -1, bd = 1e9; others.forEach((p, i) => { if (p.role === 'GK') return; const d = L.dist(p, mid); if (d < bd) { bd = d; best = i; } });
        if (best >= 0 && bd < 14) { intercepted = true; receiver = { team: team === 'us' ? 'them' : 'us', idx: best }; to = { x: others[best].x, y: others[best].y }; }
      }
      const d = L.dist(from, to), speed = 15 + d * 0.12;
      this.ball.flight = { from, to, t: 0, dur: d / speed, receiver, intercepted, loft: Math.min(2.4, d / 14), startD: (receiver.team === 'us' && receiver.idx === this.meIdx) ? L.dist(this.me, to) : undefined };
      this.holder = null; this.app.sfx.kick(); this.app.fx.dust(from.x, from.y);
      if (team === 'them') this.theirPasses++;
    }
    receiveMe(pts, popup, say) {
      this.received++; this.points += pts; this.app.sfx.receive(); this.app.sfx.perfect();
      this.app.fx.text(this.me.x, this.me.y - 3, popup, '#b6ff3b', 2); this.app.fx.burst(this.me.x, this.me.y, ['#b6ff3b', '#fff'], 18, 8);
      this.app.coach(say, 'good'); this.msgCool = 3;
    }
    updateRoll(dt) { // a pass to you that landed short or wide keeps rolling: meet it and it is yours, ignore it and they take it
      const r = this.ball.roll; r.t += dt; r.speed = Math.max(0, r.speed - 4.5 * dt);
      this.ball.x = L.clamp(this.ball.x + r.ux * r.speed * dt, 1, F.w - 1); this.ball.y = L.clamp(this.ball.y + r.uy * r.speed * dt, 1, F.h - 1); this.ball.spin += dt * 10;
      const d = L.dist(this.me, this.ball); r.minD = Math.min(r.minD, d);
      if (d < 2.4) { this.ball.roll = null; this.receiveMe(30, '+30 Went and got it!', 'You went to meet the pass. Good! ⚽'); this.holder = { team: 'us', idx: this.meIdx }; this.setPossession('us'); this.holdTimer = 1.4; this.updateBallPos(); return; }
      if (r.speed > 0 && r.t < 1.8) return;
      this.ball.roll = null; // you let it go
      const passed = ((this.ball.x - this.me.x) * r.ux + (this.ball.y - this.me.y) * r.uy) > 0;
      this.app.coach('The pass came to you — go and get it! 🏃', 'bad'); this.msgCool = 4;
      this.teach('drill-roll', passed ? 'The ball rolled past you 🏃' : 'You let the pass go 🏃', `That pass was played to YOU. It came within ${Math.max(1, Math.round(r.minD))} m of you and you did not go to meet it, so the other team picked it up. When a pass comes, attack the ball.`, 'Move toward passes meant for you.', { arrows: [{ from: { x: r.from.x, y: r.from.y }, to: { x: this.ball.x, y: this.ball.y } }] });
      let best = 0, bd = 1e9; this.them.forEach((p, i) => { const d2 = L.dist(p, this.ball); if (d2 < bd) { bd = d2; best = i; } });
      this.holder = { team: 'them', idx: best }; this.setPossession('them'); this.holdTimer = rnd(1, 2); this.updateBallPos();
    }
    landBall() {
      const f = this.ball.flight, mates = f.receiver.team === 'us' ? this.us : this.them, r = mates[f.receiver.idx];
      this.ball.flight = null;
      if (f.receiver.team === 'us' && f.receiver.idx === this.meIdx) {
        if (L.dist(this.me, f.to) > 3.2) { // not there yet: the ball keeps rolling for a moment, so you can still go and get it
          const dx = f.to.x - f.from.x, dy = f.to.y - f.from.y, n = Math.hypot(dx, dy) || 1;
          this.ball.z = 0; this.ball.roll = { ux: dx / n, uy: dy / n, speed: 7, t: 0, from: f.from, minD: L.dist(this.me, this.ball) }; this.holder = null; return;
        }
        this.receiveMe(50, '+50 Great spot!', 'Perfect position — the ball found YOU! ⚽✨');
      } else { this.app.sfx.receive(); this.app.fx.dust(r.x, r.y); }
      this.holder = f.receiver; this.setPossession(f.receiver.team);
      this.holdTimer = (this.holder.team === 'us' && this.holder.idx === this.meIdx) ? 1.4 : rnd(1.0, 2.3);
      this.updateBallPos();
    }

    // ---------- update ----------
    update(dt) {
      if (this.over) return;
      if (window.PhoneView && PhoneView.active() && this.me) { // Pocket view: me, the ball and the teammates I must keep my distance from
        const near = this.us.filter(p => p !== this.me && L.dist(p, this.me) < 22);
        this.app.pitch.actionCam(dt, [this.me, this.ball].concat(near), { focus: this.me, minScale: 6.5, maxScale: 12 });
      }
      this.app.pitch.t += dt;
      if (Explain.paused) return;
      if (this.countdown > 0) { const before = Math.ceil(this.countdown); this.countdown -= dt; const after = Math.ceil(this.countdown); if (after < before) { after > 0 ? this.app.sfx.countdown() : this.app.sfx.start(); } return; }
      this.timeLeft -= dt; this.app.setTimer(this.timeLeft);
      if (this.timeLeft <= 0) { this.finish(); return; }
      this.msgCool -= dt; this.openUpCool -= dt; this.crowdCool -= dt; this.tipTimer -= dt;

      // ball flight
      if (this.ball.flight) {
        const f = this.ball.flight; f.t += dt; const k = Math.min(1, f.t / f.dur);
        this.ball.x = f.from.x + (f.to.x - f.from.x) * k; this.ball.y = f.from.y + (f.to.y - f.from.y) * k; this.ball.z = Math.sin(k * Math.PI) * f.loft; this.ball.spin += dt * 14;
        if (k >= 1) this.landBall();
      } else if (this.ball.roll) {
        this.updateRoll(dt);
      } else if (this.holder) {
        this.holdTimer -= dt; if (this.holdTimer <= 0) this.kickPass();
      }

      // targets for both teams
      const ourT = L.teamTargets(this.us, this.ball, { possession: this.poss === 'us', dir: 1 });
      const theirT = L.teamTargets(this.them, this.ball, { possession: this.poss === 'them', dir: -1 });
      this.us.forEach((p, i) => p.target = ourT[i]); this.them.forEach((p, i) => p.target = theirT[i]);
      // one opponent presses the ball when we have it
      if (this.poss === 'us') { let best = -1, bd = 1e9; this.them.forEach((p, i) => { if (p.role === 'GK') return; const d = L.dist(p, this.ball); if (d < bd) { bd = d; best = i; } }); if (best >= 0) this.them[best].target = { x: L.clamp(this.ball.x + 3, 1, F.w - 1), y: this.ball.y }; }

      // AI movement
      for (const p of this.us) if (p !== this.me) this.moveToward(p, p.target, 5.5, dt);
      for (const p of this.them) this.moveToward(p, p.target, 5.5, dt);
      // receiver runs to meet the ball
      if (this.ball.flight) { const f = this.ball.flight; const r = (f.receiver.team === 'us' ? this.us : this.them)[f.receiver.idx]; if (r !== this.me) this.moveToward(r, f.to, 7, dt); }

      // my movement
      let vx = 0, vy = 0; const k = this.keys;
      if (k.ArrowLeft || k.KeyA) vx -= 1; if (k.ArrowRight || k.KeyD) vx += 1; if (k.ArrowUp || k.KeyW) vy -= 1; if (k.ArrowDown || k.KeyS) vy += 1;
      if (!vx && !vy && Touch.enabled) { vx = Touch.vec.x; vy = Touch.vec.y; }
      if (vx || vy) { const n = Math.max(1, Math.hypot(vx, vy)); this.me.x += vx / n * 7 * dt; this.me.y += vy / n * 7 * dt; }
      else if (this.dest) { this.moveToward(this.me, this.dest, 7, dt); if (L.dist(this.me, this.dest) < 0.3) this.dest = null; }
      this.me.x = L.clamp(this.me.x, 0.5, F.w - 0.5); this.me.y = L.clamp(this.me.y, 0.5, F.h - 0.5);
      if ((vx || vy || this.dest) && Math.random() < dt * 12) this.app.fx.dust(this.me.x, this.me.y + 0.8);

      if (this.holder) this.updateBallPos();

      // ---------- scoring ----------
      const d = L.dist(this.me, this.me.target), s = L.spacingScore(d) / 100;
      this.totalTime += dt; this.shapeTime += dt * s;
      this.offX += (this.me.x - this.me.target.x) * dt;
      this.offBall += Math.sign(this.ball.y - this.me.target.y) * (this.me.y - this.me.target.y) * dt;
      if (d <= L.GOOD_RADIUS) {
        this.zoneTime += dt; this.outTime = 0;
        const c = Math.min(5, 1 + Math.floor(this.zoneTime / 5));
        if (c !== this.combo) { this.combo = c; this.bestCombo = Math.max(this.bestCombo, c); this.app.setCombo(c); this.app.sfx.combo(c); this.app.fx.text(this.me.x, this.me.y - 3, `COMBO x${c}!`, '#ffd23f', 2.2); this.app.fx.burst(this.me.x, this.me.y, '#ffd23f', 16, 9); }
        this.points += dt * 10 * this.combo * s;
        if (Math.random() < dt * 3) this.app.fx.sparkle(this.me.x + rnd(-1.5, 1.5), this.me.y + rnd(-1.5, 1.5), '#b6ff3b');
        this.farTime = 0;
      } else {
        this.outTime += dt;
        if (this.outTime > 1.2 && this.combo > 1) { this.combo = 1; this.zoneTime = 0; this.app.setCombo(1); this.app.fx.text(this.me.x, this.me.y - 3, 'combo lost', '#ff8a8a', 1.4); }
        if (this.outTime > 1.2) this.zoneTime = 0;
        this.points += dt * 10 * s;
        if (d > 12) { this.farTime += dt; if (this.farTime > 2.5 && this.msgCool <= 0) { this.app.coach(this.difficulty === 'rookie' ? 'Out of position! Run to the glowing ring. 💫' : 'Out of position! Where would your coach want you? 🤔', 'bad'); this.msgCool = 5; this.farTime = 0; this.teach('drill-far', 'Out of position 🕳️', `You are ${d.toFixed(0)} m from your spot. ${this.poss === 'us' ? 'We have the ball, so the team should be SPREAD out with you in your lane.' : 'They have the ball, so the team should SQUEEZE together — and you have left a gap.'} Slide with the ball, like you are tied to your teammates with a rope.`, 'Slide with the ball; stay in your lane.', { ring: { ...this.me.target, r: L.GOOD_RADIUS }, arrows: [{ from: { x: this.me.x, y: this.me.y }, to: { ...this.me.target } }] }); } }
      }
      // crowding
      const mates = this.us.filter(p => p !== this.me && p.role !== 'GK');
      const crowd = L.crowding(this.me, mates);
      if (crowd.length && d > L.GOOD_RADIUS * 0.8) { this.crowdTimer += dt; if (this.crowdTimer > 0.7 && this.crowdCool <= 0) { this.crowdCount++; this.crowdCool = 3; this.points = Math.max(0, this.points - 20); this.combo = 1; this.zoneTime = 0; this.app.setCombo(1); this.app.sfx.bad(); this.app.fx.kick(0.4); this.app.fx.text(this.me.x, this.me.y - 3, 'TOO CLOSE! -20', '#ff5a5a', 2); this.app.coach(`Too close to your ${crowd[0].p.name}! Give them room. 📏`, 'bad'); this.msgCool = 4; this.teach('drill-crowd', 'Too close together 📏', `You were only ${crowd[0].d.toFixed(0)} m from your ${crowd[0].p.name}. One defender can mark you BOTH, and the passer loses an option. Stay about 10 steps apart to make triangles.`, 'Give teammates room: about 10 steps.', { ring: { x: this.me.x, y: this.me.y, r: L.CROWD_DIST }, labels: { [crowd[0].p.index]: 'TEAMMATE' } }); } }
      else this.crowdTimer = 0;
      // triangles
      const near = mates.map(p => ({ p, d: L.dist(p, this.me) })).sort((a, b) => a.d - b.d).slice(0, 2);
      this.triangleOK = near.length === 2 && L.goodTriangle(this.me, near[0].p, near[1].p); this.nearMates = near;
      if (this.triangleOK && d <= L.GOOD_RADIUS) { this.triTime += dt; if (this.triTime >= 6) { this.triTime = 0; this.triCount++; this.points += 25; this.app.sfx.pop(); this.app.fx.text(this.me.x, this.me.y - 3, '🔺 Triangle! +25', '#38e8ff', 1.9); } }
      // ball switched sides
      const side = this.ball.y < 22 ? -1 : this.ball.y > 46 ? 1 : 0;
      if (side && side !== this.lastBallSide) { if (this.lastBallSide && this.msgCool <= 0) { this.app.coach('Ball switched sides — SLIDE over with your team! ↔️', 'info'); this.msgCool = 4; } this.lastBallSide = side; }
      if (this.tipTimer <= 0 && this.msgCool <= 0) { this.app.coach(pick(TIPS), 'info'); this.tipTimer = 14; this.msgCool = 3; }
      this.app.setScore(Math.floor(this.points));
    }

    finish() {
      this.over = true; const pct = this.totalTime ? Math.round(100 * this.shapeTime / this.totalTime) : 0;
      const mx = this.offX / Math.max(1, this.totalTime), mb = this.offBall / Math.max(1, this.totalTime);
      let fb;
      if (this.crowdCount >= 4) fb = { face: '📏', text: `You crowded a teammate ${this.crowdCount} times. Give them space — stay about 10 steps away.` };
      else if (Math.abs(mx) < 2.5 && Math.abs(mb) < 2.5) fb = { face: '🤩', text: 'Brilliant shape! You moved with the team like a pro. Coaches LOVE this.' };
      else if (Math.abs(mx) >= Math.abs(mb)) fb = mx > 0 ? { face: '🏃', text: 'You drift too far FORWARD. Hold your spot — the goal will still be there!' } : { face: '⬆️', text: 'You hang back too much. Push UP with your team when the ball goes forward.' };
      else fb = mb > 0 ? { face: '🧲', text: 'You chase the ball! Slide toward it, but stay in your lane.' } : { face: '↔️', text: 'You stay too far from the ball side. Slide over with your teammates.' };
      Touch.enable(false);
      this.app.finish({
        lessons: Explain.lessons.slice(0, 4), title: 'Full Time!', score: Math.floor(this.points), pct, stars: L.stars(pct), feedback: fb,
        stats: [{ k: 'In position', v: pct + '%' }, { k: 'Passes to you', v: this.received }, { k: 'Best combo', v: 'x' + this.bestCombo }, { k: 'Triangles', v: this.triCount }, { k: 'Too close', v: this.crowdCount }],
      });
    }

    // ---------- draw ----------
    draw() {
      const P = this.app.pitch, c = P.ctx, d = L.dist(this.me, this.me.target);
      P.drawField();
      // team shape blob
      const hull = P.hull(this.us.filter(p => p.role !== 'GK'));
      P.poly(hull, this.poss === 'us' ? 'rgba(61,139,255,.13)' : 'rgba(61,139,255,.22)', 'rgba(120,180,255,.35)', 1.5);
      // my target ghost
      let ghostA = 1;
      if (this.difficulty === 'pro') ghostA = L.clamp((d - L.GOOD_RADIUS * 1.2) / 4, 0, 1);
      if (this.difficulty === 'legend') ghostA = L.clamp((d - 11) / 4, 0, 1);
      if (ghostA > 0.01) {
        c.globalAlpha = ghostA; const pulse = 1 + Math.sin(P.t * 4) * 0.1;
        P.ring(this.me.target.x, this.me.target.y, L.GOOD_RADIUS * pulse, d <= L.GOOD_RADIUS ? 'rgba(182,255,59,.95)' : 'rgba(182,255,59,.7)', { dash: [8, 8], width: 3, glow: d <= L.GOOD_RADIUS ? 'rgba(182,255,59,.35)' : 'rgba(182,255,59,.18)' });
        if (d > L.GOOD_RADIUS) P.arrow(this.me, this.me.target, 'rgba(182,255,59,.8)', 3);
        c.globalAlpha = 1;
      }
      // lines to nearest teammates
      for (const n of this.nearMates || []) { const col = n.d < L.CROWD_DIST ? 'rgba(255,90,90,.9)' : n.d > 28 ? 'rgba(255,210,63,.6)' : 'rgba(182,255,59,.55)'; P.line(this.me, n.p, col, n.d < L.CROWD_DIST ? 4 : 2, [6, 6]); }
      if (this.triangleOK && this.nearMates) P.poly([this.me, this.nearMates[0].p, this.nearMates[1].p], 'rgba(56,232,255,.14)', 'rgba(56,232,255,.5)', 1.5);
      if (this.dest) P.ring(this.dest.x, this.dest.y, 0.9, 'rgba(255,255,255,.7)', { width: 2 });
      // players
      const hp = this.holderPlayer();
      this.them.forEach((p, i) => P.drawPlayer(p, { team: p.role === 'GK' ? 'gk' : 'them', number: i + 1, hasBall: p === hp }));
      this.us.forEach((p, i) => { if (p !== this.me) P.drawPlayer(p, { team: p.role === 'GK' ? 'gk' : 'us', number: i + 1, hasBall: p === hp }); });
      P.drawPlayer(this.me, { team: 'us', number: this.meIdx + 1, me: true, hasBall: this.me === hp, label: 'YOU', labelColor: '#b6ff3b' });
      P.drawBall(this.ball);
      this.app.fx.draw(P);
      if (this.countdown > 0) { const n = Math.ceil(this.countdown); P.textM(F.halfway, F.h / 2 - 4, n > 3 ? 'READY?' : String(n), n > 3 ? '#fff' : '#ffd23f', 9); P.textM(F.halfway, F.h / 2 + 5, Touch.isTouchDevice() ? 'Drag on the left of the screen to move' : 'Arrow keys / WASD or click to move', '#fff', 2); }
      else if (this.timeLeft > this.duration - 1.2) P.textM(F.halfway, F.h / 2 - 4, 'GO!', '#b6ff3b', 9);
    }
  }
  window.SpacingGame = SpacingGame;
})();
