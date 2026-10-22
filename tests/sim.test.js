// Match engine tests. Run: npm test
const L = require('../js/logic.js');
const { MatchSim } = require('../js/sim.js');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.stack.split('\n').slice(0, 2).join(' | ')); } }
const eq = (a, b, m) => { if (a !== b) throw new Error((m || '') + ` expected ${JSON.stringify(b)} got ${JSON.stringify(a)}`); };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const run = (sim, secs, inp, id) => { const evs = []; for (let i = 0; i < secs * 60; i++) { if (inp) sim.setInput(id || 'me', inp); evs.push(...sim.step(1 / 60)); } return evs; };
const rng = () => 0.5; // deterministic

console.log('\nMATCH ENGINE');
test('starts 11 v 11 with two keepers, ball in the center, kickoff phase', () => {
  const s = new MatchSim({ rng });
  eq(s.players.length, 22); eq(s.players.filter(p => p.role === 'GK').length, 2);
  ok(Math.abs(s.ball.x - L.FIELD.halfway) < 2 && Math.abs(s.ball.y - 34) < 2); eq(s.phase, 'kickoff');
});
test('a human can take a role; leaving hands it back to the AI', () => {
  const s = new MatchSim({ rng }); const p = s.addHuman('me', 0, 'ST', 'Sam');
  ok(p && p.human === 'me' && p.role === 'ST' && p.team === 0);
  eq(s.addHuman('other', 0, 'ST', 'Bo').role !== 'ST' || s.addHuman('x', 0, 'ST') === null, true, 'taken slot is not given twice');
  s.removeHuman('me'); eq(p.human, null);
});
test('human input moves the player', () => {
  const s = new MatchSim({ rng }); const p = s.addHuman('me', 0, 'CM'); s.phase = 'play';
  const x0 = p.x; run(s, 1, { mx: 1, my: 0 }); ok(p.x > x0 + 3, `moved ${p.x - x0}`);
});
test('ball crossing the goal line between the posts is a GOAL and restarts with a kickoff', () => {
  const s = new MatchSim({ rng }); s.phase = 'play'; s.ball.holder = -1;
  Object.assign(s.ball, { x: 100, y: 34, z: 0.5, vx: 25, vy: 0, vz: 0 });
  s.players.forEach(p => { p.x = p.team ? 90 : 30; }); // keep everyone away from the ball
  const evs = run(s, 1); ok(evs.some(e => e.type === 'goal' && e.team === 0), 'goal event for team 0');
  eq(s.score[0], 1); ok(['goal', 'kickoff'].includes(s.phase));
});
test('ball over the goal line OUTSIDE the posts is a restart, not a goal', () => {
  const s = new MatchSim({ rng }); s.phase = 'play'; s.ball.holder = -1;
  Object.assign(s.ball, { x: 100, y: 10, z: 0, vx: 25, vy: 0, vz: 0 }); s.players.forEach(p => { p.x = p.team ? 90 : 30; p.y = 60; });
  const evs = run(s, 1); ok(evs.some(e => e.type === 'out'), 'out event'); eq(s.score[0], 0);
  ok(s.ball.x >= 0 && s.ball.x <= L.FIELD.w && s.ball.y >= 0 && s.ball.y <= L.FIELD.h, 'ball back inside');
});
test('a player next to a loose ball picks it up', () => {
  const s = new MatchSim({ rng }); s.phase = 'play'; s.ball.holder = -1;
  const p = s.addHuman('me', 0, 'CM'); Object.assign(s.ball, { x: p.x + 0.5, y: p.y, vx: 0, vy: 0, z: 0 });
  run(s, 0.2); eq(s.ball.holder, p.i);
});
test('PASS sends the ball toward a teammate and fires a pass event', () => {
  const s = new MatchSim({ rng }); s.phase = 'play'; const p = s.addHuman('me', 0, 'CM'); s.giveBall(p.i);
  const evs = run(s, 0.1, { mx: 0, my: 0, pass: true });
  ok(evs.some(e => e.type === 'pass' && e.from === p.i), 'pass event'); ok(s.ball.holder === -1 && Math.hypot(s.ball.vx, s.ball.vy) > 8, 'ball flying');
});
test('SHOOT fires the ball toward the opponent goal', () => {
  const s = new MatchSim({ rng }); s.phase = 'play'; const p = s.addHuman('me', 0, 'ST'); p.x = 88; p.y = 34; s.giveBall(p.i);
  const evs = run(s, 0.05, { mx: 0, my: 0, shoot: true });
  ok(evs.some(e => e.type === 'shot'), 'shot event'); ok(s.ball.vx > 15, 'ball heading right fast');
});
test('receiving a pass while OFFSIDE blows the whistle and gives the ball away', () => {
  const s = new MatchSim({ rng }); s.phase = 'play';
  const passer = s.addHuman('me', 0, 'CM'), runner = s.addHuman('r', 0, 'ST');
  passer.x = 60; passer.y = 34; runner.x = 90; runner.y = 34; // runner beyond the whole red back line
  s.players.filter(p => p.team === 1).forEach((p, i) => { p.x = p.role === 'GK' ? 103 : 75; p.y = i < 5 ? 4 + i * 5 : 44 + (i - 5) * 4; }); // nobody on the pass lane (y=34)
  s.giveBall(passer.i); s.kickPass(passer.i, runner.i);
  const evs = run(s, 3, { mx: 0, my: 0 }, 'r');
  const off = evs.find(e => e.type === 'offside'); ok(off && off.player === runner.i, 'offside event for the runner');
  ok(s.ball.holder >= 0 && s.players[s.ball.holder].team === 1, 'free kick to the other team');
  ok(evs.some(e => e.type === 'explain' && e.to === 'r' && e.key === 'offside'), 'runner gets an explainer');
});
test('receiving a pass while ONSIDE is fine', () => {
  const s = new MatchSim({ rng }); s.phase = 'play';
  const passer = s.addHuman('me', 0, 'CM'), runner = s.addHuman('r', 0, 'ST');
  passer.x = 60; passer.y = 34; runner.x = 70; runner.y = 34;
  s.players.filter(p => p.team === 1).forEach((p, i) => { p.x = p.role === 'GK' ? 103 : 80; p.y = 5 + i * 6; });
  s.giveBall(passer.i); s.kickPass(passer.i, runner.i);
  const evs = run(s, 3, { mx: 0, my: 0 }, 'r'); ok(!evs.some(e => e.type === 'offside')); eq(s.ball.holder, runner.i);
});
test('the keeper catches a soft shot straight at him', () => {
  const s = new MatchSim({ rng }); s.phase = 'play'; s.ball.holder = -1;
  const gk = s.players.find(p => p.team === 1 && p.role === 'GK'); gk.x = 103; gk.y = 34;
  s.players.forEach(p => { if (p !== gk) { p.x = 30; p.y = 10; } });
  Object.assign(s.ball, { x: 85, y: 34, z: 0, vx: 14, vy: 0, vz: 0, inFlight: { kind: 'shot', team: 0, from: 0 } });
  const evs = run(s, 2); ok(evs.some(e => e.type === 'save'), 'save event'); eq(s.ball.holder, gk.i); eq(s.score[0], 0);
});
test('an intercepted pass sends the passer an explainer', () => {
  const s = new MatchSim({ rng }); s.phase = 'play';
  const passer = s.addHuman('me', 0, 'CM'), mate = s.players.find(p => p.team === 0 && p.role === 'ST');
  passer.x = 50; passer.y = 34; mate.x = 70; mate.y = 34;
  s.players.filter(p => p.team === 1).forEach((p, i) => { p.x = 90; p.y = 5 + i * 6; }); const red = s.players.find(p => p.team === 1 && p.role === 'CM'); red.x = 60; red.y = 34;
  s.giveBall(passer.i); s.kickPass(passer.i, mate.i);
  const evs = run(s, 2); ok(evs.some(e => e.type === 'intercept'), 'intercept'); ok(evs.some(e => e.type === 'explain' && e.to === 'me' && e.key === 'intercepted'));
});
test('full time ends the match', () => {
  const s = new MatchSim({ rng, duration: 2, halves: false }); s.phase = 'play'; const evs = run(s, 3); ok(evs.some(e => e.type === 'fulltime')); eq(s.phase, 'fulltime');
});
test('snapshot is compact and round-trips the important bits', () => {
  const s = new MatchSim({ rng }); s.addHuman('me', 0, 'ST'); const snap = s.snapshot();
  eq(snap.p.length, 22); eq(snap.tg.length, 22); ok(Array.isArray(snap.sc)); ok(JSON.stringify(snap).length < 3000, 'small enough for 20 Hz');
});
test('HALFTIME: teams switch ends and attack the other goal', () => {
  const s = new MatchSim({ rng, duration: 4 }); s.phase = 'play';
  const evs = run(s, 2.2); ok(evs.some(e => e.type === 'halftime'), 'halftime event'); eq(s.phase, 'halftime');
  run(s, 8); eq(s.half, 2); eq(s.dir(0), -1, 'blue now attacks left'); eq(s.goalOf(0).x, 0);
  const gk0 = s.players.find(p => p.team === 0 && p.role === 'GK'); ok(gk0.x > 90, 'blue keeper is now on the right');
});
test('a blue goal in the SECOND half counts for blue (left goal)', () => {
  const s = new MatchSim({ rng, duration: 4 }); s.phase = 'play'; run(s, 2.2); run(s, 8); s.phase = 'play'; s.ball.holder = -1;
  Object.assign(s.ball, { x: 5, y: 34, z: 0.5, vx: -25, vy: 0, vz: 0 }); s.players.forEach(p => { p.x = 60; p.y = 10; });
  run(s, 1); eq(s.score[0], 1); eq(s.score[1], 0);
});
test('passive (tutorial) mode: nobody tackles, clock does not run', () => {
  const s = new MatchSim({ rng, passive: true }); s.phase = 'play'; const p = s.addHuman('me', 0, 'ST'); s.giveBall(p.i);
  s.players.filter(q => q.team === 1 && q.role !== 'GK').forEach(q => { q.x = p.x + 0.5; q.y = p.y; });
  run(s, 2, { mx: 0, my: 0 }); eq(s.ball.holder, p.i); eq(s.time, 0);
});
test('every player has a jersey name', () => { const s = new MatchSim({ rng }); ok(s.players.every(p => p.jersey)); });
test('a PASS press just BEFORE the ball arrives is remembered and fires on arrival', () => {
  const s = new MatchSim({ rng }); s.phase = 'play'; const p = s.addHuman('me', 0, 'CM'); s.ball.holder = -1;
  Object.assign(s.ball, { x: p.x - 6, y: p.y, vx: 12, vy: 0, z: 0 }); // rolling toward the player
  s.setInput('me', { mx: 0, my: 0, pass: true }); // pressed too early
  const evs = run(s, 1, { mx: 0, my: 0 }); ok(evs.some(e => e.type === 'pass' && e.from === p.i), 'pass fired once the ball arrived');
});
test('SHOOT during the kickoff freeze starts play immediately', () => {
  const s = new MatchSim({ rng }); const cm = s.addHuman('me', 0, 'CM'); eq(s.ball.holder, cm.i); eq(s.phase, 'kickoff');
  s.setInput('me', { mx: 0, my: 0, shoot: true }); const evs = run(s, 0.2, { mx: 0, my: 0 }); ok(evs.some(e => e.type === 'shot'), 'shot event'); eq(s.phase, 'play');
});
test('"rolled past you" does NOT fire when you were sprinting for the ball and got beaten to it', () => {
  const s = new MatchSim({ rng }); s.phase = 'play';
  const passer = s.addHuman('me', 0, 'CM'), me = s.addHuman('r', 0, 'ST'); passer.x = 40; passer.y = 34; me.x = 70; me.y = 44;
  s.players.filter(p => p.team === 1).forEach((p, i) => { p.x = 90; p.y = 5 + i * 6; }); const red = s.players.find(p => p.team === 1 && p.role === 'CM'); red.x = 58; red.y = 36;
  s.giveBall(passer.i); s.kickPass(passer.i, me.i);
  const evs = run(s, 2.5, { mx: -1, my: -1 }, 'r'); // running toward the ball the whole time
  ok(evs.some(e => e.type === 'intercept'), 'the pass was cut out'); ok(!evs.some(e => e.type === 'explain' && e.key === 'rolledpast'), 'no "rolled past you" lecture');
});
test('"rolled past you" DOES fire when the ball comes right to you and you stand still', () => {
  const s = new MatchSim({ rng }); s.phase = 'play';
  const passer = s.addHuman('me', 0, 'CM'), me = s.addHuman('r', 0, 'ST'); passer.x = 50; passer.y = 34; me.x = 70; me.y = 34;
  s.players.filter(p => p.team === 1).forEach((p, i) => { p.x = 90; p.y = 5 + i * 6; }); const red = s.players.find(p => p.team === 1 && p.role === 'CM'); red.x = 76; red.y = 34; // waiting just behind you
  s.giveBall(passer.i); s.ball.x = 50.8; s.kickPass(passer.i, me.i); // aimed at you...
  s.ball.vx *= 1.6; me.y = 36.2; // ...overhit, and you are standing 2 m off its path, not moving
  const evs = run(s, 2.5, { mx: 0, my: 0 }, 'r');
  ok(evs.some(e => e.type === 'explain' && e.key === 'rolledpast'), 'you let it go by');
});
test('a hard pass does not go THROUGH the player it was meant for', () => {
  const s = new MatchSim({ rng }); s.phase = 'play';
  const passer = s.addHuman('me', 0, 'CM'), me = s.addHuman('r', 0, 'ST'); passer.x = 45; passer.y = 34; me.x = 60; me.y = 34;
  s.players.filter(p => p.team === 1).forEach((p, i) => { p.x = 95; p.y = 5 + i * 6; });
  s.giveBall(passer.i); s.kickPass(passer.i, me.i); s.ball.vx = 24; s.ball.vy = 0; // a rocket, straight at you
  run(s, 1.5, { mx: 0, my: 0 }, 'r'); eq(s.ball.holder, me.i);
});
console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed ? 1 : 0);
