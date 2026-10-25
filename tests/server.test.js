// Static server tests: versioned asset URLs, the version meta tag, ETags and 304s (so phones pick up new builds). Run: npm test
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');
const VERSION = require('../package.json').version;

let passed = 0, failed = 0;
const test = async (name, fn) => { try { await fn(); passed++; console.log('  ✓ ' + name); } catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + e.message); } };
const ok = (v, m) => { if (!v) throw new Error(m || 'expected truthy'); };
const get = (port, p, headers = {}) => new Promise((res, rej) => { http.get({ host: '127.0.0.1', port, path: p, headers }, r => { const chunks = []; r.on('data', c => chunks.push(c)); r.on('end', () => res({ status: r.statusCode, headers: r.headers, body: Buffer.concat(chunks).toString() })); }).on('error', rej); });

(async () => {
  const port = 8900 + Math.floor(Math.random() * 90);
  const proc = spawn(process.execPath, [path.join(__dirname, '..', 'server', 'server.js')], { env: { ...process.env, PORT: String(port) }, stdio: ['ignore', 'pipe', 'inherit'] });
  await new Promise((res, rej) => { proc.stdout.on('data', d => { if (String(d).includes('running')) res(); }); proc.on('exit', c => rej(new Error('server exited ' + c))); setTimeout(() => rej(new Error('server start timeout')), 8000); });
  console.log('\nSTATIC SERVER');
  await test(`index.html links scripts and styles with ?v=${VERSION}`, async () => {
    const r = await get(port, '/'); ok(r.status === 200, 'status ' + r.status);
    const links = r.body.match(/(?:src|href)="(?:js|css)\/[^"]+"/g) || []; ok(links.length >= 10, 'found ' + links.length + ' asset links');
    const stale = links.filter(l => !l.endsWith(`?v=${VERSION}"`)); ok(stale.length === 0, 'unversioned: ' + stale.join(' '));
  });
  await test('index.html carries the version in a meta tag', async () => { const r = await get(port, '/'); ok(r.body.includes(`<meta name="app-version" content="${VERSION}">`)); });
  await test('a versioned script URL serves the script', async () => { const r = await get(port, `/js/main.js?v=${VERSION}`); ok(r.status === 200 && /javascript/.test(r.headers['content-type']) && r.body.includes('PhoneView')); });
  await test('responses carry an ETag and no-cache, and a matching If-None-Match gets a 304', async () => {
    const r = await get(port, '/js/rules.js'); ok(r.headers.etag && r.headers['cache-control'] === 'no-cache', 'headers ' + JSON.stringify(r.headers));
    const r2 = await get(port, '/js/rules.js', { 'If-None-Match': r.headers.etag }); ok(r2.status === 304 && r2.body === '', 'status ' + r2.status);
    const r3 = await get(port, '/js/rules.js', { 'If-None-Match': '"nope"' }); ok(r3.status === 200 && r3.body.length > 1000, 'status ' + r3.status);
    const r4 = await get(port, '/js/rules.js', { 'If-None-Match': 'W/' + r.headers.etag }); ok(r4.status === 304, 'weak tag (as a CDN sends it) should still get 304, got ' + r4.status);
  });
  await test('the web app manifest is served as a manifest', async () => { const r = await get(port, '/manifest.webmanifest'); ok(r.status === 200 && r.headers['content-type'] === 'application/manifest+json' && JSON.parse(r.body).icons.length === 2); });
  await test('server files are not served', async () => { const r = await get(port, '/server/server.js'); ok(r.status === 403, 'status ' + r.status); });
  proc.kill();
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => { console.error('FATAL', e); process.exit(1); });
