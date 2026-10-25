/* Three more drills: Throw-in Thinking (decision), Press vs Drop (decision), Corner Attack (movement). */
(function () {
  'use strict';
  const L = Logic, F = L.FIELD, rnd = (a, b) => a + Math.random() * (b - a), pick = a => a[Math.floor(Math.random() * a.length)];

  // ---------------- shared bits ----------------
  class Drill {
    constructor(app) { this.app = app; }
    begin(rounds, view) { this.rounds = rounds; this.round = 0; this.points = 0; this.over = false; this.keys = {}; this.dragging = false; this.dest = null; this.app.pitch.setView(view); this.app.setPossession(null); this.app.setCombo(null); this.app.setScore(0); this.app.showPass(false); this.explainAfter = null; }
    onPointer(type, m) { if (this.phase === 'choose' && this.onPick) { if (type === 'down') this.onPick(m); return; } if (type === 'down') { this.dragging = true; this.dest = m; } else if (type === 'move' && this.dragging) this.dest = m; else if (type === 'up') this.dragging = false; }
    onKey(code, down) { this.keys[code] = down; if (down) this.dest = null; if (down && this.phase === 'choose' && this.hotkeys) { const k = this.hotkeys[code]; if (k !== undefined) this.choose(k); } }
    moveMe(p, dt, speed, box) {
      let vx = 0, vy = 0; const k = this.keys; if (k.ArrowLeft || k.KeyA) vx -= 1; if (k.ArrowRight || k.KeyD) vx += 1; if (k.ArrowUp || k.KeyW) vy -= 1; if (k.ArrowDown || k.KeyS) vy += 1;
      if (!vx && !vy && Touch.enabled) { vx = Touch.vec.x; vy = Touch.vec.y; }
      if (vx || vy) { const n = Math.max(1, Math.hypot(vx, vy)); p.x += vx / n * speed * dt; p.y += vy / n * speed * dt; this.dest = null; }
      else if (this.dest) { const dx = this.dest.x - p.x, dy = this.dest.y - p.y, d = Math.hypot(dx, dy); if (d < 0.3) this.dest = null; else { const s = Math.min(d, speed * dt); p.x += dx / d * s; p.y += dy / d * s; } }
      p.x = L.clamp(p.x, box.x0, box.x1); p.y = L.clamp(p.y, box.y0, box.y1);
    }
    nextRound(first) {
      this.round++; this.app.hideChoices(); this.app.hideVerdict();
      if (this.round > this.rounds) return this.finish();
      this.app.setTimerText(`Round ${this.round}/${this.rounds}`); if (!first) this.app.toast(`Round ${this.round}`);
      this.setup(); if (this.explainAfter) { Explain.show({ ...this.explainAfter, blocking: true }); this.explainAfter = null; }
    }
    award(pts, word, why, kind) { this.pending = pts; this.app.verdict(word, why, kind); if (kind === 'good') this.app.sfx.good(); else this.app.sfx.bad(); }
    finish() {
      this.over = true; Touch.enable(false); this.app.hideChoices(); const max = this.rounds * 100, pct = Math.round(100 * this.points / max);
      this.app.finish({ title: this.title, score: this.points, pct, stars: L.stars(pct), feedback: this.feedback(pct), stats: this.stats(), lessons: Explain.lessons.slice(0, 4), report: { mode: this.title, name: 'You', role: '', result: `${this.points} points`, stars: L.stars(pct), stats: this.stats(), lessons: Explain.lessons } });
    }
    update(dt) {
      if (this.over || Explain.paused) return; this.app.pitch.t += dt;
      if (window.PhoneView && PhoneView.active() && this.me && this.ball) { // Pocket view: me, the ball and whatever the drill asks me to read (teammates, the carrier, the landing spot)
        const pts = [this.me, this.ball, this.carrier, this.support, this.spot].concat(this.mates || [], this.defs || []);
        this.app.pitch.actionCam(dt, pts, { focus: this.me, minScale: 6.5, maxScale: 12 });
      }
      if (this.rule) { this.ruleTick(dt); } else this.tick(dt); this.app.setScore(this.points);
    }
    choose(k) { if (this.rule) this.answerRule(k); } // drills without choices (corner) still answer rule rounds
    ruleRound(tags) { // one question from the shared rule library, matched to this drill
      this.rule = Rules.pick(tags, 1)[0]; this.phase = 'choose'; this.onPick = null; this.hotkeys = { Digit1: 0, Digit2: 1, Digit3: 2 }; this.rulesRight = this.rulesRight || 0;
      this.app.choices(this.rule.a.map((a, i) => ({ label: a, key: i })), k => this.answerRule(k), '🧑‍⚖️ Rule check: ' + this.rule.q);
    }
    answerRule(k) {
      const r = this.rule; if (this.phase !== 'choose') return; this.app.hideChoices(); this.phase = 'resolve'; this.resT = 0; const ok = k === r.ok; Rules.record(r.id, ok);
      if (ok) { this.rulesRight = (this.rulesRight || 0) + 1; this.award(100, 'CORRECT ✓', r.why, 'good'); }
      else { this.award(0, 'NOT QUITE', r.why, 'bad'); this.explainAfter = { key: 'rule-' + r.id, title: r.title, text: r.why, lesson: r.lesson }; }
    }
    ruleTick(dt) { if (this.phase === 'resolve') this.resolveTimer(dt, 2.6, () => { this.rule = null; this.nextRound(false); }); }
    drawRule() {
      const P = this.app.pitch, c = P.ctx; P.drawField(); c.fillStyle = 'rgba(0,0,20,.55)'; c.fillRect(0, 0, P.cssW, P.cssH);
      const cx = P.view.x + P.view.w / 2, cy = P.view.y + P.view.h * 0.22; P.textM(cx, cy, '🧑‍⚖️ RULE CHECK', '#ffd23f', 4);
      const words = this.rule.q.split(' '); const lines = []; let line = ''; for (const w of words) { if ((line + ' ' + w).trim().length > 46) { lines.push(line.trim()); line = w; } else line += ' ' + w; } lines.push(line.trim());
      lines.forEach((l, i) => P.textM(cx, cy + 6 + i * 3.2, l, '#fff', 2.2)); this.app.fx.draw(P);
    }
    flight(from, to, dur, loft) { this.fl = { from: { ...from }, to: { ...to }, t: 0, dur, loft }; }
    stepFlight(dt) { const f = this.fl; if (!f) return false; f.t += dt; const k = Math.min(1, f.t / f.dur); this.ball.x = f.from.x + (f.to.x - f.from.x) * k; this.ball.y = f.from.y + (f.to.y - f.from.y) * k; this.ball.z = Math.sin(k * Math.PI) * f.loft; this.ball.spin += dt * 12; if (k >= 1) { this.fl = null; return true; } return false; }
    resolveTimer(dt, len, then) { this.resT = (this.resT || 0) + dt; if (this.resT >= len) { this.resT = 0; if (this.pending) { this.points += this.pending; this.pending = 0; } then(); } }
  }

  // ---------------- 1. Throw-in Thinking ----------------
  const QUIZ = [
    { q: 'Can you be OFFSIDE straight from a throw-in?', a: ['Yes, always', 'No — never from a throw-in', 'Only in the box'], ok: 1, why: 'There is NO offside from a throw-in. That is why a quick, long throw can catch defenders napping.' },
    { q: 'Where must the ball come from on a throw-in?', a: ['From the chest', 'From behind the head, both hands', 'One hand is fine'], ok: 1, why: 'Both hands, ball from behind and over the head, and BOTH feet on the ground (on or behind the line). Otherwise it is a foul throw — the other team gets it.' },
    { q: 'Can the thrower score directly from the throw?', a: ['Yes', 'No', 'Only if it bounces'], ok: 1, why: 'A goal cannot be scored directly from a throw-in. Throw to a teammate first.' },
    { q: 'Who takes the throw-in?', a: ['The team that touched it last', 'The team that did NOT touch it last', 'The ref decides'], ok: 1, why: 'The ball goes to the team that did NOT touch it last before it crossed the sideline.' },
  ];
  class ThrowInDrill extends Drill {
    start() { this.title = 'Throw-in Report'; this.good = 0; this.quizOK = 0; this.late = 0; this.begin(6, { x: 30, y: -7, w: 62, h: 44 }); Touch.enable(true, []); this.app.coach('You are taking the throw-in. Find the teammate who is FREE — a marked player gets the ball stolen.', 'info'); this.nextRound(true); }
    setup() {
      this.phase = 'choose'; this.timer = 6; this.stolen = false; this.ball = { x: 60, y: -0.5, z: 1.5, spin: 0 }; this.me = { x: 60, y: -1.2 };
      this.quiz = null; if (this.round === 3 || this.round === 6) return this.ruleRound(['throwin', 'offside']);
      const open = Math.floor(Math.random() * 3);
      this.mates = [{ x: rnd(51, 55), y: rnd(5, 9) }, { x: rnd(62, 68), y: rnd(9, 14) }, { x: rnd(70, 78), y: rnd(16, 24) }].map((m, i) => ({ ...m, open: i === open, letter: 'ABC'[i] }));
      this.defs = this.mates.map(m => m.open ? { x: m.x + rnd(5, 8) * (Math.random() < 0.5 ? -1 : 1), y: m.y + rnd(4, 7) } : { x: m.x + rnd(-1.6, 1.6), y: m.y + rnd(1.2, 2) });
      this.defs.push({ x: rnd(40, 48), y: rnd(20, 30) });
      this.app.choices(this.mates.map((m, i) => ({ label: `Throw to ${m.letter}`, key: i })), k => this.choose(k), 'Who is FREE? Tap a teammate (or A / B / C)');
      this.hotkeys = { KeyA: 0, KeyB: 1, KeyC: 2, Digit1: 0, Digit2: 1, Digit3: 2 };
      this.onPick = m => { let best = -1, bd = 5; this.mates.forEach((q, i) => { const d = L.dist(q, m); if (d < bd) { bd = d; best = i; } }); if (best >= 0) this.choose(best); };
    }
    choose(k) {
      if (this.rule) return this.answerRule(k);
      if (this.phase !== 'choose') return; this.app.hideChoices(); this.phase = 'resolve'; this.resT = 0;
      if (this.quiz) { const ok = k === this.quiz.ok; if (ok) { this.quizOK++; this.award(100, 'CORRECT ✓', this.quiz.why, 'good'); } else { this.award(0, 'NOT QUITE', this.quiz.why, 'bad'); this.explainAfter = { key: 'throw-rule', title: 'Throw-in rule 📏', text: this.quiz.why, lesson: this.quiz.q + ' ' + this.quiz.a[this.quiz.ok] + '.' }; } return; }
      const m = this.mates[k]; this.chosen = k; this.flight(this.ball, m, 0.9, 2.5);
      if (m.open) { this.good++; this.award(100, 'FREE PLAYER ✓', `${m.letter} had space around him — nobody could steal it.`, 'good'); }
      else { this.award(0, 'STOLEN ✗', `${m.letter} was MARKED — a defender was 2 steps away.`, 'bad'); const o = this.mates.find(q => q.open);
        this.explainAfter = { key: 'throw-marked', title: 'You threw to a marked player ✂️', text: `A defender was standing right next to ${m.letter}, so he had no time to control the ball. ${o.letter} had nobody within 5 steps — that is the free player. Before you throw, look for the teammate with SPACE around him.`, lesson: 'Throw to the player with space around him.', snap: this.snap({ labels: { [o.letter]: 'FREE', [m.letter]: 'MARKED' }, ring: { x: o.x, y: o.y, r: 4 } }) }; }
    }
    snap(extra) { const players = [{ ...this.me, team: 0, me: true, label: 'YOU' }, ...this.mates.map(m => ({ x: m.x, y: m.y, team: 0, label: (extra.labels && extra.labels[m.letter]) || m.letter })), ...this.defs.map(d => ({ x: d.x, y: d.y, team: 1 }))]; return { players, ball: { x: this.ball.x, y: this.ball.y }, dir: 1, ...extra, labels: undefined }; }
    tick(dt) {
      if (this.phase === 'choose') { this.timer -= dt; if (this.timer <= 0 && !this.quiz) { this.late++; this.app.hideChoices(); this.phase = 'resolve'; this.resT = 0; this.award(0, 'TOO SLOW ⏱️', 'Quick throw-ins catch defenders napping. Decide fast!', 'bad'); this.explainAfter = { key: 'throw-slow', title: 'Too slow ⏱️', text: 'You waited more than 6 seconds. While you wait, defenders get organized and mark everyone. Look up BEFORE you pick up the ball, then throw quickly.', lesson: 'Decide before you pick the ball up.' }; } return; }
      if (this.fl) { if (this.stepFlight(dt)) { const m = this.mates[this.chosen]; if (!m.open && !this.stolen) { const d = this.defs[this.chosen]; this.flight(this.ball, d, 0.4, 0.3); this.stolen = true; this.app.sfx.bad(); } else if (m.open) this.app.fx.sparkle(this.ball.x, this.ball.y, '#b6ff3b'); } return; }
      this.resolveTimer(dt, 1.6, () => this.nextRound(false));
    }
    feedback(pct) { return pct >= 80 ? { face: '🧠', text: 'Sharp eyes! You spot the free player every time.' } : this.late >= 2 ? { face: '⏱️', text: 'Decide faster: look up before you pick up the ball.' } : { face: '👀', text: 'Look for SPACE around a teammate, not just the closest one.' }; }
    stats() { return [{ k: 'Free picks', v: this.good }, { k: 'Rules right', v: this.rulesRight || 0 }, { k: 'Too slow', v: this.late }]; }
    draw() {
      if (this.rule) return this.drawRule();
      const P = this.app.pitch, c = P.ctx; P.drawField();
      if (this.quiz) { c.fillStyle = 'rgba(0,0,20,.45)'; c.fillRect(0, 0, P.cssW, P.cssH); P.textM(61, 10, '📏 RULE CHECK', '#ffd23f', 4); P.textM(61, 17, this.quiz.q, '#fff', 2.2); P.drawPlayer(this.me, { team: 'us', number: 7, me: true }); P.drawBall(this.ball); this.app.fx.draw(P); return; }
      if (this.phase === 'choose') { const [px, py] = P.toPx(this.me.x, this.me.y - 2.5); c.fillStyle = 'rgba(0,0,0,.5)'; c.fillRect(px - 30, py - 4, 60, 8); c.fillStyle = this.timer < 2 ? '#ff5a5a' : '#ffd23f'; c.fillRect(px - 30, py - 4, 60 * this.timer / 6, 8); }
      this.defs.forEach((d, i) => P.drawPlayer(d, { team: 'them', number: i + 2 }));
      this.mates.forEach((m, i) => { P.drawPlayer(m, { team: 'us', number: i + 8 }); if (this.phase === 'choose') { P.ring(m.x, m.y, 2.4, 'rgba(255,255,255,.6)', { width: 2 }); P.textM(m.x, m.y - 3.6, m.letter, '#ffd23f', 3); } else if (m.open) P.ring(m.x, m.y, 4, 'rgba(182,255,59,.6)', { dash: [6, 6], width: 2 }); });
      P.drawPlayer(this.me, { team: 'us', number: 7, me: true, label: 'YOU (thrower)', labelColor: '#b6ff3b' }); P.drawBall(this.ball); this.app.fx.draw(P);
    }
  }

  // ---------------- 2. Press vs Drop ----------------
  const SCENES = [
    { id: 'back', ans: 'press', cue: 'His BACK is to your goal — he cannot see forward.', carrier: { x: 60, y: 34, face: 1 }, mates: 'compact', support: 'marked' },
    { id: 'line', ans: 'press', cue: 'He is stuck on the SIDELINE — the line is an extra defender.', carrier: { x: 58, y: 5, face: -1 }, mates: 'compact', support: 'marked' },
    { id: 'set', ans: 'press', cue: 'Your team is SET behind you and his teammate is marked — go win it!', carrier: { x: 62, y: 30, face: -1 }, mates: 'compact', support: 'marked' },
    { id: 'touch', ans: 'press', cue: 'HEAVY TOUCH — the ball is 3 steps from his feet.', carrier: { x: 60, y: 38, face: -1, loose: true }, mates: 'compact', support: 'marked' },
    { id: 'gap', ans: 'drop', cue: 'He is FACING your goal and there is a HOLE behind you — slow him down.', carrier: { x: 60, y: 34, face: -1 }, mates: 'stretched', support: 'marked' },
    { id: '2v1', ans: 'drop', cue: 'TWO attackers, ONE of you — stay between them, do not dive in.', carrier: { x: 60, y: 30, face: -1 }, mates: 'stretched', support: 'free' },
    { id: 'counter', ans: 'drop', cue: 'COUNTER-ATTACK: your teammates are still running back. Delay!', carrier: { x: 62, y: 36, face: -1 }, mates: 'ahead', support: 'free' },
    { id: 'free', ans: 'drop', cue: 'His teammate is FREE beside him — if you dive in he just passes.', carrier: { x: 58, y: 34, face: -1 }, mates: 'stretched', support: 'free' },
  ];
  class PressDropDrill extends Drill {
    start() { this.title = 'Press vs Drop Report'; this.right = 0; this.begin(9, { x: 8, y: -4, w: 80, h: 76 }); Touch.enable(true, []); this.order = SCENES.slice().sort(() => Math.random() - 0.5); this.app.coach('They have the ball. You are the midfielder in front of the defense. PRESS (go win it) or DROP (slow him down)?', 'info'); this.nextRound(true); }
    setup() {
      if (this.round === 9) return this.ruleRound(['fouls']);
      const sc = this.order[(this.round - 1) % SCENES.length]; this.sc = sc; this.phase = 'choose'; this.timer = 4; this.me = { x: 48, y: 34 }; this.start0 = { ...this.me };
      const c = sc.carrier; this.carrier = { x: c.x, y: c.y, face: c.face }; this.ball = { x: c.x + (c.loose ? -3 : c.face * 0.8), y: c.y, z: 0, spin: 0 };
      this.support = { x: c.x + 2, y: c.y + (c.y < 20 ? 10 : -10) }; this.supportMarker = sc.support === 'marked' ? { x: this.support.x - 1.5, y: this.support.y + 1.2 } : null;
      this.mates = sc.mates === 'compact' ? [{ x: 38, y: 24 }, { x: 36, y: 44 }, { x: 42, y: 34 }] : sc.mates === 'stretched' ? [{ x: 18, y: 20 }, { x: 16, y: 48 }, { x: 24, y: 34 }] : [{ x: 72, y: 20 }, { x: 70, y: 48 }, { x: 66, y: 34 }];
      this.gk = { x: 3, y: 34 }; this.others = [{ x: 75, y: 15 }, { x: 78, y: 52 }];
      this.app.choices([{ label: 'PRESS 🔥', key: 'press' }, { label: 'DROP 🛡️', key: 'drop' }], k => this.choose(k), 'What do you do?'); this.hotkeys = { Digit1: 'press', Digit2: 'drop', ArrowRight: 'press', ArrowLeft: 'drop' }; this.onPick = null;
    }
    choose(k) {
      if (this.rule) return this.answerRule(k);
      if (this.phase !== 'choose') return; this.app.hideChoices(); this.phase = 'resolve'; this.resT = 0; this.chosen = k; const sc = this.sc, ok = k === sc.ans;
      if (ok) { this.right++; this.award(100, k === 'press' ? 'PRESS ✓' : 'DROP ✓', sc.cue, 'good'); }
      else {
        this.award(0, k === 'press' ? 'BEATEN ✗' : 'TOO PASSIVE ✗', sc.cue, 'bad');
        const text = k === 'press' ? `You dived in, but ${sc.cue.toLowerCase()} He went straight past you into the space. When the carrier faces your goal with help beside him or a hole behind you, DROP: get between him and the goal and slow him down until your team is set.` : `You backed off, but ${sc.cue.toLowerCase()} He had all day on the ball. When his back is turned, the sideline traps him, the ball is away from his feet, or your team is set behind you — PRESS and win it.`;
        this.explainAfter = { key: k === 'press' ? 'press-wrong' : 'drop-wrong', title: k === 'press' ? 'Dove in too early 🔥' : 'Should have pressed 🛡️', text, lesson: k === 'press' ? 'Drop when he faces goal and you are outnumbered.' : 'Press when he is turned, trapped or your team is set.', snap: this.snap() };
      }
    }
    snap() { return { players: [{ ...this.me, team: 0, me: true, label: 'YOU' }, ...this.mates.map(m => ({ ...m, team: 0 })), { ...this.gk, team: 0, gk: true }, { ...this.carrier, team: 1, label: 'CARRIER' }, { ...this.support, team: 1, label: this.sc.support === 'free' ? 'FREE MAN' : '' }, ...(this.supportMarker ? [{ ...this.supportMarker, team: 0 }] : []), ...this.others.map(o => ({ ...o, team: 1 }))], ball: { x: this.ball.x, y: this.ball.y }, dir: -1, arrows: [{ from: { x: this.carrier.x, y: this.carrier.y }, to: { x: this.carrier.x + this.carrier.face * 10, y: this.carrier.y } }] }; }
    tick(dt) {
      if (this.phase === 'choose') { this.timer -= dt; this.carrier.x += this.carrier.face * 0.6 * dt; this.ball.x = this.carrier.x + (this.sc.carrier.loose ? -3 : this.carrier.face * 0.8); if (this.timer <= 0) this.choose('drop'); return; }
      const ok = this.chosen === this.sc.ans; this.resT += dt; const t = this.resT;
      if (this.chosen === 'press') { const d = L.dist(this.me, this.ball); if (d > 1) { this.me.x += (this.ball.x - this.me.x) / d * 7 * dt; this.me.y += (this.ball.y - this.me.y) / d * 7 * dt; } else if (ok && !this.won) { this.won = true; this.app.fx.text(this.me.x, this.me.y - 3, 'WON IT! 💪', '#b6ff3b', 2.4); this.app.sfx.thud(); } if (!ok && t > 0.8) { this.carrier.x -= 7 * dt; this.carrier.y += (34 - this.carrier.y) * dt; this.ball.x = this.carrier.x - 0.8; this.ball.y = this.carrier.y; } }
      else { const tgt = { x: this.carrier.x - 6, y: this.carrier.y + (34 - this.carrier.y) * 0.3 }; const d = L.dist(this.me, tgt); if (d > 0.3) { this.me.x += (tgt.x - this.me.x) / d * 6 * dt; this.me.y += (tgt.y - this.me.y) / d * 6 * dt; } if (ok) { this.mates.forEach(m => { m.x += (Math.min(m.x, 40) + 0 - m.x) * dt * 0.5; if (m.x > 50) m.x -= 8 * dt; }); if (t > 1.4 && !this.won) { this.won = true; this.app.fx.text(this.me.x, this.me.y - 3, 'DELAYED! Team is set ✓', '#b6ff3b', 2.2); } } else if (t > 0.8) { this.carrier.x -= 2 * dt; if (t > 1.6 && !this.won) { this.won = true; this.app.fx.text(this.carrier.x, this.carrier.y - 3, 'He had all day…', '#ff8a8a', 2.2); } } }
      if (t > 2.6) { this.won = false; this.resT = 0; if (this.pending) { this.points += this.pending; this.pending = 0; } this.nextRound(false); }
    }
    feedback(pct) { return pct >= 75 ? { face: '🧠', text: 'You read the game like a coach: press when he is turned or trapped, drop when he faces goal with help.' } : { face: '👀', text: 'Look at two things: where is the carrier FACING, and is your team SET behind you?' }; }
    stats() { return [{ k: 'Right calls', v: this.right }, { k: 'Rule check', v: (this.rulesRight || 0) + '/1' }]; }
    draw() {
      if (this.rule) return this.drawRule();
      const P = this.app.pitch; P.drawField();
      if (this.phase === 'choose') { const sc = this.sc; P.textM(48, -2, sc.mates === 'compact' ? 'Your team: SET ✓' : sc.mates === 'ahead' ? 'Your team: still running back!' : 'Your team: STRETCHED — gap behind you', sc.mates === 'compact' ? '#b6ff3b' : '#ff8a8a', 2); P.arrow(this.carrier, { x: this.carrier.x + this.carrier.face * 8, y: this.carrier.y }, 'rgba(255,210,63,.9)', 3); P.textM(this.carrier.x + this.carrier.face * 10, this.carrier.y - 2.5, this.carrier.face === -1 ? 'facing YOUR goal' : 'back to goal', '#ffd23f', 1.5);
        const [px, py] = P.toPx(this.me.x, this.me.y - 3.2); P.ctx.fillStyle = 'rgba(0,0,0,.5)'; P.ctx.fillRect(px - 30, py - 4, 60, 8); P.ctx.fillStyle = this.timer < 1.5 ? '#ff5a5a' : '#ffd23f'; P.ctx.fillRect(px - 30, py - 4, 60 * this.timer / 4, 8); }
      P.drawPlayer(this.gk, { team: 'gk', number: 1 }); this.mates.forEach((m, i) => P.drawPlayer(m, { team: 'us', number: i + 2 })); if (this.supportMarker) P.drawPlayer(this.supportMarker, { team: 'us', number: 6 });
      this.others.forEach((o, i) => P.drawPlayer(o, { team: 'them', number: i + 7 })); P.drawPlayer(this.support, { team: 'them', number: 10, label: this.sc.support === 'free' ? 'FREE' : undefined, labelColor: '#ff8a8a' });
      P.drawPlayer(this.carrier, { team: 'them', number: 9, hasBall: !this.sc.carrier.loose, label: 'CARRIER', labelColor: '#ff8a8a' }); P.drawPlayer(this.me, { team: 'us', number: 8, me: true, label: 'YOU', labelColor: '#b6ff3b' }); P.drawBall(this.ball); this.app.fx.draw(P);
    }
  }

  // ---------------- 3. Corner Attack ----------------
  class CornerDrill extends Drill {
    start() { this.title = 'Corner Report'; this.goals = 0; this.late = 0; this.camp = 0; this.begin(7, { x: 66, y: -4, w: 43, h: 76 }); Touch.enable(true, []); this.app.coach('Corner! Start DEEP (not in the 6-yard box). When the ball is kicked a ring shows where it lands: sprint there and get there first.', 'info'); this.nextRound(true); }
    setup() {
      if (this.round === 7) return this.ruleRound(['corner', 'handball']);
      this.phase = 'wait'; this.t = 0; this.side = Math.random() < 0.5 ? 0 : 1; const cy = this.side ? F.h - 0.5 : 0.5;
      this.taker = { x: 104.3, y: cy }; this.ball = { x: 104, y: cy + (this.side ? -0.6 : 0.6), z: 0, spin: 0 }; this.gk = { x: 103.5, y: 34 };
      this.defs = [{ x: 99, y: 29 }, { x: 99, y: 39 }, { x: 96, y: 34 }, { x: 94, y: 27 }, { x: 93, y: 41 }]; this.mates = [{ x: 88, y: 28 }, { x: 90, y: 42 }]; this.me = { x: 88, y: 36 };
      const spots = [{ x: 100.5, y: this.side ? 38 : 30, n: 'NEAR POST' }, { x: 100.5, y: this.side ? 30 : 38, n: 'FAR POST' }, { x: 94, y: 34, n: 'PENALTY SPOT' }, { x: 99.5, y: 34, n: 'SIX-YARD BOX' }]; this.spot = pick(spots);
      this.marker = this.defs[2]; this.showRing = false; this.kicked = false; this.campFlag = false; this.landed = false; this.arrivedAt = undefined; this.onPick = null; this.hotkeys = null;
    }
    tick(dt) {
      this.t += dt; const box = { x0: 84, x1: 104.5, y0: 2, y1: 66 };
      if (this.phase === 'wait') { this.moveMe(this.me, dt, 7.5, box); if (this.t > 1.8 && !this.kicked) { this.kicked = true; this.showRing = true; this.campFlag = this.me.x > 98.5 && Math.abs(this.me.y - 34) < 11; if (this.campFlag) this.camp++; this.flight(this.ball, this.spot, 3.2, 6); this.app.sfx.kick(); this.phase = 'air'; this.at = 0; } return; }
      if (this.phase === 'air') {
        this.at += dt; this.moveMe(this.me, dt, 7.5, box);
        const react = this.campFlag ? 0 : 1.3, sp = this.campFlag ? 7.5 : 4.0; if (this.at > react) { const m = this.marker, d = L.dist(m, this.spot); if (d > 0.4) { m.x += (this.spot.x - m.x) / d * sp * dt; m.y += (this.spot.y - m.y) / d * sp * dt; } }
        this.defs.forEach((d, i) => { if (d !== this.marker) { const tgt = this.spot; const dd = L.dist(d, tgt); if (dd > 3 && this.at > 1.6) { d.x += (tgt.x - d.x) / dd * 1.4 * dt; d.y += (tgt.y - d.y) / dd * 2.2 * dt; } } void i; });
        if (this.arrivedAt === undefined && L.dist(this.me, this.spot) < 2.4) this.arrivedAt = this.at;
        if (this.stepFlight(dt)) {
          const myD = L.dist(this.me, this.spot), defD = Math.min(...this.defs.map(d => L.dist(d, this.spot))); this.phase = 'resolve'; this.resT = 0;
          if (myD < 2.4 && myD < defD + 0.7 && !this.campFlag) { this.goals++; const sharp = this.arrivedAt !== undefined && this.arrivedAt > 2.2; this.award(sharp ? 150 : 100, sharp ? 'HEADER! PERFECT TIMING 🎯' : 'HEADER GOAL! ⚽', sharp ? 'You arrived exactly as the ball did — unmarkable. +150' : 'You attacked the ball and got there first. +100', 'good'); this.flight(this.spot, { x: 105, y: 34 + rnd(-2.5, 2.5) }, 0.4, 0.6); this.goalFx = true; }
          else if (this.campFlag) { this.award(0, 'MARKED ✗', 'You were waiting in the 6-yard box before the kick, so a defender stuck to you.', 'bad'); this.explainAfter = { key: 'corner-camp', title: 'Waiting in the box = easy to mark 🧍', text: 'Before the kick you were already standing in the 6-yard box. Defenders LOVE that: your marker glued himself to you and won the header. Start deeper (around the penalty spot or the edge of the box), then sprint in while the ball is in the air.', lesson: 'Start deep, arrive as the ball arrives.', snap: this.snap() }; this.flight(this.spot, { x: 80, y: this.spot.y }, 0.6, 1); }
          else if (myD < 2.2) { this.award(30, 'CLEARED', 'You got there, but the defender was first. Attack earlier! +30', 'bad'); this.late++; this.explainAfter = { key: 'corner-late', title: 'A step too late 🐢', text: `You reached the landing spot, but the defender was ${Math.max(0.1, myD - defD).toFixed(1)} m closer. Start your run the moment the ring appears and sprint straight at it.`, lesson: 'Sprint at the ring the moment the ball is kicked.', snap: this.snap() }; this.flight(this.spot, { x: 80, y: this.spot.y }, 0.6, 1); }
          else { this.award(0, 'NOT THERE ✗', `You never attacked the ball — you were ${myD.toFixed(0)} m away.`, 'bad'); this.late++; this.explainAfter = { key: 'corner-late', title: 'You did not attack the ball 🏃', text: `The ring showed where the ball would land, but you were ${myD.toFixed(0)} m away when it arrived. A corner is a race: when the ring appears, go!`, lesson: 'When the ring appears, sprint to it.', snap: this.snap() }; this.flight(this.spot, { x: 80, y: this.spot.y }, 0.6, 1); }
        }
        return;
      }
      if (this.fl) { if (this.stepFlight(dt) && this.goalFx) { this.goalFx = false; this.app.sfx.goal(); this.app.fx.confetti(100, 34, 80); this.app.fx.kick(0.6); } return; }
      this.resolveTimer(dt, 1.5, () => this.nextRound(false));
    }
    snap() { return { players: [{ ...this.me, team: 0, me: true, label: 'YOU' }, ...this.mates.map(m => ({ ...m, team: 0 })), { ...this.taker, team: 0, label: 'TAKER' }, { ...this.gk, team: 1, gk: true }, ...this.defs.map(d => ({ ...d, team: 1, label: d === this.marker ? 'MARKER' : '' }))], ball: { x: this.spot.x, y: this.spot.y }, dir: 1, ring: { x: this.spot.x, y: this.spot.y, r: 2.2 } }; }
    feedback(pct) { return this.goals >= 4 ? { face: '🎯', text: 'You time your runs like a pro: start deep, arrive late, attack the ball.' } : this.camp >= 2 ? { face: '🧍', text: 'Stop waiting on the spot — defenders mark you easily. Start deep and sprint in.' } : { face: '🏃', text: 'Go the moment the ring appears. A corner is a race to the ball.' }; }
    stats() { return [{ k: 'Headers', v: this.goals }, { k: 'Late', v: this.late }, { k: 'Rule check', v: (this.rulesRight || 0) + '/1' }]; }
    draw() {
      if (this.rule) return this.drawRule();
      const P = this.app.pitch; P.drawField();
      if (this.showRing && this.phase !== 'resolve') { const left = this.fl ? Math.max(0, 1 - this.fl.t / this.fl.dur) : 0; P.ring(this.spot.x, this.spot.y, 2.4, '#ffd23f', { width: 4, glow: 'rgba(255,210,63,.35)', dash: [8, 6] }); P.ring(this.spot.x, this.spot.y, 2.4 + left * 6, 'rgba(255,255,255,.55)', { width: 2 }); P.textM(this.spot.x, this.spot.y - 4.5, this.spot.n, '#ffd23f', 1.6); P.textM(this.spot.x, this.spot.y + 4.5, `lands in ${(this.fl ? this.fl.dur - this.fl.t : 0).toFixed(1)} s`, '#fff', 1.4); }
      if (this.phase === 'wait') P.textM(90, 10, 'Start deep… wait for the kick…', '#fff', 2.6); else if (this.phase === 'air') P.textM(90, 10, 'ATTACK THE RING!', '#ffd23f', 2.6);
      P.drawPlayer(this.gk, { team: 'gk', number: 1 }); this.defs.forEach((d, i) => P.drawPlayer(d, { team: 'them', number: i + 2, label: d === this.marker && this.phase !== 'wait' ? 'MARKER' : undefined, labelColor: '#ff8a8a' }));
      this.mates.forEach((m, i) => P.drawPlayer(m, { team: 'us', number: i + 10 })); P.drawPlayer(this.taker, { team: 'us', number: 7 }); P.drawPlayer(this.me, { team: 'us', number: 9, me: true, label: 'YOU', labelColor: '#b6ff3b' });
      if (this.dest) P.ring(this.dest.x, this.dest.y, 0.9, 'rgba(255,255,255,.7)', { width: 2 }); P.drawBall(this.ball); this.app.fx.draw(P);
    }
  }
  window.Drills = { throwin: ThrowInDrill, press: PressDropDrill, corner: CornerDrill };
})();
