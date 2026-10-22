/* Synth sound effects - no audio files needed. */
(function () {
  'use strict';
  let ctx = null, master = null, muted = false;
  try { muted = localStorage.getItem('pp-muted') === '1'; } catch (e) {}

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination);
    return true;
  }
  const now = () => ctx.currentTime;

  function tone({ f = 440, f2 = null, type = 'sine', t = 0.2, v = 0.4, delay = 0, attack = 0.005 }) {
    if (!ensure() || muted) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(f, now() + delay);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, now() + delay + t);
    g.gain.setValueAtTime(0, now() + delay); g.gain.linearRampToValueAtTime(v, now() + delay + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now() + delay + t);
    o.connect(g); g.connect(master); o.start(now() + delay); o.stop(now() + delay + t + 0.05);
  }
  function noise({ t = 0.3, v = 0.3, delay = 0, lp = 2000 }) {
    if (!ensure() || muted) return;
    const len = Math.floor(ctx.sampleRate * t), buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const s = ctx.createBufferSource(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    s.buffer = buf; f.type = 'lowpass'; f.frequency.value = lp; g.gain.value = v;
    s.connect(f); f.connect(g); g.connect(master); s.start(now() + delay);
  }

  // crowd: a looping, filtered noise bed that swells on goals
  let crowd = null;
  function crowdStart() {
    if (!ensure() || crowd) return;
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let last = 0; for (let i = 0; i < len; i++) { last = last * 0.97 + (Math.random() * 2 - 1) * 0.03; d[i] = last * 6; }
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), lfo = ctx.createOscillator(), lg = ctx.createGain();
    src.buffer = buf; src.loop = true; f.type = 'bandpass'; f.frequency.value = 500; f.Q.value = 0.6; g.gain.value = 0.10;
    lfo.frequency.value = 0.13; lg.gain.value = 0.04; lfo.connect(lg); lg.connect(g.gain);
    src.connect(f); f.connect(g); g.connect(master); src.start(); lfo.start(); crowd = { src, g, lfo };
  }
  function crowdStop() { if (!crowd) return; try { crowd.g.gain.linearRampToValueAtTime(0, now() + 0.6); crowd.src.stop(now() + 0.7); crowd.lfo.stop(now() + 0.7); } catch (e) {} crowd = null; }
  function crowdSwell(v = 0.4, t = 2.5) { if (!crowd) return; const g = crowd.g.gain; g.cancelScheduledValues(now()); g.setValueAtTime(g.value, now()); g.linearRampToValueAtTime(v, now() + 0.15); g.linearRampToValueAtTime(0.10, now() + t); }

  const Audio = {
    crowdStart, crowdStop, crowdSwell,
    heartbeat() { tone({ f: 70, f2: 45, type: 'sine', t: 0.16, v: 0.5 }); tone({ f: 65, f2: 40, type: 'sine', t: 0.14, v: 0.4, delay: 0.22 }); },
    hornGoal() { [220, 277, 330].forEach(f => tone({ f, type: 'sawtooth', t: 1.2, v: 0.08 })); },
    thud() { tone({ f: 120, f2: 50, type: 'triangle', t: 0.18, v: 0.45 }); },
    unlock() { ensure(); },
    get muted() { return muted; },
    toggle() { muted = !muted; try { localStorage.setItem('pp-muted', muted ? '1' : '0'); } catch (e) {} if (ensure()) master.gain.value = muted ? 0 : 0.5; return muted; },
    kick() { tone({ f: 160, f2: 60, type: 'triangle', t: 0.12, v: 0.6 }); noise({ t: 0.08, v: 0.25, lp: 1200 }); },
    receive() { tone({ f: 520, type: 'sine', t: 0.08, v: 0.25 }); },
    pop() { tone({ f: 700, f2: 1100, type: 'sine', t: 0.07, v: 0.25 }); },
    tick() { tone({ f: 1200, type: 'square', t: 0.03, v: 0.08 }); },
    good() { [523, 659, 784].forEach((f, i) => tone({ f, type: 'triangle', t: 0.18, v: 0.3, delay: i * 0.07 })); },
    perfect() { [523, 659, 784, 1046].forEach((f, i) => tone({ f, type: 'triangle', t: 0.25, v: 0.32, delay: i * 0.08 })); noise({ t: 0.4, v: 0.08, delay: 0.3, lp: 6000 }); },
    bad() { tone({ f: 220, f2: 110, type: 'sawtooth', t: 0.35, v: 0.25 }); },
    whistle() { for (let i = 0; i < 2; i++) { tone({ f: 2200, f2: 2300, type: 'square', t: 0.18, v: 0.12, delay: i * 0.22 }); tone({ f: 2900, type: 'sine', t: 0.18, v: 0.1, delay: i * 0.22 }); } },
    goal() { crowdSwell(0.45, 3); noise({ t: 1.6, v: 0.35, lp: 3500 }); [392, 523, 659, 784].forEach((f, i) => tone({ f, type: 'triangle', t: 0.5, v: 0.3, delay: 0.1 + i * 0.12 })); tone({ f: 1046, type: 'triangle', t: 0.9, v: 0.3, delay: 0.6 }); },
    combo(level) { tone({ f: 600 + level * 120, f2: 900 + level * 120, type: 'sine', t: 0.12, v: 0.25 }); },
    countdown() { tone({ f: 880, type: 'sine', t: 0.1, v: 0.3 }); },
    start() { tone({ f: 1320, type: 'sine', t: 0.35, v: 0.35 }); },
  };
  window.SFX = Audio;
})();
