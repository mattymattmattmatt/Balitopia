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

  // Per-archetype weapon voices. One sound for 24 weapons made every Guardian
  // feel interchangeable — this is the cheapest way to make swapping bodies
  // register as a change in the ears as well as the eyes.
  const WEAPON_VOICE = {
    shot:  () => blip(520 + Math.random() * 120, 0.07, 'square', 0.05, -260),
    nova:  () => { noise(0.16, 0.15, 800); blip(300, 0.12, 'triangle', 0.07, -120); },
    chain: () => { blip(1200 + Math.random() * 300, 0.06, 'sawtooth', 0.05, -700); noise(0.05, 0.07, 4000); },
    beam:  () => { blip(880, 0.14, 'sine', 0.07, 420); noise(0.09, 0.05, 3000); },
    slash: () => { noise(0.09, 0.12, 2600); blip(420, 0.07, 'triangle', 0.05, -180); },
    orbit: () => blip(660, 0.05, 'sine', 0.04, 120),
    aura:  () => noise(0.1, 0.06, 400),
    trail: () => noise(0.07, 0.05, 1200),
  };

  // ------- public SFX -------
  const S = {
    // UI (no synth fallback — menus were silent before, sample is pure polish)
    uiClick()    { fileOr('ui_click', 0.55); },
    uiBack()     { fileOr('ui_back', 0.55); },
    uiSelect()   { if (ok('uiSelect', 40)) fileOr('ui_select', 0.45); },
    // combat
    shoot()      { if (ok('shoot', 70)) fileOr('shoot', 0.4, WEAPON_VOICE.shot); },
    weapon(kind) {
      if (!ok('w_' + kind, kind === 'orbit' || kind === 'aura' ? 160 : 70)) return;
      if (kind === 'shot' && sfxHas.shoot) return playSample('shoot', 0.4);
      const v = WEAPON_VOICE[kind] || WEAPON_VOICE.shot;
      if (!muted) v();
    },
    // THE missing sound: hit.mp3 shipped in the manifest and nothing ever
    // called this, so every hit in the game landed in silence.
    hit(crit) {
      if (crit) { fileOr('hit', 0.85, () => { noise(0.06, 0.16, 2600); blip(1100, 0.09, 'square', 0.09, -600); }); return; }
      if (!ok('hit', 45)) return;
      fileOr('hit', 0.42, () => noise(0.04, 0.07, 1500));
    },
    kill()       { if (ok('kill', 60)) fileOr('kill', 0.6, () => { blip(300, 0.12, 'sawtooth', 0.1, -180); noise(0.08, 0.1, 900); }); },
    bigKill()    { blip(160, 0.3, 'sawtooth', 0.2, -110); noise(0.25, 0.22, 500); },
    slam()       { duckFor(0.6); noise(0.3, 0.3, 380); blip(90, 0.34, 'sine', 0.28, -40); },
    hurt()       { fileOr('hurt', 0.8, () => blip(180, 0.2, 'sawtooth', 0.22, -90)); },
    gem()        { if (ok('gem', 60)) fileOr('gem', 0.5, () => blip(880 + Math.random() * 220, 0.08, 'sine', 0.12, 300)); },
    heal()       { fileOr('heal', 0.75, () => { playFile('assets/audio/sfx/catch.wav', 0.7); blip(520, 0.18, 'sine', 0.1, 260); }); },
    level()      { duckFor(0.9); fileOr('levelup', 0.85, () => [440, 554, 659, 880].forEach((f, i) => setTimeout(() => blip(f, 0.16, 'triangle', 0.2), i * 90))); },
    tierup()     { duckFor(1.0); fileOr('tierup', 0.9, () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.18, 'triangle', 0.22), i * 70))); },
    powerReady() { duckFor(0.7); fileOr('power_ready', 0.8, () => [784, 1047, 1319].forEach((f, i) => setTimeout(() => blip(f, 0.14, 'sine', 0.18), i * 60))); },
    powershot()  { duckFor(1.1); fileOr('powershot', 1.0, () => { blip(140, 0.5, 'sawtooth', 0.3, 120); noise(0.4, 0.3, 900); }); },
    cageHit()    { if (ok('cageHit', 90)) { blip(240, 0.06, 'square', 0.1, -60); noise(0.04, 0.1, 2200); } },
    possess()    { blip(200, 0.3, 'sine', 0.2, 700); blip(900, 0.25, 'sine', 0.12, -500); },
    nova()       { if (ok('nova', 120)) noise(0.18, 0.18, 700); },
    bossHit()    { if (ok('bossHit', 130)) noise(0.07, 0.12, 700); },
    // new cues
    dash()       { if (ok('dash', 90)) { noise(0.12, 0.11, 2200); blip(700, 0.09, 'sine', 0.06, 500); } },
    soul()       { blip(660, 0.16, 'sine', 0.1, 330); },
    wardUp()     { blip(440, 0.2, 'sine', 0.08, 220); },
    wardBreak()  { duckFor(0.5); noise(0.16, 0.2, 3000); blip(880, 0.16, 'triangle', 0.14, -420); },
    brink()      { duckFor(0.8); blip(120, 0.5, 'sine', 0.2, -40); },
    chest()      { duckFor(1.0); [523, 659, 784, 1047, 1319].forEach((f, i) => setTimeout(() => blip(f, 0.2, 'triangle', 0.2), i * 70)); },
    chestTick()  { blip(900 + Math.random() * 200, 0.05, 'square', 0.07); },
    eliteSpawn() { duckFor(0.7); blip(180, 0.4, 'sawtooth', 0.18, -60); noise(0.25, 0.14, 600); },
    surge()      { duckFor(0.9); noise(0.5, 0.22, 480); blip(110, 0.5, 'sine', 0.18, 60); },
    unlock()     { duckFor(1.2); [659, 784, 988, 1319, 1568].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.2), i * 90)); },
    combo(n)     { if (ok('combo', 60)) blip(500 + Math.min(900, n * 22), 0.05, 'sine', 0.06, 90); },
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

  let musicPath = null, duckUntil = 0, fadeTimer = null;
  // Duck the music under important cues so information cuts through the mix.
  function duckFor(sec) { duckUntil = Math.max(duckUntil, performance.now() + sec * 1000); }
  function musicTargetVol() {
    const ducked = performance.now() < duckUntil;
    return musicBase * musicVol * (ducked ? 0.42 : 1);
  }
  // Crossfade instead of a hard cut. Boss arrival — the biggest moment in a run
  // — used to have the emotional shape of changing a radio station.
  function playMusic(path, opts) {
    if (musicEl && musicPath === path && !musicEl.paused && !musicEl.ended) return;
    const { loop = true, vol = 0.55, fade = 1.0 } = opts || {};
    const old = musicEl;
    musicPath = path;
    musicBase = vol;
    const el = new Audio('assets/audio/' + path);
    el.loop = loop;
    el.volume = 0;
    el.muted = muted;
    el.play().catch(() => { if (loop) startMusic(); });
    el.onerror = () => { if (loop && musicEl === el) startMusic(); };
    musicEl = el;
    const t0 = performance.now();
    clearInterval(fadeTimer);
    fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - t0) / (fade * 1000));
      if (musicEl === el) el.volume = Math.max(0, Math.min(1, musicTargetVol() * k));
      if (old) { old.volume = Math.max(0, old.volume * (1 - k)); if (k >= 1) { old.pause(); } }
      if (k >= 1 && !old) clearInterval(fadeTimer), fadeTimer = setInterval(tickMusicVol, 120);
      if (k >= 1 && old) { clearInterval(fadeTimer); fadeTimer = setInterval(tickMusicVol, 120); }
    }, 40);
    stopSynthMusic();
  }
  function tickMusicVol() {
    if (musicEl) musicEl.volume = Math.max(0, Math.min(1, musicTargetVol()));
  }
  function stopMusic(fade) {
    stopSynthMusic();
    clearInterval(fadeTimer); fadeTimer = null;
    if (musicEl) {
      const el = musicEl;
      if (fade) {
        const t0 = performance.now(), v0 = el.volume;
        const f = setInterval(() => {
          const k = Math.min(1, (performance.now() - t0) / (fade * 1000));
          el.volume = Math.max(0, v0 * (1 - k));
          if (k >= 1) { el.pause(); clearInterval(f); }
        }, 40);
      } else el.pause();
      musicEl = null;
    }
    musicPath = null;
  }
  // Pause/resume for backgrounding — the loop used to keep playing during a call.
  function pauseAll() { if (musicEl) musicEl.pause(); if (previewEl) previewEl.pause(); }
  function resumeAll() { if (musicEl) musicEl.play().catch(() => {}); }

  function playFile(path, vol) {
    if (muted || sfxVol <= 0) return;
    let a = fileCache[path];
    if (!a) { a = new Audio(path); fileCache[path] = a; }
    a.volume = (vol === undefined ? 0.9 : vol) * sfxVol;
    try { a.currentTime = 0; } catch (e) {}
    a.play().catch(() => {});
  }

  // Hero theme previews. These are full 2-3 MB songs; tapping through the
  // roster used to stream tens of megabytes because pause() leaves the download
  // running. We now (a) prefer a short <id>_preview file when one exists,
  // (b) hard-ABORT the previous stream instead of just pausing it, and
  // (c) stop after a 12s hook so a long track never downloads in full.
  // See tools/encode_audio.sh for the pipeline that generates the small files.
  let previewStop = null;
  const previewHas = {};
  function preview(path) {
    stopPreview();
    // try the cheap preview cut first; fall back to the full track
    const short = path.replace(/\.(mp3|ogg|opus|m4a)$/, '_preview.$1');
    const src = previewHas[path] === false ? path : short;
    previewEl = new Audio();
    previewEl.preload = 'auto';
    previewEl.volume = 0.6 * musicVol;
    previewEl.muted = muted;
    previewEl.onerror = () => {
      if (previewHas[path] !== false && previewEl && previewEl.src.includes('_preview')) {
        previewHas[path] = false;                 // no cut on disk — use the full track once
        preview(path);
      }
    };
    previewEl.src = src;
    previewEl.play().catch(() => {});
    previewStop = setTimeout(stopPreview, 12000);  // never stream more than the hook
  }
  function stopPreview() {
    clearTimeout(previewStop); previewStop = null;
    if (previewEl) {
      previewEl.pause();
      // abort the in-flight fetch — pause() alone keeps downloading
      try { previewEl.removeAttribute('src'); previewEl.load(); } catch (e) {}
      previewEl = null;
    }
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
    toggleMute, setMuted, setMusicVol, setSfxVol, duckFor, pauseAll, resumeAll,
    get muted() { return muted; }, get musicVol() { return musicVol; }, get sfxVol() { return sfxVol; } };
})();
