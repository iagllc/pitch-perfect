/* Pitch Perfect online server: serves the game + runs authoritative matches in rooms over WebSockets. */
'use strict';
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const WebSocket = require('ws');
const VERSION = require('../package.json').version;
const { MatchSim } = require('../js/sim.js');

const ROOT = path.join(__dirname, '..');
const PORT = process.env.PORT || 8080;
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.md': 'text/markdown' };
const MATCH_SECONDS = +process.env.MATCH_SECONDS || 240;

const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]); if (p === '/') p = '/index.html';
  const file = path.normalize(path.join(ROOT, p));
  if (!file.startsWith(ROOT) || file.includes(path.sep + 'server' + path.sep) || file.includes('node_modules')) { res.writeHead(403); return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    // index.html gets versioned asset URLs (js/x.js?v=2.2.0) so a phone that cached the old scripts fetches the new ones after an update.
    if (p === '/index.html') data = Buffer.from(data.toString().replace(/(src|href)="((?:js|css)\/[^"?]+)"/g, `$1="$2?v=${VERSION}"`).replace('</head>', `  <meta name="app-version" content="${VERSION}">\n</head>`));
    const etag = '"' + crypto.createHash('sha1').update(data).digest('hex').slice(0, 16) + '"';
    if (req.headers['if-none-match'] === etag) { res.writeHead(304, { ETag: etag, 'Cache-Control': 'no-cache' }); return res.end(); }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache', ETag: etag }); res.end(data);
  });
});
const wss = new WebSocket.Server({ server });

const rooms = new Map();
function cleanAvatar(a) { if (!a || typeof a !== 'object') return null; return { set: a.set === 'teen' ? 'teen' : 'kid', sex: a.sex === 'f' ? 'f' : 'm', skin: (+a.skin % 6) || 0, hair: String(a.hair || 'short').slice(0, 10), hairCol: (+a.hairCol % 7) || 0, beard: String(a.beard || 'none').slice(0, 8), build: String(a.build || 'athletic').slice(0, 8), extra: String(a.extra || 'none').slice(0, 8), lashes: !!a.lashes }; }
let nextId = 1;
const code = () => { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; let s = ''; for (let i = 0; i < 4; i++) s += A[Math.floor(Math.random() * A.length)]; return rooms.has(s) ? code() : s; };
const send = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };

function makeRoom() {
  const r = { code: code(), clients: new Map(), host: null, started: false, sim: null, timer: null, last: 0, acc: 0, created: Date.now() };
  rooms.set(r.code, r); return r;
}
function roster(r) {
  if (r.sim) return r.sim.roster();
  // lobby roster: an empty sim gives the slot layout
  const host = r.clients.get(r.host); const tmp = new MatchSim({ duration: 1, avatarSet: host && host.avatar ? host.avatar.set : 'kid' }); for (const c of r.clients.values()) if (c.team !== null) tmp.addHuman(c.id, c.team, c.role, c.name, c.avatar); return tmp.roster();
}
function broadcastRoster(r) { const ro = roster(r); for (const c of r.clients.values()) send(c.ws, { t: 'roster', roster: ro, host: r.host, started: r.started, code: r.code }); }
function startMatch(r) {
  const host = r.clients.get(r.host); r.sim = new MatchSim({ duration: MATCH_SECONDS, avatarSet: host && host.avatar ? host.avatar.set : 'kid' }); r.started = true;
  for (const c of r.clients.values()) if (c.team !== null) { const p = r.sim.addHuman(c.id, c.team, c.role, c.name, c.avatar); c.idx = p ? p.i : null; }
  broadcastRoster(r);
  for (const c of r.clients.values()) send(c.ws, { t: 'start', myIdx: c.idx, roster: r.sim.roster(), duration: MATCH_SECONDS });
  r.last = Date.now(); r.acc = 0;
  r.timer = setInterval(() => tick(r), 50);
}
function tick(r) {
  const now = Date.now(); r.acc += Math.min(0.25, (now - r.last) / 1000); r.last = now; const events = [];
  while (r.acc >= 1 / 60) { r.acc -= 1 / 60; events.push(...r.sim.step(1 / 60)); if (r.sim.phase === 'fulltime') break; }
  const snap = r.sim.snapshot();
  for (const c of r.clients.values()) {
    const mine = events.filter(e => e.type !== 'explain' || e.to === c.id);
    if (mine.length) send(c.ws, { t: 'ev', events: mine });
    send(c.ws, { t: 'state', s: snap });
  }
  if (r.sim.phase === 'fulltime') { clearInterval(r.timer); r.timer = null; for (const c of r.clients.values()) send(c.ws, { t: 'ft', report: r.sim.report(c.id), score: r.sim.score }); r.started = false; r.sim = null; broadcastRoster(r); }
}
function leave(ws) {
  const r = ws.room; if (!r) return; const c = r.clients.get(ws.id); r.clients.delete(ws.id); ws.room = null;
  if (r.sim) r.sim.removeHuman(ws.id);
  if (r.host === ws.id) r.host = r.clients.keys().next().value || null;
  if (!r.clients.size) { if (r.timer) clearInterval(r.timer); rooms.delete(r.code); return; }
  broadcastRoster(r); void c;
}

wss.on('connection', ws => {
  ws.id = 'u' + (nextId++); ws.isAlive = true; ws.on('pong', () => ws.isAlive = true);
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch (e) { return; }
    const r = ws.room;
    if (m.t === 'join') {
      leave(ws);
      const room = (m.code && rooms.get(String(m.code).toUpperCase())) || makeRoom();
      if (room.clients.size >= 22) return send(ws, { t: 'error', msg: 'Room is full' });
      const name = String(m.name || 'Player').slice(0, 14);
      const avatar = cleanAvatar(m.avatar);
      room.clients.set(ws.id, { id: ws.id, ws, name, team: null, role: null, idx: null, avatar }); ws.room = room; if (!room.host) room.host = ws.id;
      send(ws, { t: 'joined', id: ws.id, code: room.code, host: room.host, started: room.started }); broadcastRoster(room);
    } else if (!r) { return; }
    else if (m.t === 'pick') {
      const c = r.clients.get(ws.id), team = m.team === 1 ? 1 : 0, role = String(m.role || 'CM');
      const taken = [...r.clients.values()].some(o => o !== c && o.team === team && o.role === role);
      if (taken) return send(ws, { t: 'error', msg: 'That spot is taken' });
      c.team = team; c.role = role;
      if (r.sim) { r.sim.removeHuman(ws.id); const p = r.sim.addHuman(ws.id, team, role, c.name, c.avatar); c.idx = p ? p.i : null; send(ws, { t: 'start', myIdx: c.idx, roster: r.sim.roster(), duration: MATCH_SECONDS }); }
      broadcastRoster(r);
    } else if (m.t === 'start') { if (ws.id === r.host && !r.started) startMatch(r); }
    else if (m.t === 'input') { if (r.sim) r.sim.setInput(ws.id, m); }
    else if (m.t === 'leave') leave(ws);
  });
  ws.on('close', () => leave(ws));
});
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); } }, 15000);

server.listen(PORT, () => console.log(`⚽ Pitch Perfect running at http://localhost:${PORT}  (share your LAN IP for iPads)`));
