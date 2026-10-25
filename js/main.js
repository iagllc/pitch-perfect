/* App shell: menus, lobby, HUD, overlays, game loop, input. */
(function () {
  'use strict';
  const $ = s => document.querySelector(s);
  const el = {
    menu: $('#menu'), game: $('#game'), lobby: $('#lobby'), stage: $('#stage'), canvas: $('#pitch'),
    score: $('#score'), scoreChip: $('#scoreChip'), timer: $('#timer'), timerLbl: $('#timerLbl'), timerChip: $('#timerChip'), combo: $('#combo'), comboChip: $('#comboChip'), possChip: $('#possChip'), poss: $('#poss'),
    board: $('#scoreboard'), coachText: $('#coachText'), bubble: $('#bubble'), passBtn: $('#passBtn'), verdict: $('#verdict'), toast: $('#toast'), rules: $('#rulePanel'),
    tutorial: $('#tutorial'), results: $('#results'), pause: $('#pause'), muteBtns: document.querySelectorAll('.muteBtn'),
  };
  const ROLES = [['GK', 'Keeper 🧤'], ['LB', 'Left Back'], ['LCB', 'Center Back (L)'], ['RCB', 'Center Back (R)'], ['RB', 'Right Back'], ['LCM', 'Left Mid'], ['CM', 'Center Mid'], ['RCM', 'Right Mid'], ['LW', 'Left Wing'], ['ST', 'Striker ⚽'], ['RW', 'Right Wing']];
  const settings = { role: 'CM', difficulty: 'rookie', team: 0, name: '', avatar: null, camera: 'full' };
  try { Object.assign(settings, JSON.parse(localStorage.getItem('pp-settings') || '{}')); } catch (e) {}
  const applyAvatar = () => {
    window.__myAvatar = settings.avatar || Avatars.defaultAvatar('kid', 'm'); window.__avatarSet = window.__myAvatar.set;
    const teen = window.__avatarSet === 'teen'; document.documentElement.dataset.theme = teen ? 'teen' : 'kid';
    const ps = document.getElementById('pauseSub'); if (ps) ps.textContent = teen ? 'Game paused.' : 'Take a breather, champ.';
    if (window.__app && window.__app.pitch) window.__app.pitch.cacheKey = '';
  };
  applyAvatar();
  const save = () => { try { localStorage.setItem('pp-settings', JSON.stringify(settings)); } catch (e) {} };
  const isPhone = () => Math.min(window.innerWidth, window.innerHeight) < 520 || Math.max(window.innerWidth, window.innerHeight) < 1000;
  if (isPhone() && !settings.cameraChosen) settings.camera = 'follow'; // small screens: follow the ball unless the player chose otherwise
  let rotateSkipped = false;
  // On an iPhone in Safari, "Add to Home Screen" is the only way to lose the tabs and bars for good: say so once.
  function homeScreenTip() {
    if (!PhoneView.active() || PhoneView.standalone() || settings.homeTipShown || !/iPhone|iPad|iPod/.test(navigator.userAgent)) return;
    settings.homeTipShown = true; save();
    setTimeout(() => app.toast('Tip: Share ⬆️ → "Add to Home Screen" plays full screen with no tabs 📱', 6000), 3000);
  }
  function updateRotate() { const inGame = document.getElementById('game').classList.contains('active') && window.__app && window.__app.running; const portrait = window.innerHeight > window.innerWidth && window.innerWidth < 700; document.getElementById('rotate').classList.toggle('show', inGame && portrait && !rotateSkipped); }

  const TUTORIALS = {
    guide: { title: 'First Game', icon: '🎓', color: 'lime', intro: 'A 60-second guided game. The ball waits for you, the coach talks you through it, nobody tackles.',
      rules: [['🏃', 'Move', T => T ? 'Drag anywhere on the left half of the screen.' : 'Arrow keys or WASD.'], ['⚽', 'Pass', T => T ? 'Point the joystick at a teammate and tap PASS.' : 'Hold a direction and press Space.'], ['🎯', 'Shoot', T => T ? 'Tap SHOOT.' : 'Press X.'], ['🚩', 'Offside line', 'You will learn it on the field, step by step.']], pick: 'guide' },
    throwin: { title: 'Throw-in Thinking', icon: '🙌', color: 'cyan', intro: 'You take the throw-in. Pick the teammate who is FREE, fast. Two rounds are rule questions.',
      rules: [['👀', 'Look for SPACE around a teammate.', 'A defender within 2 steps = marked = stolen ball.'], ['⏱️', 'Be quick.', 'Defenders get organized while you wait.'], ['🙌', 'Both hands, from behind the head.', 'Both feet on the ground, on or behind the line.'], ['🚩', 'No offside from a throw-in!', 'A long quick throw can catch defenders napping.']] },
    press: { title: 'Press vs Drop', icon: '🔥', color: 'pink', intro: 'They have the ball. You are the midfielder in front of the defense. Do you PRESS (go win it) or DROP (slow him down)?',
      rules: [['🔥', 'PRESS when…', 'his back is to goal, he is stuck on the sideline, the ball is away from his feet, or your team is set behind you.'], ['🛡️', 'DROP when…', 'he faces your goal with a free teammate beside him, or there is a hole behind you because your team is stretched.'], ['👀', 'Two questions, every time:', 'Where is he FACING? Is my team SET?'], ['⏱️', 'Decide in 4 seconds.', 'Hesitating is the worst choice of all.']] },
    corner: { title: 'Corner Attack', icon: '🚩', color: 'gold', intro: 'A corner is a race. Start deep, watch for the landing ring, then attack the ball so you get there first.',
      rules: [['🧍', 'Never stand still in the box.', 'A marker sticks to a player who stands still.'], ['🏃', 'Start deep, arrive late.', 'Sprint at the ring the moment the ball is kicked.'], ['🎯', 'Perfect timing = bonus.', 'Arrive exactly as the ball does.'], ['👀', 'Near post, far post, penalty spot.', 'The ring shows where the ball will land.']] },
    match: { title: 'Match vs AI', icon: '🏟️', color: 'cyan', intro: 'Real 11 v 11: pass, shoot, tackle and defend. Keep your shape, stay onside, and your coach will explain every mistake.',
      rules: [['🎮', T => T ? 'Drag on the left of the screen to move.' : 'Move with arrows / WASD.', T => T ? 'PASS goes to the teammate you are facing. SHOOT shoots.' : 'Space = PASS to the teammate you are facing. X = SHOOT.'], ['🟢', 'The glowing ring is YOUR spot.', 'Stay in it and the ball will find you.'], ['🚩', 'Watch the red offside line.', 'If you are past it when a pass is kicked, the whistle goes.'], ['🧢', 'Coach pops up when something goes wrong.', 'Read it, hit Got it, and fix it next time.']], pick: 'match' },
    spacing: { title: 'Shape Shift', icon: '🌍', color: 'lime', intro: 'Spacing drill. You control ONE player while the ball moves — keep the team’s shape.',
      rules: [['🌍', 'We have the ball? SPREAD OUT.', 'Make the field big so passes are easy.'], ['🧲', 'Lost the ball? SQUEEZE IN.', 'Get compact and close the gaps.'], ['🪢', 'Slide with the ball.', 'The whole team shifts toward the ball together.'], ['📏', 'Never crowd a teammate.', 'Stay about 10 steps apart. Make triangles!']], pick: 'spacing' },
    attack: { title: 'Offside: Striker', icon: '🎯', color: 'gold', intro: 'You are the striker. A player is OFFSIDE only if ALL THREE are true at the moment the ball is kicked:',
      rules: [['1️⃣', 'You are in the other team’s half.', 'In your own half you can never be offside.'], ['2️⃣', 'You are ahead of the ball.', 'Behind or level with the ball = never offside.'], ['3️⃣', 'You are past the 2nd-last defender.', 'The keeper counts as a defender. LEVEL = onside.'], ['⏱️', 'It is judged when the ball is KICKED.', 'Where you run to AFTER the kick does not matter.']], diagrams: true },
    defend: { title: 'Offside: Defender', icon: '🛡️', color: 'pink', intro: 'You move the back four as ONE line. The striker is offside only if ALL THREE are true when the pass is kicked:',
      rules: [['1️⃣', 'He is in YOUR half.', 'Push past halfway and the trap can never work.'], ['2️⃣', 'He is ahead of the ball.', ''], ['3️⃣', 'He is past your 2nd-last defender.', 'STEP UP so he is past your line when the ball is kicked = offside. DROP to cover if he is already running.'], ['👀', 'Watch for the yellow PASS COMING bar.', 'That is your moment to decide.']], diagrams: true },
  };

  const app = {
    pitch: null, fx: new FX(), sfx: window.SFX, mode: null, modeKey: null, running: false, paused: false, net: null, settings,
    toggleCamera() { settings.camera = settings.camera === 'follow' ? 'full' : 'follow'; settings.cameraChosen = true; save(); renderCamera(); this.toast(settings.camera === 'follow' ? 'Camera: follow the ball 🔍' : 'Camera: full field'); },
    setScore(n) { if (el.score.textContent !== String(n)) el.score.textContent = n; },
    setTimer(s) { const v = Math.max(0, Math.ceil(s)); el.timerLbl.textContent = 'Time'; el.timer.textContent = `${Math.floor(v / 60)}:${String(v % 60).padStart(2, '0')}`; el.timerChip.classList.toggle('hurry', v <= 10 && v > 0); },
    setTimerText(t) { el.timerLbl.textContent = 'Round'; el.timer.textContent = t.replace('Round ', ''); el.timerChip.classList.remove('hurry'); },
    setCombo(c) { el.comboChip.style.display = c === null ? 'none' : ''; if (c !== null) { el.combo.textContent = 'x' + c; el.comboChip.classList.remove('bump'); void el.comboChip.offsetWidth; el.comboChip.classList.add('bump'); } },
    setPossession(t) { el.possChip.style.display = t === null ? 'none' : ''; if (t) { el.possChip.className = 'chip possession ' + t; el.poss.textContent = t === 'us' ? 'WE have it — spread!' : 'THEY have it — squeeze!'; } },
    showScoreboard(on) { el.board.style.display = on ? '' : 'none'; el.scoreChip.style.display = on ? 'none' : ''; el.timerChip.style.display = on ? 'none' : ''; },
    setScoreboard(sc, t, dur) { const left = Math.max(0, Math.ceil((dur || 240) - t)); $('#sbBlue').textContent = sc[0]; $('#sbRed').textContent = sc[1]; $('#sbClock').textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`; $('#sbClock').classList.toggle('hurry', left <= 15); },
    setRules(r) { el.rules.style.display = r ? '' : 'none'; if (!r) return; const set = (id, on) => { const row = $('#' + id); row.classList.toggle('yes', on); row.querySelector('.mark').textContent = on ? '✓' : '✗'; }; set('r1', r.half); set('r2', r.ball); set('r3', r.line); const r4 = $('#r4'); r4.style.display = r.exception ? '' : 'none'; if (r.exception) { r4.classList.add('yes'); r4.querySelector('.mark').textContent = '✓'; r4.style.background = 'rgba(182,255,59,.15)'; r4.querySelector('.mark').style.background = '#b6ff3b'; r4.querySelector('.mark').style.color = '#06101f'; }
      const v = $('#rv'); v.textContent = r.exception ? '= NO OFFSIDE POSSIBLE ✓' : r.offside ? '= OFFSIDE POSITION 🚩' : '= ONSIDE ✓'; v.className = 'rule-verdict ' + (r.offside ? 'bad' : 'good'); $('#rpTitle').innerHTML = r.who === 'Striker' ? 'Is the <span>striker</span> offside right now?' : 'Are <span>you</span> offside right now?'; },
    coach(text, kind) { el.coachText.textContent = text; el.bubble.className = 'bubble ' + (kind || 'info'); void el.bubble.offsetWidth; el.bubble.classList.add('flash'); },
    verdict(word, why, kind) { el.verdict.className = 'show ' + kind; el.verdict.querySelector('.word').textContent = word; el.verdict.querySelector('.why').textContent = why; },
    hideVerdict() { el.verdict.className = ''; },
    showPass(b) { el.passBtn.classList.toggle('show', !!b && !Touch.enabled); },
    toast(t, ms) { el.toast.textContent = t; el.toast.classList.add('show'); clearTimeout(this._tt); this._tt = setTimeout(() => el.toast.classList.remove('show'), ms || 1600); },
    finish(r) { this.running = false; Touch.enable(false); this.lastReport = r.report || null; showResults(r); updateRotate(); },
    choices(list, cb, prompt) { const bar = $('#choiceBar'); bar.innerHTML = `${prompt ? `<div class="prompt">${prompt}</div>` : ''}<div class="btns">${list.map((c, i) => `<button class="btn big ${i % 2 ? 'pink' : 'cyan'}" data-i="${i}">${c.label}</button>`).join('')}</div>`; bar.classList.add('show'); bar.querySelectorAll('button').forEach(b => b.onclick = () => { this.sfx.pop(); cb(list[+b.dataset.i].key); }); },
    hideChoices() { const bar = $('#choiceBar'); bar.classList.remove('show'); bar.innerHTML = ''; },
    halftime(score, st, team, report) {
      const ov = $('#halftime'), mine = team === 0 ? 'Blue' : 'Red', bar = (a, b, la, lb) => `<div class="hbar"><span class="l">${la}</span><div class="track"><div class="b" style="width:${a}%"></div><div class="r" style="width:${b}%"></div></div><span class="r">${lb}</span></div>`;
      ov.innerHTML = `<div class="modal"><button class="modal-x" id="htX" aria-label="Close">✕</button><h2 class="gradient">HALFTIME</h2><div class="htscore"><span class="blue">BLUE</span> ${score[0]} – ${score[1]} <span class="red">RED</span></div>
        ${bar(st.poss[0], st.poss[1], st.poss[0] + '%', st.poss[1] + '%')}<div class="hlabel">possession</div>
        ${bar(st.shots[0] * 10, st.shots[1] * 10, st.shots[0], st.shots[1])}<div class="hlabel">shots</div>
        ${bar(st.passes[0], st.passes[1], st.passes[0], st.passes[1])}<div class="hlabel">passes</div>
        ${report ? `<div class="feedback"><div class="face">🧢</div><div>You (${mine}): ${report.shape}% in position so far, ${report.passes} passes, ${report.shots} shots. ${report.shape >= 60 ? 'Great shape — keep it up!' : 'Second half: stay in your ring more.'}</div></div>` : ''}
        <div class="refcall" id="refCall"></div>
        <p>Teams switch ends. Second half starts in a moment…</p><div class="actions"><button class="btn ghost" id="htClose">OK</button></div></div>`;
      ov.classList.add('active'); $('#htClose').onclick = $('#htX').onclick = () => this.hideHalftime();
      renderRefCall($('#refCall'), Rules.pick(null, 1)[0]);
    },
    hideHalftime() { $('#halftime').classList.remove('active'); },
  };

  // ---------- avatar picker ----------
  const AV_SKIN = Avatars.SKIN, AV_HAIRC = Avatars.HAIR_COL;
  let avReturn = 'menu';
  function openAvatar(returnTo) {
    avReturn = returnTo || 'menu'; app.sfx.unlock(); app.sfx.pop();
    const a = Object.assign({}, settings.avatar || Avatars.defaultAvatar('kid', 'm')); const el2 = $('#avatarUI');
    const seg = (id, items, cur) => `<div class="seg" id="${id}">${items.map(([v, l]) => `<button data-v="${v}" class="${cur === v ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const sw = (id, cols, cur) => `<div class="sw" id="${id}">${cols.map((col, i) => `<button data-v="${i}" class="${cur === i ? 'on' : ''}" style="background:${col}" aria-label="option ${i + 1}"></button>`).join('')}</div>`;
    const render = () => {
      const hairs = (a.set === 'teen' ? Avatars.TEEN_HAIR : Avatars.KID_HAIR).map(h => [h, h]); if (!hairs.some(h => h[0] === a.hair)) a.hair = a.set === 'teen' ? (a.sex === 'f' ? 'ponytail' : 'fade') : (a.sex === 'f' ? 'ponytail' : 'short');
      el2.innerHTML = `<div class="av-grid"><div><canvas id="avPortrait" width="300" height="320"></canvas><canvas id="avTop" width="300" height="110"></canvas></div><div class="av-controls">
        <div><span class="lbl">Set</span>${seg('avSet', [['kid', '🧒 Kids'], ['teen', '🧑 Teen+']], a.set)}</div>
        <div><span class="lbl">Player</span>${seg('avSex', [['m', a.set === 'teen' ? 'Male' : '👦 Boy'], ['f', a.set === 'teen' ? 'Female' : '👧 Girl']], a.sex)}</div>
        ${a.set === 'teen' ? `<div><span class="lbl">Build</span>${seg('avBuild', [['slim', 'Slim'], ['athletic', 'Athletic'], ['strong', 'Strong']], a.build)}</div>` : ''}
        <div><span class="lbl">Skin</span>${sw('avSkin', AV_SKIN, a.skin)}</div>
        <div><span class="lbl">Hair</span>${seg('avHair', hairs, a.hair)}</div>
        <div><span class="lbl">Hair color</span>${sw('avHairC', AV_HAIRC, a.hairCol)}</div>
        ${a.set === 'teen' ? `<div><span class="lbl">Facial hair</span>${seg('avBeard', [['none', 'None'], ['stubble', 'Stubble'], ['beard', 'Beard']], a.beard)}</div>` : ''}
        <div><span class="lbl">Extra</span>${seg('avExtra', a.set === 'teen' ? [['none', 'None'], ['band', 'Headband'], ['tape', 'Wrist tape'], ['captain', 'Captain band']] : [['none', 'None'], ['band', 'Headband'], ['glasses', 'Glasses']], a.extra)}</div>
        <div><span class="lbl">Camera</span>${seg('avCam', [['full', 'Full field'], ['follow', '🔍 Follow the ball']], settings.camera)}</div>
        <div class="actions" style="justify-content:flex-start"><button class="btn big" id="avSave">Save ✓</button><button class="btn ghost" id="avRandom">🎲 Surprise me</button></div></div></div>`;
      const bind = (id, key, isNum) => { const box = $('#' + id); if (!box) return; box.querySelectorAll('button').forEach(b => b.onclick = () => { const v = isNum ? +b.dataset.v : b.dataset.v; if (key === 'camera') { settings.camera = v; settings.cameraChosen = true; save(); } else { a[key] = v; if (key === 'sex') { a.lashes = v === 'f'; a.hair = a.set === 'teen' ? (v === 'f' ? 'ponytail' : 'fade') : (v === 'f' ? 'ponytail' : 'short'); if (v === 'f') a.beard = 'none'; } } app.sfx.pop(); render(); }); };
      bind('avSet', 'set'); bind('avSex', 'sex'); bind('avBuild', 'build'); bind('avSkin', 'skin', true); bind('avHair', 'hair'); bind('avHairC', 'hairCol', true); bind('avBeard', 'beard'); bind('avExtra', 'extra'); bind('avCam', 'camera');
      $('#avRandom').onclick = () => { Object.assign(a, Avatars.randomAvatar(a.set)); app.sfx.pop(); render(); };
      $('#avSave').onclick = () => { settings.avatar = Object.assign({}, a); save(); applyAvatar(); Avatars.reset(); app.sfx.good(); renderMenuAvatar(); if (avReturn === 'lobby') { show(el.lobby); if (app.net) app.net.send({ t: 'avatar', avatar: settings.avatar }); } else show(el.menu); };
      drawAvatarPreview(a);
    };
    render(); show($('#avatar'));
  }
  function drawAvatarPreview(a) {
    const cv = $('#avPortrait'); if (!cv) return; const c = cv.getContext('2d'); grassBg(c, 300, 320); Avatars.drawPortrait(c, 150, a.set === 'teen' ? 275 : 190, a.set === 'teen' ? 225 : 240, a, 'us', { number: 10, me: true });
    c.font = `700 22px ${getComputedStyle(document.body).fontFamily}`; c.textAlign = 'center'; c.textBaseline = 'bottom'; c.lineWidth = 4; c.strokeStyle = 'rgba(0,0,0,.6)'; c.fillStyle = '#b6ff3b'; c.strokeText((settings.name || 'YOU').toUpperCase(), 150, 312); c.fillText((settings.name || 'YOU').toUpperCase(), 150, 312);
    previewAvatar = a;
  }
  let previewAvatar = null, avT = 0;
  function grassBg(c, w, h) { c.fillStyle = '#1d6b35'; c.fillRect(0, 0, w, h); for (let i = 0; i < 5; i++) { c.fillStyle = i % 2 ? 'rgba(255,255,255,.04)' : 'rgba(0,0,0,.05)'; c.fillRect(i * w / 5, 0, w / 5 + 1, h); } }
  function avatarTopFrame(dt) {
    const cv = $('#avTop'); if (!cv || !previewAvatar || !$('#avatar').classList.contains('active')) return; avT += dt; const c = cv.getContext('2d'); grassBg(c, 300, 110);
    c.fillStyle = 'rgba(255,255,255,.65)'; c.font = '600 12px ' + getComputedStyle(document.body).fontFamily; c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('On the field (actual size)', 10, 8);
    const ang = avT * 1.2, x = 150 + Math.cos(ang) * 70, y = 64 + Math.sin(ang) * 22;
    const A = Avatars.anim('__preview', x, y, performance.now(), { hasBall: false }); Avatars.draw(c, x, y, 11, previewAvatar, 'us', A, { me: true, hasBall: false, number: 10 });
  }
  function renderMenuAvatar() { const cv = $('#menuAvatar'); if (!cv) return; const c = cv.getContext('2d'); c.clearRect(0, 0, cv.width, cv.height); const a = window.__myAvatar; Avatars.drawPortrait(c, 40, a.set === 'teen' ? 92 : 62, a.set === 'teen' ? 80 : 90, a, 'us', { number: 10 }); $('#menuAvatarName').textContent = settings.name ? settings.name : 'Your player'; $('#menuAvatarSet').textContent = a.set === 'teen' ? 'Teen+ set' : 'Kids set'; renderCamera(); }
  function renderCamera() { document.querySelectorAll('.camBtn').forEach(b => { b.textContent = settings.camera === 'follow' ? '🎥 Camera: follow ball' : '🎥 Camera: full field'; b.title = 'Switch camera (Z key)'; }); }

  // ---------- Ref's call (one rule question, inline) ----------
  function renderRefCall(box, card, onDone) {
    if (!box || !card) return;
    box.innerHTML = `<div class="rc-kicker">🧑‍⚖️ REF'S CALL</div><div class="rc-q">${card.q}</div><div class="rc-a">${card.a.map((a, i) => `<button class="btn ghost small" data-i="${i}">${a}</button>`).join('')}</div>`;
    box.querySelectorAll('button').forEach(b => b.onclick = () => { const right = +b.dataset.i === card.ok; Rules.record(card.id, right); app.sfx[right ? 'good' : 'bad'](); box.querySelectorAll('button').forEach(x => { x.disabled = true; if (+x.dataset.i === card.ok) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); }); const w = document.createElement('div'); w.className = 'rc-why ' + (right ? 'good' : 'bad'); w.textContent = (right ? '✓ Correct. ' : '✗ Not quite. ') + card.why; box.appendChild(w); onDone && onDone(right); });
  }
  // ---------- rule book screen ----------
  function openRules() {
    app.sfx.unlock(); app.sfx.pop(); const el2 = $('#rulesUI'); const prog = Rules.progress, iq = Rules.refIQ();
    const groups = Object.entries(Rules.TAGS).map(([tag, label]) => `<div class="rb-group"><h3>${label}</h3>${Rules.RULES.filter(r => r.tag === tag).map(r => { const p = prog[r.id]; const st = p ? (p.right > 0 ? 'known' : 'missed') : 'new'; return `<details class="rb-rule ${st}"><summary><span class="rb-mark">${st === 'known' ? '✓' : st === 'missed' ? '!' : '·'}</span>${r.title}</summary><p>${r.why}</p><p class="rb-lesson">💡 ${r.lesson}</p></details>`; }).join('')}</div>`).join('');
    el2.innerHTML = `<div class="rb-head"><div><b>${Rules.learned()}</b> of ${Rules.RULES.length} rules learned${iq !== null ? ` · Ref IQ <b>${iq}%</b>` : ''}</div><button class="btn big" id="rbQuiz">🧑‍⚖️ Quiz me (5)</button></div><div id="rbQuizBox"></div><div class="rb-groups">${groups}</div>`;
    $('#rbQuiz').onclick = () => { const cards = Rules.pick(null, 5); let i = 0, right = 0; const box = $('#rbQuizBox'); const next = () => { if (i >= cards.length) { box.innerHTML = `<div class="refcall"><div class="rc-kicker">RESULT</div><div class="rc-q">${right} of ${cards.length} correct${right === cards.length ? ' — perfect! 🏆' : ''}</div><div class="rc-a"><button class="btn small" id="rbAgain">Again</button></div></div>`; $('#rbAgain').onclick = () => openRules(); return; } box.innerHTML = `<div class="refcall"><div class="rc-count">${i + 1} / ${cards.length}</div></div>`; const inner = box.firstChild; const card = cards[i++]; renderRefCall(inner, card, ok => { if (ok) right++; const b = document.createElement('button'); b.className = 'btn small'; b.textContent = 'Next ▶'; b.style.marginTop = '10px'; b.onclick = next; inner.appendChild(b); }); }; next(); };
    show($('#rules'));
  }

  // ---------- screens ----------
  function show(screen) { document.querySelectorAll('.screen').forEach(s => s.classList.remove('active')); screen.classList.add('active'); updateRotate(); }
  function rolePicker(id, cur, roles) { return `<div class="picker" id="${id}">${(roles || ROLES).map(r => `<button data-role="${r[0]}" class="${cur === r[0] ? 'on' : ''}">${r[1]}</button>`).join('')}</div>`; }
  function openTutorial(key) {
    if (!settings.avatar) { pendingKey = key; avReturn = 'menu'; openAvatar('menu'); const btnWait = setInterval(() => { if (settings.avatar) { clearInterval(btnWait); openTutorial(pendingKey); } }, 300); return; }
    app.sfx.unlock(); app.sfx.pop();
    const t = TUTORIALS[key]; app.modeKey = key;
    const drillRoles = ROLES.filter(r => r[0] !== 'GK');
    el.tutorial.innerHTML = `<div class="modal wide"><button class="modal-x" id="tutX" aria-label="Close">✕</button>
      <div style="font-size:54px">${t.icon}</div>
      <h2 class="gradient">${t.title}</h2><p>${t.intro}</p>
      <div class="rules">${t.rules.map(r => { const T = Touch.isTouchDevice(), f = v => typeof v === 'function' ? v(T) : v; return `<div class="rule"><div class="em">${r[0]}</div><div><b>${f(r[1])}</b><span>${f(r[2])}</span></div></div>`; }).join('')}</div>
      ${t.diagrams ? `<div class="diagrams"><div><canvas id="dg1" width="220" height="130"></canvas><span class="good">LEVEL = onside ✓</span></div><div><canvas id="dg2" width="220" height="130"></canvas><span class="bad">Past the line = OFFSIDE 🚩</span></div><div><canvas id="dg3" width="220" height="130"></canvas><span class="good">Behind the ball = onside ✓</span></div></div>` : ''}
      ${t.pick === 'guide' ? `<p style="margin-top:14px"><b style="color:var(--text)">Your position</b></p>${rolePicker('rolePick', ['ST', 'CM', 'LW', 'RW', 'LCM', 'RCM'].includes(settings.role) ? settings.role : 'ST', ROLES.filter(r => ['ST', 'CM', 'LW', 'RW', 'LCM', 'RCM'].includes(r[0])))}` : ''}
      ${t.pick === 'match' ? `<p style="margin-top:14px"><b style="color:var(--text)">Your team</b></p><div class="seg" id="teamPick"><button data-t="0" class="${settings.team === 0 ? 'on' : ''}">🔵 Blue</button><button data-t="1" class="${settings.team === 1 ? 'on' : ''}">🔴 Red</button></div>
        <p style="margin-top:14px"><b style="color:var(--text)">Your position</b></p>${rolePicker('rolePick', settings.role)}` : ''}
      ${t.pick === 'spacing' ? `<p style="margin-top:14px"><b style="color:var(--text)">Pick your position</b></p>${rolePicker('rolePick', settings.role === 'GK' ? 'CM' : settings.role, drillRoles)}
        <p style="margin-top:14px"><b style="color:var(--text)">Helper ring</b></p><div class="seg" id="diffPick">${[['rookie', 'Rookie: always on'], ['pro', 'Pro: fades'], ['legend', 'Legend: hidden']].map(d => `<button data-d="${d[0]}" class="${settings.difficulty === d[0] ? 'on' : ''}">${d[1]}</button>`).join('')}</div>` : ''}
      <div class="actions"><button class="btn ghost" id="tutBack">Back</button><button class="btn big ${t.color}" id="tutPlay">PLAY ▶</button></div>
    </div>`;
    el.tutorial.classList.add('active'); show(el.game);
    if (t.diagrams) drawOffsideDiagrams();
    el.tutorial.querySelectorAll('#rolePick button').forEach(b => b.onclick = () => { settings.role = b.dataset.role; save(); el.tutorial.querySelectorAll('#rolePick button').forEach(x => x.classList.toggle('on', x === b)); app.sfx.pop(); });
    el.tutorial.querySelectorAll('#diffPick button').forEach(b => b.onclick = () => { settings.difficulty = b.dataset.d; save(); el.tutorial.querySelectorAll('#diffPick button').forEach(x => x.classList.toggle('on', x === b)); app.sfx.pop(); });
    el.tutorial.querySelectorAll('#teamPick button').forEach(b => b.onclick = () => { settings.team = +b.dataset.t; save(); el.tutorial.querySelectorAll('#teamPick button').forEach(x => x.classList.toggle('on', x === b)); app.sfx.pop(); });
    $('#tutBack').onclick = $('#tutX').onclick = () => { el.tutorial.classList.remove('active'); show(el.menu); };
    $('#tutPlay').onclick = () => { if (PhoneView.active()) PhoneView.enterFullscreen(); el.tutorial.classList.remove('active'); startGame(key); homeScreenTip(); }; // the Play tap is the gesture that lets a phone go full screen
  }
  function drawOffsideDiagrams() {
    const reds = (lineX) => [{ x: 103, y: 34, team: 1, gk: true }, { x: lineX, y: 20, team: 1, label: '2nd-last' }, { x: lineX + 1, y: 44, team: 1 }, { x: lineX - 8, y: 12, team: 1 }];
    const base = (att, ball, extra) => ({ players: [...reds(80), { x: 62, y: 40, team: 0 }, { ...att, team: 0, me: true, label: 'YOU' }], ball, dir: 1, lineX: 80, ...extra });
    Explain.drawSnap($('#dg1'), base({ x: 80, y: 30 }, { x: 63, y: 40 }));
    Explain.drawSnap($('#dg2'), base({ x: 86, y: 30 }, { x: 63, y: 40 }, { arrows: [{ from: { x: 63, y: 40 }, to: { x: 86, y: 30 } }] }));
    Explain.drawSnap($('#dg3'), base({ x: 84, y: 30 }, { x: 88, y: 40 }, { lineX: 80 }));
  }
  function startGame(key, netOpts) {
    Avatars.reset(); app.pitch.setCamera(null); applyAvatar();
    app.sfx.unlock(); app.sfx.start(); app.fx = new FX(); app.hideVerdict(); el.results.classList.remove('active'); app.showScoreboard(false); app.setRules(null); app.hideChoices(); app.hideHalftime(); Explain.reset(); el.scoreChip.style.display = ''; document.activeElement && document.activeElement.blur && document.activeElement.blur();
    if (app.mode && app.mode.stop) app.mode.stop();
    if (key === 'spacing') { app.mode = new SpacingGame(app); app.mode.start({ role: settings.role === 'GK' ? 'CM' : settings.role, difficulty: settings.difficulty, duration: 90 }); }
    else if (key === 'attack' || key === 'defend') { app.mode = new OffsideTrainer(app); app.mode.start({ variant: key }); }
    else if (key === 'match') { app.mode = new MatchClient(app); app.mode.start({ mode: 'local', team: settings.team, role: settings.role, name: settings.name || 'You', duration: 240, avatar: window.__myAvatar }); }
    else if (key === 'guide') { app.mode = new MatchClient(app); app.mode.start({ mode: 'guide', team: 0, role: ['ST', 'CM', 'LW', 'RW', 'LCM', 'RCM'].includes(settings.role) ? settings.role : 'ST', name: settings.name || 'You', avatar: window.__myAvatar }); }
    else if (Drills[key]) { app.mode = new Drills[key](app); app.mode.start(); }
    else if (key === 'online') { app.mode = new MatchClient(app); app.mode.start({ mode: 'net', ...netOpts }); }
    app.modeKey = key; show(el.game); app.pitch.resize(); app.running = true; app.paused = false; last = performance.now(); updateRotate();
  }
  function showResults(r) {
    el.results.innerHTML = `<div class="modal"><button class="modal-x" id="resX" aria-label="Close">✕</button>
      <h2 class="gradient">${r.title}</h2>
      <div class="stars">${[0, 1, 2].map(i => `<span class="s" data-i="${i}">⭐</span>`).join('')}</div>
      <div class="bigscore">${r.score}</div><p>points</p>
      <div class="stats">${r.stats.map(s => `<div class="stat"><div class="v">${s.v}</div><div class="k">${s.k}</div></div>`).join('')}</div>
      <div class="feedback"><div class="face">${r.feedback.face}</div><div>${r.feedback.text}</div></div>
      ${r.lessons && r.lessons.length ? `<div class="lessons"><b>Lessons from this game</b>${r.lessons.map(l => `<div class="lesson-row">📌 <span>${l.title.replace(/[^\w\s!'—–-]+$/g, '')}</span> — ${l.lesson}</div>`).join('')}</div>` : ''}
      <div class="actions"><button class="btn ghost" id="resMenu">Menu</button>${r.report ? `<button class="btn ghost" id="resReport">📄 Report card</button>` : ''}<button class="btn big" id="resAgain">${r.next ? r.nextLabel : app.modeKey === 'online' ? 'Back to lobby ▶' : 'Play again ▶'}</button></div>
    </div>`;
    el.results.classList.add('active');
    r.stars > 0 && app.fx.confetti(Logic.FIELD.halfway, 20, 120);
    el.results.querySelectorAll('.s').forEach((s, i) => { if (i < r.stars) setTimeout(() => { s.classList.add('lit'); app.sfx.good(); }, 400 + i * 350); });
    if (r.stars === 3) setTimeout(() => app.sfx.goal(), 1500);
    $('#resMenu').onclick = $('#resX').onclick = () => { el.results.classList.remove('active'); leaveToMenu(); };
    $('#resAgain').onclick = () => { el.results.classList.remove('active'); if (r.next) { settings.role = settings.role === 'GK' ? 'ST' : settings.role; startGame(r.next); return; } if (app.modeKey === 'online') { app.mode = null; show(el.lobby); } else startGame(app.modeKey); };
    if (r.report) { r.report.name = r.report.name && r.report.name !== 'You' ? r.report.name : (settings.name || 'Player'); r.report.stars = r.stars; $('#resReport').onclick = () => { app.sfx.pop(); Report.open(r.report); }; }
  }
  function leaveToMenu() { app.running = false; if (app.mode && app.mode.stop) app.mode.stop(); app.mode = null; app.hideChoices(); app.hideHalftime(); el.scoreChip.style.display = ''; app.showPass(false); Touch.enable(false); app.setRules(null); el.pause.classList.remove('active'); if (app.net) { app.net.close(); app.net = null; } show(el.menu); }
  function togglePause() { if (!app.mode || !app.running || app.modeKey === 'online') return; app.paused = !app.paused; el.pause.classList.toggle('active', app.paused); app.sfx.pop(); last = performance.now(); }

  // ---------- online lobby ----------
  const lob = { code: $('#lobbyCode'), link: $('#lobbyLink'), teams: $('#lobbyTeams'), status: $('#lobbyStatus'), start: $('#lobbyStart'), join: $('#lobbyJoin'), name: $('#lobbyName'), codeIn: $('#lobbyCodeIn'), setup: $('#lobbySetup'), room: $('#lobbyRoom') };
  let lobbyState = { roster: null, host: null, started: false, team: null, role: null }; let pendingKey = null;
  async function openOnline(prefillCode) {
    app.sfx.unlock();
    if (!settings.avatar) { openAvatar('menu'); const w = setInterval(() => { if (settings.avatar) { clearInterval(w); openOnline(prefillCode); } }, 300); return; }
    if (!Net.available()) { el.tutorial.innerHTML = `<div class="modal"><div style="font-size:54px">🌐</div><h2 class="gradient">Online needs the server</h2><p>You opened the game as a file. To play online, run <b>npm start</b> in the game folder and open <b>http://localhost:8080</b> (or your laptop’s IP address on the iPad). Then this button creates a room.</p><div class="actions"><button class="btn" id="tutBack">OK</button></div></div>`; el.tutorial.classList.add('active'); show(el.game); $('#tutBack').onclick = () => { el.tutorial.classList.remove('active'); show(el.menu); }; return; }
    show(el.lobby); lob.setup.style.display = ''; lob.room.style.display = 'none'; lob.name.value = settings.name || ''; lob.codeIn.value = prefillCode || ''; lob.status.textContent = '';
  }
  async function joinRoom(code) {
    settings.name = lob.name.value.trim().slice(0, 14) || 'Player'; save();
    lob.status.textContent = 'Connecting…';
    try { app.net = new Net(); await app.net.connect(); } catch (e) { lob.status.textContent = 'Could not reach the server. Is it running?'; return; }
    const net = app.net; lobbyState = { roster: null, host: null, started: false, team: null, role: null };
    net.on('joined', m => { lob.setup.style.display = 'none'; lob.room.style.display = ''; lob.code.textContent = m.code; const url = location.origin + location.pathname + '?room=' + m.code; lob.link.textContent = url; lob.link.href = url; lobbyState.host = m.host; lobbyState.started = m.started; history.replaceState(null, '', '?room=' + m.code); });
    net.on('roster', m => { lobbyState.roster = m.roster; lobbyState.host = m.host; lobbyState.started = m.started; renderLobby(); });
    net.on('error', m => app.toast(m.msg));
    net.on('start', m => { const me = m.roster[m.myIdx]; if (!me) return; startGame('online', { net, myIdx: m.myIdx, roster: m.roster, team: me.team, role: me.role, name: settings.name, duration: m.duration }); app.mode.duration = m.duration; });
    net.on('close', () => { if (app.modeKey === 'online' && app.running) { app.toast('Disconnected from server'); leaveToMenu(); } else if (el.lobby.classList.contains('active')) { lob.status.textContent = 'Disconnected.'; lob.setup.style.display = ''; lob.room.style.display = 'none'; } });
    net.send({ t: 'join', code: code || undefined, name: settings.name, avatar: settings.avatar || window.__myAvatar });
  }
  function renderLobby() {
    const r = lobbyState.roster, me = app.net.id; if (!r) return;
    lob.teams.innerHTML = [0, 1].map(t => `<div class="team-col t${t}"><h3>${t === 0 ? '🔵 Blue' : '🔴 Red'}</h3>${ROLES.map(([role, label]) => { const slot = r.find(p => p.team === t && p.role === role); const taken = slot && slot.human; const mine = taken && slot.human === me; return `<button class="slot ${taken ? 'taken' : ''} ${mine ? 'mine' : ''}" data-t="${t}" data-r="${role}" ${taken && !mine ? 'disabled' : ''}>${label}<span>${taken ? (mine ? 'YOU' : slot.hname) : 'AI'}</span></button>`; }).join('')}</div>`).join('');
    lob.teams.querySelectorAll('.slot').forEach(b => b.onclick = () => { app.net.send({ t: 'pick', team: +b.dataset.t, role: b.dataset.r }); lobbyState.team = +b.dataset.t; lobbyState.role = b.dataset.r; app.sfx.pop(); });
    const isHost = lobbyState.host === me, picked = r.some(p => p.human === me), humans = r.filter(p => p.human).length;
    lob.start.style.display = isHost && !lobbyState.started ? '' : 'none'; lob.start.disabled = !picked;
    lob.status.textContent = lobbyState.started ? (picked ? 'Match in progress — you are in!' : 'Match in progress: pick a spot to jump in.') : isHost ? (picked ? `${humans} player${humans > 1 ? 's' : ''} ready. Press Start when everyone has a spot.` : 'Pick your spot, then start the match.') : (picked ? 'Waiting for the host to start…' : 'Pick a spot on a team.');
  }

  // ---------- loop ----------
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    avatarTopFrame(dt);
    if (!app.mode || !el.game.classList.contains('active')) return;
    if (app.running && !app.paused) { app.mode.update(dt); app.fx.update(dt); }
    const c = app.pitch.ctx; c.save();
    if (app.fx.shake > 0) c.translate((Math.random() - .5) * app.fx.shake * 12, (Math.random() - .5) * app.fx.shake * 12);
    app.mode.draw(); c.restore();
  }

  // ---------- input ----------
  function bindInput() {
    const cv = el.canvas;
    const send = (type, e) => { if (app.mode && app.running && !app.paused && !Touch.enabled) app.mode.onPointer(type, app.pitch.eventToM(e)); };
    cv.addEventListener('pointerdown', e => { cv.setPointerCapture(e.pointerId); app.sfx.unlock(); send('down', e); });
    cv.addEventListener('pointermove', e => send('move', e)); cv.addEventListener('pointerup', e => send('up', e)); cv.addEventListener('pointercancel', e => send('up', e));
    const keyish = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'Enter', 'KeyX', 'KeyE', 'ShiftLeft', 'ShiftRight', 'KeyB', 'KeyC', 'KeyO', 'Digit1', 'Digit2', 'Digit3']);
    window.addEventListener('keydown', e => {
      if (!el.game.classList.contains('active') || el.tutorial.classList.contains('active') || el.results.classList.contains('active')) return;
      if (Explain.current && Explain.current.blocking && (e.code === 'Space' || e.code === 'Enter')) { e.preventDefault(); Explain.hide(); return; }
      if (e.code === 'Escape' || e.code === 'KeyP') { togglePause(); return; }
      if (e.code === 'KeyM') { toggleMute(); return; }
      if (e.code === 'KeyZ') { app.toggleCamera(); return; }
      if (keyish.has(e.code)) { e.preventDefault(); if (!e.repeat && app.mode && app.running && !app.paused) app.mode.onKey(e.code, true); }
    });
    window.addEventListener('keyup', e => { if (e.code === 'Space' && el.game.classList.contains('active')) e.preventDefault(); if (keyish.has(e.code) && app.mode) app.mode.onKey(e.code, false); });
    el.passBtn.onclick = () => { if (app.mode && app.mode.requestPass) app.mode.requestPass(); };
    $('#pauseBtn').onclick = togglePause; $('#resumeBtn').onclick = togglePause; $('#pauseX').onclick = togglePause;
    $('#quitBtn').onclick = () => { leaveToMenu(); };
    $('#menuBtn').onclick = () => { if (app.running && !confirm('Quit this game?')) return; leaveToMenu(); };
    document.querySelectorAll('[data-mode]').forEach(b => b.onclick = () => b.dataset.mode === 'online' ? openOnline() : openTutorial(b.dataset.mode));
    el.muteBtns.forEach(b => b.onclick = toggleMute); renderMute();
    document.querySelectorAll('.camBtn').forEach(b => b.onclick = () => app.toggleCamera()); renderCamera();
    $('#menuAvatarBtn').onclick = () => openAvatar('menu'); $('#menuRulesBtn').onclick = openRules; document.querySelectorAll('.fsBtn').forEach(b => b.onclick = () => PhoneView.toggleFullscreen()); $('#rulesBack').onclick = () => show(el.menu); $('#lobbyAvatarBtn').onclick = () => openAvatar('lobby'); $('#avBack').onclick = () => show(avReturn === 'lobby' ? el.lobby : el.menu); renderMenuAvatar();
    $('#lobbyCreate').onclick = () => joinRoom(null); lob.join.onclick = () => joinRoom(lob.codeIn.value.trim().toUpperCase());
    lob.start.onclick = () => app.net && app.net.send({ t: 'start' });
    $('#lobbyBack').onclick = leaveToMenu; $('#lobbyCopy').onclick = () => { try { navigator.clipboard.writeText(lob.link.href); app.toast('Link copied!'); } catch (e) {} };
    const relayout = () => { PhoneView.apply(app.pitch); app.pitch && app.pitch.resize(); updateRotate(); };
    window.addEventListener('resize', relayout); window.addEventListener('orientationchange', () => setTimeout(relayout, 300));
    $('#rotateSkip').onclick = () => { rotateSkipped = true; updateRotate(); };
    document.addEventListener('visibilitychange', () => { if (document.hidden && app.running && !app.paused) togglePause(); });
  }
  function toggleMute() { app.sfx.toggle(); renderMute(); }
  function renderMute() { el.muteBtns.forEach(b => b.textContent = app.sfx.muted ? '🔇' : '🔊'); }

  // ---------- boot ----------
  window.addEventListener('DOMContentLoaded', () => {
    app.pitch = new Pitch(el.canvas, el.stage); Touch.init(el.stage); PhoneView.apply(app.pitch);
    const vm = document.querySelector('meta[name="app-version"]'); if (vm) $('#appVersion').textContent = 'v' + vm.content; // so a phone can tell which build it is running
    bindInput(); show(el.menu); requestAnimationFrame(frame);
    const room = new URLSearchParams(location.search).get('room'); if (room && Net.available()) openOnline(room.toUpperCase());
    window.__app = app;
  });
})();
