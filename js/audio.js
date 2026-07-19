// ============================================================
// BALITOPIA — WebAudio: synthesized SFX + island battle loop
// ============================================================
'use strict';

const Sound = (() => {
  let ctx = null, master = null, musicGain = null, sfxGain = null;
  let muted = false, musicTimer = null, step = 0;
  let musicVol = 0.8, sfxVol = 1.0, musicBase = 0.55;   // 0..1 user volumes

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return true; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain(); master.gain.value = 0.85; master.connect(ctx.destination);
      sfxGain = ctx.createGain(); sfxGain.gain.value = 0.7 * sfxVol; sfxGain.connect(master);
      musicGain = ctx.createGain(); musicGain.gain.value = 0.28 * musicVol; musicGain.connect(master);
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

  // ------- optional SFX samples (assets/audio/sfx/<name>.mp3) -------
  // Enabled via assets/audio/sfx/manifest.json (a JSON array of names).
  // Add "<name>" there and drop <name>.mp3 in the folder → used automatically;
  // otherwise the synth voice below plays. Ships as [] so there are no 404s.
  // Full list + ElevenLabs prompts: SOUND_DESIGN.md
  const sfxHas = {}, sfxPool = {};
  function probeSfx() {
    fetch('assets/audio/sfx/manifest.json')
      .then(r => r.ok ? r.json() : [])
      .then(list => { if (Array.isArray(list)) list.forEach(n => sfxHas[n] = true); })
      .catch(() => {});
  }
  function playSample(name, vol) {
    const pool = sfxPool[name] || (sfxPool[name] = []);
    let a = pool.find(x => x.paused || x.ended);
    if (!a) {
      if (pool.length >= 5) a = pool[0];
      else { a = new Audio(`assets/audio/sfx/${name}.mp3`); pool.push(a); }
    }
    a.volume = vol == null ? 0.8 : vol;
    try { a.currentTime = 0; } catch (e) {}
    a.play().catch(() => {});
  }
  // play the sample if present, else the synth fallback
  const fileOr = (name, vol, synth) => {
    if (muted) return;
    if (sfxHas[name]) playSample(name, vol);
    else if (synth) synth();
  };

  // ------- public SFX -------
  const S = {
    // UI (no synth fallback — menus were silent before, sample is pure polish)
    uiClick()    { fileOr('ui_click', 0.55); },
    uiBack()     { fileOr('ui_back', 0.55); },
    uiSelect()   { if (ok('uiSelect', 40)) fileOr('ui_select', 0.45); },
    // combat
    shoot()      { if (ok('shoot', 70)) fileOr('shoot', 0.4, () => blip(520 + Math.random() * 120, 0.07, 'square', 0.05, -260)); },
    hit()        { if (ok('hit', 60)) fileOr('hit', 0.5, () => noise(0.05, 0.08, 1400)); },
    kill()       { if (ok('kill', 60)) fileOr('kill', 0.6, () => { blip(300, 0.12, 'sawtooth', 0.1, -180); noise(0.08, 0.1, 900); }); },
    bigKill()    { blip(160, 0.3, 'sawtooth', 0.2, -110); noise(0.25, 0.22, 500); },
    hurt()       { fileOr('hurt', 0.8, () => blip(180, 0.2, 'sawtooth', 0.22, -90)); },
    gem()        { if (ok('gem', 60)) fileOr('gem', 0.5, () => blip(880 + Math.random() * 220, 0.08, 'sine', 0.12, 300)); },
    // heal chain: generated heal.mp3 → the shipped catch.wav → synth chime
    heal()       { fileOr('heal', 0.75, () => { playFile('assets/audio/sfx/catch.wav', 0.7); blip(520, 0.18, 'sine', 0.1, 260); }); },
    level()      { fileOr('levelup', 0.85, () => [440, 554, 659, 880].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.2), i * 90))); },
    tierup()     { fileOr('tierup', 0.9, () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.22), i * 70))); },
    powerReady() { fileOr('power_ready', 0.8, () => [784, 1047, 1319].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'sine', 0.18), i * 60))); },
    powershot()  { fileOr('powershot', 1.0, () => { blip(140, 0.5, 'sawtooth', 0.3, 120); noise(0.4, 0.3, 900); }); },
    cageHit()    { if (ok('cageHit', 90)) { blip(240, 0.06, 'square', 0.1, -60); noise(0.04, 0.1, 2200); } },
    possess()    { blip(200, 0.3, 'sine', 0.2, 700); blip(900, 0.25, 'sine', 0.12, -500); },
    nova()       { if (ok('nova', 120)) noise(0.18, 0.18, 700); },
    bossHit()    { if (ok('bossHit', 130)) noise(0.07, 0.12, 700); },
  };
  probeSfx();

  // resume the WebAudio context after a phone lock / tab switch — otherwise
  // synth SFX silently die for the rest of the run
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  });

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
  function stopSynthMusic() {
    if (musicTimer) { clearInterval(musicTimer); musicTimer = null; }
  }

  // ------- file-based audio (the real soundtrack from assets/audio) -------
  let musicEl = null, previewEl = null;
  const fileCache = {};

  let musicPath = null;
  function playMusic(path, opts) {
    // path is relative to assets/audio/, e.g. 'music/title.mp3' or 'enemies/glob.mp3'
    // idempotent: if this track is already playing, leave it alone (don't restart)
    if (musicEl && musicPath === path && !musicEl.paused && !musicEl.ended) return;
    const { loop = true, vol = 0.55 } = opts || {};
    stopMusic();
    musicPath = path;
    musicBase = vol;
    const el = new Audio('assets/audio/' + path);
    el.loop = loop;
    el.volume = vol * musicVol;
    el.muted = muted;
    el.play().catch(() => { if (loop) startMusic(); });   // synth fallback (e.g. file:// runs)
    el.onerror = () => { if (loop && musicEl === el) startMusic(); };
    musicEl = el;
  }
  function stopMusic() {
    stopSynthMusic();
    if (musicEl) { musicEl.pause(); musicEl = null; }
    musicPath = null;
  }

  function playFile(path, vol) {
    if (muted || sfxVol <= 0) return;
    let a = fileCache[path];
    if (!a) { a = new Audio(path); fileCache[path] = a; }
    a.volume = (vol === undefined ? 0.9 : vol) * sfxVol;
    try { a.currentTime = 0; } catch (e) {}
    a.play().catch(() => {});
  }

  // hero theme preview on the select screen (one at a time)
  function preview(path) {
    stopPreview();
    previewEl = new Audio(path);
    previewEl.volume = 0.6 * musicVol;
    previewEl.muted = muted;
    previewEl.play().catch(() => {});
  }
  function stopPreview() {
    if (previewEl) { previewEl.pause(); previewEl = null; }
  }

  function setMuted(v) {
    muted = !!v;
    if (master) master.gain.value = muted ? 0 : 0.85;
    if (musicEl) musicEl.muted = muted;
    if (previewEl) previewEl.muted = muted;
    return muted;
  }
  function toggleMute() { return setMuted(!muted); }
  function setMusicVol(v) {
    musicVol = Math.max(0, Math.min(1, v));
    if (musicEl) musicEl.volume = musicBase * musicVol;
    if (musicGain) musicGain.gain.value = 0.28 * musicVol;
  }
  function setSfxVol(v) {
    sfxVol = Math.max(0, Math.min(1, v));
    if (sfxGain) sfxGain.gain.value = 0.7 * sfxVol;
  }

  return { ensure, sfx: S, startMusic, stopMusic, playMusic, playFile, preview, stopPreview,
    toggleMute, setMuted, setMusicVol, setSfxVol,
    get muted() { return muted; }, get musicVol() { return musicVol; }, get sfxVol() { return sfxVol; } };
})();
