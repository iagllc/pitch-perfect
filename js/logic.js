/* Pitch Perfect - pure game rules (no drawing). Works in the browser AND in Node tests. */
(function (root) {
  'use strict';

  const FIELD = { w: 105, h: 68, halfway: 52.5 };
  const GOOD_RADIUS = 5;     // meters: "you're in the right spot"
  const CROWD_DIST = 7;      // meters: closer than this = crowding a teammate
  const EPS = 0.05;

  const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ---------- Formations (home spots for a team attacking to the RIGHT) ----------
  const FORMATIONS = {
    '433': [
      { role: 'GK', x: 6, y: 34, name: 'Keeper' },
      { role: 'LB', x: 20, y: 8, name: 'Left Back' },
      { role: 'LCB', x: 18, y: 24, name: 'Center Back' },
      { role: 'RCB', x: 18, y: 44, name: 'Center Back' },
      { role: 'RB', x: 20, y: 60, name: 'Right Back' },
      { role: 'LCM', x: 38, y: 18, name: 'Left Mid' },
      { role: 'CM', x: 34, y: 34, name: 'Center Mid' },
      { role: 'RCM', x: 38, y: 50, name: 'Right Mid' },
      { role: 'LW', x: 62, y: 8, name: 'Left Wing' },
      { role: 'ST', x: 66, y: 34, name: 'Striker' },
      { role: 'RW', x: 62, y: 60, name: 'Right Wing' },
    ],
  };

  function mirrorX(x, dir) { return dir === 1 ? x : FIELD.w - x; }

  function formation(id, dir) {
    const base = FORMATIONS[id] || FORMATIONS['433'];
    return base.map((p, i) => ({
      role: p.role, name: p.name, index: i, formationId: id, dir,
      home: { x: mirrorX(p.x, dir), y: p.y },
    }));
  }

  // ---------- Team shape: where SHOULD everybody be, given the ball? ----------
  function teamTargets(players, ball, opts) {
    const dir = opts.dir || 1;
    const poss = !!opts.possession;
    const bx = mirrorX(ball.x, dir);          // canonical: we attack to the right
    const by = ball.y;
    const outfield = players.filter(p => p.role !== 'GK');
    const cx = outfield.reduce((s, p) => s + mirrorX(p.home.x, dir), 0) / outfield.length;

    // Principle 1: slide together toward the ball (sideways AND up/down the pitch)
    const shiftX = (bx - FIELD.halfway) * 0.45;
    const shiftY = (by - FIELD.h / 2) * 0.35;
    // Principle 2: spread out WITH the ball, squeeze together WITHOUT it
    const spread = poss ? 1.05 : 0.72;
    const depth = poss ? 1.05 : 0.80;

    const targets = players.map(p => {
      const hx = mirrorX(p.home.x, dir), hy = p.home.y;
      if (p.role === 'GK') {
        return { x: clamp(4 + bx * 0.08, 3, 14), y: clamp(34 + (by - 34) * 0.3, 24, 44) };
      }
      return {
        x: clamp(cx + (hx - cx) * depth + shiftX, 1, FIELD.w - 1),
        y: clamp(34 + (hy - 34) * spread + shiftY, 3, FIELD.h - 3),
      };
    });

    // Principle 3: never crowd a teammate - nudge anyone closer than CROWD_DIST apart
    for (let iter = 0; iter < 8; iter++) {
      let moved = false;
      for (let i = 0; i < targets.length; i++) for (let j = i + 1; j < targets.length; j++) {
        const a = targets[i], b = targets[j];
        let dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy);
        if (d >= CROWD_DIST) continue;
        if (d < 1e-6) { dx = 0; dy = 1; d = 1; }
        const push = (CROWD_DIST - d) / 2 + 0.01;
        const ux = dx / d, uy = dy / d;
        const aFixed = players[i].role === 'GK', bFixed = players[j].role === 'GK';
        if (!aFixed) { a.x -= ux * push * (bFixed ? 2 : 1); a.y -= uy * push * (bFixed ? 2 : 1); }
        if (!bFixed) { b.x += ux * push * (aFixed ? 2 : 1); b.y += uy * push * (aFixed ? 2 : 1); }
        moved = true;
      }
      for (let i = 0; i < targets.length; i++) {
        if (players[i].role === 'GK') continue;
        targets[i].x = clamp(targets[i].x, 1, FIELD.w - 1);
        targets[i].y = clamp(targets[i].y, 1, FIELD.h - 1);
      }
      if (!moved) break;
    }
    // back to real coordinates
    return targets.map(t => ({ x: mirrorX(t.x, dir), y: t.y }));
  }

  function targetPosition(p, ball, opts) {
    const team = formation(p.formationId || '433', opts.dir || p.dir || 1);
    return teamTargets(team, ball, opts)[p.index];
  }

  function teamWidth(points) {
    let minx = Infinity, maxx = -Infinity, miny = Infinity, maxy = -Infinity;
    for (const p of points) { minx = Math.min(minx, p.x); maxx = Math.max(maxx, p.x); miny = Math.min(miny, p.y); maxy = Math.max(maxy, p.y); }
    return (maxx - minx) + (maxy - miny);
  }

  // ---------- Scoring helpers ----------
  function spacingScore(d) {
    if (d <= GOOD_RADIUS) return 100 - 50 * (d / GOOD_RADIUS);
    return Math.max(0, 50 * (1 - (d - GOOD_RADIUS) / (2 * GOOD_RADIUS)));
  }

  function crowding(me, mates, limit) {
    const lim = limit || CROWD_DIST;
    return mates.map(p => ({ p, d: dist(me, p) })).filter(c => c.d < lim);
  }

  function goodTriangle(a, b, c) {
    const d1 = dist(a, b), d2 = dist(a, c);
    if (d1 < 6 || d2 < 6 || d1 > 30 || d2 > 30) return false;
    const ang = Math.acos(clamp(((b.x - a.x) * (c.x - a.x) + (b.y - a.y) * (c.y - a.y)) / (d1 * d2), -1, 1));
    const deg = ang * 180 / Math.PI;
    return deg >= 30 && deg <= 150;
  }

  function stars(pct) { return pct >= 85 ? 3 : pct >= 60 ? 2 : pct >= 35 ? 1 : 0; }

  // ---------- The offside rule ----------
  // attacker, ball: {x,y}. opponents: [{x,y}] (keeper included!). dir: +1 attacking right, -1 left.
  function judgeOffside({ attacker, ball, opponents, dir }) {
    const d = dir || 1;
    const ax = mirrorX(attacker.x, d), bx = mirrorX(ball.x, d);
    const oxs = opponents.map(o => mirrorX(o.x, d)).sort((a, b) => b - a);
    const second = oxs.length >= 2 ? oxs[1] : (oxs[0] ?? FIELD.w);
    const lineX = Math.max(second, FIELD.halfway);
    const out = (offside, reason) => ({ offside, reason, lineX: mirrorX(lineX, d), margin: lineX - ax });
    if (ax <= FIELD.halfway + EPS) return out(false, 'own-half');
    if (ax <= bx + EPS) return out(false, 'behind-ball');
    if (Math.abs(ax - lineX) <= EPS) return out(false, 'level');
    if (ax > lineX) return out(true, 'offside');
    return out(false, 'onside');
  }

  const api = { FIELD, GOOD_RADIUS, CROWD_DIST, dist, clamp, formation, teamTargets, targetPosition,
    teamWidth, spacingScore, crowding, goodTriangle, stars, judgeOffside, mirrorX };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Logic = api;
})(typeof window !== 'undefined' ? window : globalThis);
