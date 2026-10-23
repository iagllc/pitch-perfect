/* Match screen: draws a MatchSim (local vs AI / guided game) or a stream of server snapshots (online). */
(function () {
  'use strict';
  const L = Logic, F = L.FIELD;
  const TEAM_NAME = ['BLUE', 'RED'], TEAM_COL = ['#3d8bff', '#ff5a5a'];
  const MSG = { 'Throw-in': 'THROW-IN', 'Goal kick': 'GOAL KICK', 'Corner': 'CORNER', 'Kickoff': 'KICKOFF', 'Offside!': 'OFFSIDE!', 'Full time!': 'FULL TIME', 'Halftime': 'HALFTIME', 'Second half': 'SECOND HALF' };

  class MatchClient {
    constructor(app) { this.app = app; }
    start(o) {
      this.mode = o.mode; this.team = o.team; this.role = o.role; this.name = o.name || 'You'; this.keys = {}; this.pending = { pass: false, shoot: false }; this.trail = []; this.over = false;
      this.buffer = []; this.bufT = 0; this.replay = null; this.goalT = 99; this.goalSide = 0; this.finalBanner = false; this.lastSec = -1; this.halfShown = false; this.events = [];
      this.app.pitch.fullView(); this.app.setPossession(null); this.app.setCombo(null); this.app.showScoreboard(true);
      Explain.reset(); Explain.onPause = () => { this.paused = true; }; Explain.onResume = () => { this.paused = false; };
      if (this.mode === 'net') {
        this.net = o.net; this.myIdx = o.myIdx; this.roster = o.roster; this.snaps = []; this.view = null; this.sendT = 0; this.duration = o.duration || 240;
        this.net.on('state', m => { this.snaps.push({ at: performance.now(), s: m.s }); if (this.snaps.length > 30) this.snaps.shift(); });
        this.net.on('ev', m => m.events.forEach(e => this.handleEvent(e)));
        this.net.on('roster', m => { this.roster = m.roster; });
        this.net.on('ft', m => this.finish(m.report, m.score));
      } else {
        const guided = this.mode === 'guide';
        this.sim = new Sim.MatchSim({ duration: o.duration || 240, passive: guided, halves: !guided, avatarSet: (o.avatar && o.avatar.set) || 'kid' }); this.me = this.sim.addHuman('me', o.team, o.role, this.name, o.avatar); this.myIdx = this.me.i; this.acc = 0;
        if (guided) { this.guide = new Guide(this); this.sim.phase = 'play'; }
        this.view = this.viewFromSim();
      }
      this.app.coach(guidedText(this), 'info');
      Touch.enable(true, ['pass', 'shoot'], { buttonsAlways: true }); Touch.actions.pass = () => this.pending.pass = true; Touch.actions.shoot = () => this.pending.shoot = true;
      try { this.app.sfx.crowdStart(); } catch (e) {}
      function guidedText(m) { const T = Touch.isTouchDevice(); return m.mode === 'guide' ? 'Welcome! Let’s learn the basics in 60 seconds.' : `You are the ${TEAM_NAME[m.team]} ${roleName(m.role)}. ${T ? 'Drag on the left to run, tap PASS or SHOOT.' : 'Space = pass, X = shoot.'} Keep your shape and stay onside!`; }
    }
    stop() { try { this.app.sfx.crowdStop(); } catch (e) {} this.app.pitch.setCamera(null); }
    onKey(code, down) {
      this.keys[code] = down;
      if (down && (code === 'Space' || code === 'Enter')) this.pending.pass = true;
      if (down && (code === 'KeyX' || code === 'ShiftLeft' || code === 'ShiftRight' || code === 'KeyE')) this.pending.shoot = true;
    }
    onPointer() {}
    requestPass() { this.pending.pass = true; }
    requestShoot() { this.pending.shoot = true; }
    inputVec() {
      let mx = 0, my = 0; const k = this.keys;
      if (k.ArrowLeft || k.KeyA) mx -= 1; if (k.ArrowRight || k.KeyD) mx += 1; if (k.ArrowUp || k.KeyW) my -= 1; if (k.ArrowDown || k.KeyS) my += 1;
      if (!mx && !my && Touch.enabled) { mx = Touch.vec.x; my = Touch.vec.y; }
      return { mx, my };
    }
    dir() { const v = this.view; return (this.team === 0 ? 1 : -1) * ((v && v.half === 2) ? -1 : 1); }
    viewFromSim() {
      const s = this.sim; return { players: s.players, ball: s.ball, holder: s.ball.holder, score: s.score, time: s.time, phase: s.phase, half: s.half, msg: s.msg, poss: s.possTeam, flags: s.ball.flags, inFlight: s.ball.inFlight ? s.ball.inFlight.kind : '', duration: s.duration };
    }
    viewFromNet() {
      if (this.snaps.length < 1) return null; const now = performance.now() - 120; let a = this.snaps[0], b = this.snaps[0];
      for (let i = 0; i < this.snaps.length; i++) { if (this.snaps[i].at <= now) a = this.snaps[i]; if (this.snaps[i].at >= now) { b = this.snaps[i]; break; } b = this.snaps[i]; }
      const k = b.at > a.at ? L.clamp((now - a.at) / (b.at - a.at), 0, 1) : 1, A = a.s, B = b.s, lerp = (x, y) => x + (y - x) * k;
      const players = A.p.map((p, i) => { const r = this.roster[i]; return { i, x: lerp(p[0], B.p[i][0]), y: lerp(p[1], B.p[i][1]), team: r.team, role: r.role, name: r.name, jersey: r.jersey, human: r.human, hname: r.hname, avatar: r.avatar, target: { x: lerp(A.tg[i][0], B.tg[i][0]), y: lerp(A.tg[i][1], B.tg[i][1]) } }; });
      return { players, ball: { x: lerp(A.b[0], B.b[0]), y: lerp(A.b[1], B.b[1]), z: lerp(A.b[2], B.b[2]), vx: B.b[3], vy: B.b[4] }, holder: B.h, score: B.sc, time: B.t, phase: B.ph, half: B.hf || 1, msg: B.msg, poss: B.poss, flags: B.fl, inFlight: B.ifk, duration: this.duration };
    }
    update(dt) {
      this.app.pitch.t += dt; if (this.over) return;
      const inp = this.inputVec(); const full = { ...inp, pass: this.pending.pass, shoot: this.pending.shoot };
      if (this.mode !== 'net') {
        if (this.paused) return;
        this.sim.setInput('me', full); this.pending = { pass: false, shoot: false };
        this.acc += dt; let n = 0; while (this.acc >= 1 / 60 && n++ < 4) { this.acc -= 1 / 60; const evs = this.sim.step(1 / 60); evs.forEach(e => this.handleEvent(e)); if (this.over) break; }
        this.view = this.viewFromSim();
        if (this.guide) this.guide.update(dt);
      } else {
        this.sendT -= dt; if (this.sendT <= 0 || full.pass || full.shoot) { this.net.send({ t: 'input', ...full }); this.pending = { pass: false, shoot: false }; this.sendT = 1 / 20; }
        this.view = this.viewFromNet();
      }
      if (!this.view) return;
      const v = this.view; if (this.mode !== 'guide') this.app.setScoreboard(v.score, v.time, v.duration);
      this.updateCamera(dt);
      if (v.inFlight === 'shot') { this.trail.push({ x: v.ball.x, y: v.ball.y, z: v.ball.z, life: 0.35 }); } this.trail.forEach(t => t.life -= dt); this.trail = this.trail.filter(t => t.life > 0);
      // replay buffer (20 Hz)
      this.bufT += dt; if (v.phase === 'play' && this.bufT >= 0.05) { this.bufT = 0; this.buffer.push({ p: v.players.map(p => [p.x, p.y]), b: [v.ball.x, v.ball.y, v.ball.z || 0], h: v.holder }); if (this.buffer.length > 90) this.buffer.shift(); }
      this.goalT += dt;
      if (this.replay) { this.replay.t += dt; if (this.replay.t > 1.4) { this.replay.i += dt * 20 * 0.55; if (this.replay.i >= this.replay.frames.length - 1 || v.phase !== 'goal') this.replay = null; } }
      // last-minute drama
      if (this.mode !== 'guide') {
        const left = v.duration - v.time;
        if (left <= 60 && !this.finalBanner && v.phase === 'play') { this.finalBanner = true; this.app.fx.text(F.halfway, 20, '⏱️ FINAL MINUTE!', '#ffd23f', 4); this.app.sfx.whistle(); this.app.coach('Last minute! Every ball counts — stay sharp.', 'info'); }
        if (left <= 30 && v.phase === 'play') { const sec = Math.ceil(left); if (sec !== this.lastSec) { this.lastSec = sec; this.app.sfx.heartbeat(); if (sec <= 10) this.app.fx.text(F.halfway, F.h / 2 - 10, String(sec), '#ff5a5a', 6); } }
      }
    }
    updateCamera(dt) {
      const P = this.app.pitch, v = this.view, follow = this.app.settings.camera === 'follow';
      if (!follow) { if (P.cam) P.setCamera(null); return; }
      const me = v.players[this.myIdx], small = Math.min(window.innerWidth, window.innerHeight) < 520, zoom = small ? 2.4 : Touch.enabled ? 1.7 : 1.9;
      const tx = v.ball.x * 0.6 + me.x * 0.4, ty = v.ball.y * 0.6 + me.y * 0.4;
      if (!this.camPos) this.camPos = { x: tx, y: ty };
      const k = Math.min(1, dt * 3.5); this.camPos.x += (tx - this.camPos.x) * k; this.camPos.y += (ty - this.camPos.y) * k;
      P.setCamera({ cx: this.camPos.x, cy: this.camPos.y, zoom }); const h = P.camHalf();
      P.setCamera({ cx: L.clamp(this.camPos.x, -4 + h.w, F.w + 4 - h.w), cy: L.clamp(this.camPos.y, -4 + h.h, F.h + 4 - h.h), zoom });
    }
    handleEvent(e) {
      const v = this.view, P = this.app, me = this.myIdx, ball = v ? v.ball : { x: 52, y: 34 };
      this.events.push(e); if (this.guide) this.guide.onEvent(e);
      if (e.type === 'pass' || e.type === 'shot') Avatars.action('p' + e.from, 'kick'); if (e.type === 'tackle') Avatars.action('p' + e.by, 'slide'); if (e.type === 'save' && v) { const gk = v.players[e.by]; Avatars.action('p' + e.by, 'dive', (v.ball.y - gk.y) * (gk.x > F.halfway ? -1 : 1) > 0 ? 1 : -1); } if (e.type === 'goal' && v) v.players.forEach(p => { if (p.team === e.team) Avatars.action('p' + p.i, 'jump'); });
      switch (e.type) {
        case 'goal': { const mine = e.team === this.team; P.sfx.goal(); P.sfx.hornGoal(); P.fx.kick(0.8); const side = ball.x > F.halfway ? 1 : 0; this.goalSide = side; this.goalT = 0; P.fx.confetti(side ? 96 : 9, 34, 100); P.fx.text(F.halfway, 26, mine ? 'GOAL!!! ⚽' : 'GOAL AGAINST 😖', mine ? '#ffd23f' : '#ff8a8a', 5);
          if (this.buffer.length > 20) this.replay = { frames: this.buffer.slice(-60), i: 0, t: 0 };
          P.coach(mine ? `${TEAM_NAME[e.team]} scores! Watch the replay, then back to shape.` : 'They scored. Shake it off — squeeze in and win it back!', mine ? 'good' : 'bad'); break; }
        case 'shot': P.sfx.kick(); if (e.from === me) P.fx.burst(ball.x, ball.y, '#fff', 6, 6); break;
        case 'pass': P.sfx.kick(); break;
        case 'receive': if (e.by === me) { P.sfx.receive(); P.fx.sparkle(ball.x, ball.y, '#b6ff3b'); } break;
        case 'save': P.sfx.pop(); P.fx.text(ball.x, ball.y - 3, e.parry ? 'PARRIED!' : 'SAVED!', '#ffd23f', 2.4); break;
        case 'tackle': P.sfx.thud(); P.fx.text(ball.x, ball.y - 3, e.from === me ? 'Tackled!' : (e.by === me ? 'Won it! 💪' : 'Tackle'), e.from === me ? '#ff8a8a' : '#fff', 2); break;
        case 'intercept': P.fx.text(ball.x, ball.y - 3, e.by === me ? 'Intercepted! 💪' : 'Cut out!', e.from === me ? '#ff8a8a' : '#fff', 2); break;
        case 'offside': P.sfx.whistle(); P.fx.kick(0.3); P.fx.text(ball.x, ball.y - 3, '🚩 OFFSIDE', '#ff5a5a', 3); break;
        case 'out': P.sfx.tick(); break;
        case 'play': if (v && v.time < 0.1) P.sfx.start(); break;
        case 'halftime': P.sfx.whistle(); P.halftime(e.score, e.stats, this.team, this.mode !== 'net' ? this.sim.report('me') : null); break;
        case 'secondhalf': { P.hideHalftime(); const d = this.dir() * -1; /* view not yet updated; dir flips */ P.fx.text(F.halfway, 24, 'SECOND HALF', '#fff', 4); P.coach(`Teams switch ends! You now attack the ${d === 1 ? 'RIGHT ➡️' : 'LEFT ⬅️'} goal.`, 'info'); break; }
        case 'fulltime': P.sfx.whistle(); P.sfx.crowdSwell(0.35, 3); if (this.mode !== 'net') this.finish(this.sim.report('me'), e.score, e.stats); break;
        case 'explain': if (this.guide) break; if (e.to === 'me' || this.mode === 'net') Explain.show({ ...e, blocking: this.mode !== 'net' }); break;
      }
    }
    finish(report, score, tstats) {
      this.over = true; Touch.enable(false); this.stop(); this.app.pitch.setCamera(null); const mine = score[this.team], theirs = score[1 - this.team];
      const result = mine > theirs ? 'You WIN! 🏆' : mine < theirs ? 'Lost this one 😤' : 'Draw 🤝';
      const r = report || {}; const pct = r.shape || 0; const lessons = Explain.lessons.slice(0, 5);
      const fb = lessons.length ? { face: '🧢', text: 'Your coach noticed: ' + lessons.map(l => l.lesson).join(' · ') } : { face: '🤩', text: 'No mistakes flagged. Clean game — keep playing like that!' };
      const stats = [{ k: 'In position', v: pct + '%' }, { k: 'Goals', v: r.goals || 0 }, { k: 'Passes', v: r.passes || 0 }, { k: 'Shots', v: r.shots || 0 }, { k: 'Tackles', v: r.tackles || 0 }, { k: 'Offsides', v: r.offsides || 0 }];
      this.app.finish({ title: `${result}  ${TEAM_NAME[this.team]} ${mine} – ${theirs} ${TEAM_NAME[1 - this.team]}`, score: mine * 100 + (r.goals || 0) * 50 + (r.passes || 0) * 5 + (r.tackles || 0) * 10 + (r.intercepts || 0) * 10, pct, stars: L.stars(pct + (mine > theirs ? 20 : 0)), feedback: fb, stats, lessons,
        report: { mode: this.mode === 'net' ? 'Online match' : 'Match vs AI', name: this.name, role: `${TEAM_NAME[this.team]} ${roleName(this.role)}`, result: `${TEAM_NAME[this.team]} ${mine} – ${theirs} ${TEAM_NAME[1 - this.team]} (${result.replace(/[^\w !]/g, '').trim()})`, shape: pct, stats, lessons: Explain.lessons, tstats } });
    }
    // ---------- draw ----------
    draw() {
      const P = this.app.pitch, c = P.ctx, v = this.view; P.drawField(); if (!v) { P.textM(F.halfway, F.h / 2, 'Connecting…', '#fff', 3); return; }
      if (this.replay && this.replay.t > 1.4) return this.drawReplay();
      const me = v.players[this.myIdx], mates = v.players.filter(p => p.team === this.team && p.role !== 'GK');
      const wePoss = v.poss === this.team, d = this.dir();
      P.poly(P.hull(mates), wePoss ? 'rgba(61,139,255,.10)' : 'rgba(61,139,255,.18)', 'rgba(120,180,255,.3)', 1.5);
      const opp = v.players.filter(p => p.team !== this.team);
      if ((wePoss || this.guide) && me.role !== 'GK') {
        const xs = opp.map(p => d === 1 ? p.x : F.w - p.x).sort((a, b) => b - a); const lineX = d === 1 ? Math.max(xs[1], F.halfway) : F.w - Math.max(xs[1], F.halfway);
        const j = L.judgeOffside({ attacker: me, ball: v.ball, opponents: opp, dir: d });
        P.vline(lineX, j.offside ? 'rgba(255,90,90,.8)' : 'rgba(255,255,255,.28)', 2, [6, 10], j.offside || this.guide ? 'OFFSIDE LINE' : '');
        if (j.offside && v.holder !== this.myIdx) P.textM(me.x, me.y - 4.2, '🚩 OFFSIDE POSITION', '#ff5a5a', 1.6);
      }
      if (me.target && v.holder !== this.myIdx) { const dd = L.dist(me, me.target); P.ring(me.target.x, me.target.y, L.GOOD_RADIUS, dd <= L.GOOD_RADIUS ? 'rgba(182,255,59,.8)' : 'rgba(182,255,59,.45)', { dash: [8, 8], width: 2.5, glow: dd <= L.GOOD_RADIUS ? 'rgba(182,255,59,.25)' : null }); if (dd > L.GOOD_RADIUS * 1.6 && !this.guide) P.arrow(me, me.target, 'rgba(182,255,59,.55)', 2); }
      for (const t of this.trail) { const [px, py] = P.toPx(t.x, t.y - t.z * .6); c.globalAlpha = t.life / 0.35 * 0.5; c.fillStyle = '#fff'; c.beginPath(); c.arc(px, py, 0.4 * P.scale, 0, Math.PI * 2); c.fill(); } c.globalAlpha = 1;
      if (v.holder === this.myIdx) { const inp = this.inputVec(); if (Math.hypot(inp.mx, inp.my) > 0.3) P.arrow(me, { x: L.clamp(me.x + inp.mx * 10, 0, F.w), y: L.clamp(me.y + inp.my * 10, 0, F.h) }, 'rgba(255,255,255,.5)', 2); }
      this.drawPlayers(v.players, v.holder, me);
      P.drawBall(v.ball);
      if (this.goalT < 1.3) P.netRipple(this.goalSide, this.goalT);
      if (this.guide) this.guide.draw(P);
      this.app.fx.draw(P);
      if (v.phase !== 'play' && v.msg && !this.guide) { const m = MSG[v.msg] || v.msg.toUpperCase(); P.textM(F.halfway, F.h / 2 - 4, m, v.msg.includes('SCORES') ? '#ffd23f' : '#fff', m.length > 12 ? 5 : 7); }
      if (this.mode === 'net' && this.snaps.length && performance.now() - this.snaps[this.snaps.length - 1].at > 2000) P.textM(F.halfway, 6, 'Connection lost…', '#ff8a8a', 2.5);
    }
    drawPlayers(players, holder, me) {
      const P = this.app.pitch, big = P.scale > 7;
      const ball = this.view.ball;
      for (const p of players) { if (p === me) continue; P.drawPlayer(p, { key: 'p' + p.i, avatar: p.avatar, team: p.role === 'GK' ? 'gk' : (p.team === 0 ? 'us' : 'them'), number: (p.i % 11) + 1, hasBall: holder === p.i, faceTo: ball, name: big ? (p.human ? p.hname : p.jersey) : undefined, nameColor: p.human ? TEAM_COL[p.team] : undefined }); }
      P.drawPlayer(me, { key: 'p' + me.i, avatar: me.avatar, team: me.role === 'GK' ? 'gk' : (me.team === 0 ? 'us' : 'them'), number: (me.i % 11) + 1, me: true, hasBall: holder === this.myIdx, faceTo: ball, label: 'YOU', labelColor: '#b6ff3b', name: big ? this.name : undefined });
    }
    drawReplay() {
      const P = this.app.pitch, c = P.ctx, r = this.replay, i = Math.floor(r.i), k = r.i - i, A = r.frames[i], B = r.frames[Math.min(i + 1, r.frames.length - 1)], lerp = (x, y) => x + (y - x) * k;
      const players = this.view.players.map((p, j) => ({ ...p, x: lerp(A.p[j][0], B.p[j][0]), y: lerp(A.p[j][1], B.p[j][1]) }));
      this.drawPlayers(players, B.h, players[this.myIdx]); P.drawBall({ x: lerp(A.b[0], B.b[0]), y: lerp(A.b[1], B.b[1]), z: lerp(A.b[2], B.b[2]), spin: r.i });
      c.fillStyle = 'rgba(0,0,0,.35)'; c.fillRect(0, 0, P.cssW, 34); P.textM(F.halfway, -1.2, '◀◀ REPLAY  (slow motion)', '#ffd23f', 2);
      const blink = Math.floor(P.t * 2) % 2 === 0; if (blink) { c.fillStyle = '#ff5a5a'; c.beginPath(); c.arc(24, 17, 7, 0, Math.PI * 2); c.fill(); }
      c.strokeStyle = 'rgba(255,255,255,.5)'; c.lineWidth = 6; c.strokeRect(3, 3, P.cssW - 6, P.cssH - 6);
    }
  }
  function roleName(r) { return ({ GK: 'Keeper', LB: 'Left Back', LCB: 'Center Back', RCB: 'Center Back', RB: 'Right Back', LCM: 'Left Mid', CM: 'Center Mid', RCM: 'Right Mid', LW: 'Left Wing', ST: 'Striker', RW: 'Right Wing' })[r] || r; }
  window.MatchClient = MatchClient; window.roleName = roleName; window.TEAM_NAME = TEAM_NAME;
})();
