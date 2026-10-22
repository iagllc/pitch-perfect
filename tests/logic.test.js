// Tiny test runner - no dependencies. Run: npm test
const L = require('../js/logic.js');

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.message); }
}
function eq(a, b, msg) { if (a !== b) throw new Error((msg || '') + ` expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); }
function ok(v, msg) { if (!v) throw new Error(msg || 'expected truthy'); }
function near(a, b, tol, msg) { if (Math.abs(a - b) > tol) throw new Error((msg || '') + ` expected ~${b} got ${a}`); }

console.log('\nOFFSIDE RULE');
// Field: 105 x 68. Attacking team attacks to the right (+x). Halfway at x = 52.5.
const defenders = (xs) => xs.map((x, i) => ({ x, y: 20 + i * 8 }));

test('attacker ahead of the second-last defender is OFFSIDE', () => {
  const r = L.judgeOffside({ attacker: { x: 85, y: 34 }, ball: { x: 60, y: 34 },
    opponents: defenders([100, 80, 78, 75, 70]), dir: 1 });
  eq(r.offside, true); near(r.lineX, 80, 0.001, 'line is second-last opponent');
});
test('attacker LEVEL with the second-last defender is ONSIDE', () => {
  const r = L.judgeOffside({ attacker: { x: 80, y: 34 }, ball: { x: 60, y: 34 },
    opponents: defenders([100, 80, 78]), dir: 1 });
  eq(r.offside, false); eq(r.reason, 'level');
});
test('attacker behind the second-last defender is ONSIDE', () => {
  const r = L.judgeOffside({ attacker: { x: 70, y: 34 }, ball: { x: 60, y: 34 },
    opponents: defenders([100, 80, 78]), dir: 1 });
  eq(r.offside, false);
});
test('attacker behind the BALL is onside even if past every defender', () => {
  const r = L.judgeOffside({ attacker: { x: 88, y: 30 }, ball: { x: 90, y: 34 },
    opponents: defenders([100, 80, 78]), dir: 1 });
  eq(r.offside, false); eq(r.reason, 'behind-ball');
});
test('attacker in OWN HALF is never offside', () => {
  const r = L.judgeOffside({ attacker: { x: 50, y: 34 }, ball: { x: 30, y: 34 },
    opponents: defenders([100, 45, 40]), dir: 1 });
  eq(r.offside, false); eq(r.reason, 'own-half');
});
test('goalkeeper counts as an opponent (keeper way out => line moves)', () => {
  // keeper at 70, one defender at 90: second-last is 70, attacker at 80 is offside
  const r = L.judgeOffside({ attacker: { x: 80, y: 34 }, ball: { x: 60, y: 34 },
    opponents: defenders([90, 70]), dir: 1 });
  eq(r.offside, true); near(r.lineX, 70, 0.001);
});
test('works when attacking to the LEFT (dir = -1)', () => {
  const r = L.judgeOffside({ attacker: { x: 20, y: 34 }, ball: { x: 45, y: 34 },
    opponents: defenders([5, 25, 27]), dir: -1 });
  eq(r.offside, true); near(r.lineX, 25, 0.001);
  const r2 = L.judgeOffside({ attacker: { x: 26, y: 34 }, ball: { x: 45, y: 34 },
    opponents: defenders([5, 25, 27]), dir: -1 });
  eq(r2.offside, false);
});
test('margin tells how close to the line you were (positive = onside gap)', () => {
  const r = L.judgeOffside({ attacker: { x: 77, y: 34 }, ball: { x: 60, y: 34 },
    opponents: defenders([100, 80, 78]), dir: 1 });
  near(r.margin, 3, 0.001);
});

console.log('\nSPACING / TEAM SHAPE');
const F = L.FIELD;
test('field is a full-size pitch (105 x 68)', () => { eq(F.w, 105); eq(F.h, 68); });
test('a 4-3-3 has 11 players incl. one keeper', () => {
  const f = L.formation('433', 1);
  eq(f.length, 11); eq(f.filter(p => p.role === 'GK').length, 1);
});
test('target positions stay inside the field', () => {
  const f = L.formation('433', 1);
  for (const ball of [{ x: 1, y: 1 }, { x: 104, y: 67 }, { x: 52, y: 34 }]) {
    for (const p of f) {
      const t = L.targetPosition(p, ball, { possession: true, dir: 1 });
      ok(t.x >= 0 && t.x <= F.w && t.y >= 0 && t.y <= F.h, `${p.role} out of bounds ${t.x},${t.y}`);
    }
  }
});
test('team shifts TOWARD the ball side (slide together)', () => {
  const p = L.formation('433', 1).find(q => q.role === 'CM');
  const left = L.targetPosition(p, { x: 50, y: 5 }, { possession: true, dir: 1 });
  const right = L.targetPosition(p, { x: 50, y: 63 }, { possession: true, dir: 1 });
  ok(left.y < p.home.y, 'should move toward low y'); ok(right.y > p.home.y, 'should move toward high y');
});
test('team pushes UP when the ball is far forward, drops when ball is deep', () => {
  const p = L.formation('433', 1).find(q => q.role === 'LCB');
  const fwd = L.targetPosition(p, { x: 90, y: 34 }, { possession: true, dir: 1 });
  const back = L.targetPosition(p, { x: 15, y: 34 }, { possession: false, dir: 1 });
  ok(fwd.x > p.home.x); ok(back.x < p.home.x);
});
test('team is COMPACT without the ball and SPREAD with it', () => {
  const f = L.formation('433', 1).filter(p => p.role !== 'GK');
  const ball = { x: 52, y: 34 };
  const spread = L.teamWidth(f.map(p => L.targetPosition(p, ball, { possession: true, dir: 1 })));
  const tight = L.teamWidth(f.map(p => L.targetPosition(p, ball, { possession: false, dir: 1 })));
  ok(tight < spread, `tight ${tight} should be < spread ${spread}`);
});
test('targets never put two teammates closer than the crowding distance', () => {
  const f = L.formation('433', 1);
  for (const ball of [{ x: 10, y: 5 }, { x: 95, y: 60 }, { x: 52, y: 34 }, { x: 70, y: 2 }]) {
    for (const poss of [true, false]) {
      const ts = f.map(p => L.targetPosition(p, ball, { possession: poss, dir: 1 }));
      for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) {
        ok(L.dist(ts[i], ts[j]) >= L.CROWD_DIST - 0.01, `${f[i].role}-${f[j].role} too close at ball ${ball.x},${ball.y}`);
      }
    }
  }
});
test('spacing score: 100 on the spot, 0 when far away, in between otherwise', () => {
  eq(L.spacingScore(0), 100); eq(L.spacingScore(100), 0);
  const mid = L.spacingScore(L.GOOD_RADIUS); ok(mid > 0 && mid < 100, 'edge of radius is partial credit');
  ok(L.spacingScore(2) > L.spacingScore(6));
});
test('crowding: flags a teammate who is too close', () => {
  const me = { x: 50, y: 30 };
  const mates = [{ x: 53, y: 30 }, { x: 70, y: 30 }];
  const c = L.crowding(me, mates);
  eq(c.length, 1); near(c[0].d, 3, 0.001);
});
test('passing triangle: good when two teammates make a wide-enough angle', () => {
  ok(L.goodTriangle({ x: 50, y: 34 }, { x: 60, y: 24 }, { x: 60, y: 44 }));
  ok(!L.goodTriangle({ x: 50, y: 34 }, { x: 60, y: 34 }, { x: 70, y: 34 }), 'a flat line is not a triangle');
});
test('rating turns a percentage into stars', () => {
  eq(L.stars(95), 3); eq(L.stars(70), 2); eq(L.stars(45), 1); eq(L.stars(10), 0);
});

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
