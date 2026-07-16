// ============================================================
// BALITOPIA — WebAudio: synthesized SFX + island battle loop
// ============================================================
'use strict';

const Sound = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let muted = false, musicTimer = null, step = 0;

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.7; sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.28; musicGain.connect(master);
      return true;
    } catch (e) { return false; }
  }

  function blip(freq, dur, type = 'square', vol = 0.2, slide = 0) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(sfxGain);
    o.start(t); o.stop(t + dur + 0.02);
  }

  function noise(dur, vol = 0.25, freq = 800) {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const n = ctx.createBufferSource();
    const buf = ctx.createBuffer(1, ctx.sampleRate * dur, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    n.buffer = buf;
    const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    n.connect(f); f.connect(g); g.connect(sfxGain);
    n.start(t);
  }

  // throttle guard — with 24 guardians firing, un-gated SFX would melt the mixer
  const lastT = {};
  function ok(k, ms) {
    const n = performance.now();
    if (n - (lastT[k] || 0) < ms) return false;
    lastT[k] = n; return true;
  }

  // ------- public SFX -------
  const S = {
    shoot()      { if (ok('shoot', 70)) blip(520 + Math.random() * 120, 0.07, 'square', 0.05, -260); },
    hit()        { if (ok('hit', 60)) noise(0.05, 0.08, 1400); },
    kill()       { if (ok('kill', 60)) { blip(300, 0.12, 'sawtooth', 0.1, -180); noise(0.08, 0.1, 900); } },
    bigKill()    { blip(160, 0.3, 'sawtooth', 0.2, -110); noise(0.25, 0.22, 500); },
    hurt()       { blip(180, 0.2, 'sawtooth', 0.22, -90); },
    gem()        { if (ok('gem', 60)) blip(880 + Math.random() * 220, 0.08, 'sine', 0.12, 300); },
    heal()       { blip(520, 0.18, 'sine', 0.15, 260); },
    level()      { [440, 554, 659, 880].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.2), i * 90)); },
    cageHit()    { if (ok('cageHit', 90)) { blip(240, 0.06, 'square', 0.1, -60); noise(0.04, 0.1, 2200); } },
    cageBreak()  { noise(0.3, 0.3, 1200); [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 100)); },
    possess()    { blip(200, 0.3, 'sine', 0.2, 700); blip(900, 0.25, 'sine', 0.12, -500); },
    nova()       { if (ok('nova', 120)) noise(0.18, 0.18, 700); },
    bossRoar()   { blip(70, 1.1, 'sawtooth', 0.35, 30); noise(0.9, 0.3, 300); },
    bossHit()    { if (ok('bossHit', 130)) noise(0.07, 0.12, 700); },
    victory()    { [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => blip(f, 0.35, 'triangle', 0.25), i * 150)); },
    defeat()     { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => blip(f, 0.4, 'sine', 0.22), i * 220)); },
  };

  // ------- music: 2-bar island battle loop -------
  const PENT = [261.6, 311.1, 349.2, 392.0, 466.2, 523.3, 622.3, 698.5]; // C minor pentatonic-ish
  const BASSLINE = [0, 0, 3, 0, 5, 5, 3, 2, 0, 0, 3, 0, 7, 5, 3, 2];

  function playStep() {
    if (!ctx || muted) return;
    const t = ctx.currentTime;
    const s = step % 16;
    // kick
    if (s % 4 === 0) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(120, t);
      o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
      o.connect(g); g.connect(musicGain); o.start(t); o.stop(t + 0.16);
    }
    // shaker
    if (s % 2 === 1) {
      const n = ctx.createBufferSource();
      const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      n.buffer = buf;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
      n.connect(f); f.connect(g); g.connect(musicGain); n.start(t);
    }
    // bass
    const b = ctx.createOscillator(), bg = ctx.createGain();
    b.type = 'triangle';
    b.frequency.value = PENT[BASSLINE[s]] / 2;
    bg.gain.setValueAtTime(0.16, t); bg.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    b.connect(bg); bg.connect(musicGain); b.start(t); b.stop(t + 0.18);
    // sparkle arp on offbeats of bar 2
    if (step % 32 >= 16 && s % 4 === 2) {
      const a = ctx.createOscillator(), ag = ctx.createGain();
      a.type = 'sine';
      a.frequency.value = PENT[(s + Math.floor(step / 16)) % 8] * 2;
      ag.gain.setValueAtTime(0.07, t); ag.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      a.connect(ag); ag.connect(musicGain); a.start(t); a.stop(t + 0.22);
    }
    step++;
  }

  function startMusic() {
    if (!ensure() || musicTimer) return;
    step = 0;
    musicTimer = setInterval(playStep, 145);
  }
  function stopMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }
  function toggleMute() {
    muted = !muted;
    if (master) master.gain.value = muted ? 0 : 0.85;
    return muted;
  }

  return { ensure, sfx: S, startMusic, stopMusic, toggleMute, get muted() { return muted; } };
})();
