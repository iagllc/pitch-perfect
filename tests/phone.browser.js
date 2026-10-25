// Pocket view test: on an emulated iPhone 15 held sideways the field fills the screen, the camera zooms to the action and
// the radar is drawn; on a desktop nothing changes. Needs Playwright (see smoke.browser.js).
//
// Run:  npm run test:phone                       # local server on a free port
//       URL=https://your-site npm run test:phone   # a deployed site
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
let chromium, devices;
try { ({ chromium, devices } = require('playwright')); } catch (e) { console.log('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium'); process.exit(2); }

const OUT = path.join(__dirname, 'screenshots');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const problems = [];
const check = (ok, what) => { console.log((ok ? '  ✓ ' : '  ✗ ') + what); if (!ok) problems.push(what); };

async function startLocalServer() {
  const port = 8100 + Math.floor(Math.random() * 800);
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { proc.stdout.on('data', d => { if (String(d).includes('running')) res(); }); proc.on('exit', c => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server start timeout')), 10000); });
  return { url: `http://localhost:${port}/`, proc };
}
const state = () => ({ // read from inside the page
  phone: document.documentElement.hasAttribute('data-phone'), win: [innerWidth, innerHeight],
  canvas: (() => { const r = document.querySelector('canvas#pitch').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
  stage: (() => { const r = document.getElementById('stage').getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height)]; })(),
  scale: +window.__app.pitch.scale.toFixed(2), base: +window.__app.pitch.baseScale.toFixed(2), cam: window.__app.pitch.cam ? { zoom: +window.__app.pitch.cam.zoom.toFixed(2), cacheZoom: window.__app.pitch.cam.cacheZoom && +window.__app.pitch.cam.cacheZoom.toFixed(2), auto: !!window.__app.pitch.cam.auto } : null,
});
async function startMatch(page, mode, settle = 3000) {
  await page.click(`[data-mode="${mode}"]`); await page.waitForTimeout(500);
  if (await page.$eval('#avatar', e => e.classList.contains('active'))) { await page.click('#avSave'); await page.waitForTimeout(700); }
  await page.click('#tutPlay'); await page.waitForTimeout(settle);
}
async function stepsIn2s(page) { // engine steps over 2s of real time, pressing "Got it" on any coaching popup so the match is never paused mid-measure
  const dismiss = async () => { const m = await page.$('#explainModal:visible'); if (m) { const b = await m.$('button'); if (b) await b.click().catch(() => {}); return true; } return false; };
  await dismiss(); await page.waitForTimeout(150);
  const a = await page.evaluate(() => window.__app.mode.sim.tick); let paused = 0;
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(100); if (await dismiss()) paused++; }
  const b = await page.evaluate(() => window.__app.mode.sim.tick);
  return { speed: await page.evaluate(() => window.__app.settings.speed), scale: await page.evaluate(() => window.__app.timeScale()), steps: b - a, popups: paused };
}
async function backToMenu(page) {
  const m = await page.$('#explainModal:visible'); if (m) { const b = await m.$('button'); if (b) await b.click().catch(() => {}); }
  await page.keyboard.press('KeyP'); await page.waitForTimeout(300); const q = await page.$('#quitBtn'); if (q) await q.click({ force: true }).catch(() => {}); await page.waitForTimeout(500);
}

(async () => {
  let server = null, url = process.env.URL;
  if (!url) { server = await startLocalServer(); url = server.url; }
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM || undefined });
  const pageErrors = [], consoleErrors = [];

  // ---- iPhone 15, landscape
  const dev = devices['iPhone 15 landscape'] || devices['iPhone 13 landscape'];
  log('iPhone emulation:', JSON.stringify(dev.viewport), 'dpr', dev.deviceScaleFactor);
  const ctx = await browser.newContext({ ...dev });
  const page = await ctx.newPage();
  page.on('pageerror', e => pageErrors.push(String(e))); page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 }); await page.waitForTimeout(500);
  check(await page.evaluate(() => document.documentElement.hasAttribute('data-phone')), 'phone: Pocket view switches on for a small landscape phone');
  // full screen + Home Screen app plumbing
  const man = await page.evaluate(async () => { const l = document.querySelector('link[rel="manifest"]'); if (!l) return null; const r = await fetch(l.href); const j = await r.json().catch(() => null); return { status: r.status, type: r.headers.get('content-type'), icons: j && j.icons && j.icons.length, display: j && j.display }; });
  check(man && man.status === 200 && man.icons >= 2 && man.display === 'fullscreen', `phone: web app manifest served (${JSON.stringify(man)})`);
  const icon = await page.evaluate(async () => { const l = document.querySelector('link[rel="apple-touch-icon"]'); if (!l) return 0; return (await fetch(l.href)).status; });
  check(icon === 200, 'phone: apple-touch-icon is served (Add to Home Screen gets a real icon)');
  check(await page.$eval('meta[name="apple-mobile-web-app-capable"]', m => m.content === 'yes'), 'phone: Home Screen app runs without Safari bars (apple-mobile-web-app-capable)');
  const fsInfo = await page.evaluate(() => ({ supported: PhoneView.fullscreenSupported(), standalone: PhoneView.standalone(), btn: [...document.querySelectorAll('.fsBtn')].map(b => b.style.display !== 'none') }));
  log('fullscreen:', JSON.stringify(fsInfo));
  if (fsInfo.supported) {
    check(fsInfo.btn.every(Boolean), 'phone: full-screen buttons are shown when the browser can go full screen');
    await page.click('#menu .fsBtn'); await page.waitForTimeout(600);
    const fsNow = await page.evaluate(() => ({ fs: PhoneView.isFullscreen(), attr: document.documentElement.hasAttribute('data-fullscreen'), label: document.querySelector('#menu .fsBtn').textContent }));
    check(fsNow.fs && fsNow.attr && /Exit/.test(fsNow.label), `phone: tapping the button enters full screen and the button flips to Exit (${JSON.stringify(fsNow)})`);
    await page.evaluate(() => PhoneView.exitFullscreen()); await page.waitForTimeout(400);
  } else console.log('  - this browser build cannot go full screen; button checks skipped');

  await startMatch(page, 'match');
  // game speed: slow motion by default on a phone (engine steps per 2s: 120 at full speed, about 66 at Slow)
  const sp = await stepsIn2s(page); log('phone speed:', JSON.stringify(sp));
  check(sp.speed === 'normal' && sp.scale === 0.85 && sp.steps > 88 && sp.steps < 115, `phone speed: Normal (0.85x) by default, ${sp.steps} engine steps in 2s (120 would be full speed)`);
  let s = await page.evaluate(state); log('phone match:', JSON.stringify(s));
  check(s.canvas[0] >= s.stage[0] - 2 && s.canvas[1] >= s.stage[1] - 2, `phone match: canvas fills the stage (${s.canvas.join('x')} of ${s.stage.join('x')})`);
  check(s.scale >= 7.5 && s.scale <= 13.5, `phone match: zoomed to ${s.scale} px per meter (want 7.5–13)`);
  check(s.cam && s.cam.cacheZoom > 0 && !s.cam.auto, 'phone match: action camera is driving the view');
  check(s.scale > s.base * 1.5, `phone match: players are ${(s.scale / s.base).toFixed(1)}x bigger than the full-field view`);
  await page.screenshot({ path: path.join(OUT, 'pocket-match.png') });
  // joystick: resting stick visible, short travel, base follows an overshoot
  const joy = await page.evaluate(() => { const b = document.querySelector('.joy-base'); return { R: Touch.R, rest: Touch.rest, idle: b.classList.contains('idle') && b.style.display === 'block', left: parseFloat(b.style.left), top: parseFloat(b.style.top) }; });
  check(joy.R === 24 && joy.rest && joy.idle, `phone joystick: fixed thumb-pad shown at (${joy.left}, ${joy.top}) with 24px travel`);
  const st = await page.$eval('#stage', e => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top }; });
  await page.mouse.move(st.x + joy.left + 40, st.y + joy.top); await page.mouse.down(); await page.waitForTimeout(80); // press to the RIGHT of the pad, no slide at all
  const v1 = await page.evaluate(() => ({ x: +Touch.vec.x.toFixed(2), y: +Touch.vec.y.toFixed(2), base: parseFloat(document.querySelector('.joy-base').style.left) }));
  check(v1.x === 1 && Math.abs(v1.y) < 0.05 && Math.abs(v1.base - joy.left) < 1, `phone joystick: a press 40px right of the pad = full speed right, pad did not move (${JSON.stringify(v1)})`);
  await page.mouse.move(st.x + joy.left + 10, st.y + joy.top - 60, { steps: 3 }); await page.waitForTimeout(80);
  const v2 = await page.evaluate(() => ({ x: +Touch.vec.x.toFixed(2), y: +Touch.vec.y.toFixed(2) }));
  check(v2.y < -0.9 && v2.x > 0 && v2.x < 0.3, `phone joystick: sliding above the pad steers up (${JSON.stringify(v2)})`);
  await page.mouse.up(); await page.waitForTimeout(80);
  await page.mouse.move(st.x + joy.left, st.y + joy.top); await page.mouse.down(); await page.mouse.move(st.x + joy.left + 6, st.y + joy.top, { steps: 2 }); await page.waitForTimeout(80);
  const v4 = await page.evaluate(() => ({ x: +Touch.vec.x.toFixed(2) })); await page.mouse.up(); await page.waitForTimeout(80);
  check(v4.x === 1, `phone joystick: a 6px nudge from the pad center is already full speed (digital), got ${v4.x}`);
  const v3 = await page.evaluate(() => { const b = document.querySelector('.joy-base'); return { x: Touch.vec.x, idle: b.classList.contains('idle'), left: parseFloat(b.style.left) }; });
  check(v3.x === 0 && v3.idle && Math.abs(v3.left - joy.left) < 1, 'phone joystick: letting go stops the player and the pad is still in place');
  await page.waitForTimeout(3000); const s2 = await page.evaluate(state); check(s2.cam && s2.scale >= 7.5, `phone match: still framing the action 3s later (${s2.scale} px/m)`);
  await page.screenshot({ path: path.join(OUT, 'pocket-match-2.png') });
  // the camera button still gives the whole field, now filling the width
  const m0 = await page.$('#explainModal:visible'); if (m0) { const b = await m0.$('button'); if (b) await b.click().catch(() => {}); await page.waitForTimeout(300); } // a coaching popup pauses the game
  await page.evaluate(() => window.__app.toggleCamera()); await page.waitForTimeout(800); const sf = await page.evaluate(state); log('phone full-field:', JSON.stringify(sf));
  check(sf.cam && sf.cam.auto && Math.abs(sf.cam.zoom - 1) < 0.01 && sf.canvas[0] >= sf.stage[0] - 2, 'phone match: camera button shows the whole field, canvas still full width');
  await page.screenshot({ path: path.join(OUT, 'pocket-match-full.png') });
  await page.evaluate(() => window.__app.toggleCamera()); await backToMenu(page);

  await startMatch(page, 'attack');
  s = await page.evaluate(state); log('phone striker drill:', JSON.stringify(s));
  check(s.cam && !s.cam.auto && s.scale >= 7, `phone drill: Striker Timing framed at ${s.scale} px per meter`);
  await page.screenshot({ path: path.join(OUT, 'pocket-drill-striker.png') }); await backToMenu(page);
  await startMatch(page, 'throwin');
  s = await page.evaluate(state); log('phone throw-in drill:', JSON.stringify(s));
  check(s.cam && s.scale >= 6.5, `phone drill: Throw-in Thinking framed at ${s.scale} px per meter`);
  await page.screenshot({ path: path.join(OUT, 'pocket-drill-throwin.png') }); await backToMenu(page);
  await ctx.close();

  // ---- desktop: nothing changes
  const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const dpage = await dctx.newPage();
  dpage.on('pageerror', e => pageErrors.push(String(e))); dpage.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  await dpage.goto(url, { waitUntil: 'networkidle', timeout: 60000 }); await dpage.waitForTimeout(500);
  await startMatch(dpage, 'match');
  s = await dpage.evaluate(state); log('desktop match:', JSON.stringify(s));
  check(!s.phone, 'desktop: Pocket view stays off');
  check(s.cam === null && s.canvas[0] < s.stage[0] - 20, `desktop: full-field camera, field keeps its shape (${s.canvas.join('x')} in ${s.stage.join('x')})`);
  check(await dpage.$eval('#appVersion', e => /^v\d+\.\d+\.\d+\+[0-9a-f]{6}$/.test(e.textContent)), 'desktop: the menu shows the build version (' + await dpage.$eval('#appVersion', e => e.textContent) + ')');
  const dsp = await stepsIn2s(dpage); log('desktop speed:', JSON.stringify(dsp));
  check(dsp.speed === 'full' && dsp.steps > 100 && dsp.steps < 135, `desktop speed: Full by default, ${dsp.steps} engine steps in 2s`);
  await backToMenu(dpage);
  // offside trainer: the back line is ragged (never a perfect straight line) and, as a defender, you are one player in it
  const lineInfo = async () => dpage.evaluate(() => { const m = window.__app.mode; const xs = m.defs.map(d => +d.x.toFixed(2)); return { xs, spread: +(Math.max(...xs) - Math.min(...xs)).toFixed(2), meIdx: m.meIdx, meIsDef: m.me === m.defs[m.meIdx], lineX: +m.rulesNow().lineX.toFixed(2) }; });
  await startMatch(dpage, 'attack'); await dpage.waitForTimeout(2500);
  let li = await lineInfo(); log('striker drill line:', JSON.stringify(li));
  check(li.spread >= 0.8, `Striker Timing: defenders are ${li.spread} m apart front-to-back, not a straight line`);
  await backToMenu(dpage);
  await startMatch(dpage, 'defend', 700); // measure inside the first 3.5s of the round, before the pass is played
  li = await lineInfo(); log('defender drill line:', JSON.stringify(li));
  check(li.meIsDef && li.meIdx >= 0, `Defender Trap: you are defender #${li.meIdx + 2}, one player in the line`);
  await dpage.keyboard.down('ArrowLeft'); await dpage.waitForTimeout(900); await dpage.keyboard.up('ArrowLeft'); await dpage.waitForTimeout(200);
  const li2 = await lineInfo(); log('defender drill after stepping up:', JSON.stringify(li2));
  check(li2.xs[li2.meIdx] < li.xs[li.meIdx] - 3, 'Defender Trap: stepping up moves YOUR defender');
  check(li2.spread >= 0.8, `Defender Trap: your line followed but stayed ragged (${li2.spread} m front-to-back)`);
  check(Math.abs(li2.lineX - Math.max(...li2.xs)) < 0.01, `Defender Trap: the dotted line sits on the 2nd-last defender (keeper is last) at x=${li2.lineX}`);
  await dctx.close(); await browser.close(); if (server) server.proc.kill();

  check(pageErrors.length === 0, 'no page errors' + (pageErrors.length ? ': ' + pageErrors.join(' | ') : ''));
  check(consoleErrors.length === 0, 'no console errors' + (consoleErrors.length ? ': ' + consoleErrors.join(' | ') : ''));
  console.log(problems.length ? `\n✗ FAIL: ${problems.length} problem(s)` : '\n✓ PASS: Pocket view works on a small phone and leaves the desktop alone');
  process.exit(problems.length ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
