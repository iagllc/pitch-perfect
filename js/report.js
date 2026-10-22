/* Report card: a standalone, shareable HTML page built from the match results. */
(function () {
  'use strict';
  const PRACTICE = {
    offside: 'Striker Timing drill: play 5 rounds without a single flag.', offsidepos: 'Striker Timing drill: hover ON the line, not past it.', 't-off': 'Striker Timing drill: start your run when the ball is kicked.', 't-safe': 'Striker Timing drill: get closer to the line — level is onside.',
    position: 'Shape Shift drill: 60 seconds with 70%+ in position.', 'drill-far': 'Shape Shift drill: slide with the ball, stay in your lane.', 'drill-open': 'Shape Shift drill: be in your spot and the ball will find you.',
    crowding: 'In your next game count 10 steps between you and the nearest teammate.', 'drill-crowd': 'Make triangles: 10 steps from teammates.',
    intercepted: 'Throw-in drill: pick the teammate with a CLEAR lane.', tackled: 'Press vs Drop drill, then pass within 2 seconds when a defender is close.', longshot: 'Corner drill: get inside the box before you shoot.',
    't-through': 'Defender Trap drill: 5 traps in a row.', 't-half': 'Defender Trap drill: keep your line in your own half.', rolledpast: 'Move toward every pass meant for you.', 'drill-roll': 'Attack the ball when it is passed to you.',
    'throw-marked': 'Throw-in drill: throw to the player with space around him.', 'press-wrong': 'Press vs Drop drill: look at where the carrier is FACING.', 'drop-wrong': 'Press vs Drop drill: press when your team is set behind you.', 'corner-late': 'Corner drill: start deep, arrive as the ball arrives.', 'corner-camp': 'Corner drill: never stand still in the box.',
  };
  const DEFAULTS = ['Play one match as a defender to feel the offside trap.', 'Try the Corner drill: start deep, arrive late.', 'Beat your best "in position" score in Shape Shift.'];
  const esc = s => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

  const Report = {
    practice(lessons) { const out = []; for (const l of lessons || []) { const p = PRACTICE[l.key]; if (p && !out.includes(p)) out.push(p); if (out.length === 3) break; } for (const d of DEFAULTS) { if (out.length >= 3) break; out.push(d); } return out; },
    snapImage(snap) { try { const cv = document.createElement('canvas'); cv.width = 360; cv.height = 210; Explain.drawSnap(cv, snap); return cv.toDataURL('image/png'); } catch (e) { return null; } },
    build(d) {
      const date = new Date().toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
      const lessons = (d.lessons || []).slice(0, 4).map(l => ({ ...l, img: l.snap ? this.snapImage(l.snap) : null }));
      const practice = this.practice(d.lessons);
      const stars = '⭐'.repeat(d.stars || 0) + '☆'.repeat(3 - (d.stars || 0));
      return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Report card — ${esc(d.name)}</title>
<style>body{font-family:Fredoka,'Baloo 2',Nunito,'Avenir Next',system-ui,sans-serif;margin:0;background:#0b1020;color:#f4f7ff;padding:24px}.card{max-width:760px;margin:0 auto;background:linear-gradient(180deg,#182245,#0f1733);border:1px solid rgba(255,255,255,.14);border-radius:26px;padding:28px;box-shadow:0 18px 50px rgba(0,0,0,.45)}h1{margin:0;font-size:34px;background:linear-gradient(92deg,#b6ff3b,#38e8ff 50%,#ff4fa3);-webkit-background-clip:text;background-clip:text;color:transparent}.sub{color:#9fb0d8;margin:4px 0 18px}.row{display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px;margin:16px 0}.stat{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12);border-radius:16px;padding:12px;text-align:center}.stat b{display:block;font-size:28px}.stat span{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9fb0d8}.big{font-size:22px;font-weight:700;margin:10px 0}.stars{font-size:30px}h2{font-size:18px;margin:22px 0 10px;color:#ffd23f}.lesson{display:grid;grid-template-columns:150px 1fr;gap:12px;align-items:center;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:10px;margin-bottom:10px}.lesson img{width:150px;border-radius:10px;display:block}.lesson b{display:block;font-size:16px}.lesson span{color:#9fb0d8;font-size:14px}.todo{background:#fff;color:#0b1020;border-radius:16px;padding:14px 18px;font-weight:700}.todo li{margin:6px 0}.foot{margin-top:18px;font-size:12px;color:#9fb0d8;text-align:center}@media print{body{background:#fff;color:#111}.card{box-shadow:none;background:#fff;border-color:#ddd}.todo{border:1px solid #ddd}h1{color:#111;-webkit-text-fill-color:#111}.stat,.lesson{border-color:#ddd;background:#fafafa}.stat span,.lesson span,.sub,.foot{color:#555}}@media(max-width:520px){.lesson{grid-template-columns:1fr}.lesson img{width:100%}}</style></head>
<body><div class="card"><h1><span style="-webkit-text-fill-color:initial;color:initial">⚽</span> Report card: ${esc(d.name)}</h1><div class="sub">${esc(d.mode)} · ${esc(d.role || '')} · ${date}</div>
<div class="big">${esc(d.result || d.title || '')}</div><div class="stars">${stars}</div>
<div class="row">${(d.stats || []).map(s => `<div class="stat"><b>${esc(s.v)}</b><span>${esc(s.k)}</span></div>`).join('')}</div>
<h2>What the coach noticed</h2>${lessons.length ? lessons.map(l => `<div class="lesson">${l.img ? `<img src="${l.img}" alt="">` : '<div></div>'}<div><b>${esc(l.title)}</b><span>${esc(l.lesson)}</span></div></div>`).join('') : '<p>No mistakes flagged this game. Clean sheet of errors! 🤩</p>'}
<h2>3 things to practice</h2><div class="todo"><ol>${practice.map(p => `<li>${esc(p)}</li>`).join('')}</ol></div>
<div class="foot">Pitch Perfect · learn where to BE on the field</div></div></body></html>`;
    },
    open(d) { const html = this.build(d); const w = window.open('', '_blank'); if (w) { w.document.open(); w.document.write(html); w.document.close(); } else this.download(d); },
    download(d) { const blob = new Blob([this.build(d)], { type: 'text/html' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `pitch-perfect-report-${(d.name || 'player').replace(/\W+/g, '-')}.html`; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); },
  };
  window.Report = Report;
})();
