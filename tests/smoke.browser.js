// Browser smoke test with a "tackle bot": proves the rule popups (FOUL / PENALTY! / ADVANTAGE) really fire in a
// live match, and that the page runs with zero console or page errors.
//
// Run:  npm run test:browser                      # starts the local server on a free port and tests it
//       URL=https://your-site npm run test:browser  # tests a deployed site instead
//
// Needs Playwright with Chromium (not a project dependency):  npm i -D playwright && npx playwright install chromium
// If Chromium lives elsewhere, point to it with CHROMIUM=/path/to/chrome.
// Screenshots of each popup land in tests/screenshots/ (git-ignored).
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

let chromium;
try { ({ chromium } = require('playwright')); } catch (e) { console.log('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const BUDGET = +process.env.BUDGET || 260;            // max real seconds to play (a match is 240s + halftime)
const OUT = path.join(__dirname, 'screenshots');
const WANT = ['FOUL', 'PENALTY', 'ADVANTAGE', 'HANDBALL', 'PLAY ON', 'INDIRECT', '8 SECONDS', 'YELLOW']; // whistle banners we hunt for
const CORE = ['FOUL', 'PENALTY', 'ADVANTAGE'];          // stop early once all of these are on film
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// Runs inside the page before any script: logs canvas text, logs sim events and, once window.__bot is set,
// steers the human player at the opposing ball carrier from behind (that is what the engine calls a foul).
function pageHook() {
  window.__fxLog = []; window.__events = []; window.__bot = false;
  const iv = setInterval(() => {
    if (window.FX && FX.prototype.text && !FX.prototype.__hooked) {
      const o = FX.prototype.text; FX.prototype.text = function (x, y, str, c, s) { window.__fxLog.push(str); return o.call(this, x, y, str, c, s); }; FX.prototype.__hooked = true;
    }
    if (window.Sim && Sim.MatchSim && !Sim.MatchSim.prototype.__hooked) {
      const step = Sim.MatchSim.prototype.step, emit = Sim.MatchSim.prototype.emit;
      Sim.MatchSim.prototype.emit = function (e) { window.__events.push(e.type + (e.penalty ? '/penalty' : '')); return emit.call(this, e); };
      Sim.MatchSim.prototype.step = function (dt) {
        window.__sim = this;
        if (window.__bot) {
          const me = this.players.find(p => p.human === 'me'), b = this.ball;
          if (me && me.input) {
            let tgt = null;
            if (b.holder === me.i) { // we have it: keep it and drift slowly toward their box, so defenders tackle from behind
              const g = this.goalOf(me.team), dx = g.x - me.x, dy = g.y - me.y, d = Math.hypot(dx, dy) || 1;
              const k = Math.abs(g.x - me.x) < 12 ? 0 : 0.3; // stop on the edge of the box (a foul there is a penalty)
              me.input.mx = dx / d * k; me.input.my = dy / d * k; me.input.pass = false; me.input.shoot = false;
              return step.call(this, dt);
            }
            if (b.holder >= 0) { const h = this.players[b.holder]; if (h.team !== me.team) tgt = h; }
            else if (b.inFlight && b.inFlight.receiver >= 0 && this.players[b.inFlight.receiver].team !== me.team) tgt = this.players[b.inFlight.receiver];
            else { let bd = 1e9; for (const p of this.players) { if (p.team === me.team || p.role === 'GK') continue; const d = Math.hypot(p.x - b.x, p.y - b.y); if (d < bd) { bd = d; tgt = p; } } }
            if (tgt) { // aim just behind the carrier, inside tackling range of the ball
              const dx = tgt.x - tgt.fx * 0.35 - me.x, dy = tgt.y - tgt.fy * 0.35 - me.y, d = Math.hypot(dx, dy) || 1;
              me.input.mx = dx / d; me.input.my = dy / d; me.input.pass = false; me.input.shoot = false;
            }
          }
        }
        return step.call(this, dt);
      };
      Sim.MatchSim.prototype.__hooked = true;
    }
    if (window.FX && FX.prototype.__hooked && window.Sim && Sim.MatchSim.prototype.__hooked) clearInterval(iv);
  }, 30);
}

async function startLocalServer() {
  const port = 8100 + Math.floor(Math.random() * 800);
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { proc.stdout.on('data', d => { if (String(d).includes('running')) res(); }); proc.on('exit', c => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server start timeout')), 10000); });
  return { url: `http://localhost:${port}/`, proc };
}

(async () => {
  let server = null, url = process.env.URL;
  if (!url) { server = await startLocalServer(); url = server.url; }
  fs.mkdirSync(OUT, { recursive: true });
  const consoleErrors = [], pageErrors = [], failedReqs = [], seen = {}, timeline = [];
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || undefined });
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', e => pageErrors.push(String(e && e.stack || e)));
  page.on('response', r => { if (r.status() >= 400) failedReqs.push(`${r.url()} -> HTTP ${r.status()}`); });
  await page.addInitScript(pageHook);

  log('open', url);
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  if (await page.$('#rotateSkip:visible')) await page.click('#rotateSkip');
  const rules = await page.evaluate(() => window.Rules && Rules.RULES.length);
  log('menu loaded | rule library:', rules, 'rules | rule book button:', !!(await page.$('#menuRulesBtn')));

  // Solo match as a center back (near our own box, so a foul can be a penalty).
  await page.click('[data-mode="match"]'); await page.waitForTimeout(600);
  if (await page.$eval('#avatar', e => e.classList.contains('active'))) { await page.click('#avSave'); await page.waitForTimeout(800); } // first-run avatar screen
  const roles = await page.$$eval('#rolePick button', b => b.map(x => x.dataset.role));
  const role = ['LCB', 'RCB', 'CB', 'LB', 'RB'].find(r => roles.includes(r)); if (role) await page.click(`#rolePick button[data-role="${role}"]`);
  await page.click('#tutPlay'); await page.waitForTimeout(1200);
  const hooks = await page.evaluate(() => ({ fx: !!(window.FX && FX.prototype.__hooked), sim: !!(window.Sim && Sim.MatchSim.prototype.__hooked), running: !!window.__sim }));
  log('match started as', role || 'default role', '| hooks:', JSON.stringify(hooks));
  if (!hooks.fx || !hooks.sim || !hooks.running) { console.log('FAIL: could not hook the match engine'); process.exit(1); }
  await page.evaluate(() => { window.__bot = true; });
  await page.keyboard.down('ArrowRight'); // keeps the input channel open; the bot overrides the direction every tick

  const T0 = Date.now(); let lastStatus = 0, halftime = false;
  while ((Date.now() - T0) / 1000 < BUDGET) {
    await page.waitForTimeout(120);
    const fx = await page.evaluate(() => { const l = window.__fxLog.slice(); window.__fxLog.length = 0; return l; });
    for (const s of fx) {
      const key = WANT.find(w => s.toUpperCase().includes(w));
      if (key && !seen[key]) { seen[key] = path.join(OUT, `${key.toLowerCase().replace(/\s+/g, '-')}.png`); await page.screenshot({ path: seen[key] }); timeline.push(`${Math.round((Date.now() - T0) / 1000)}s  ${s}`); log('popup:', s); }
    }
    // the coaching modal pauses the match on purpose; press "Got it" so play continues
    const modal = await page.$('#explainModal:visible'); if (modal) { const b = await modal.$('button:has-text("Got it")') || await modal.$('button'); if (b) await b.click().catch(() => {}); }
    if (!halftime && await page.$('#halftime.active')) { halftime = true; const c = await page.$('#htClose'); if (c) await c.click().catch(() => {}); log('halftime reached'); }
    if (await page.$('#results.active')) { log('full time'); break; }
    if (CORE.every(w => seen[w])) break;
    if (Date.now() - lastStatus > 20000) { lastStatus = Date.now(); log('clock:', await page.evaluate(() => `${window.__sim.time.toFixed(0)}s game time, phase ${window.__sim.phase}`)); }
  }
  await page.keyboard.up('ArrowRight');
  const events = await page.evaluate(() => window.__events);
  const counts = {}; events.forEach(e => { if (/foul|advantage|handball|goal|halftime/.test(e)) counts[e] = (counts[e] || 0) + 1; });
  await browser.close(); if (server) server.proc.kill();

  console.log('\nRULE POPUPS SEEN'); timeline.forEach(t => console.log('  ' + t)); if (!timeline.length) console.log('  none');
  console.log('ENGINE EVENTS', JSON.stringify(counts));
  console.log('SCREENSHOTS'); Object.values(seen).forEach(s => console.log('  ' + s));
  console.log('CONSOLE ERRORS', consoleErrors.length); consoleErrors.forEach(e => console.log('  ' + e));
  console.log('PAGE ERRORS', pageErrors.length); pageErrors.forEach(e => console.log('  ' + e));
  console.log('FAILED REQUESTS', failedReqs.length); failedReqs.forEach(e => console.log('  ' + e));

  const problems = [];
  if (rules !== 32) problems.push(`rule library has ${rules} rules, expected 32`);
  if (!timeline.length) problems.push(`no whistle popup (${WANT.join(' / ')}) within ${BUDGET}s`);
  if (consoleErrors.length) problems.push('console errors'); if (pageErrors.length) problems.push('page errors'); if (failedReqs.length) problems.push('failed requests');
  console.log(problems.length ? '\n✗ FAIL: ' + problems.join('; ') : '\n✓ PASS: rule popups fire and the page runs clean');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
