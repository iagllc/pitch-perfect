/* Pitch Perfect match engine: 11 v 11 with real possession (pass, receive, shoot, tackle, keepers, offside).
   Pure simulation, no drawing. Runs in the browser (solo vs AI) and on the Node server (online rooms). */
(function (root) {
  'use strict';
  const L = (typeof require === 'function' && typeof module !== 'undefined') ? require('./logic.js') : root.Logic;
  const F = L.FIELD, GOAL_HALF = 3.66, GOAL_H = 2.44;
  const clamp = L.clamp, dist = L.dist;
  const HUMAN_SPEED = 7.2, AI_SPEED = 6.4, GK_SPEED = 8.5, ACCEL = 28;
  const DECEL = 6, DRAG = 0.15, GRAVITY = 20; // rolling friction: constant decel + a little air drag
  const passSpeed = d => clamp(Math.sqrt(2 * DECEL * d * 1.3), 8, 28);
  const EXPLAIN_COOLDOWN = 12;

  const KID_HAIR_F = ['ponytail', 'braids', 'bun', 'long', 'curly', 'short'], KID_HAIR_M = ['short', 'spiky', 'curly', 'buzz', 'short'];
  const TEEN_HAIR_F = ['ponytail', 'braids', 'long', 'bun', 'hijab', 'afro', 'fade'], TEEN_HAIR_M = ['fade', 'buzz', 'afro', 'locs', 'bun', 'bald', 'fade'];
  function randomAvatarData(set, rng) {
    rng = rng || Math.random; const pick = a => a[Math.floor(rng() * a.length)]; const sex = rng() < 0.5 ? 'm' : 'f';
    const a = { set: set === 'teen' ? 'teen' : 'kid', sex, skin: Math.floor(rng() * 6), hairCol: Math.floor(rng() * 7), beard: 'none', build: pick(['slim', 'athletic', 'athletic', 'strong']), extra: 'none', lashes: sex === 'f' };
    if (a.set === 'teen') { a.hair = pick(sex === 'f' ? TEEN_HAIR_F : TEEN_HAIR_M); if (sex === 'm') { const r = rng(); a.beard = r < 0.2 ? 'beard' : r < 0.45 ? 'stubble' : 'none'; } if (rng() < 0.12) a.extra = pick(['band', 'tape']); }
    else { a.hair = pick(sex === 'f' ? KID_HAIR_F : KID_HAIR_M); if (rng() < 0.12) a.extra = pick(['band', 'glasses']); }
    return a;
  }
  const NAMES = ['Max', 'Leo', 'Zoe', 'Kai', 'Ava', 'Eli', 'Mia', 'Noa', 'Ty', 'Sam', 'Jax', 'Ivy', 'Ash', 'Rio', 'Lou', 'Nia', 'Oli', 'Ren', 'Tia', 'Ben', 'Joy', 'Gus', 'Bo', 'Zed', 'Uma'];

  const TEXT = {
    offside: { title: 'Offside! 🚩', text: (d) => `When the ball was KICKED you were ${d} m past the second-last defender (the keeper counts as one). Wait on the line, then go the moment the ball is played.`, lesson: 'Time your run: start when the ball is kicked, not before.' },
    intercepted: { title: 'Pass cut out ✂️', text: (n) => `A defender was standing in the lane between you and ${n}. Look for a teammate with a CLEAR line, or pass to the side first.`, lesson: 'Pass down clear lanes, not through defenders.' },
    tackled: { title: 'Tackled! 💥', text: (t) => `You held the ball for ${t} s with a defender right on you. Pass EARLY when you feel pressure, or dribble away from the defender.`, lesson: 'Under pressure: pass early.' },
    rolledpast: { title: 'That pass was for you 🏃', text: () => 'Your teammate played the ball to you, but you did not move to meet it. When the ball comes, GO and get it.', lesson: 'Move toward passes meant for you.' },
    position: { title: 'Goal against — gap in your zone 🕳️', text: (d) => `When the shot was taken you were ${d} m away from your spot. That gap is where the attack came through. Stay with the team shape.`, lesson: 'Keep your shape when defending.' },
    longshot: { title: 'Too far out 🎯', text: (d) => `You shot from ${d} m. From this far the keeper has plenty of time. Get inside the box, or pass to someone closer.`, lesson: 'Shoot from inside 25 m.' },
    crowding: { title: 'Too close together 📏', text: (n) => `You and ${n} were standing almost on top of each other. One defender can mark you BOTH. Spread out to give the passer two options.`, lesson: 'Stay about 10 steps from teammates.' },
    offsidepos: { title: 'Standing offside 🚩', text: () => 'You stood in an offside position for a long time while we had the ball. Your teammates cannot pass to you there. Drop back level with the last defender.', lesson: 'Stay level with the last defender.' },
  };

  class MatchSim {
    constructor(opts = {}) {
      this.rng = opts.rng || Math.random; this.duration = opts.duration ?? 240; this.halves = opts.halves === false ? 1 : 2; this.half = 1; this.passive = !!opts.passive; this.avatarSet = opts.avatarSet === 'teen' ? 'teen' : 'kid';
      this.tstats = { shots: [0, 0], poss: [0, 0], passes: [0, 0] };
      this.players = [];
      for (const team of [0, 1]) {
        const f = L.formation('433', team === 0 ? 1 : -1);
        for (const p of f) this.players.push({ i: this.players.length, team, role: p.role, name: p.name, jersey: NAMES[(this.players.length * 7 + 3) % NAMES.length], avatar: randomAvatarData(this.avatarSet, this.rng), home: { ...p.home }, x: p.home.x, y: p.home.y, vx: 0, vy: 0, fx: team === 0 ? 1 : 0, fy: 0, target: { ...p.home }, human: null, hname: null, input: null, kickCool: 0, holdTime: 0, aiTimer: 0, crowdT: 0, offposT: 0, cool: {}, shapeT: 0, shapeGood: 0, stats: { passes: 0, shots: 0, goals: 0, tackles: 0, intercepts: 0, offsides: 0, lost: 0 } });
      }
      this.ball = { x: F.halfway, y: F.h / 2, z: 0, vx: 0, vy: 0, vz: 0, holder: -1, lastTouch: -1, lastTeam: 0, inFlight: null, flags: [], flagSnap: null };
      this.score = [0, 0]; this.time = 0; this.tick = 0; this.events = []; this.possTeam = 0; this.msg = ''; this.lastShotSnap = null;
      this.resetPositions(0, true);
    }

    // ---------- setup ----------
    dir(team) { return (team === 0 ? 1 : -1) * (this.half === 1 ? 1 : -1); }
    goalOf(team) { return { x: this.dir(team) === 1 ? F.w : 0, y: F.h / 2 }; }      // the goal `team` attacks
    switchEnds() { this.half = 2; for (const p of this.players) { p.home = { x: F.w - p.home.x, y: p.home.y }; p.fx = -p.fx; } }
    ownGoal(team) { return this.goalOf(1 - team); }
    teamPlayers(t) { return this.players.filter(p => p.team === t); }
    addHuman(id, team, role, name, avatar) {
      if (this.players.some(p => p.human === id)) return this.players.find(p => p.human === id);
      let p = this.players.find(q => q.team === team && q.role === role && !q.human);
      if (!p) p = this.players.find(q => q.team === team && !q.human && q.role !== 'GK') || this.players.find(q => q.team === team && !q.human);
      if (!p) return null;
      p.human = id; p.hname = name || 'Player'; if (avatar) p.avatar = avatar; p.input = { mx: 0, my: 0, pass: false, shoot: false }; return p;
    }
    removeHuman(id) { const p = this.players.find(q => q.human === id); if (p) { p.human = null; p.hname = null; p.input = null; p.avatar = randomAvatarData(this.avatarSet, this.rng); } }
    setInput(id, inp) {
      const p = this.players.find(q => q.human === id); if (!p) return; const old = p.input || {};
      p.input = { mx: clamp(+inp.mx || 0, -1, 1), my: clamp(+inp.my || 0, -1, 1), pass: !!inp.pass || old.pass, shoot: !!inp.shoot || old.shoot, passUntil: old.passUntil || 0, shootUntil: old.shootUntil || 0 };
      if (inp.pass) p.input.passUntil = this.tick + 45;   // a press is remembered for 0.75 s
      if (inp.shoot) p.input.shootUntil = this.tick + 45;
    }
    wants(p, what) { const i = p.input; return !!i && (i[what] || (i[what + 'Until'] || 0) > this.tick); }
    consume(p) { if (p.input) { p.input.pass = p.input.shoot = false; p.input.passUntil = p.input.shootUntil = 0; } }
    resetPositions(kickTeam, first) {
      for (const p of this.players) { p.x = p.home.x; p.y = p.home.y; p.vx = p.vy = 0; p.holdTime = 0; p.kickCool = 0; }
      const cm = this.players.find(p => p.team === kickTeam && p.role === 'CM'); cm.x = F.halfway - this.dir(kickTeam) * 0.8; cm.y = F.h / 2;
      const st = this.players.find(p => p.team === kickTeam && p.role === 'ST'); st.x = F.halfway - this.dir(kickTeam) * 6; st.y = F.h / 2 - 4;
      this.ball.inFlight = null; this.ball.flags = []; this.ball.z = this.ball.vz = 0; this.giveBall(cm.i);
      this.phase = 'kickoff'; this.phaseT = first ? 2.5 : 2.0; this.msg = 'Kickoff';
    }
    giveBall(i) { const p = this.players[i]; this.ball.holder = i; this.ball.x = p.x + p.fx * 0.7; this.ball.y = p.y + p.fy * 0.7; this.ball.vx = this.ball.vy = this.ball.vz = this.ball.z = 0; this.ball.inFlight = null; this.ball.lastTouch = i; this.ball.lastTeam = p.team; this.possTeam = p.team; p.holdTime = 0; }
    emit(e) { this.events.push(e); }
    teamStats() { const t = this.tstats.poss[0] + this.tstats.poss[1] || 1; return { poss: [Math.round(100 * this.tstats.poss[0] / t), Math.round(100 * this.tstats.poss[1] / t)], shots: this.tstats.shots.slice(), passes: this.tstats.passes.slice(), half: this.half }; }
    explain(p, key, arg, snap) {
      if (!p.human) return; const now = this.time; if (p.cool[key] && now - p.cool[key] < EXPLAIN_COOLDOWN) return; p.cool[key] = now;
      const T = TEXT[key]; this.emit({ type: 'explain', to: p.human, key, title: T.title, text: T.text(arg), lesson: T.lesson, snap });
    }
    snapAround(focus, extra = {}) { // a picture of the moment, for the explainer
      return { players: this.players.map(p => ({ x: +p.x.toFixed(1), y: +p.y.toFixed(1), team: p.team, me: p === focus, gk: p.role === 'GK', label: p === focus ? 'YOU' : (extra.labels && extra.labels[p.i]) || '' })), ball: { x: +this.ball.x.toFixed(1), y: +this.ball.y.toFixed(1) }, dir: this.dir(focus.team), ...extra };
    }

    // ---------- main step ----------
    step(dt) {
      this.events = []; this.tick++;
      if (this.phase === 'fulltime') return this.events;
      for (const p of this.players) { p.kickCool = Math.max(0, p.kickCool - dt); }
      if (this.phase !== 'play') {
        this.phaseT -= dt;
        if (this.phaseT <= 0) {
          if (this.phase === 'goal') this.resetPositions(this.concededTeam, false);
          else if (this.phase === 'halftime') { this.switchEnds(); this.resetPositions(1, false); this.msg = 'Second half'; this.emit({ type: 'secondhalf' }); }
          else { this.phase = 'play'; this.msg = ''; this.emit({ type: 'play' }); }
        }
        if (this.phase !== 'kickoff' && this.phase !== 'restart') { this.clearInputs(); return this.events; }
        // during kickoff/restart players may shuffle but the ball waits
      }
      if (this.phase === 'play' && !this.passive) {
        this.time += dt; this.tstats.poss[this.possTeam] += dt;
        if (this.time >= this.duration) { this.phase = 'fulltime'; this.msg = 'Full time!'; this.emit({ type: 'fulltime', score: this.score.slice(), stats: this.teamStats() }); return this.events; }
        if (this.halves === 2 && this.half === 1 && this.time >= this.duration / 2) { this.phase = 'halftime'; this.phaseT = 7; this.msg = 'Halftime'; this.emit({ type: 'halftime', score: this.score.slice(), stats: this.teamStats() }); return this.events; }
      }

      this.computeTargets();
      for (const p of this.players) this.movePlayer(p, dt);
      if (this.phase === 'play') this.updateBall(dt);
      else if (this.ball.holder >= 0) { const h = this.players[this.ball.holder]; this.ball.x = h.x + h.fx * 0.7; this.ball.y = h.y + h.fy * 0.7; }
      this.trackShape(dt);
      this.clearInputs();
      return this.events;
    }
    clearInputs() { for (const p of this.players) if (p.input) { p.input.pass = false; p.input.shoot = false; } }

    computeTargets() {
      for (const team of [0, 1]) {
        const tp = this.teamPlayers(team), poss = this.possTeam === team;
        const ts = L.teamTargets(tp, this.ball, { possession: poss, dir: this.dir(team) });
        tp.forEach((p, k) => p.target = ts[k]);
      }
    }
    offsideLine(team) { // x of the line attackers of `team` must not pass (second-last opponent)
      const d = this.dir(team), xs = this.teamPlayers(1 - team).map(p => d === 1 ? p.x : F.w - p.x).sort((a, b) => b - a);
      const second = Math.max(xs[1] ?? F.w, F.halfway); return d === 1 ? second : F.w - second;
    }

    // ---------- movement ----------
    movePlayer(p, dt) {
      let dx = 0, dy = 0, speed = AI_SPEED;
      const holder = this.ball.holder >= 0 ? this.players[this.ball.holder] : null;
      const frozen = this.phase !== 'play';
      if (frozen && holder === p) {
        if (p.human && (this.phase === 'kickoff' || this.phase === 'restart') && (this.wants(p, 'pass') || this.wants(p, 'shoot'))) { this.phase = 'play'; this.msg = ''; this.emit({ type: 'play' }); }
        else { p.vx = p.vy = 0; return; }
      }
      if (frozen && !p.human) { const t = p.target, ddx = t.x - p.x, ddy = t.y - p.y, dn = Math.hypot(ddx, ddy); if (dn > 0.3) { dx = ddx / dn; dy = ddy / dn; } }
      else if (p.human) {
        speed = p.role === 'GK' ? GK_SPEED : HUMAN_SPEED; dx = p.input.mx; dy = p.input.my;
        if (holder === p) { if (this.wants(p, 'shoot')) { this.consume(p); this.kickShot(p.i); } else if (this.wants(p, 'pass')) { this.consume(p); this.humanPass(p); } }
      } else { const d = this.aiDecide(p, holder); dx = d.x; dy = d.y; speed = d.speed || (p.role === 'GK' ? GK_SPEED : AI_SPEED); }
      const n = Math.hypot(dx, dy); if (n > 1) { dx /= n; dy /= n; }
      if (holder === p) speed *= 0.88; // dribbling is a little slower
      const tvx = dx * speed, tvy = dy * speed;
      p.vx += clamp(tvx - p.vx, -ACCEL * dt, ACCEL * dt); p.vy += clamp(tvy - p.vy, -ACCEL * dt, ACCEL * dt);
      p.x += p.vx * dt; p.y += p.vy * dt;
      const sp = Math.hypot(p.vx, p.vy); if (sp > 0.5) { p.fx = p.vx / sp; p.fy = p.vy / sp; }
      if (p.role === 'GK') { const g = this.ownGoal(p.team); p.x = clamp(p.x, Math.min(g.x, Math.abs(g.x - 16.5)), Math.max(g.x, Math.abs(g.x - 16.5))); p.y = clamp(p.y, F.h / 2 - 20, F.h / 2 + 20); if (g.x === 0) p.x = clamp(p.x, 0.5, 16.5); else p.x = clamp(p.x, F.w - 16.5, F.w - 0.5); }
      else { p.x = clamp(p.x, -1, F.w + 1); p.y = clamp(p.y, -1, F.h + 1); }
    }

    aiDecide(p, holder) {
      const b = this.ball, toward = (t, speed) => { const dx = t.x - p.x, dy = t.y - p.y, d = Math.hypot(dx, dy); return d < 0.2 ? { x: 0, y: 0, speed } : { x: dx / d * Math.min(1, d / 1.5), y: dy / d * Math.min(1, d / 1.5), speed }; };
      if (p.role === 'GK') return this.gkDecide(p, holder, toward);
      if (holder === p) return this.aiWithBall(p, toward);
      // receiver of an in-flight pass runs to meet it
      if (b.inFlight && b.inFlight.kind === 'pass' && b.inFlight.receiver === p.i) return toward(this.ballLanding(), AI_SPEED + 0.5);
      const weHaveIt = this.possTeam === p.team;
      if (!weHaveIt) {
        if (this.passive || (holder && holder.role === 'GK')) return toward(p.target, AI_SPEED); // keeper has it in his hands: back off
        // nearest two outfielders chase / cover
        const mates = this.teamPlayers(p.team).filter(q => q.role !== 'GK').map(q => ({ q, d: dist(q, b) })).sort((a, c) => a.d - c.d);
        if (mates[0].q === p) return toward(b, AI_SPEED + 0.6);
        if (mates[1].q === p) { const g = this.ownGoal(p.team); return toward({ x: b.x + (g.x - b.x) * 0.18, y: b.y + (g.y - b.y) * 0.18 }, AI_SPEED); }
        return toward(p.target, AI_SPEED);
      }
      // attacking: hold shape, but never stand offside
      const t = { ...p.target }, d = this.dir(p.team), line = this.offsideLine(p.team);
      if (d === 1 ? t.x > line - 0.6 : t.x < line + 0.6) t.x = line - d * 0.6;
      if (holder && holder.team === p.team && holder !== p && (p.role === 'ST' || p.role === 'LW' || p.role === 'RW') && (holder.x - F.halfway) * d > -5) {
        t.x = line - d * 0.8; // sit on the shoulder of the last defender, ready to run
      }
      if (holder && holder.team === p.team && holder.human && dist(holder, p) < 14 && Math.abs(holder.y - p.y) < 12 && p.role !== 'GK') {
        // give a human on the ball a nearby, open option
        const g = this.goalOf(p.team); t.x = holder.x + d * 9; t.y = p.y < holder.y ? holder.y - 10 : holder.y + 10; t.y = clamp(t.y, 3, F.h - 3); t.x = clamp(t.x, 2, F.w - 2); void g;
        if (d === 1 ? t.x > line - 0.6 : t.x < line + 0.6) t.x = line - d * 0.6;
      }
      return toward(t, AI_SPEED);
    }
    gkDecide(p, holder, toward) {
      const b = this.ball, g = this.ownGoal(p.team), d = this.dir(p.team);
      if (this.passive && p.team === 1) return toward({ x: g.x + d * 1.5, y: F.h / 2 }, 2);
      if (holder === p) { if (p.holdTime > 1.0) this.aiPass(p, true); return { x: 0, y: 0 }; }
      // shot coming? move to where it will cross
      if (b.inFlight && b.inFlight.kind === 'shot' && b.inFlight.team !== p.team && Math.sign(b.vx) === -d && Math.hypot(b.vx, b.vy) > 8 && (b.inFlight.t || 0) > 0.33) { // keepers need a moment to react
        const tcross = (g.x - b.x) / b.vx; if (tcross > 0 && tcross < 2.5) { const yAt = b.y + b.vy * tcross; return toward({ x: g.x + d * 1.2, y: clamp(yAt, F.h / 2 - 5, F.h / 2 + 5) }, 6.5); }
      }
      if (dist(b, p) < 9 && b.holder < 0 && (b.lastTeam !== p.team || dist(b, g) < 10)) return toward(b, GK_SPEED); // come and collect loose balls
      const dx = b.x - g.x, dy = b.y - g.y, n = Math.hypot(dx, dy) || 1, out = clamp(1.5 + n / 14, 1.5, 5);
      return toward({ x: g.x + dx / n * out, y: clamp(g.y + dy / n * out * 1.4, F.h / 2 - 6, F.h / 2 + 6) }, GK_SPEED);
    }
    aiWithBall(p, toward) {
      p.aiTimer += 1 / 60;
      if (this.passive) { if (p.holdTime > 1.2 && this.passiveTarget !== undefined) { this.kickPass(p.i, this.passiveTarget); this.passiveTarget = undefined; } return { x: 0, y: 0 }; }
      const g = this.goalOf(p.team), d = this.dir(p.team), goalD = dist(p, g);
      const pressure = Math.min(...this.teamPlayers(1 - p.team).map(q => dist(q, p)));
      const shotLane = this.laneOpen(p, g, p.team, true);
      const shotOK = goalD < 30 && Math.abs(p.y - F.h / 2) < 17 && (shotLane > 0.9 || goalD < 13);
      if (shotOK && (goalD < 20 || (pressure < 3.5 && goalD < 26) || this.rng() < 0.04)) { this.kickShot(p.i); return { x: 0, y: 0 }; }
      const patience = pressure < 2.5 ? 0.7 : 1.4 + this.rng() * 1.2;
      if (p.holdTime > patience) { this.aiPass(p); return { x: d, y: 0 }; }
      // dribble toward goal, away from the nearest defender
      const near = this.teamPlayers(1 - p.team).map(q => ({ q, dd: dist(q, p) })).sort((a, c) => a.dd - c.dd)[0].q;
      let vx = d, vy = (g.y - p.y) / 30; const ax = p.x - near.x, ay = p.y - near.y, an = Math.hypot(ax, ay) || 1;
      if (dist(near, p) < 5) { vx += ax / an * 0.8; vy += ay / an * 0.8; }
      return { x: vx, y: vy, speed: AI_SPEED };
    }

    // ---------- passing & shooting ----------
    laneOpen(from, to, team, skipGK) { // smallest distance from any opponent to the pass line
      let best = 99; const dx = to.x - from.x, dy = to.y - from.y, len2 = dx * dx + dy * dy || 1;
      for (const q of this.teamPlayers(1 - team)) { if (skipGK && q.role === 'GK') continue; const t = clamp(((q.x - from.x) * dx + (q.y - from.y) * dy) / len2, 0.05, 0.95); const px = from.x + dx * t, py = from.y + dy * t; best = Math.min(best, Math.hypot(q.x - px, q.y - py)); }
      return best;
    }
    bestReceiver(p, dirVec) {
      const d = this.dir(p.team), line = this.offsideLine(p.team), opp = this.teamPlayers(1 - p.team);
      let best = null, bs = -1e9;
      for (const q of this.teamPlayers(p.team)) {
        if (q === p) continue; const dd = dist(p, q); if (dd < 4 || dd > 45) continue;
        if (dirVec) { const ang = Math.acos(clamp(((q.x - p.x) * dirVec.x + (q.y - p.y) * dirVec.y) / dd, -1, 1)); if (ang > 0.8) continue; }
        const off = L.judgeOffside({ attacker: q, ball: this.ball, opponents: opp, dir: d }).offside;
        const lane = this.laneOpen(p, q, p.team), mark = Math.min(...opp.map(o => dist(o, q)));
        const gq = dist(q, this.goalOf(p.team)); let s = (q.x - p.x) * d * 0.08 - gq * 0.035 + (gq < 25 ? 1.8 : 0) + Math.min(lane, 8) * 0.35 + Math.min(mark, 8) * 0.15 - (q.role === 'GK' ? 4 : 0) - (off ? 6 : 0) + this.rng() * 0.6;
        if (q.human && dist(q, q.target) < L.GOOD_RADIUS) s += 1.2;
        if (s > bs) { bs = s; best = q; }
      }
      return best;
    }
    humanPass(p) {
      const inp = p.input, hasDir = Math.hypot(inp.mx, inp.my) > 0.3; const dv = hasDir ? { x: inp.mx / Math.hypot(inp.mx, inp.my), y: inp.my / Math.hypot(inp.mx, inp.my) } : null;
      const r = this.bestReceiver(p, dv) || (dv ? null : this.bestReceiver(p, null));
      if (r) this.kickPass(p.i, r.i); else if (dv) this.kickLoose(p.i, dv, 16); else this.kickLoose(p.i, { x: this.dir(p.team), y: 0 }, 14);
    }
    aiPass(p, isGK) {
      const r = this.bestReceiver(p, null);
      if (r) this.kickPass(p.i, r.i); else this.kickLoose(p.i, { x: this.dir(p.team), y: (this.rng() - 0.5) }, isGK ? 22 : 14);
    }
    beginFlight(p, kind, extra) {
      this.ball.holder = -1; this.ball.lastTouch = p.i; this.ball.lastTeam = p.team; p.kickCool = 0.5; p.holdTime = 0; p.aiTimer = 0;
      this.ball.inFlight = { kind, team: p.team, from: p.i, ...extra };
    }
    recordOffsideFlags(p) { // who is in an offside position at the moment of the kick?
      const opp = this.teamPlayers(1 - p.team), d = this.dir(p.team); this.ball.flags = []; const snap = { line: this.offsideLine(p.team), margins: {} };
      for (const q of this.teamPlayers(p.team)) { if (q === p) continue; const j = L.judgeOffside({ attacker: q, ball: this.ball, opponents: opp, dir: d }); if (j.offside) { this.ball.flags.push(q.i); snap.margins[q.i] = -j.margin; } }
      this.ball.flagSnap = this.ball.flags.length ? this.snapAround(p, { lineX: snap.line, margins: snap.margins, labels: Object.fromEntries(this.ball.flags.map(i => [i, 'OFFSIDE'])) }) : null;
    }
    kickPass(fromI, toI) {
      const p = this.players[fromI], r = this.players[toI];
      const lead = 0.35, tx = r.x + r.vx * lead, ty = r.y + r.vy * lead, dx = tx - this.ball.x, dy = ty - this.ball.y, dd = Math.hypot(dx, dy) || 1;
      const speed = passSpeed(dd); // sized so the ball arrives at the receiver with a bit to spare
      this.ball.vx = dx / dd * speed; this.ball.vy = dy / dd * speed; this.ball.vz = dd > 30 ? 7 : 0; this.ball.z = 0.01;
      this.recordOffsideFlags(p); this.beginFlight(p, 'pass', { receiver: toI, to: { x: tx, y: ty } }); p.stats.passes++; this.tstats.passes[p.team]++;
      this.emit({ type: 'pass', from: fromI, to: toI });
    }
    kickLoose(fromI, dv, speed) {
      const p = this.players[fromI]; this.ball.vx = dv.x * speed; this.ball.vy = dv.y * speed; this.ball.vz = 0;
      this.recordOffsideFlags(p); this.beginFlight(p, 'pass', { receiver: -1, to: { x: this.ball.x + dv.x * 15, y: this.ball.y + dv.y * 15 } }); p.stats.passes++;
      this.emit({ type: 'pass', from: fromI, to: -1 });
    }
    kickShot(fromI) {
      const p = this.players[fromI], g = this.goalOf(p.team), dd = dist(p, g);
      const corner = (this.rng() < 0.5 ? -1 : 1) * (2.0 + this.rng() * 1.3), err = (this.rng() - 0.5) * (dd / 7), dx = g.x - this.ball.x, dy = g.y + corner + err - this.ball.y, n = Math.hypot(dx, dy) || 1;
      const speed = clamp(25 + dd * 0.25, 25, 31); this.ball.vx = dx / n * speed; this.ball.vy = dy / n * speed; this.ball.vz = 3 + this.rng() * 4; this.ball.z = 0.01;
      this.recordOffsideFlags(p); this.beginFlight(p, 'shot', { t: 0 }); p.stats.shots++; this.tstats.shots[p.team]++;
      this.lastShotSnap = { team: p.team, shooter: fromI, snaps: {} };
      for (const q of this.teamPlayers(1 - p.team)) if (q.human && q.role !== 'GK') { const dq = dist(q, q.target); if (dq > 9) this.lastShotSnap.snaps[q.i] = { d: dq.toFixed(0), snap: this.snapAround(q, { ring: { ...q.target, r: L.GOOD_RADIUS }, arrows: [{ from: { x: q.x, y: q.y }, to: q.target }] }) }; }
      this.emit({ type: 'shot', from: fromI, dist: dd });
      if (dd > 30 && p.human) this.explain(p, 'longshot', dd.toFixed(0), this.snapAround(p, { arrows: [{ from: { x: p.x, y: p.y }, to: g }] }));
    }
    ballLanding() { const b = this.ball; const v = Math.hypot(b.vx, b.vy); const s = v * v / (2 * DECEL); return { x: clamp(b.x + b.vx / (v || 1) * s, 0, F.w), y: clamp(b.y + b.vy / (v || 1) * s, 0, F.h) }; }

    // ---------- the ball ----------
    updateBall(dt) {
      const b = this.ball;
      if (b.holder >= 0) {
        const h = this.players[b.holder]; h.holdTime += dt; b.x = h.x + h.fx * 0.7; b.y = h.y + h.fy * 0.7; b.z = 0;
        // tackles
        if (h.holdTime > 0.45 && h.role !== 'GK' && !this.passive) for (const q of this.teamPlayers(1 - h.team)) { // keepers holding the ball are protected
          if (q.kickCool > 0 || dist(q, b) > 1.15) continue;
          if (this.rng() < 1 - Math.exp(-3 * dt)) {
            const held = h.holdTime.toFixed(1); h.stats.lost++; q.stats.tackles++;
            this.explain(h, 'tackled', held, this.snapAround(h, { labels: { [q.i]: 'TACKLER' } }));
            this.giveBall(q.i); q.kickCool = 0; this.emit({ type: 'tackle', by: q.i, from: h.i }); this.flagCheckCrowding(dt); return;
          }
        }
        this.flagCheckCrowding(dt); return;
      }
      // free ball physics
      if (b.inFlight) { const f = b.inFlight; f.t = (f.t || 0) + dt;
        if (f.kind === 'pass' && f.receiver >= 0) { const r = this.players[f.receiver]; const d = dist(r, b); const toward = d > 0.01 ? (r.vx * (b.x - r.x) + r.vy * (b.y - r.y)) / d : 0; if (f.minD === undefined || d < f.minD) f.minD = d; f.chase = Math.max(f.chase || 0, toward); } }
      b.x += b.vx * dt; b.y += b.vy * dt;
      if (b.z > 0 || b.vz > 0) { b.z += b.vz * dt; b.vz -= GRAVITY * dt; if (b.z <= 0) { b.z = 0; b.vz = b.vz < -3 ? -b.vz * 0.35 : 0; } }
      const sp = Math.hypot(b.vx, b.vy); if (sp > 0) { const air = b.z > 0.2; const ns = Math.max(0, sp - (air ? 0 : DECEL * dt)) * (1 - DRAG * dt); b.vx *= ns / sp; b.vy *= ns / sp; }
      // goal / out
      if (b.x < 0 || b.x > F.w || b.y < 0 || b.y > F.h) { this.ballOut(); return; }
      // pickups
      let best = null, bd = 99;
      const fast = Math.hypot(b.vx, b.vy) > 14;
      const intended = b.inFlight && b.inFlight.kind === 'pass' ? b.inFlight.receiver : -1;
      for (const p of this.players) { if (p.kickCool > 0) continue; const r = p.role === 'GK' ? (fast ? 0.95 : 1.6) : p.i === intended ? 1.4 : (fast ? 0.65 : 1.15); const d = dist(p, b); if (d < r && d < bd && b.z < 2.3) { bd = d; best = p; } }
      if (best) {
        const spd = Math.hypot(b.vx, b.vy);
        if (best.role === 'GK' && b.inFlight && b.inFlight.kind === 'shot' && spd > 20 && Math.abs(b.y - best.y) > 0.45 && this.rng() < 0.65) {
          // PARRY: the keeper gets a hand to it but cannot hold it
          const d = this.dir(best.team); b.vx = d * (6 + this.rng() * 6); b.vy = (b.y > best.y ? 1 : -1) * (5 + this.rng() * 6); b.vz = 2; b.z = 0.3; b.inFlight = null; best.kickCool = 0.6;
          this.emit({ type: 'save', by: best.i, parry: true });
        } else this.pickup(best);
      }
      this.flagCheckCrowding(dt);
    }
    ballOut() {
      const b = this.ball, crossedGoalLine = b.x < 0 || b.x > F.w;
      const attackerOfThatGoal = (b.x > F.w) === (this.dir(0) === 1) ? 0 : 1; // who attacks the goal the ball crossed
      if (crossedGoalLine && Math.abs(b.y - F.h / 2) < GOAL_HALF && b.z < GOAL_H) {
        const scoring = attackerOfThatGoal; this.score[scoring]++; this.concededTeam = 1 - scoring;
        const scorer = this.players[b.lastTouch]; if (scorer && scorer.team === scoring) scorer.stats.goals++;
        this.phase = 'goal'; this.phaseT = 7.5; this.msg = (scoring === 0 ? 'BLUE' : 'RED') + ' SCORES!';
        this.emit({ type: 'goal', team: scoring, scorer: b.lastTouch, score: this.score.slice() });
        if (this.lastShotSnap && this.lastShotSnap.team === scoring) for (const [i, s] of Object.entries(this.lastShotSnap.snaps)) this.explain(this.players[+i], 'position', s.d, s.snap);
        b.inFlight = null; b.vx = b.vy = 0; b.x = clamp(b.x, 0, F.w); return;
      }
      // restart: throw-in / goal kick / corner, simplified: other team gets it right there
      const other = 1 - b.lastTeam, kind = !crossedGoalLine ? 'Throw-in' : (b.lastTeam === attackerOfThatGoal ? 'Goal kick' : 'Corner');
      b.x = clamp(b.x, 1, F.w - 1); b.y = clamp(b.y, 1, F.h - 1); b.z = b.vz = 0;
      if (kind === 'Goal kick') { const gk = this.players.find(p => p.team === other && p.role === 'GK'); b.x = gk.x + this.dir(other) * 4; b.y = gk.y; }
      let taker = null, td = 99; for (const p of this.teamPlayers(other)) { if (kind !== 'Goal kick' && p.role === 'GK') continue; const d = dist(p, b); if (d < td) { td = d; taker = p; } }
      taker.x = b.x - taker.fx * 0.7; taker.y = b.y - taker.fy * 0.7; this.giveBall(taker.i); b.inFlight = null; b.flags = [];
      this.phase = 'restart'; this.phaseT = 1.2; this.msg = kind; this.emit({ type: 'out', kind, team: other });
    }
    pickup(p) {
      const b = this.ball, f = b.inFlight;
      if (f && f.kind === 'pass' && f.team !== p.team) {
        const passer = this.players[f.from]; p.stats.intercepts++;
        if (f.receiver >= 0) { const r = this.players[f.receiver]; this.explain(passer, 'intercepted', r.hname || r.name, this.snapAround(passer, { labels: { [p.i]: 'BLOCKED', [r.i]: 'TARGET' }, arrows: [{ from: { x: passer.x, y: passer.y }, to: { x: r.x, y: r.y } }] }));
          const passedBy = ((b.x - r.x) * b.vx + (b.y - r.y) * b.vy) > 0; // ball is now beyond the receiver along its path
          if (r.human && (f.minD || 99) < 3 && (f.chase || 0) < 1.5 && passedBy) this.explain(r, 'rolledpast', '', this.snapAround(r, { arrows: [{ from: { x: passer.x, y: passer.y }, to: { x: b.x, y: b.y } }] })); }
        this.emit({ type: 'intercept', by: p.i, from: f.from });
      } else if (f && f.kind === 'pass' && f.team === p.team && b.flags.includes(p.i)) {
        // OFFSIDE: whistle, free kick to the other team
        const margin = b.flagSnap && b.flagSnap.margins ? b.flagSnap.margins[p.i] : 0; p.stats.offsides++;
        this.explain(p, 'offside', (margin || 0).toFixed(1), b.flagSnap && { ...b.flagSnap, players: b.flagSnap.players.map((q, i) => ({ ...q, me: i === p.i, label: i === p.i ? 'YOU' : '' })) });
        this.emit({ type: 'offside', player: p.i, margin });
        let taker = null, td = 99; for (const q of this.teamPlayers(1 - p.team)) { if (q.role === 'GK') continue; const d = dist(q, b); if (d < td) { td = d; taker = q; } }
        taker.x = b.x - this.dir(taker.team) * 0.7; taker.y = b.y; this.giveBall(taker.i); b.flags = [];
        this.phase = 'restart'; this.phaseT = 1.8; this.msg = 'Offside!'; return;
      } else if (f && f.kind === 'shot' && p.role === 'GK' && f.team !== p.team) { this.emit({ type: 'save', by: p.i }); }
      else if (f && f.kind === 'pass' && f.team === p.team) { this.emit({ type: 'receive', by: p.i, from: f.from }); }
      this.giveBall(p.i); b.flags = [];
    }
    flagCheckCrowding(dt) { // spacing lessons during open play (humans only)
      for (const p of this.players) {
        if (!p.human || p.role === 'GK') continue;
        if (this.possTeam === p.team && this.ball.holder !== p.i) {
          const mates = this.teamPlayers(p.team).filter(q => q !== p && q.role !== 'GK');
          const near = mates.map(q => ({ q, d: dist(q, p) })).sort((a, c) => a.d - c.d)[0];
          if (near.d < 5.5) { p.crowdT += dt; if (p.crowdT > 2.5) { p.crowdT = 0; this.explain(p, 'crowding', near.q.hname || near.q.name, this.snapAround(p, { labels: { [near.q.i]: 'TEAMMATE' }, ring: { x: p.x, y: p.y, r: L.CROWD_DIST } })); } } else p.crowdT = 0;
          const off = L.judgeOffside({ attacker: p, ball: this.ball, opponents: this.teamPlayers(1 - p.team), dir: this.dir(p.team) });
          if (off.offside) { p.offposT += dt; if (p.offposT > 4) { p.offposT = 0; this.explain(p, 'offsidepos', '', this.snapAround(p, { lineX: this.offsideLine(p.team) })); } } else p.offposT = 0;
        } else { p.crowdT = 0; p.offposT = 0; }
      }
    }
    trackShape(dt) { for (const p of this.players) if (p.human && p.role !== 'GK' && this.phase === 'play') { p.shapeT += dt; if (dist(p, p.target) <= L.GOOD_RADIUS) p.shapeGood += dt; } }

    // ---------- network snapshot ----------
    snapshot() {
      const r1 = v => Math.round(v * 10) / 10;
      return { t: r1(this.time), ph: this.phase, hf: this.half, sc: this.score, poss: this.possTeam, msg: this.msg, h: this.ball.holder,
        p: this.players.map(p => [r1(p.x), r1(p.y)]), tg: this.players.map(p => [r1(p.target.x), r1(p.target.y)]),
        b: [r1(this.ball.x), r1(this.ball.y), r1(this.ball.z), r1(this.ball.vx), r1(this.ball.vy)], fl: this.ball.flags, ifk: this.ball.inFlight ? this.ball.inFlight.kind : '' };
    }
    roster() { return this.players.map(p => ({ i: p.i, team: p.team, role: p.role, name: p.name, jersey: p.jersey, human: p.human, hname: p.hname, avatar: p.avatar })); }
    report(id) { const p = this.players.find(q => q.human === id); if (!p) return null; return { ...p.stats, shape: p.shapeT ? Math.round(100 * p.shapeGood / p.shapeT) : 0, role: p.role, team: p.team }; }
  }

  const api = { MatchSim, TEXT, randomAvatarData };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Sim = api;
})(typeof window !== 'undefined' ? window : globalThis);
