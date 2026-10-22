/* Avatars: Kids set (bobbleheads) and Teen+ set (overhead figures). Rendering + per-player animation state. */
(function () {
  'use strict';
  const SKIN = ['#ffe0bd', '#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5a3a22'];
  const HAIR_COL = ['#1a120b', '#4a2e18', '#8b5a2b', '#d9b36a', '#101010', '#b23a2a', '#6f6f6f'];
  const KID_HAIR = ['short', 'spiky', 'curly', 'ponytail', 'braids', 'bun', 'long', 'buzz'];
  const TEEN_HAIR = ['fade', 'buzz', 'afro', 'ponytail', 'braids', 'locs', 'long', 'bun', 'hijab', 'bald'];
  const TEAM = { us: ['#7cbcff', '#2466e0', '#0c2f78', '#e8f1ff'], them: ['#ff8f8f', '#e23838', '#7a0f0f', '#ffe9e9'], gk: ['#ffe88a', '#f2a900', '#8a5a00', '#fff6d6'] };
  const DISPLAY = "'Barlow Condensed','Fredoka',sans-serif", ROUND = "'Fredoka','Baloo 2',sans-serif";
  const rr = (c, x, y, w, h, r) => { c.beginPath(); if (c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); };
  const shade = (hex, k) => { const n = parseInt(hex.slice(1), 16); const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`; };
  const wrapCol = o => HAIR_COL[o.hairCol] === '#101010' ? '#2b3a67' : HAIR_COL[o.hairCol];

  function randomAvatar(set, rng) {
    rng = rng || Math.random; const pick = a => a[Math.floor(rng() * a.length)]; const sex = rng() < 0.5 ? 'm' : 'f';
    const a = { set: set || 'kid', sex, skin: Math.floor(rng() * 6), hairCol: Math.floor(rng() * 7), beard: 'none', build: pick(['slim', 'athletic', 'athletic', 'strong']), extra: rng() < 0.12 ? pick(['band', 'tape']) : 'none', lashes: sex === 'f' };
    if (a.set === 'teen') { a.hair = sex === 'f' ? pick(['ponytail', 'braids', 'long', 'bun', 'hijab', 'afro', 'fade']) : pick(['fade', 'buzz', 'afro', 'locs', 'bun', 'bald', 'fade']); if (sex === 'm') { const r = rng(); a.beard = r < 0.2 ? 'beard' : r < 0.45 ? 'stubble' : 'none'; } }
    else { a.hair = sex === 'f' ? pick(['ponytail', 'braids', 'bun', 'long', 'curly', 'short']) : pick(['short', 'spiky', 'curly', 'buzz', 'short']); if (a.extra === 'tape') a.extra = 'glasses'; }
    return a;
  }
  function defaultAvatar(set, sex) { return { set: set || 'kid', sex: sex || 'm', skin: 1, hair: set === 'teen' ? (sex === 'f' ? 'ponytail' : 'fade') : (sex === 'f' ? 'ponytail' : 'short'), hairCol: 0, beard: 'none', build: 'athletic', extra: 'none', lashes: sex === 'f' }; }

  /* ---------------- Kids set (front view bobblehead) ---------------- */
  function drawKid(c, x, y, r, o, team, A, ex) {
    const s = r / 20, col = TEAM[team] || TEAM.us, skin = SKIN[o.skin], hair = HAIR_COL[o.hairCol];
    const pose = A.action || (A.speed > 0.6 ? 'run' : 'idle'), run = A.phase, face = A.face;
    c.save(); c.translate(x, y);
    const bob = pose === 'run' ? Math.sin(run * Math.PI * 2) * 1.2 * s : pose === 'idle' ? Math.sin(A.t * 2) * 0.5 * s : 0;
    const jump = pose === 'jump' ? -10 * s * Math.sin(Math.min(1, A.actionT / 0.6) * Math.PI) : 0;
    c.fillStyle = 'rgba(0,0,0,.28)'; c.beginPath(); c.ellipse(1 * s, 20 * s, 15 * s, 6 * s, 0, 0, Math.PI * 2); c.fill();
    if (ex.me) { const g = c.createRadialGradient(0, 4 * s, 10 * s, 0, 4 * s, 34 * s); g.addColorStop(0, 'rgba(182,255,59,.55)'); g.addColorStop(1, 'rgba(182,255,59,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 4 * s, 34 * s, 0, Math.PI * 2); c.fill(); }
    if (ex.hasBall) { c.strokeStyle = '#fff'; c.lineWidth = 2.5; c.beginPath(); c.arc(0, 4 * s, 27 * s, 0, Math.PI * 2); c.stroke(); }
    c.translate(0, jump); if (face < 0) c.scale(-1, 1);
    const legSwing = pose === 'run' ? Math.sin(run * Math.PI * 2) * 5 * s : 0, kick = pose === 'kick' ? 7 * s * Math.sin(Math.min(1, A.actionT / 0.4) * Math.PI) : 0;
    for (const side of [-1, 1]) { const lx = side * 5 * s, ly = 15 * s + (side > 0 ? legSwing : -legSwing) + (side > 0 ? -kick * 0.4 : 0); c.fillStyle = col[1]; c.fillRect(lx - 3 * s, 11 * s, 6 * s, 6 * s); c.fillStyle = '#fff'; c.fillRect(lx - 2.6 * s, ly, 5.2 * s, 5 * s); c.fillStyle = '#222'; c.beginPath(); c.ellipse(lx + (side > 0 ? kick : 0), ly + 6 * s, 4 * s, 2.4 * s, 0, 0, Math.PI * 2); c.fill(); }
    const g = c.createLinearGradient(-12 * s, 0, 12 * s, 0); g.addColorStop(0, col[0]); g.addColorStop(0.55, col[1]); g.addColorStop(1, col[2]);
    c.fillStyle = g; rr(c, -12 * s, -2 * s + bob, 24 * s, 16 * s, 7 * s); c.fill(); c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = 1.2 * s; c.stroke();
    const armSwing = pose === 'run' ? Math.sin(run * Math.PI * 2) * 4 * s : 0, up = pose === 'jump' ? -14 * s : 0;
    for (const side of [-1, 1]) { c.fillStyle = team === 'gk' ? '#ffd23f' : skin; c.beginPath(); c.arc(side * 14 * s, 6 * s + (side > 0 ? armSwing : -armSwing) + up + bob, (team === 'gk' ? 4.2 : 3.4) * s, 0, Math.PI * 2); c.fill(); if (team === 'gk') { c.strokeStyle = '#8a5a00'; c.lineWidth = 1; c.stroke(); } }
    c.fillStyle = '#fff'; c.font = `700 ${11 * s}px ${ROUND}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.save(); if (face < 0) c.scale(-1, 1); c.fillText(ex.number, 0, 7 * s + bob); c.restore();
    const hy = -12 * s + bob, hr = 11 * s;
    if (o.hair === 'curly') { c.fillStyle = hair; c.beginPath(); c.arc(0, hy - 1 * s, hr * 1.28, 0, Math.PI * 2); c.fill(); }
    if (o.hair === 'long') { c.fillStyle = hair; rr(c, -hr * 1.05, hy - 2 * s, hr * 2.1, hr * 1.45, 6 * s); c.fill(); }
    if (o.hair === 'ponytail') { c.strokeStyle = hair; c.lineWidth = 4.5 * s; c.lineCap = 'round'; c.beginPath(); c.moveTo(-hr * .7, hy - 2 * s); c.quadraticCurveTo(-hr * 1.6, hy + 2 * s, -hr * 1.2 + Math.sin(run * 6.28) * 2 * s, hy + 12 * s); c.stroke(); }
    if (o.hair === 'braids') { c.strokeStyle = hair; c.lineWidth = 3.4 * s; c.lineCap = 'round'; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * hr * .75, hy + 2 * s); c.lineTo(sd * hr * .95, hy + 13 * s); c.stroke(); c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(sd * hr * .95, hy + 13 * s, 1.6 * s, 0, 6.28); c.fill(); } }
    c.fillStyle = skin; c.beginPath(); c.arc(0, hy, hr, 0, Math.PI * 2); c.fill(); c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = hair;
    if (['short', 'ponytail', 'long', 'braids', 'bun'].includes(o.hair)) { c.beginPath(); c.arc(0, hy, hr * 1.02, Math.PI * 1.05, Math.PI * 1.95); c.quadraticCurveTo(0, hy - hr * .35, -hr * 1.0, hy - hr * .2); c.fill(); }
    if (o.hair === 'buzz') { c.globalAlpha = .55; c.beginPath(); c.arc(0, hy, hr, Math.PI * 1.08, Math.PI * 1.92); c.closePath(); c.fill(); c.globalAlpha = 1; }
    if (o.hair === 'spiky') { c.beginPath(); c.moveTo(-hr, hy - hr * .2); for (let i = 0; i < 6; i++) { const t = -1 + i * .4; c.lineTo((t + .2) * hr, hy - hr * 1.45); c.lineTo((t + .4) * hr, hy - hr * .75); } c.lineTo(hr, hy - hr * .2); c.closePath(); c.fill(); }
    if (o.hair === 'curly') { c.beginPath(); c.arc(0, hy, hr * 1.04, Math.PI * 1.05, Math.PI * 1.95); c.closePath(); c.fill(); }
    if (o.hair === 'bun') { c.beginPath(); c.arc(0, hy - hr * 1.15, hr * .42, 0, Math.PI * 2); c.fill(); }
    if (o.extra === 'band') { c.fillStyle = team === 'them' ? '#38e8ff' : '#ff4fa3'; c.fillRect(-hr, hy - hr * .55, hr * 2, 3 * s); }
    c.fillStyle = '#1b1b2a'; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * 3.8 * s, hy + 1 * s, 1.5 * s, 2 * s, 0, 0, Math.PI * 2); c.fill(); }
    if (o.lashes) { c.strokeStyle = '#1b1b2a'; c.lineWidth = 1 * s; for (const sd of [-1, 1]) { c.beginPath(); c.moveTo(sd * 2.4 * s, hy - 1.6 * s); c.lineTo(sd * 5.6 * s, hy - 2.4 * s); c.stroke(); } }
    c.strokeStyle = '#8a3a2a'; c.lineWidth = 1.2 * s; c.beginPath(); c.arc(0, hy + 3 * s, 3 * s, 0.15 * Math.PI, 0.85 * Math.PI); c.stroke();
    c.fillStyle = 'rgba(255,120,120,.35)'; for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * 6.5 * s, hy + 3.5 * s, 1.8 * s, 0, 6.28); c.fill(); }
    if (o.extra === 'glasses') { c.strokeStyle = '#222'; c.lineWidth = 1.2 * s; for (const sd of [-1, 1]) { c.beginPath(); c.arc(sd * 3.8 * s, hy + 1 * s, 3.2 * s, 0, 6.28); c.stroke(); } }
    c.restore();
  }

  /* ---------------- Teen+ set: overhead figure with a pose rig ---------------- */
  function teenPose(A) {
    const P = { lean: 0, legs: [0.15, -0.15], lift: [0, 0], arms: [-0.1, -0.1], out: [0, 0], shoulder: 0, prone: 0, yaw: 0, headTurn: 0, bob: 0 };
    const sp = Math.min(1, A.speed / 7.5), ph = A.phase * Math.PI * 2, s = Math.sin(ph);
    const run = (stride, swing, lean) => { P.legs = [s * stride, -s * stride]; P.lift = [Math.max(0, Math.cos(ph)), Math.max(0, -Math.cos(ph))]; P.arms = [-s * swing, s * swing]; P.lean = lean; P.shoulder = s * 0.14 * stride; };
    const k = A.actionT;
    switch (A.action) {
      case 'kick': { const T = Math.min(k, 0.6); if (T < 0.12) { P.legs = [0.45, -1.0]; P.lift = [0, 0.6]; P.arms = [0.5, -0.5]; P.shoulder = -0.2; } else if (T < 0.25) { const q = (T - 0.12) / 0.13; P.legs = [0.45, -1.0 + q * 2.5]; P.lift = [0, 0.9]; P.arms = [0.6, -0.6]; P.shoulder = -0.2 + 0.55 * q; P.lean = 0.2; } else { const q = (T - 0.25) / 0.35; P.legs = [0.45, 1.5 - q * 1.3]; P.lift = [0, 0.8 * (1 - q)]; P.arms = [0.5 * (1 - q), -0.5 * (1 - q)]; P.shoulder = 0.35 * (1 - q); P.lean = 0.15 * (1 - q); } return P; }
      case 'slide': { const q = k < 0.15 ? k / 0.15 : k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.4); P.prone = q; P.legs = [2.1 * q + 0.15 * (1 - q), -0.6 * q]; P.arms = [-0.9 * q, -0.4 * q]; P.out = [0.5 * q, 0.4 * q]; P.lean = 0.9 * q; P.yaw = 0.35 * q; return P; }
      case 'dive': { const side = A.actionSide || 1; const q = k < 0.3 ? k / 0.3 : k < 0.9 ? 1 : Math.max(0, 1 - (k - 0.9) / 0.4); P.yaw = -1.35 * q * side; P.prone = q; P.arms = [1.6 * q + 0.3 * (1 - q), 1.4 * q + 0.3 * (1 - q)]; P.out = [0.4, 0.1]; P.legs = [0.3, -1.4 * q]; P.lean = 0.9 * q; return P; }
      case 'jump': { run(0.8, 0, 0.25); P.arms = [0.3, 0.3]; P.out = [1.3, 1.3]; P.headTurn = Math.sin(A.t * 3) * 0.3; return P; }
    }
    if (sp < 0.08) { P.bob = Math.sin(A.t * 1.4) * 0.06; P.legs = [0.1 + Math.sin(A.t * 1.4) * 0.05, -0.1]; P.out = [0.15, 0.15]; P.arms = [-0.35, -0.35]; return P; }
    if (A.hasBall) run(0.3 + sp * 0.3, 0.25 + sp * 0.2, 0.1 + sp * 0.15); else run(0.35 + sp * 0.7, 0.3 + sp * 0.6, 0.08 + sp * 0.35);
    return P;
  }
  function drawTeen(c, x, y, r, o, team, A, ex) {
    const col = TEAM[team] || TEAM.us, skin = SKIN[o.skin], hair = HAIR_COL[o.hairCol], bw = o.build === 'strong' ? 1.15 : o.build === 'slim' ? 0.9 : 1, P = teenPose(A), heading = A.heading;
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.28)'; c.save(); c.rotate(heading + P.yaw); c.beginPath(); c.ellipse(0.25 * r + P.lean * r * 0.5, 0.35 * r, (1.2 + P.prone * 0.8) * r, (1.0 + (P.out[0] + P.out[1]) * 0.2) * r * bw, 0, 0, 6.28); c.restore(); c.fill();
    if (ex.me) { const g = c.createRadialGradient(0, 0, r, 0, 0, r * 2.6); g.addColorStop(0, 'rgba(182,255,59,.5)'); g.addColorStop(1, 'rgba(182,255,59,0)'); c.fillStyle = g; c.beginPath(); c.arc(0, 0, r * 2.6, 0, 6.28); c.fill(); }
    if (ex.hasBall) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 2; c.beginPath(); c.arc(0, 0, r * 1.5, 0, 6.28); c.stroke(); }
    c.rotate(heading + P.yaw);
    const sh = r * 0.95 * bw, hipW = r * 0.62 * bw, lean = P.lean * r;
    const feet = [];
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? -1 : 1, fx = -0.35 * r + P.legs[i] * r, fy = sd * (0.45 * r + P.out[i] * r * 0.4), lift = P.lift[i], hx = -0.3 * r + lean * 0.25, hy = sd * hipW * 0.55, kx = (hx + fx) / 2 + lift * 0.3 * r, ky = (hy + fy) / 2 + sd * lift * 0.22 * r;
      c.lineCap = 'round'; c.strokeStyle = shade(skin, .92); c.lineWidth = Math.max(1.6, 0.4 * r * bw); c.beginPath(); c.moveTo(hx, hy); c.lineTo(kx, ky); c.stroke();
      c.strokeStyle = skin; c.lineWidth = Math.max(1.5, 0.32 * r * bw); c.beginPath(); c.moveTo(kx, ky); c.lineTo(fx, fy); c.stroke();
      c.strokeStyle = col[1]; c.lineWidth = Math.max(1.5, 0.34 * r * bw); c.beginPath(); c.moveTo((kx + fx) / 2, (ky + fy) / 2); c.lineTo(fx, fy); c.stroke();
      feet.push([fx, fy, lift, Math.atan2(fy - ky, fx - kx)]);
    }
    const g = c.createLinearGradient(0, -sh, 0, sh); g.addColorStop(0, col[0]); g.addColorStop(.5, col[1]); g.addColorStop(1, shade(col[1], .8));
    const tx0 = -0.55 * r + P.prone * 0.4 * r, tx1 = 0.5 * r + lean + P.prone * 0.6 * r;
    c.save(); c.rotate(P.shoulder * 0.4);
    c.fillStyle = g; c.beginPath(); c.moveTo(tx0, -hipW); c.lineTo(tx1 - 0.3 * r, -sh); c.quadraticCurveTo(tx1 + 0.25 * r, 0, tx1 - 0.3 * r, sh); c.lineTo(tx0, hipW); c.quadraticCurveTo(tx0 - 0.25 * r, 0, tx0, -hipW); c.fill();
    c.strokeStyle = 'rgba(255,255,255,.45)'; c.lineWidth = 1; c.stroke();
    const g4 = c.createLinearGradient(tx0, 0, tx1, 0); g4.addColorStop(0, 'rgba(0,0,0,.22)'); g4.addColorStop(1, 'rgba(255,255,255,.08)'); c.fillStyle = g4; c.fill();
    c.fillStyle = col[3]; c.fillRect(tx1 - 0.55 * r, -sh, 0.12 * r, 2 * sh);
    c.save(); c.translate((tx0 + tx1) / 2 - 0.05 * r, 0); c.rotate(Math.PI / 2); c.fillStyle = col[3]; c.font = `700 ${Math.max(7, 1.05 * r)}px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ex.number, 0, 0); c.restore();
    if (o.extra === 'captain') { c.fillStyle = '#ffd23f'; c.fillRect(tx1 - 0.6 * r, -sh - 0.05 * r, 0.3 * r, 0.3 * r); }
    c.restore();
    for (const [fx, fy, lift, ang] of feet) { c.fillStyle = '#17171c'; c.beginPath(); c.ellipse(fx + Math.cos(ang) * 0.08 * r, fy + Math.sin(ang) * 0.08 * r, (0.44 + lift * 0.1) * r, (0.24 + lift * 0.06) * r, ang, 0, 6.28); c.fill(); c.fillStyle = 'rgba(255,255,255,.55)'; c.beginPath(); c.ellipse(fx + Math.cos(ang) * 0.3 * r, fy + Math.sin(ang) * 0.3 * r, 0.1 * r, 0.16 * r, ang, 0, 6.28); c.fill(); }
    for (let i = 0; i < 2; i++) {
      const sd = i === 0 ? -1 : 1, sx = tx1 - 0.35 * r, sy = sd * sh * 0.95, hx = sx - 0.2 * r + P.arms[i] * r, hy = sd * (sh * 1.15 + P.out[i] * r), ex2 = (sx + hx) / 2 - 0.2 * r * (1 - P.prone), ey = sd * (sh * 1.2 + P.out[i] * r * 0.5);
      c.strokeStyle = col[1]; c.lineWidth = Math.max(1.5, 0.36 * r * bw); c.lineCap = 'round'; c.beginPath(); c.moveTo(sx, sy); c.lineTo(ex2, ey); c.stroke();
      c.strokeStyle = skin; c.lineWidth = Math.max(1.5, 0.3 * r * bw); c.beginPath(); c.moveTo(ex2, ey); c.lineTo(hx, hy); c.stroke();
      if (o.extra === 'tape') { c.strokeStyle = '#fff'; c.lineWidth = Math.max(1.5, 0.32 * r); c.beginPath(); c.moveTo((ex2 + hx) / 2 + (hx - ex2) * .25, (ey + hy) / 2 + (hy - ey) * .25); c.lineTo(hx - (hx - ex2) * .12, hy - (hy - ey) * .12); c.stroke(); }
      c.fillStyle = team === 'gk' ? '#ffd23f' : skin; c.beginPath(); c.arc(hx, hy, (team === 'gk' ? 0.3 : 0.2) * r, 0, 6.28); c.fill(); if (team === 'gk') { c.strokeStyle = '#8a5a00'; c.lineWidth = 1; c.stroke(); }
    }
    const hr = 0.6 * r, hx = tx1 - 0.15 * r + (P.prone ? 0.35 * r : 0);
    c.strokeStyle = shade(skin, .85); c.lineWidth = Math.max(2, 0.5 * r); c.lineCap = 'butt'; c.beginPath(); c.moveTo(hx - hr * 1.1, 0); c.lineTo(hx - hr * .3, 0); c.stroke();
    c.save(); c.translate(hx, 0); c.rotate(P.headTurn);
    if (o.hair === 'ponytail') { c.strokeStyle = hair; c.lineWidth = 0.3 * r; c.lineCap = 'round'; c.beginPath(); c.moveTo(-hr * .6, 0); c.quadraticCurveTo(-hr * 1.6, Math.sin(A.t * 7) * 0.25 * r, -hr * 2.6, Math.sin(A.t * 7) * 0.35 * r); c.stroke(); }
    if (o.hair === 'long') { c.fillStyle = hair; c.beginPath(); c.ellipse(-hr * .9, 0, hr * 1.5, hr * 1.35, 0, 0, 6.28); c.fill(); }
    if (o.hair === 'braids' || o.hair === 'locs') { c.strokeStyle = hair; c.lineWidth = (o.hair === 'locs' ? 0.15 : 0.11) * r; c.lineCap = 'round'; for (let i = -2; i <= 2; i++) { c.beginPath(); c.moveTo(-hr * .5, i * hr * .35); c.lineTo(-hr * 2.0, i * hr * .55); c.stroke(); } }
    if (o.hair === 'afro') { c.fillStyle = hair; c.beginPath(); c.arc(0, 0, hr * 1.45, 0, 6.28); c.fill(); c.fillStyle = 'rgba(255,255,255,.08)'; c.beginPath(); c.arc(hr * .2, -hr * .2, hr * .9, 0, 6.28); c.fill(); }
    c.fillStyle = shade(skin, .95); for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(-hr * .1, sd * hr * 1.0, hr * .22, hr * .16, 0, 0, 6.28); c.fill(); }
    c.fillStyle = skin; c.beginPath(); c.arc(0, 0, hr, 0, 6.28); c.fill();
    c.fillStyle = shade(skin, .93); c.beginPath(); c.ellipse(hr * 1.02, 0, hr * .22, hr * .16, 0, 0, 6.28); c.fill();
    const hairR = o.hair === 'hijab' ? hr * 1.18 : hr * 1.02, faceDepth = o.hair === 'hijab' ? 0.78 : 0.82;
    const hairFill = () => { c.beginPath(); c.arc(0, 0, hairR, 0, 6.28); c.fill(); c.fillStyle = skin; c.beginPath(); c.arc(0, 0, hr, -0.95, 0.95); c.lineTo(hr * faceDepth, 0); c.closePath(); c.fill(); };
    if (o.hair === 'bald') { const g2 = c.createRadialGradient(hr * .1, -hr * .2, 0, 0, 0, hr); g2.addColorStop(0, 'rgba(255,255,255,.35)'); g2.addColorStop(1, 'rgba(0,0,0,.12)'); c.fillStyle = g2; c.beginPath(); c.arc(0, 0, hr, 0, 6.28); c.fill(); }
    else if (o.hair === 'buzz') { c.fillStyle = hair; c.globalAlpha = .6; hairFill(); c.globalAlpha = 1; }
    else if (o.hair === 'hijab') { c.fillStyle = wrapCol(o); hairFill(); c.strokeStyle = 'rgba(0,0,0,.2)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, hr * .75, 0.9, 5.4); c.stroke(); }
    else { c.fillStyle = hair; hairFill(); }
    if (!['bald', 'hijab', 'afro'].includes(o.hair)) { const g3 = c.createRadialGradient(-hr * .15, -hr * .2, 0, -hr * .1, 0, hr); g3.addColorStop(0, 'rgba(255,255,255,.22)'); g3.addColorStop(1, 'rgba(0,0,0,.18)'); c.fillStyle = g3; c.beginPath(); c.arc(0, 0, hairR, 0.95, 5.33); c.lineTo(hr * faceDepth, 0); c.closePath(); c.fill();
      if (['fade', 'bun', 'ponytail', 'long'].includes(o.hair)) { c.strokeStyle = 'rgba(0,0,0,.28)'; c.lineWidth = Math.max(1, hr * .08); c.beginPath(); c.moveTo(-hr * .85, -hr * .25); c.lineTo(hr * .55, -hr * .3); c.stroke(); }
      if (o.hair === 'fade') { c.strokeStyle = 'rgba(255,255,255,.14)'; c.lineWidth = Math.max(1, hr * .3); c.beginPath(); c.arc(0, 0, hr * .88, 1.3, 2.9); c.stroke(); c.beginPath(); c.arc(0, 0, hr * .88, 3.4, 5.0); c.stroke(); } }
    if (o.hair === 'bun') { c.fillStyle = shade(hair, .8); c.beginPath(); c.arc(-hr * .3, 0, hr * .4, 0, 6.28); c.fill(); }
    if (o.extra === 'band') { c.fillStyle = team === 'them' ? '#38e8ff' : '#ff4fa3'; c.fillRect(hr * .35, -hr * 1.02, hr * .2, hr * 2.04); }
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = 1; c.beginPath(); c.arc(0, 0, hairR, 0, 6.28); c.stroke();
    c.restore(); c.restore();
  }

  /* ---------------- Portrait (Teen+) and Kid portrait for pickers / lobby / report ---------------- */
  function drawPortrait(c, x, y, H, o, team, ex = {}) {
    if (o.set !== 'teen') { drawKid(c, x, y - H * 0.42, H * 0.3, o, team, { action: null, speed: 0, phase: 0, face: 1, t: 0, actionT: 0 }, { number: ex.number || 10, me: ex.me }); return; }
    const u = H / 8, bw = o.build === 'strong' ? 1.18 : o.build === 'slim' ? 0.88 : 1, col = TEAM[team] || TEAM.us, skin = SKIN[o.skin], hair = HAIR_COL[o.hairCol];
    c.save(); c.translate(x, y);
    c.fillStyle = 'rgba(0,0,0,.3)'; c.beginPath(); c.ellipse(0, 0.05 * u, 1.6 * u * bw, 0.45 * u, 0, 0, 6.28); c.fill();
    for (const sd of [-1, 1]) { const lx = sd * 0.42 * u * bw; c.fillStyle = skin; rr(c, lx - 0.3 * u, -3.3 * u, 0.6 * u, 2.2 * u, 0.25 * u); c.fill(); c.fillStyle = col[1]; rr(c, lx - 0.36 * u, -1.7 * u, 0.72 * u, 1.25 * u, 0.2 * u); c.fill(); c.fillStyle = col[3]; c.fillRect(lx - 0.36 * u, -1.0 * u, 0.72 * u, 0.12 * u); c.fillStyle = '#17171c'; c.beginPath(); c.ellipse(lx + sd * 0.05 * u, -0.25 * u, 0.5 * u, 0.3 * u, 0, 0, 6.28); c.fill(); c.fillStyle = '#fff'; c.beginPath(); c.ellipse(lx + sd * 0.1 * u, -0.3 * u, 0.22 * u, 0.08 * u, 0, 0, 6.28); c.fill(); }
    c.fillStyle = col[2]; rr(c, -0.95 * u * bw, -4.3 * u, 1.9 * u * bw, 1.5 * u, 0.3 * u); c.fill();
    const g = c.createLinearGradient(-1.2 * u, 0, 1.2 * u, 0); g.addColorStop(0, col[0]); g.addColorStop(.5, col[1]); g.addColorStop(1, shade(col[1], .75));
    c.fillStyle = g; c.beginPath(); c.moveTo(-1.25 * u * bw, -6.6 * u); c.lineTo(1.25 * u * bw, -6.6 * u); c.quadraticCurveTo(1.35 * u * bw, -5.5 * u, 1.0 * u * bw, -4.2 * u); c.lineTo(-1.0 * u * bw, -4.2 * u); c.quadraticCurveTo(-1.35 * u * bw, -5.5 * u, -1.25 * u * bw, -6.6 * u); c.fill();
    for (const sd of [-1, 1]) { const ax = sd * 1.35 * u * bw; c.fillStyle = col[1]; rr(c, ax - 0.4 * u, -6.55 * u, 0.8 * u, 1.1 * u, 0.3 * u); c.fill(); c.fillStyle = col[3]; c.fillRect(ax - 0.4 * u, -5.55 * u, 0.8 * u, 0.1 * u); c.strokeStyle = skin; c.lineWidth = 0.52 * u * (o.build === 'strong' ? 1.15 : 1); c.lineCap = 'round'; c.beginPath(); c.moveTo(ax, -5.6 * u); c.lineTo(ax + sd * 0.25 * u, -3.9 * u); c.stroke();
      if (team === 'gk') { c.fillStyle = '#ffd23f'; c.beginPath(); c.arc(ax + sd * 0.3 * u, -3.7 * u, 0.42 * u, 0, 6.28); c.fill(); c.strokeStyle = '#8a5a00'; c.lineWidth = 1; c.stroke(); } else { c.fillStyle = skin; c.beginPath(); c.arc(ax + sd * 0.3 * u, -3.75 * u, 0.32 * u, 0, 6.28); c.fill(); }
      if (o.extra === 'tape') { c.fillStyle = '#fff'; c.fillRect(ax + sd * 0.1 * u - 0.25 * u, -4.4 * u, 0.5 * u, 0.25 * u); } if (o.extra === 'captain' && sd === -1) { c.fillStyle = '#ffd23f'; rr(c, ax - 0.42 * u, -6.2 * u, 0.84 * u, 0.3 * u, 0.05 * u); c.fill(); } }
    c.strokeStyle = col[3]; c.lineWidth = 0.12 * u; c.beginPath(); c.moveTo(-0.45 * u, -6.6 * u); c.lineTo(0, -6.15 * u); c.lineTo(0.45 * u, -6.6 * u); c.stroke();
    c.fillStyle = col[3]; c.font = `700 ${1.3 * u}px ${DISPLAY}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(ex.number || 10, 0, -5.2 * u);
    c.fillStyle = shade(skin, .9); c.fillRect(-0.3 * u, -7.1 * u, 0.6 * u, 0.6 * u);
    const hy = -7.55 * u, hr = 0.56 * u;
    if (o.hair === 'afro') { c.fillStyle = hair; c.beginPath(); c.arc(0, hy - 0.05 * u, hr * 1.5, 0, 6.28); c.fill(); }
    if (o.hair === 'long') { c.fillStyle = hair; rr(c, -hr * 1.1, hy - hr * 0.9, hr * 2.2, hr * 2.9, hr * .5); c.fill(); }
    if (o.hair === 'hijab') { c.fillStyle = wrapCol(o); c.beginPath(); c.ellipse(0, hy + hr * 0.6, hr * 1.45, hr * 1.9, 0, 0, 6.28); c.fill(); }
    if (o.hair === 'ponytail') { c.strokeStyle = hair; c.lineWidth = 0.32 * u; c.lineCap = 'round'; c.beginPath(); c.moveTo(-hr * .9, hy); c.quadraticCurveTo(-hr * 1.6, hy + hr, -hr * 1.1, hy + hr * 2.6); c.stroke(); }
    if (o.hair === 'braids' || o.hair === 'locs') { c.strokeStyle = hair; c.lineWidth = (o.hair === 'locs' ? 0.16 : 0.12) * u; c.lineCap = 'round'; for (let i = -3; i <= 3; i++) { if (Math.abs(i) < 2 && o.hair === 'braids') continue; c.beginPath(); c.moveTo(i * hr * .32, hy - hr * .2); c.lineTo(i * hr * .4, hy + hr * 2.2); c.stroke(); } }
    c.fillStyle = skin; c.beginPath(); c.ellipse(0, hy, hr, hr * 1.12, 0, 0, 6.28); c.fill(); c.strokeStyle = 'rgba(0,0,0,.18)'; c.lineWidth = 1; c.stroke();
    c.fillStyle = hair;
    if (o.hair === 'fade') { c.beginPath(); c.ellipse(0, hy - hr * .45, hr * 1.02, hr * .7, 0, Math.PI, 0); c.fill(); c.globalAlpha = .45; c.beginPath(); c.ellipse(0, hy - hr * .1, hr * 1.02, hr * .55, 0, Math.PI * 1.1, Math.PI * 1.9); c.fill(); c.globalAlpha = 1; }
    if (o.hair === 'buzz') { c.globalAlpha = .55; c.beginPath(); c.ellipse(0, hy - hr * .35, hr * 1.0, hr * .72, 0, Math.PI, 0); c.fill(); c.globalAlpha = 1; }
    if (o.hair === 'afro') { c.beginPath(); c.ellipse(0, hy - hr * .35, hr * 1.05, hr * .8, 0, Math.PI, 0); c.fill(); }
    if (['ponytail', 'long', 'bun', 'braids', 'locs'].includes(o.hair)) { c.beginPath(); c.ellipse(0, hy - hr * .4, hr * 1.04, hr * .75, 0, Math.PI, 0); c.fill(); }
    if (o.hair === 'bun') { c.beginPath(); c.arc(0, hy - hr * 1.25, hr * .38, 0, 6.28); c.fill(); }
    if (o.hair === 'hijab') { c.fillStyle = wrapCol(o); c.beginPath(); c.ellipse(0, hy - hr * .3, hr * 1.12, hr * .85, 0, Math.PI, 0); c.fill(); c.fillRect(-hr * 1.1, hy - hr * .3, hr * .25, hr * 1.3); c.fillRect(hr * .85, hy - hr * .3, hr * .25, hr * 1.3); }
    if (o.extra === 'band') { c.fillStyle = team === 'them' ? '#38e8ff' : '#ff4fa3'; c.fillRect(-hr * 1.02, hy - hr * .55, hr * 2.04, hr * .2); }
    c.fillStyle = '#1a1a26'; for (const sd of [-1, 1]) { c.beginPath(); c.ellipse(sd * hr * .38, hy - hr * .05, hr * .1, hr * .13, 0, 0, 6.28); c.fill(); c.lineWidth = Math.max(1, hr * .09); c.strokeStyle = hair === '#d9b36a' ? '#8b5a2b' : hair; c.beginPath(); c.moveTo(sd * hr * .2, hy - hr * .35); c.lineTo(sd * hr * .58, hy - hr * (o.sex === 'f' ? .42 : .38)); c.stroke(); }
    c.strokeStyle = shade(skin, .72); c.lineWidth = Math.max(1, hr * .07); c.beginPath(); c.moveTo(0, hy - hr * .05); c.lineTo(-hr * .08, hy + hr * .32); c.lineTo(hr * .06, hy + hr * .34); c.stroke();
    c.strokeStyle = '#7a3a30'; c.lineWidth = Math.max(1, hr * .08); c.beginPath(); c.moveTo(-hr * .28, hy + hr * .62); c.quadraticCurveTo(0, hy + hr * .78, hr * .28, hy + hr * .62); c.stroke();
    if (o.beard === 'stubble' || o.beard === 'beard') { c.fillStyle = hair; c.globalAlpha = o.beard === 'stubble' ? .35 : .9; c.beginPath(); c.moveTo(-hr * .95, hy + hr * .25); c.quadraticCurveTo(-hr * .9, hy + hr * 1.25, 0, hy + hr * (o.beard === 'beard' ? 1.35 : 1.12)); c.quadraticCurveTo(hr * .9, hy + hr * 1.25, hr * .95, hy + hr * .25); c.quadraticCurveTo(hr * .7, hy + hr * .9, 0, hy + hr * .95); c.quadraticCurveTo(-hr * .7, hy + hr * .9, -hr * .95, hy + hr * .25); c.fill(); c.globalAlpha = 1; }
    c.restore();
  }

  /* ---------------- animation state per player ---------------- */
  const anims = new Map();
  function anim(key, x, y, now, extra = {}) {
    let A = anims.get(key);
    if (!A) { A = { x, y, vx: 0, vy: 0, speed: 0, heading: extra.heading ?? 0, phase: Math.random(), face: 1, action: null, actionT: 0, actionSide: 1, t: Math.random() * 10, last: now, hasBall: false }; anims.set(key, A); return A; }
    let dt = (now - A.last) / 1000; A.last = now; if (dt <= 0 || dt > 0.25) { A.x = x; A.y = y; return A; }
    const vx = (x - A.x) / dt, vy = (y - A.y) / dt; A.vx += (vx - A.vx) * 0.45; A.vy += (vy - A.vy) * 0.45; A.x = x; A.y = y;
    A.speed = Math.hypot(A.vx, A.vy); A.t += dt; A.hasBall = !!extra.hasBall;
    if (A.speed > 0.8) { const target = Math.atan2(A.vy, A.vx); let d = target - A.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; A.heading += d * Math.min(1, dt * (A.speed > 4 ? 9 : 6)); if (Math.abs(A.vx) > 0.6) A.face = A.vx > 0 ? 1 : -1; }
    else if (extra.faceTo) { const target = Math.atan2(extra.faceTo.y - y, extra.faceTo.x - x); let d = target - A.heading; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; A.heading += d * Math.min(1, dt * 3); }
    const cadence = A.speed < 0.5 ? 0 : 1.3 + A.speed * 0.17; A.phase = (A.phase + dt * cadence) % 1;
    if (A.action) { A.actionT += dt; const len = { kick: 0.6, jump: 1.6, slide: 1.1, dive: 1.3 }[A.action] || 0.6; if (A.actionT > len) A.action = null; }
    return A;
  }
  function action(key, kind, side) { const A = anims.get(key); if (!A) return; A.action = kind; A.actionT = 0; if (side !== undefined) A.actionSide = side; }
  function reset() { anims.clear(); }

  /* ---------------- unified draw used by the pitch ---------------- */
  function draw(c, x, y, r, o, team, A, ex) { if (o.set === 'teen') drawTeen(c, x, y, r, o, team, A, ex); else drawKid(c, x, y, r, o, team, A, ex); }

  // deterministic random avatars for non-match modes (keyed by e.g. "them-4")
  const cache = new Map();
  function forKey(key, set) { const k = key + '|' + set; if (!cache.has(k)) { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; let s = h || 1; const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; cache.set(k, randomAvatar(set, rng)); } return cache.get(k); }

  window.Avatars = { SKIN, HAIR_COL, KID_HAIR, TEEN_HAIR, randomAvatar, defaultAvatar, draw, drawKid, drawTeen, drawPortrait, anim, action, reset, forKey };
})();
