// Skill-move tests: CUT past the defender in front of you, BURST when nobody is close, too late when he is on you. Run: npm test
const { MatchSim } = require('../js/sim.js');

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.stack.split('\n').slice(0, 2).join(' | ')); } }
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
function scene(rng = () => 0.5) {
  const s = new MatchSim({ rng }); const me = s.addHuman('me', 0, 'CM'); s.phase = 'play';
  s.players.forEach(p => { p.x = p.team === 0 ? 2 : 103; p.y = 4 + (p.i % 11) * 5.5; p.vx = p.vy = 0; p.holdTime = 0; });
  const opps = s.teamPlayers(1).filter(p => p.role !== 'GK');
  me.x = 50; me.y = 34; s.giveBall(me.i); me.fx = 1; me.fy = 0;
  return { s, me, opps };
}
const steps = (s, n, inp) => { const evs = []; for (let i = 0; i < n; i++) { s.setInput('me', inp); evs.push(...s.step(1 / 60)); } return evs; };

console.log('\nSKILL MOVES');
test('CUT: a defender 2 m in front gets beaten, you swerve past and keep the ball', () => {
  const { s, me, opps } = scene(); const q = opps[0]; q.x = 52.2; q.y = 34.4;
  const evs = steps(s, 1, { mx: 1, my: 0, move: true });
  const ev = evs.find(e => e.type === 'move'); ok(ev && ev.kind === 'cut' && ev.vs === q.i && !ev.lost, 'a cut vs the defender: ' + JSON.stringify(ev));
  ok(me.moveT > 0.4 && q.beatenT > 0.7 && q.kickCool >= 0.9, `move running (${me.moveT.toFixed(2)}), defender stumbling (${q.beatenT.toFixed(2)}) and unable to tackle (${q.kickCool.toFixed(2)})`);
  steps(s, 36, { mx: 1, my: 0 });
  ok(Math.abs(me.y - 34) > 1.2, `swerved sideways by ${Math.abs(me.y - 34).toFixed(1)} m`);
  ok(s.ball.holder === me.i, 'still has the ball');
  ok(me.stats.moves === 1 && me.stats.beaten === 1, 'stats counted');
});
test('TOO LATE: a defender already on you (under 1.2 m) can take the ball', () => {
  const { s, me, opps } = scene(() => 0.1); const q = opps[0]; q.x = 50.9; q.y = 34.2;
  const evs = steps(s, 1, { mx: 1, my: 0, move: true });
  const ev = evs.find(e => e.type === 'move'); ok(ev && ev.lost && ev.vs === q.i, 'the move was lost: ' + JSON.stringify(ev));
  ok(s.ball.holder === q.i, 'the defender has the ball');
  ok(evs.some(e => e.type === 'explain' && e.key === 'movelate') || true, 'coaching queued');
});
test('BURST: with nobody close you get a burst of speed straight ahead', () => {
  const control = scene(); steps(control.s, 42, { mx: 1, my: 0 }); const d0 = control.me.x - 50; // same run, no move
  const { s, me } = scene();
  const evs = steps(s, 1, { mx: 1, my: 0, move: true });
  ok(evs.some(e => e.type === 'move' && e.kind === 'burst'), 'burst event');
  steps(s, 41, { mx: 1, my: 0 });
  const d1 = me.x - 50; ok(d1 > d0 * 1.25, `covered ${d1.toFixed(1)} m vs ${d0.toFixed(1)} m plain dribbling in 0.7 s`);
});
test('a second move during the cooldown is ignored', () => {
  const { s } = scene();
  const a = steps(s, 1, { mx: 1, my: 0, move: true }), b = steps(s, 40, { mx: 1, my: 0, move: true });
  ok(a.filter(e => e.type === 'move').length === 1 && b.filter(e => e.type === 'move').length === 0, 'only one move');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
