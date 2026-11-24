// Passing tests: the open teammate gets the ball, and "OPEN!" calls are answered. Run: npm test
const L = require('../js/logic.js');
const { MatchSim } = require('../js/sim.js');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.stack.split('\n').slice(0, 2).join(' | ')); } }
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const rng = () => 0.5;
// everyone parked far away in their own half, then we place the few players a scene needs
function scene() {
  const s = new MatchSim({ rng }); const me = s.addHuman('me', 0, 'CM'); s.phase = 'play';
  s.players.forEach(p => { p.x = p.team === 0 ? 2 : 103; p.y = 4 + (p.i % 11) * 5.5; p.vx = p.vy = 0; p.holdTime = 0; }); // out of passing range (> 45 m) of the scenes below
  const mates = s.teamPlayers(0).filter(p => p !== me && p.role !== 'GK'), opps = s.teamPlayers(1).filter(p => p.role !== 'GK');
  const put = (p, x, y) => { p.x = x; p.y = y; };
  return { s, me, mates, opps, put };
}
const steps = (s, n, inp) => { const evs = []; for (let i = 0; i < n; i++) { if (inp) s.setInput('me', inp); evs.push(...s.step(1 / 60)); if (s.ball.inFlight) break; } return evs; };

console.log('\nPASSING');
test('a pass goes to the OPEN teammate, not the marked one you are facing', () => {
  const { s, me, mates, opps, put } = scene();
  put(me, 50, 34); s.giveBall(me.i);
  put(mates[0], 62, 34); put(opps[0], 62.5, 35.2); put(opps[1], 56, 34.3); // facing-direction teammate: marked, and a defender in the lane
  put(mates[1], 54, 22);                                                      // open teammate off to the side
  steps(s, 5, { mx: 1, my: 0, pass: true });
  ok(s.ball.inFlight && s.ball.inFlight.kind === 'pass', 'a pass was played');
  ok(s.ball.inFlight.receiver === mates[1].i, `expected the open teammate (${mates[1].i}), got ${s.ball.inFlight.receiver} (marked one is ${mates[0].i})`);
});
test('with nobody open, the pass still goes the way you face', () => {
  const { s, me, mates, opps, put } = scene();
  put(me, 50, 34); s.giveBall(me.i);
  put(mates[0], 62, 34); put(opps[0], 62.5, 35.2); put(opps[1], 56, 34.3);
  put(mates[1], 54, 22); put(opps[2], 54.5, 23); put(opps[3], 52, 28);     // the side option is covered too
  steps(s, 5, { mx: 1, my: 0, pass: true });
  ok(s.ball.inFlight && s.ball.inFlight.receiver === mates[0].i, `expected the facing teammate ${mates[0].i}, got ${s.ball.inFlight && s.ball.inFlight.receiver}`);
});
test('"OPEN!": an AI teammate with the ball plays it to you when the lane is clear', () => {
  const { s, me, mates, put } = scene();
  put(mates[0], 40, 34); s.giveBall(mates[0].i); mates[0].holdTime = 0.5;
  put(me, 48, 26);
  const evs = steps(s, 30, { open: true });
  ok(evs.some(e => e.type === 'opencall' && e.player === me.i && e.hasBall && e.open), 'the call is announced as open');
  ok(s.ball.inFlight && s.ball.inFlight.receiver === me.i, `expected the pass to me (${me.i}), got ${s.ball.inFlight && s.ball.inFlight.receiver}`);
  ok(evs.some(e => e.type === 'openpass' && e.to === me.i), 'an openpass event was emitted');
});
test('"OPEN!" with a defender in the lane is not answered (and the coach is told the lane is blocked)', () => {
  const { s, me, mates, opps, put } = scene();
  put(mates[0], 40, 34); s.giveBall(mates[0].i); mates[0].holdTime = 0.5;
  put(me, 48, 26); put(opps[0], 44, 30); // right on the line between us
  const evs = steps(s, 20, { open: true });
  ok(evs.some(e => e.type === 'opencall' && e.player === me.i && e.hasBall && !e.open), 'the call is announced as blocked');
  ok(!s.ball.inFlight || s.ball.inFlight.receiver !== me.i, 'the ball was not forced into the blocked lane');
});
test('"OPEN!" when the other team has the ball just tells you so', () => {
  const { s, me, opps, put } = scene();
  put(opps[0], 60, 34); s.giveBall(opps[0].i); put(me, 50, 30);
  const evs = steps(s, 3, { open: true });
  ok(evs.some(e => e.type === 'opencall' && e.player === me.i && !e.hasBall), 'the call reports we do not have the ball');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
