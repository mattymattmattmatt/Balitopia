// ============================================================
// BALITOPIA — Guardians of the Broken Cages
// Vampire-survivors-style horde game. Landscape mobile first.
// ============================================================
'use strict';

(() => {

// ---------------- Constants ----------------
const VIEW_H = 540;                 // logical viewport height (world px) — reference only
const VIEW_AREA = 540 * 1000;       // every device sees the SAME amount of world
const WORLD = 5200;                 // world is WORLD x WORLD
const CELL = 88;                    // spatial hash cell
const MAX_ENEMIES = 300;
const MAX_PROJ = 400;
const MAX_GEMS = 500;
const MAX_PARTS = 420;
const DASH_CD = 6;                  // seconds
const DASH_DIST = 190;
const DASH_IFRAME = 0.32;

// Quality presets — auto-selected from a boot benchmark, overridable in Settings.
// dpr is the single biggest lever: it scales EVERY full-screen fill quadratically.
// 1.75 on a 3x display is visually indistinguishable from 2 and ~23% cheaper.
const QUALITY = {
  high:     { parts: 1.0, statusFx: 40, dpr: 1.75, light: 1, decor: 1.0, trails: 1 },
  balanced: { parts: 0.6, statusFx: 22, dpr: 1.5,  light: 1, decor: 0.7, trails: 1 },
  battery:  { parts: 0.3, statusFx: 10, dpr: 1.25, light: 0, decor: 0.45, trails: 0 },
};
let QL = QUALITY.high;

// ---------------- Canvas ----------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d', { alpha: false });
let cw = 0, ch = 0, viewScale = 1, viewW = 1000, viewH = VIEW_H, dpr = 1;
// half-res offscreen buffer for the additive light/glow pass
const lightCv = document.createElement('canvas');
const lightCtx = lightCv.getContext('2d');

let resizePending = false;
function resize() {
  resizePending = false;
  const nd = Math.min(QL.dpr, window.devicePixelRatio || 1);
  const nw = Math.round(window.innerWidth), nh = Math.round(window.innerHeight);
  // Fit by AREA, not height: a 21:9 phone used to see ~30% more world than a
  // 4:3 tablet, which matters on a shared daily-challenge leaderboard.
  viewScale = Math.max(0.55, Math.min(1.7, Math.sqrt(nw * nh / VIEW_AREA)));
  viewW = nw / viewScale; viewH = nh / viewScale;
  if (nw === cw && nh === ch && nd === dpr) return;
  cw = nw; ch = nh; dpr = nd;
  canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr);
  lightCv.width = Math.max(1, Math.round(cw * 0.5)); lightCv.height = Math.max(1, Math.round(ch * 0.5));
}
const queueResize = () => { if (!resizePending) { resizePending = true; requestAnimationFrame(resize); } };
window.addEventListener('resize', queueResize);
window.addEventListener('orientationchange', () => { queueResize(); setTimeout(resize, 260); });
if (window.visualViewport) window.visualViewport.addEventListener('resize', queueResize);
resize();

// ---------------- Input ----------------
const keys = {};
const inRun = () => player && !G.over && $('hud') && !$('hud').classList.contains('hidden');
window.addEventListener('keydown', e => {
  keys[e.code] = true;
  // only own the keys during a run — menus keep normal keyboard behaviour
  if (e.code === 'Space' && G.running) { e.preventDefault(); powershot(); }
  if ((e.code === 'Escape' || e.code === 'KeyP') && inRun()) {
    e.preventDefault();
    if ($('screen-levelup').classList.contains('hidden')) {
      if ($('screen-roster').classList.contains('hidden')) openRoster();
      else closeRoster();
    }
  }
});
window.addEventListener('keyup', e => { keys[e.code] = false; });

// Controls: one half of the screen is the move stick (side is a setting — the
// old hard-coded left-half locked out left-handed players entirely); the other
// half fires your powershot. Double-tap the stick side to dash.
const joyMove = { id: null, bx: 0, by: 0, ox: 0, oy: 0, dx: 0, dy: 0, active: false };
const stickOnLeft = () => prefs.stickSide !== 'right';
const isStickZone = x => stickOnLeft() ? x < cw * 0.55 : x > cw * 0.45;
let lastStickTap = 0;

canvas.addEventListener('pointerdown', e => {
  if (!G.running && !G.over) return;
  if (!isStickZone(e.clientX)) { tryPowershot(); return; }
  if (joyMove.id !== null) return;
  // double-tap the movement side = dash in the current facing/move direction
  const now = performance.now();
  if (now - lastStickTap < 280) { tryDash(); lastStickTap = 0; } else lastStickTap = now;
  joyMove.id = e.pointerId;
  joyMove.ox = joyMove.bx = e.clientX; joyMove.oy = joyMove.by = e.clientY;
  joyMove.dx = 0; joyMove.dy = 0; joyMove.active = true;
});
window.addEventListener('pointermove', e => {
  if (e.pointerId !== joyMove.id) return;
  const max = 40 + (prefs.stickSize || 100) * 0.18;   // user-scalable throw
  let dx = e.clientX - joyMove.bx, dy = e.clientY - joyMove.by;
  const len = Math.hypot(dx, dy);
  if (len > max) {
    // floating base: drag it along so direction changes feel instant
    if (prefs.stickType !== 'fixed') {
      joyMove.bx = e.clientX - dx / len * max;
      joyMove.by = e.clientY - dy / len * max;
    }
    dx = dx / len * max; dy = dy / len * max;
  }
  const dz = (prefs.deadzone || 8) / 100;
  let nx = dx / max, ny = dy / max;
  const nl = Math.hypot(nx, ny);
  if (nl < dz) { nx = ny = 0; }
  else if (nl < 1) { const s = (nl - dz) / (1 - dz) / nl; nx *= s; ny *= s; }
  joyMove.dx = nx; joyMove.dy = ny;
});
const joyEnd = e => {
  if (e.pointerId !== joyMove.id) return;
  joyMove.id = null; joyMove.active = false; joyMove.dx = 0; joyMove.dy = 0;
};
window.addEventListener('pointerup', joyEnd);
window.addEventListener('pointercancel', joyEnd);

// moveVector() used to be recomputed inside fireWeapon() for every weapon of
// every fighter every frame. Now it's computed once per frame into G.mv.
let _mv = [0, 0];
function computeMove() {
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (joyMove.active) { mx = joyMove.dx; my = joyMove.dy; }
  const l = Math.hypot(mx, my);
  if (l > 1) { mx /= l; my /= l; }
  _mv[0] = mx; _mv[1] = my;
  return _mv;
}
const moveVector = () => _mv;

// Haptic vocabulary — consistent durations so each event has its own "feel".
const HAPTIC = { crit: 8, tick: 12, level: 18, hurt: 26, dash: 14, cage: [18, 40, 18], power: 70, unlock: [12, 60, 12] };
const buzz = p => {
  if (!prefs.haptics) return;
  try { navigator.vibrate && navigator.vibrate(p); } catch (e) {}
};

// ---------------- Game state ----------------
const G = {
  running: false, over: false, time: 0, kills: 0,
  cam: { x: 0, y: 0, tx: 0, ty: 0, zoom: 1 }, shake: 0, shakeAng: 0, hurtFlash: 0,
  level: 1, xp: 0, xpNext: 16,
  spawnAcc: 0, timeScale: 1, tsTarget: 1,
  boss: null, bossWarned: false, victory: false,
  combo: 0, comboT: 0, bestCombo: 0,
  healPct(p) { player.hp = Math.min(maxHP(), player.hp + maxHP() * p); },
};

let player = null;             // { heroIdx, x, y, hp, iv, fx, ws[] }
let allies = [];               // fighters
let cages = [];                // { heroIdx, x, y, hp, broken }
let freedSet = new Set();      // heroIdx freed this run (incl. starter)
let decor = [];
let heroState = [];            // per-hero mastery: { dmg, tier, charge, kills, control }
let heroMods = [];             // per-hero signature-upgrade mods (only that hero's weapon)
let powerWaves = [];           // queued powershot projectile rings
let relics = [];               // [{ def, lv, ws }] — the second weapon slot
let chests = [], corpses = [], pools = [], ghosts = [], spires = [], totems = [];
const freshHeroMod = () => ({ dmg: 1, rate: 1, area: 1, speed: 1, pierceAdd: 0, countAdd: 0, jumpsAdd: 0, exploadMul: 1, fx: {} });

// ---------------- Shared effective-weapon resolution ----------------
// The fire path and the render path used to compute weapon parameters
// SEPARATELY, so hero mods and evolution bonuses were applied to the hitbox but
// not the visual: Yelp's "Fourth Orb" added an invisible damaging orb, and Gus's
// "+40% radius" grew an aura ring that never changed on screen. One resolver now
// feeds both, so what you see is always what you hit.
function effWeapon(heroIdx, w) {
  const m = G.mods, hm = heroMods[heroIdx] || freshHeroMod();
  const evo = !!(heroState[heroIdx] && heroState[heroIdx].tier >= 4);
  const areaMul = m.area * hm.area * (evo && (w.type === 'beam' || w.type === 'aura' || w.type === 'trail') ? 1.4 : 1);
  return {
    evo, areaMul,
    count: (w.count || 1) + hm.countAdd
      + (evo && w.type === 'nova' ? Math.ceil((w.count || 1) * 0.4) : 0)
      + (evo && w.type === 'orbit' ? 2 : 0),
    radius: (w.radius || 0) * areaMul,
    size: (w.size || 6) * areaMul,
    pierce: (w.pierce || 0) + hm.pierceAdd + (evo && w.type === 'shot' ? 2 : 0),
    jumps: (w.jumps || 0) + hm.jumpsAdd + (evo && w.type === 'chain' ? 2 : 0),
    arc: (w.arc || 0) + (evo && w.type === 'slash' ? 0.5 : 0),
    speedMul: hm.speed,
    explodeMul: hm.exploadMul,
    fx: hm.fx,
  };
}

function addDamage(src, amt) {
  if (src === undefined || src === null || G.over) return;
  const hs = heroState[src];
  if (!hs) return;
  hs.dmg += amt;
  while (hs.tier < 4 && hs.dmg >= TIER_DMG[hs.tier + 1]) {
    hs.tier++;
    const f = player.heroIdx === src ? player : allies.find(a => a.heroIdx === src);
    if (hs.tier === 4) {
      // Super Saiyan: weapon evolution
      const wtype = HEROES[src].weapons[0].type;
      banner(`🌟 ${HEROES[src].name.toUpperCase()} IS SUPER SAIYAN — WEAPON EVOLVED!`);
      banner(`✦ ${HEROES[src].name}'s ${HEROES[src].power.split(' — ')[0]} now ${EVO_NOTE[wtype] || 'transcends'}`);
      Sound.sfx.powershot();
      buzz(60);
      if (f) { effects.push({ type: 'tierup', f, color: '#ffee58', t: 0, dur: 1.3 }); spawnParts(f.x, f.y - 20, '#ffee58', 30, 230); }
      // first-ever Super Saiyan (any hero) is a milestone
      try {
        const save = loadSave();
        if (!save.firstSS) { save.firstSS = 1; saveGame(save); banner('☀ THE FIRST GUARDIAN TRANSCENDS ☀'); }
      } catch (e) {}
    } else {
      banner(`${HEROES[src].name.toUpperCase()} → ${TIER_NAMES[hs.tier]}!`);
      Sound.sfx.tierup();
      buzz(30);
      if (f) {
        spawnParts(f.x, f.y - 20, TIER_COLORS[hs.tier], 18, 170);
        effects.push({ type: 'tierup', f, color: TIER_COLORS[hs.tier], t: 0, dur: 0.9 });
      }
    }
  }
  if (hs.charge < 1) {
    const gain = amt * (G.mods.chargeMul || 1) / (POWER_NEED * (1 + hs.tier * 0.5));
    hs.charge = Math.min(1, hs.charge + gain);
    if (hs.charge >= 1 && src === player.heroIdx) { Sound.sfx.powerReady(); buzz(20); }  // your powershot is ready
  }
}
const heroDmgMul = idx => 1 + (heroState[idx] ? heroState[idx].tier : 0) * TIER_BONUS;

const enemies = [];  for (let i = 0; i < MAX_ENEMIES; i++) enemies.push({ alive: false });
const projs = [];    for (let i = 0; i < MAX_PROJ; i++) projs.push({ alive: false, hitList: [] });
const ebullets = []; for (let i = 0; i < 80; i++) ebullets.push({ alive: false });
const gems = [];     for (let i = 0; i < MAX_GEMS; i++) gems.push({ alive: false });
const parts = [];    for (let i = 0; i < MAX_PARTS; i++) parts.push({ alive: false });
let hearts = [], patches = [], effects = [], floaters = [], telegraphs = [];

function makeWS(heroIdx) {
  return HEROES[heroIdx].weapons.map(w => ({
    cd: Math.random() * (w.interval || 1) * 0.5,
    ang: Math.random() * 6.28,
    cds: w.type === 'orbit' ? new Array(w.count).fill(0) : null,
  }));
}
function makeFighter(heroIdx, x, y) {
  return { heroIdx, x, y, fx: 1, ws: makeWS(heroIdx), bob: Math.random() * 6.28 };
}
function maxHP() { return HEROES[player.heroIdx].hp + G.mods.hpBonus; }

// ---------------- Decor grid ----------------
const DECOR_CELL = 512;
const decorGrid = new Map();
function buildDecorGrid() {
  decorGrid.clear();
  for (const d of decor) {
    const k = ((d.x / DECOR_CELL) | 0) * 4096 + ((d.y / DECOR_CELL) | 0);
    let a = decorGrid.get(k);
    if (!a) decorGrid.set(k, a = []);
    a.push(d);
  }
  for (const a of decorGrid.values()) a.sort((p, q) => p.y - q.y);
}

// ---------------- Spatial hash ----------------
// Cell arrays are pooled across frames (generation-stamped) so rebuilding the
// hash 60x/sec allocates nothing — no GC hitches when the horde is thick.
const hash = new Map();
let hashGen = 0;
function buildHash() {
  hashGen++;
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = enemies[i];
    if (!e.alive) continue;
    const k = ((e.x / CELL) | 0) * 4096 + ((e.y / CELL) | 0);
    let a = hash.get(k);
    if (!a) { a = []; a.gen = 0; hash.set(k, a); }
    if (a.gen !== hashGen) { a.length = 0; a.gen = hashGen; }
    a.push(e);
  }
}
function eachProjNear(x, y, r, cb) {
  const r2 = r * r;
  for (let i = 0; i < MAX_PROJ; i++) {
    const p = projs[i];
    if (!p.alive) continue;
    if ((p.x - x) ** 2 + (p.y - y) ** 2 < r2) cb(p);
  }
}
function eachEnemyNear(x, y, r, cb) {
  const x0 = ((x - r) / CELL) | 0, x1 = ((x + r) / CELL) | 0;
  const y0 = ((y - r) / CELL) | 0, y1 = ((y + r) / CELL) | 0;
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const a = hash.get(cx * 4096 + cy);
    if (a && a.gen === hashGen)
      for (let i = 0; i < a.length; i++) { if (cb(a[i]) === false) return; }
  }
}
function nearestTarget(x, y, maxD, includeCages) {
  let best = null, bd = maxD * maxD;
  eachEnemyNear(x, y, maxD, e => {
    const d = (e.x - x) ** 2 + (e.y - y) ** 2;
    if (d < bd) { bd = d; best = e; }
  });
  if (G.boss && G.boss.alive) {
    const b = G.boss, d = (b.x - x) ** 2 + (b.y - y) ** 2;
    if (d < bd) { bd = d; best = b; }
  }
  if (!best && includeCages) {
    for (const c of cages) {
      if (c.broken) continue;
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bd) { bd = d; best = c; }
    }
  }
  return best;
}
function nearestCage(x, y, maxD) {
  let best = null, bd = maxD * maxD;
  for (const c of cages) {
    if (c.broken) continue;
    const d = (c.x - x) ** 2 + (c.y - y) ** 2;
    if (d < bd) { bd = d; best = c; }
  }
  return best;
}

// ---------------- Spawning ----------------
// Endless scaling that CONVERGES instead of exploding: each round adds less than
// the last, plateauing near a cap (hp ~4x, dmg ~3x, boss ~5x) so round 20 is a
// real fight, not a spreadsheet wall.
function conv(perStep, decay, round) {
  return 1 + perStep * (1 - Math.pow(decay, Math.max(0, round - 1))) / (1 - decay);
}
const roundHpMul   = () => conv(ROUND_EHP, 0.85, G.round || 1);
const roundDmgMul  = () => conv(ROUND_EDMG, 0.85, G.round || 1);
const roundBossMul = () => conv(ROUND_BHP, 0.85, G.round || 1);

function spawnEnemy(type, tier, x, y, elite) {
  let e = null;
  for (let i = 0; i < MAX_ENEMIES; i++) if (!enemies[i].alive) { e = enemies[i]; e.id = i; break; }
  if (!e) return null;
  const def = ENEMIES[type];
  const base = def.base || type;   // sprite family (new archetypes reuse art)
  const small = base === 'minyar';
  const scale = (small ? 0.72 + Math.random() * 0.85 : 0.85 + Math.random() * 0.5) * (elite ? 1.45 : 1);
  const timeMult = 1 + (G.time / 60) * 0.18;
  const tm = TIERS[tier].mult;
  const diff = G.diff || DIFFICULTIES[0];
  e.alive = true; e.type = type; e.base = base; e.ai = def.ai || 'chase'; e.tier = tier; e.scale = scale;
  e.x = x; e.y = y;
  e.maxhp = def.hp * tm * Math.pow(scale, 1.7) * timeMult * diff.ehp * roundHpMul()
    * (elite ? ELITE_HP : 1) * (G.mut.eHp || 1);
  e.hp = e.maxhp;
  e.spd = def.spd * (1.12 - scale * 0.18) * (0.9 + Math.random() * 0.25) * (G.mut.eSpd || 1);
  e.dmg = def.dmg * (1 + tier * 0.3) * scale * diff.edmg * roundDmgMul();
  e.lastSrc = undefined;
  e.xp = Math.max(1, Math.round(def.xp * (1 + tier * 0.9) * scale * (elite ? ELITE_XP : 1)));
  e.r = Math.max(def.r * scale, def.dh * scale * 0.21);   // hitbox now covers the body
  e.dh = def.dh;
  e.cyOff = def.dh * scale * 0.45;                        // body centre above the ground anchor
  e.slowT = 0; e.poisonT = 0; e.poisonDps = 0; e.poisonTick = 0; e.poisonSrc = undefined;
  e.burnT = 0; e.burnDps = 0; e.burnSrc = undefined;
  e.kbx = 0; e.kby = 0; e.flash = 0;
  e.wob = Math.random() * 6.28;
  e.shootCd = e.ai === 'ranged' ? 1 + Math.random() : 0;   // spitter fire timer
  e.fleeing = false; e._fl = null;
  e.elite = !!elite;
  e.affix = elite ? ELITE_AFFIXES[(Math.random() * ELITE_AFFIXES.length) | 0] : null;
  e.chargeCd = 3; e.buffCd = 2; e.burrowT = e.ai === 'burrow' ? 1.1 : 0;
  if (elite) {
    if (e.affix.id === 'swift') e.spd *= 2;
    if (e.affix.id === 'warded') e.ai = 'shielded';
    banner(`💀 ${e.affix.name.toUpperCase()} ${type.toUpperCase()} — ${e.affix.desc}`);
    Sound.sfx.eliteSpawn();
  }
  return e;
}

// Elites are the tracking targets a horde needs: 6x HP, an aura, a name and one
// affix. Spawned on act beats and, on Cataclysm, twice as often.
function spawnElite() {
  const a = Math.random() * 6.283, d = 380 + Math.random() * 180;
  const pool = G.time > 150 ? ['demonder', 'warden', 'clubbo', 'minyar'] : ['minyar', 'demonder'];
  const tier = Math.min(TIERS.length - 1, 2 + ((G.time / 110) | 0));
  const e = spawnEnemy(pool[(Math.random() * pool.length) | 0], tier,
    clampW(player.x + Math.cos(a) * d), clampW(player.y + Math.sin(a) * d), true);
  if (e) telegraphs.push({ x: e.x, y: e.y, r: 70, t: 0, dur: 0.9, dmg: 0, color: e.affix.color, mark: 1 });
  return e;
}
const clampW = v => Math.min(WORLD - 30, Math.max(30, v));

function spawnWave(dt) {
  const t = G.time;
  // Opens at 2.4/sec, not 1.4 — the first 45 seconds used to be an empty field,
  // which is the exact window that decides whether a player takes a second run.
  // (3.5 was over-corrected: soak testing had a passive player dying at 0:21 on
  // the easiest difficulty.)
  const rate = Math.min(16, 2.4 + t * 0.03) * ((G.diff || DIFFICULTIES[0]).menace) * (G.mut.spawn || 1);
  G.spawnAcc += rate * dt;
  const maxTier = Math.min(TIERS.length - 1, (t / 85) | 0);
  while (G.spawnAcc >= 1) {
    G.spawnAcc -= 1;
    const a = Math.random() * 6.283;
    const d = Math.hypot(viewW, VIEW_H) / 2 + 70 + Math.random() * 220;
    const x = Math.min(WORLD - 30, Math.max(30, player.x + Math.cos(a) * d));
    const y = Math.min(WORLD - 30, Math.max(30, player.y + Math.sin(a) * d));
    const tier = Math.max(0, maxTier - ((Math.random() ** 2) * 3 | 0));
    // higher difficulties bring the nastier spawns forward
    // Times pulled in to match the shorter 6-minute run. Burrower and Siren are
    // the two enemies that test something new: standing still, and threat
    // prioritisation.
    const early = (G.diff ? G.diff.id : 0) * 35;
    let type = 'minyar';
    const r = Math.random();
    if (t > 165 - early && r < Math.min(0.05, (t - (165 - early)) / 6000)) type = 'clubbo';
    else if (t > 100 - early && r < Math.min(0.07, (t - (100 - early)) / 3400)) type = 'warden';
    else if (t > 140 - early && r < Math.min(0.05, (t - (140 - early)) / 4200)) type = 'siren';
    else if (t > 115 - early && r < Math.min(0.07, (t - (115 - early)) / 3600)) type = 'burrower';
    else if (t > 70 - early && r < Math.min(0.09, (t - (70 - early)) / 2600)) type = 'runner';
    else if (t > 45 - early && r < Math.min(0.11, (t - (45 - early)) / 2200)) type = 'spitter';
    else if (t > 55 - early && r < Math.min(0.14, 0.025 + t / 2200)) type = 'demonder';
    const e = spawnEnemy(type, tier, x, y);
    // burrowers emerge UNDER the player after a telegraph, not at the ring
    if (e && type === 'burrower') {
      e.bx = e.x = clampW(player.x + (Math.random() - 0.5) * 220);
      e.by = e.y = clampW(player.y + (Math.random() - 0.5) * 180);
      telegraphs.push({ x: e.x, y: e.y, r: 46, t: 0, dur: 1.1, dmg: 0, color: '#a1887f', mark: 1 });
    }
    heraldEnemy(type);
  }
  // the Golden One: a rare, fleeing treasure enemy — the single most reliably
  // shareable moment in games that have one
  G.goldCd = (G.goldCd || 55) - dt;
  if (G.goldCd <= 0 && t > 40) {
    G.goldCd = 70 + Math.random() * 50;
    const a = Math.random() * 6.283;
    const e = spawnEnemy('golden', Math.min(5, 3 + ((t / 120) | 0)),
      clampW(player.x + Math.cos(a) * 330), clampW(player.y + Math.sin(a) * 330));
    if (e) { heraldEnemy('golden'); Sound.sfx.chestTick(); }
  }
}
function heraldEnemy(type) {
  const seen = G.seen || (G.seen = {});
  if (seen[type]) return;
  seen[type] = 1;
  const heralds = {
    demonder: ['A DEMONDER STALKS THE JUNGLE!', 'enemies/demonder_entrance.wav'],
    clubbo:   ["CLUBBO! RUN. OR DON'T.", 'enemies/clubbo_entrance.wav'],
    spitter:  ['SPITTERS! THEY LEAD THEIR SHOTS', null],
    warden:   ['A WARDEN — ARMORED IN FRONT. GET BEHIND IT.', null],
    runner:   ['RUNNERS! THEY BOLT, THEN BURST', null],
    burrower: ['BURROWERS! THEY COME UP UNDERNEATH YOU', null],
    siren:    ['A SIREN — SHE STRENGTHENS THE REST. KILL HER FIRST.', null],
    golden:   ['💰 A GOLDEN ONE — CATCH IT!', null],
  };
  const h = heralds[type];
  if (!h) return;
  banner(h[0]);
  if (h[1]) Sound.playFile('assets/audio/' + h[1], 0.85);
}

// ---------------- Damage ----------------
function addFloater(x, y, txt, color, scale) {
  if (floaters.length > 44) floaters.shift();
  floaters.push({ x, y, txt, color, t: 0, s: scale || 1 });
}
// Repeated hits on the same enemy within 0.22s accumulate into ONE rising
// number instead of spamming the screen — this is what lets every hit show a
// number without the playfield turning into confetti.
function addAggFloater(e, dmg, color) {
  const f = e._fl;
  if (f && f.t < 0.22 && floaters.includes(f)) {
    f.acc += dmg; f.txt = Math.round(f.acc); f.t = Math.max(0, f.t - 0.08);
    f.s = Math.min(1.35, 1 + f.acc / 400);
    return;
  }
  const nf = { x: e.x + (Math.random() - 0.5) * 10, y: bodyY(e) - e.r - 8, txt: dmg, color, t: 0, s: 1, acc: dmg };
  if (floaters.length > 44) floaters.shift();
  floaters.push(nf); e._fl = nf;
}
// Particle kinds: spark (stretched to velocity), puff (soft additive), shard
// (rotating), ring (expanding). Previously every effect in the game was the
// same axis-aligned square.
function spawnParts(x, y, color, n, spd, kind, grav) {
  n = Math.max(1, Math.round(n * QL.parts));
  let made = 0;
  for (let i = 0; i < MAX_PARTS && made < n; i++) {
    const p = parts[i];
    if (p.alive) continue;
    p.alive = true; p.x = x; p.y = y;
    const a = Math.random() * 6.283, v = spd * (0.4 + Math.random() * 0.8);
    p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
    p.t = 0; p.dur = 0.3 + Math.random() * 0.4; p.color = color;
    p.size = 2 + Math.random() * 3;
    p.kind = kind || 'spark';
    p.rot = Math.random() * 6.28; p.spin = (Math.random() - 0.5) * 14;
    p.grav = grav === undefined ? 140 : grav;
    made++;
  }
}
// Directional trauma. A single scalar meant a powershot, a boss slam and a
// scratch all shook the screen identically, so shake stopped meaning anything.
function shakeAt(x, y, amt) {
  G.shake = Math.max(G.shake, amt);
  G.shakeAng = Math.atan2(y - player.y, x - player.x);
}
// Muzzle flash at the firing point, oriented along the shot. Every weapon used
// to fire with no visual origin at all — projectiles simply appeared.
function muzzleFlash(f, ang, color, scale) {
  if (effects.length > 120) return;
  effects.push({ type: 'muzzle', x: f.x + Math.cos(ang) * 12, y: f.y - 12 + Math.sin(ang) * 12,
    ang, color, s: scale || 1, t: 0, dur: 0.11 });
}
// Directional spark burst where a projectile connects.
function impactSpark(x, y, ang, color) {
  if (effects.length > 130) return;
  effects.push({ type: 'impact', x, y, ang, color, t: 0, dur: 0.18 });
}

function spawnChest(x, y, kind) {
  if (chests.length > 10) return;
  chests.push({ x, y, kind: kind || 'normal', t: 0, opened: false });
}
const GEM_CAP = 400;   // a single gem never carries more than this much XP
function dropGem(x, y, val) {
  let free = null, near = null, nd = Infinity;
  for (let i = 0; i < MAX_GEMS; i++) {
    const gm = gems[i];
    if (!gm.alive) { free = gm; break; }
    // track the nearest gem in case the pool is full — merge locally, not into
    // a stranded far-away gem (that made one "mega-gem" swallow the whole map's
    // XP and skip ~45 levels at once when finally collected)
    const d = (gm.x - x) ** 2 + (gm.y - y) ** 2;
    if (d < nd && gm.val < GEM_CAP) { nd = d; near = gm; }
  }
  if (!free) {
    if (near) near.val = Math.min(GEM_CAP, near.val + val);   // capped local merge
    return;
  }
  free.alive = true; free.x = x + (Math.random() - 0.5) * 14; free.y = y + (Math.random() - 0.5) * 14;
  free.val = val; free.t = 0; free.vx = 0; free.vy = 0;
}

function killEnemy(e, src) {
  e.alive = false;
  G.kills++;
  const by = bodyY(e);
  // combo: kills within 2s chain into a multiplier. Gives the player continuous
  // score feedback and makes aggression feel good moment-to-moment.
  G.combo++; G.comboT = 1.2;   // short window: disengaging actually breaks it
  G.comboScore += 10 * G.comboMul;      // kill score scales with the live combo
  if (G.combo > G.bestCombo) {
    G.bestCombo = G.combo;
    if (G.combo % 10 === 0) { Sound.sfx.combo(G.combo); addFloater(player.x, player.y - 60, `×${G.combo}`, '#ffd54f', 1.3); }
  }
  if (e.lastSrc != null && heroState[e.lastSrc]) heroState[e.lastSrc].kills++;
  if (e.elite) { G.eliteKills++; onEliteDeath(e); }
  if (e.type === 'golden') { spawnChest(e.x, e.y, 'gold'); banner('💰 THE GOLDEN ONE FALLS'); }
  else dropGem(e.x, e.y, e.xp * (G.diff && G.diff.rule === 'lean' ? 0.75 : 1) * (G.mut.xp || 1));

  // death animation — enemies used to simply vanish
  if (corpses.length < 46) corpses.push({ x: e.x, y: e.y, spr: e.base + e.tier, dh: e.dh, scale: e.scale,
    vx: (e.kbx || 0) * 0.3 + (Math.random() - 0.5) * 60, vy: -60 - Math.random() * 50,
    rot: (Math.random() - 0.5) * 6, t: 0, dur: 0.32, tint: `hsl(${TIERS[e.tier].hue},65%,55%)` });
  const tint = `hsl(${TIERS[e.tier].hue},65%,55%)`;
  spawnParts(e.x, by, tint, e.base === 'minyar' ? 5 : 10, 150, 'spark');
  spawnParts(e.x, by, '#fff', 2, 90, 'puff');

  // lifesteal (Bloodtide upgrade + Swack's trait)
  const ls = G.mods.lifesteal + (src != null && HERO_TRAIT[HEROES[src].id].k === 'lifesteal' ? HERO_TRAIT[HEROES[src].id].v : 0);
  if (ls > 0 && (e.x - player.x) ** 2 + (e.y - player.y) ** 2 < 14400) {
    player.hp = Math.min(maxHP(), player.hp + maxHP() * ls); G.healed = 1;
  }
  // Chomper / Fygar: a short speed surge on kill
  if (src != null) {
    const tr = HERO_TRAIT[HEROES[src].id];
    if (tr && tr.k === 'killSpeed') { G.killSpeedT = 2; G.killSpeedV = tr.v; }
  }
  // Undertow: kills near you leave a slowing pool
  if (G.mods.undertow && (e.x - player.x) ** 2 + (e.y - player.y) ** 2 < 10000 && pools.length < 26)
    pools.push({ x: e.x, y: e.y, r: 62, life: 3.2, slow: 1.4, color: '#4dd0e1' });
  // Chocker's Plaguebearer / poison spread trait
  if (e.poisonT > 0 && (G.plagueOn || (e.poisonSrc != null && HERO_TRAIT[HEROES[e.poisonSrc].id].k === 'poisonSpread'))) {
    eachEnemyNear(e.x, e.y, 110, o => {
      if (o !== e && o.alive && o.poisonT <= 0) { o.poisonT = 2.2; o.poisonDps = e.poisonDps * 0.7; o.poisonSrc = e.poisonSrc; }
    });
  }
  // Fixie's Shatterfrost: frozen enemies burst into a frost field
  if (e.slowT > 0 && G.shatterOn) {
    effects.push({ type: 'explo', x: e.x, y: by, r: 76, t: 0, dur: 0.3, color: '#b3e5fc' });
    eachEnemyNear(e.x, e.y, 76, o => { if (o.alive) o.slowT = Math.max(o.slowT, 2.2); });
  }

  // runner detonates on death — now with a FUSE so it's a positioning test
  // rather than unavoidable damage resolved in the same frame it dies
  if (e.ai === 'runner') {
    telegraphs.push({ x: e.x, y: e.y, r: 62, t: 0, dur: 0.55, dmg: e.dmg * 1.2, color: '#fff59d', small: 1 });
  }
  if (e.type === 'clubbo') {
    Sound.playFile('assets/audio/enemies/clubbo_defeat.wav', 0.85);
    shakeAt(e.x, e.y, 7);
    if (dropsHearts() && Math.random() < 0.4) hearts.push({ x: e.x, y: e.y, t: 0 });
  } else if (e.type === 'demonder') {
    Sound.playFile('assets/audio/enemies/demonder_defeat.wav', 0.7);
    if (dropsHearts() && Math.random() < 0.14) hearts.push({ x: e.x, y: e.y, t: 0 });
  } else if (Math.random() < 0.25) Sound.sfx.kill();
}
// Nightmare removes heart drops entirely; the Famine mutator does too.
const dropsHearts = () => !(G.diff && G.diff.rule === 'noheart') && !G.mut.noHearts;

function onEliteDeath(e) {
  const af = e.affix;
  banner(`💀 ${af.name.toUpperCase()} SLAIN`);
  spawnParts(e.x, bodyY(e), af.color, 26, 240, 'spark');
  hitStop(0.07); shakeAt(e.x, e.y, 9); buzz(HAPTIC.tick);
  if (dropsHearts()) hearts.push({ x: e.x, y: e.y, t: 0 });
  if (af.id === 'gilded') {
    for (let i = 0; i < 8; i++) dropGem(e.x + (Math.random() - 0.5) * 90, e.y + (Math.random() - 0.5) * 70, Math.round(e.xp * 1.4));
    spawnChest(e.x, e.y, 'gold');
  } else if (af.id === 'splitting') {
    for (let i = 0; i < 4; i++) {
      const a = Math.random() * 6.283;
      spawnEnemy(e.type, Math.max(0, e.tier - 1), e.x + Math.cos(a) * 44, e.y + Math.sin(a) * 44);
    }
  } else if (af.id === 'volatile') {
    pools.push({ x: e.x, y: e.y, r: 96, life: 6, dps: e.dmg * 0.8, color: '#ff7043', hostile: 1 });
  } else if (Math.random() < 0.55) spawnChest(e.x, e.y, 'normal');
}

// Body-centre Y. Enemies are drawn `dh*scale` tall ABOVE their ground anchor,
// but every collision test used to measure from the anchor (the feet) with a
// small radius — so shots visibly passed through torsos and connected with bare
// ground below. The boss already had this fix; regular enemies never did.
const bodyY = e => e.isBoss ? e.y - 70 : e.isCage ? e.y : e.y - (e.cyOff || 0);

// Crits are new: the game had no burst moments at all. Rolled per damage event.
function rollCrit(src) {
  let c = G.mods.crit;
  const tr = src != null && HERO_TRAIT[HEROES[src].id];
  if (tr && (tr.k === 'critChance' || tr.k === 'shardCrit')) c += tr.v;
  return Math.random() < c;
}

function damageEnemy(e, dmg, o) {
  o = o || {};
  if (e.isBoss) return damageBoss(dmg, o);
  if (e.isCage) return damageCage(e, dmg);
  if (!e.alive) return;
  // Warden armour is now DIRECTIONAL. It always drew a shield arc facing the
  // player, promising a flanking solution the code never implemented (0.55x
  // from every angle). Now the visual tells the truth: flank it.
  if (e.ai === 'shielded') {
    const ax = (o.fromX != null ? o.fromX : player.x), ay = (o.fromY != null ? o.fromY : player.y);
    let da = Math.atan2(ay - e.y, ax - e.x) - Math.atan2(player.y - e.y, player.x - e.x);
    da = Math.abs(Math.atan2(Math.sin(da), Math.cos(da)));
    dmg *= da > 1.6 ? 1.0 : 0.35;                 // behind the arc = full damage
  }
  // per-hero conditional damage traits
  dmg *= traitDmgMul(o.src, e);
  const crit = !o.noCrit && rollCrit(o.src);
  if (crit) { dmg *= G.mods.critMul; G.crits++; }
  e.hp -= dmg;
  e.flash = crit ? 0.16 : 0.09;
  if (o.src != null) e.lastSrc = o.src;
  addDamage(o.src, dmg);
  if (o.slow) e.slowT = Math.max(e.slowT, o.slow);
  if (o.poison) { e.poisonT = o.poisonT; e.poisonDps = Math.max(e.poisonDps, o.poison); e.poisonSrc = o.src; }
  if (o.burn) { e.burnT = Math.max(e.burnT || 0, o.burn); e.burnDps = Math.max(e.burnDps || 0, o.burnDps || dmg * 0.3); e.burnSrc = o.src; }
  if (o.knock && !(e.ai === 'shielded' && e.elite)) {
    const kl = Math.hypot(o.kx, o.ky) || 1;
    let k = o.knock;
    const tr = o.src != null && HERO_TRAIT[HEROES[o.src].id];
    if (tr && tr.k === 'knockRes') k *= 1.4;
    e.kbx += o.kx / kl * k; e.kby += o.ky / kl * k;
    // Riptide: knockback deals damage proportional to how far it throws
    if (G.mods.riptide) e.hp -= k * 0.06;
  }
  // Hit confirmation. Sound.sfx.hit() shipped in the manifest and was never
  // called from anywhere — every hit in the game landed in total silence.
  Sound.sfx.hit(crit);
  if (crit) {
    addFloater(e.x, bodyY(e) - e.r - 10, Math.round(dmg), '#ffd54f', 1.5);
    spawnParts(e.x, bodyY(e), '#fff59d', 5, 190, 'spark');
    hitStop(0.035); buzz(HAPTIC.crit);
    // Zappo's crits chain; Yellogen's crits shatter
    const tr = o.src != null && HERO_TRAIT[HEROES[o.src].id];
    if (tr && tr.k === 'chainAll') {
      const n = nearestTarget(e.x, e.y, 190, false);
      if (n && n !== e) damageEnemy(n, dmg * 0.5, { src: o.src, noCrit: 1 });
    }
  } else if (prefs.dmgnum !== 'off' && !(prefs.dmgnum === 'big' && dmg < 25)) {
    // damage numbers used to be hidden for most of the screen; now every hit
    // registers, but repeats on one enemy pool into a single rising number
    addAggFloater(e, Math.round(dmg), e.ai === 'shielded' ? '#b0bec5' : '#fff');
  }
  // hit-stop on a genuinely heavy blow, so big hits land with weight
  if (dmg >= e.maxhp * 0.35 && dmg > 30) hitStop(0.03);
  if (e.hp <= 0) killEnemy(e, o.src);
}

// Conditional per-hero damage traits, resolved at the damage site.
function traitDmgMul(src, e) {
  if (src == null) return 1;
  const tr = HERO_TRAIT[HEROES[src].id];
  if (!tr) return 1;
  let m = 1;
  switch (tr.k) {
    case 'farDmg':   if ((e.x - player.x) ** 2 + (e.y - player.y) ** 2 > 90000) m += tr.v; break;
    case 'nearDmg':  if ((e.x - player.x) ** 2 + (e.y - player.y) ** 2 < 22500) m += tr.v; break;
    case 'slowDmg':  if (e.slowT > 0) m += tr.v; break;
    case 'knockDmg': if (Math.abs(e.kbx) + Math.abs(e.kby) > 40) m += tr.v; break;
    case 'hpDmg':    if (player.hp > maxHP() * 0.7) m += tr.v; break;
    case 'lowDmg':   if (player.hp < maxHP() * 0.4) m += tr.v; break;
  }
  if (src === player.heroIdx && G.mods.lowtide && player.hp < maxHP() * 0.35) m *= 1.6;
  return m;
}

function damageBoss(dmg, o) {
  const b = G.boss;
  if (!b || !b.alive) return;
  b.hp -= dmg; b.flash = 0.07;
  addDamage(o.src, dmg);
  if (o.slow) b.slowT = Math.max(b.slowT, o.slow * 0.3);
  addFloater(b.x + (Math.random() - 0.5) * 60, b.y - 90, Math.round(dmg), '#ffd54f');
  Sound.sfx.bossHit();
  if (b.hp <= 0) killBoss(b);
}

// Endless mode: killing King Glob rolls the run into the next round.
// Enemies get tougher, and he crawls back out of the mountain even angrier.
function killBoss(b) {
  b.alive = false;
  G.bossKills++;
  G.shake = 18;
  hitStop(0.32);   // big dramatic freeze on the kill
  spawnParts(b.x, b.y, '#8bc34a', 60, 260);
  spawnParts(b.x, b.y, '#ffd54f', 40, 200);
  for (let i = 0; i < 6; i++)
    dropGem(b.x + (Math.random() - 0.5) * 120, b.y + (Math.random() - 0.5) * 90, 25);
  Sound.playFile('assets/audio/enemies/glob_defeat.wav', 1);
  setTimeout(() => Sound.playFile('assets/audio/sfx/crown_crack.wav', 0.9), 900);
  G.boss = null;
  G.round++;
  G.nextBossAt = G.time + BOSS_RESPAWN - (G.mut.bossEarly || 0);
  G.bossWarned = false;
  G.healPct(0.5);
  $('boss-hp-wrap').classList.add('hidden');
  banner(G.bossKills === 1 ? '👑 KING GLOB IS DOWN — BALITOPIA IS FREE!' : `👑 GLOB SLAIN ×${G.bossKills}!`);
  banner(`🌀 ROUND ${G.round} — ${roundFlavor(G.round).toUpperCase()}`);
  buzz(HAPTIC.power);
  // The 150s post-boss gap was dead time right after the run's biggest high.
  // Now it's structured: chest immediately, mutator choice, elite wave.
  spawnChest(b.x, b.y, 'gold');
  schedule(2.0, () => { if (!G.over) queueOverlay(showMutatorDraft); });
  schedule(38, () => { if (!G.over) { spawnElite(); spawnElite(); } });
  Sound.playMusic('music/victory.mp3', { loop: false, vol: 0.6, fade: 0.5 });
  schedule(9, () => { if (!G.over && !G.boss) Sound.playMusic(`music/${G.region}.mp3`, { fade: 1.5 }); });
}

function damageCage(c, dmg) {
  if (c.broken) return;
  c.hp -= dmg;
  c.flash = 0.1;
  Sound.sfx.cageHit();
  if (c.hp <= 0) breakCage(c);
}

function breakCage(c) {
  c.broken = true;
  const ally = makeFighter(c.heroIdx, c.x, c.y);
  allies.push(ally);
  freedSet.add(c.heroIdx);
  spawnParts(c.x, c.y, '#d7a86e', 20, 190);
  spawnParts(c.x, c.y, HEROES[c.heroIdx].accent, 16, 160);
  Sound.playFile('assets/audio/sfx/shatter.wav', 0.8);
  Sound.playFile(`assets/audio/heroes/${HEROES[c.heroIdx].id}_entrance.wav`, 0.9);
  G.healPct(0.25);
  banner(`${HEROES[c.heroIdx].name.toUpperCase()} JOINED THE FIGHT!`);
  rebuildStrip();
  updateHudCounts();
}

function hurtPlayer(dmg, srcName) {
  if (player.iv > 0 || G.over) return;
  const tr = HERO_TRAIT[HEROES[player.heroIdx].id];
  // armour: Kelp Armour upgrade, Fertle's trait, Gus's aura guard
  dmg *= G.mods.armor;
  if (tr.k === 'armor') dmg *= 1 - tr.v;
  if (tr.k === 'auraGuard' && G.auraContact) dmg *= 1 - tr.v;
  dmg *= (G.mut.playerDmgTaken || 1);
  if (prefs.assist) dmg *= 0.65;   // assist mode: content stays open, score is flagged
  // Coral Ward / Yelp's shield absorbs the hit entirely
  if (G.wardUp) {
    G.wardUp = 0; G.wardT = 12;
    player.iv = 0.8;
    effects.push({ type: 'shock', x: player.x, y: player.y, r: 90, t: 0, dur: 0.4, color: '#80cbc4' });
    Sound.sfx.wardBreak(); buzz(HAPTIC.tick);
    addFloater(player.x, player.y - 46, 'WARD', '#80cbc4', 1.2);
    return;
  }
  G.lastHurtBy = srcName || G.lastHurtBy;
  G.noHitT = 0;
  player.hp -= dmg;
  player.iv = 0.6;
  shakeAt(player.x + Math.random() - 0.5, player.y, 5);
  G.hurtFlash = 0.4;
  Sound.sfx.hurt();
  buzz(HAPTIC.hurt);
  if (player.hp <= 0) {
    if (G.mods.revive > 0) {                      // Second Wind: cheat death once
      G.mods.revive--;
      player.hp = maxHP() * 0.5;
      player.iv = 2;
      G.flash = 0.35;
      banner('🕯️ SECOND WIND!');
      Sound.sfx.heal();
      slowMo(0.2, 0.7);
      effects.push({ type: 'tierup', f: player, color: '#fff59d', t: 0, dur: 0.9 });
      return;
    }
    player.hp = 0;
    endGame();
  } else if (player.hp < maxHP() * 0.15 && G.time - (G.lastBrink || -99) > 10) {
    // first time you drop to the brink in a while, the game takes a breath
    G.lastBrink = G.time;
    slowMo(0.28, 0.45);
    Sound.sfx.brink();
  }
}

// Time dilation. `hitStop` is a hard freeze for impact; `slowMo` is a ramp for
// drama. Both respect the reduced-motion preference.
function slowMo(scale, dur) {
  if (!prefs.motion) return;
  G.tsTarget = scale; G.tsHold = dur;
}
function tickTimeScale(dt) {
  if (G.tsHold > 0) { G.tsHold -= dt; if (G.tsHold <= 0) G.tsTarget = 1; }
  G.timeScale += (G.tsTarget - G.timeScale) * Math.min(1, 9 * dt);
}

// ---------------- Weapons ----------------
function spawnProj(o) {
  for (let i = 0; i < MAX_PROJ; i++) {
    const p = projs[i];
    if (p.alive) continue;
    Object.assign(p, {
      alive: true, x: o.x, y: o.y, vx: o.vx, vy: o.vy,
      dmg: o.dmg, pierce: o.pierce || 0, size: o.size || 6, life: o.life || 1.2,
      color: o.color, rainbow: !!o.rainbow, homing: !!o.homing, boomerang: !!o.boomerang, returning: false,
      explode: o.explode || 0, split: o.split || 0, slow: o.slow || 0,
      poison: o.poison || 0, poisonT: o.poisonT || 0, knock: o.knock || 0,
      owner: o.owner || null, src: o.src, t: 0, hitCd: 0,
      art: o.art || 'dot', fx: o.fx || null, hits: 0, bounces: o.bounces || 0,
      grow: o.grow || 0, loopT: o.loop || 0, ang: Math.atan2(o.vy, o.vx),
      trail: QL.trails ? (p.trail || []) : null,
    });
    if (p.trail) p.trail.length = 0;
    p.hitList.length = 0;
    return p;
  }
  return null;
}

function fireWeapon(f, w, ws, isAlly, dt) {
  const m = G.mods;
  const src = f.heroIdx;
  const hm = heroMods[src] || freshHeroMod();
  const E = effWeapon(src, w);                       // shared with the renderer
  const evo = E.evo;
  // Ally throughput now scales SUB-LINEARLY with squad size. Linear scaling meant
  // 23 allies produced ~10x the player's DPS on autopilot and the lategame played
  // itself. Only the nearest few actually fire (see updateAllies).
  const rateMul = m.rate * (isAlly ? 1.25 * (G.mut.allyRate || 1) : 1) * hm.rate
    * (G.comboRateMul && !isAlly ? G.comboRateMul : 1) * (f.frenzy ? 1 / (1 + f.frenzy * 0.06) : 1);
  const dmgMul = m.dmg * (isAlly ? allyFalloff() * m.ally : 1) * heroDmgMul(src) * hm.dmg
    * (evo && w.type === 'aura' ? 1.35 : 1) * (f.ghost ? f.ghostMul : 1);
  const areaMul = E.areaMul;
  const eCount = E.count, ePierce = E.pierce, eSpeedMul = E.speedMul;
  const eJumps = E.jumps, eExplodeMul = E.explodeMul, eArcAdd = E.arc - (w.arc || 0);
  const FX = E.fx;

  if (w.type === 'orbit') {
    ws.ang += w.rot * dt;
    const R = E.radius;
    while (ws.cds.length < eCount) ws.cds.push(0);   // new orbs from upgrades/evolution
    for (let i = 0; i < eCount; i++) {
      ws.cds[i] -= dt;
      const a = ws.ang + i / eCount * 6.283;
      const ox = f.x + Math.cos(a) * R, oy = f.y + Math.sin(a) * R;
      if (ws.cds[i] <= 0) {
        let hit = false;
        const rr = E.size + 14;
        eachEnemyNear(ox, oy, rr + 20, e => {
          if ((e.x - ox) ** 2 + (bodyY(e) - oy) ** 2 < (rr + e.r) ** 2) {
            damageEnemy(e, w.dmg * dmgMul, { knock: FX.orbknock ? 260 : 60, kx: e.x - f.x, ky: e.y - f.y, src, fromX: f.x, fromY: f.y });
            hit = true; return false;
          }
        });
        if (!hit && G.boss && G.boss.alive) {
          const b = G.boss;
          if ((b.x - ox) ** 2 + (b.y - oy) ** 2 < (rr + b.r) ** 2) { damageBoss(w.dmg * dmgMul, { src }); hit = true; }
        }
        if (!hit) for (const c of cages) {
          if (c.broken) continue;
          if ((c.x - ox) ** 2 + (c.y - oy) ** 2 < (rr + 30) ** 2) { damageCage(c, w.dmg * dmgMul); hit = true; break; }
        }
        if (hit) ws.cds[i] = 0.3;
      }
    }
    return;
  }

  ws.cd -= dt;
  if (ws.cd > 0) return;

  const interval = w.interval * rateMul;

  if (w.type === 'aura') {
    ws.cd = interval;
    const R = E.radius * (FX.constrict ? 1 + Math.min(0.5, (f.auraKills || 0) * 0.01) : 1);
    if (!isAlly) G.auraContact = false;
    eachEnemyNear(f.x, f.y, R + 30, e => {
      if ((e.x - f.x) ** 2 + (bodyY(e) - f.y) ** 2 < (R + e.r) ** 2) {
        if (!isAlly) G.auraContact = true;
        // Gus's Constrictor: the aura drags enemies inward
        if (FX.constrict) { const d = Math.hypot(e.x - f.x, e.y - f.y) || 1; e.kbx -= (e.x - f.x) / d * 90; e.kby -= (e.y - f.y) / d * 90; }
        damageEnemy(e, w.dmg * dmgMul, { src, fromX: f.x, fromY: f.y });
      }
    });
    if (G.boss && G.boss.alive && (G.boss.x - f.x) ** 2 + (G.boss.y - f.y) ** 2 < (R + G.boss.r) ** 2)
      damageBoss(w.dmg * dmgMul, { src });
    for (const c of cages) {
      if (!c.broken && (c.x - f.x) ** 2 + (c.y - f.y) ** 2 < (R + 30) ** 2) damageCage(c, w.dmg * dmgMul);
    }
    return;
  }

  if (w.type === 'trail') {
    ws.cd = interval;
    if (patches.length > 70) patches.shift();
    patches.push({ x: f.x, y: f.y, r: E.radius, dps: w.dmg * dmgMul, life: w.patchLife, tick: 0,
      color: w.color, src, grow: FX.spread ? 22 : 0 });
    return;
  }

  if (w.type === 'nova') {
    const t = nearestTarget(f.x, f.y, 700, true);
    if (!t) return;                     // hold fire until something's near
    ws.cd = interval;
    for (let i = 0; i < eCount; i++) {
      const a = i / eCount * 6.283 + Math.random() * 0.2;
      spawnProj({
        x: f.x, y: f.y - 12, vx: Math.cos(a) * w.speed * m.pspd * eSpeedMul, vy: Math.sin(a) * w.speed * m.pspd * eSpeedMul,
        dmg: w.dmg * dmgMul, pierce: 1 + m.pierceBonus + hm.pierceAdd, size: E.size, life: w.life * m.plife,
        color: w.color, knock: (w.knock || 0) * m.knockMul, src, art: 'shard',
        grow: FX.swell ? 9 : 0, owner: f, boomerang: FX.grudge ? 1 : 0,
      });
    }
    if (FX.ring) effects.push({ type: 'shock', x: f.x, y: f.y, r: 190 * areaMul, t: 0, dur: 0.45, color: w.color });
    if (!isAlly) { Sound.sfx.weapon('nova'); effects.push({ type: 'shock', x: f.x, y: f.y, r: 90, t: 0, dur: 0.28, color: w.color }); }
    return;
  }

  // ----- aimed weapons need a target -----
  const range = w.type === 'beam' ? (w.length * areaMul) : (isAlly ? 540 : 640);
  let target = nearestTarget(f.x, f.y, range, true);
  // Rescue priority: a cage next to you outranks the horde — but NOT while the
  // boss is alive. It used to override unconditionally, so fighting Glob beside
  // an unbroken cage poured your entire DPS into a 70 HP wooden box.
  if (!(G.boss && G.boss.alive)) {
    const closeCage = nearestCage(f.x, f.y, isAlly ? 210 : 250);
    if (closeCage) target = closeCage;
  }
  const [mx, my] = moveVector();
  let ang;
  if (target) ang = Math.atan2(target.y - f.y, target.x - f.x);
  else if (!isAlly && (mx || my)) ang = Math.atan2(my, mx);
  else return;

  ws.cd = interval;
  if (ang !== undefined && Math.cos(ang) !== 0) f.fx = Math.cos(ang) >= 0 ? 1 : -1;

  if (w.type === 'chain') {
    if (!target) return;
    let cur = target;
    const pts = [{ x: f.x, y: f.y }];
    const visited = new Set();
    const chainHit = [];
    for (let j = 0; j <= eJumps && cur; j++) {
      pts.push({ x: cur.x, y: bodyY(cur) });
      damageEnemy(cur, w.dmg * dmgMul * Math.pow(0.88, j), { src, fromX: f.x, fromY: f.y });
      chainHit.push(cur);
      if (cur.id !== undefined) visited.add(cur.id);
      let nxt = null, bd = (w.range * areaMul) ** 2;
      const cx = cur.x, cy = cur.y;
      eachEnemyNear(cx, cy, w.range * areaMul, e => {
        if (visited.has(e.id)) return;
        const d = (e.x - cx) ** 2 + (e.y - cy) ** 2;
        if (d < bd) { bd = d; nxt = e; }
      });
      cur = nxt;
    }
    // Zappo's Chain Reaction: the arc travels back down the chain
    if (FX.rebound) for (let j = chainHit.length - 1; j >= 0; j--)
      if (chainHit[j].alive) damageEnemy(chainHit[j], w.dmg * dmgMul * 0.45, { src, noCrit: 1, fromX: f.x, fromY: f.y });
    effects.push({ type: 'chain', pts, t: 0, dur: 0.2, color: w.color, rebound: FX.rebound });
    if (!isAlly) { Sound.sfx.weapon('chain'); muzzleFlash(f, ang, w.color, 0.9); }
    return;
  }

  if (w.type === 'beam') {
    const L = w.length * areaMul, W2 = (w.width * areaMul) / 2;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    eachEnemyNear(f.x + dx * L / 2, f.y + dy * L / 2, L / 2 + 60, e => {
      const px = e.x - f.x, py = bodyY(e) - f.y;
      const along = px * dx + py * dy;
      if (along < -e.r || along > L + e.r) return;
      const perp = Math.abs(px * dy - py * dx);
      if (perp < W2 + e.r) damageEnemy(e, w.dmg * dmgMul, { src, fromX: f.x, fromY: f.y });
    });
    // Creeper's Withering Stare: the beam leaves burning ground behind it
    if (FX.scorch && patches.length < 70)
      patches.push({ x: f.x + dx * L * 0.55, y: f.y + dy * L * 0.55, r: 46 * areaMul,
        dps: w.dmg * dmgMul * 0.5, life: 2, tick: 0, color: '#ff8a65', src });
    if (G.boss && G.boss.alive) {
      const b = G.boss, px = b.x - f.x, py = b.y - f.y;
      const along = px * dx + py * dy;
      if (along > -b.r && along < L + b.r && Math.abs(px * dy - py * dx) < W2 + b.r) damageBoss(w.dmg * dmgMul, { src });
    }
    for (const c of cages) {
      if (c.broken) continue;
      const px = c.x - f.x, py = c.y - f.y;
      const along = px * dx + py * dy;
      if (along > 0 && along < L && Math.abs(px * dy - py * dx) < W2 + 26) damageCage(c, w.dmg * dmgMul);
    }
    effects.push({ type: 'beam', x: f.x, y: f.y, ang, len: L, wid: w.width * areaMul, t: 0, dur: 0.16, color: w.color });
    if (!isAlly) { Sound.sfx.weapon('beam'); muzzleFlash(f, ang, w.color, 1.5); }
    return;
  }

  if (w.type === 'slash') {
    const R = E.radius, half = E.arc / 2;
    let landed = false;
    eachEnemyNear(f.x, f.y, R + 40, e => {
      const by = bodyY(e);
      const d2 = (e.x - f.x) ** 2 + (by - f.y) ** 2;
      if (d2 > (R + e.r) ** 2) return;
      let da = Math.atan2(by - f.y, e.x - f.x) - ang;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < half + 0.25) {
        landed = true;
        // Stinger's Skewer Line drags enemies along the sweep instead of away
        const kx = FX.drag ? -Math.sin(ang) : e.x - f.x, ky = FX.drag ? Math.cos(ang) : by - f.y;
        damageEnemy(e, w.dmg * dmgMul, { knock: 90, kx, ky, src, fromX: f.x, fromY: f.y });
      }
    });
    // Chomper's Feeding Frenzy: each connecting bite speeds up the next
    if (FX.frenzy) f.frenzy = landed ? Math.min(6, (f.frenzy || 0) + 1) : 0;
    if (G.boss && G.boss.alive) {
      const b = G.boss, d2 = (b.x - f.x) ** 2 + (b.y - f.y) ** 2;
      if (d2 < (R + b.r) ** 2) {
        let da = Math.atan2(b.y - f.y, b.x - f.x) - ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < half + 0.3) damageBoss(w.dmg * dmgMul, { src });
      }
    }
    for (const c of cages) {
      if (c.broken) continue;
      const d2 = (c.x - f.x) ** 2 + (c.y - f.y) ** 2;
      if (d2 < (R + 30) ** 2) {
        let da = Math.atan2(c.y - f.y, c.x - f.x) - ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < half + 0.3) damageCage(c, w.dmg * dmgMul);
      }
    }
    effects.push({ type: 'slash', x: f.x, y: f.y, ang, r: R, arc: E.arc, t: 0, dur: 0.2, color: w.color });
    if (!isAlly) { Sound.sfx.weapon('slash'); muzzleFlash(f, ang, w.color, 1.3); }
    return;
  }

  // ----- shot -----
  fireShotVolley(f, w, ang, eCount, dmgMul, areaMul, eSpeedMul, ePierce, eExplodeMul, FX, src, isAlly);
  // Echo upgrade: every attack repeats once at 40% a quarter-second later
  if (m.echo && !isAlly)
    schedule(0.25, () => fireShotVolley(f, w, ang, eCount, dmgMul * m.echo, areaMul, eSpeedMul, ePierce, eExplodeMul, FX, src, true));
  // Bloom upgrade: every 8th attack also fires a free full ring
  if (m.bloom && !isAlly) {
    G.bloomN = (G.bloomN || 0) + 1;
    if (G.bloomN % m.bloom === 0) {
      for (let i = 0; i < 12; i++)
        fireShotVolley(f, w, i / 12 * 6.283, 1, dmgMul * 0.8, areaMul, eSpeedMul, ePierce, eExplodeMul, FX, src, true);
      effects.push({ type: 'shock', x: f.x, y: f.y, r: 150, t: 0, dur: 0.4, color: '#f8bbd0' });
      Sound.sfx.nova();
    }
  }
  if (!isAlly) { Sound.sfx.weapon('shot'); muzzleFlash(f, ang, w.color, 1 + (w.size || 6) / 14); }
}

function fireShotVolley(f, w, ang, eCount, dmgMul, areaMul, eSpeedMul, ePierce, eExplodeMul, FX, src, quiet) {
  const m = G.mods;
  const art = w.boomerang ? 'wave' : w.explode ? 'orb' : w.size >= 10 ? 'orb' : 'bolt';
  for (let i = 0; i < eCount; i++) {
    let a = ang;
    if (eCount > 1) a += (i - (eCount - 1) / 2) * (w.spread / Math.max(1, eCount - 1)) * 2 + (w.spread ? 0 : (Math.random() - 0.5) * 0.12);
    else if (w.spread) a += (Math.random() - 0.5) * w.spread;
    spawnProj({
      x: f.x, y: f.y - 12,
      vx: Math.cos(a) * w.speed * m.pspd * eSpeedMul, vy: Math.sin(a) * w.speed * m.pspd * eSpeedMul,
      dmg: w.dmg * dmgMul, pierce: ePierce + m.pierceBonus, size: (w.size || 6) * areaMul, life: w.life * m.plife,
      color: w.color, rainbow: w.rainbow, homing: w.homing || FX.seekWeak, boomerang: w.boomerang,
      explode: w.explode ? w.explode * eExplodeMul * areaMul : 0,
      split: w.split ? (FX.shatter5 ? 5 : 3) : (FX.cluster ? 3 : 0),
      slow: w.slow, poison: w.poison ? w.poison * dmgMul / Math.max(1, w.dmg) * w.dmg : 0,
      poisonT: w.poisonT, knock: (w.knock || 0) * m.knockMul, owner: f, src, art,
      fx: FX, bounces: FX.bounce ? 1 : 0, grow: FX.swell ? 8 : 0, loop: FX.loop ? 2 : 0,
    });
  }
}

// tiny deferred-callback queue, ticked in update() so it respects pause/timescale
let timers = [];
const schedule = (t, fn) => timers.push({ t, fn });
function tickTimers(dt) {
  for (let i = timers.length - 1; i >= 0; i--) {
    timers[i].t -= dt;
    if (timers[i].t <= 0) { const f = timers[i].fn; timers.splice(i, 1); try { f(); } catch (e) {} }
  }
}

function explodeAt(x, y, r, dmg, src) {
  eachEnemyNear(x, y, r + 30, e => {
    if ((e.x - x) ** 2 + (e.y - y) ** 2 < (r + e.r) ** 2) damageEnemy(e, dmg, { src });
  });
  if (G.boss && G.boss.alive && (G.boss.x - x) ** 2 + (G.boss.y - y) ** 2 < (r + G.boss.r) ** 2) damageBoss(dmg, { src });
  for (const c of cages) {
    if (!c.broken && (c.x - x) ** 2 + (c.y - y) ** 2 < (r + 30) ** 2) damageCage(c, dmg);
  }
  effects.push({ type: 'explo', x, y, r, t: 0, dur: 0.3, color: '#ff9e40' });
  spawnParts(x, y, '#ff9e40', 8, 180);
}

// ---------------- Projectile update ----------------
function updateProjs(dt) {
  for (let i = 0; i < MAX_PROJ; i++) {
    const p = projs[i];
    if (!p.alive) continue;
    p.t += dt;
    p.hitCd -= dt;

    if (p.homing) {
      const t = nearestTarget(p.x, p.y, 320, false);
      if (t) {
        const ta = Math.atan2(t.y - p.y, t.x - p.x);
        const cur = Math.atan2(p.vy, p.vx);
        let da = Math.atan2(Math.sin(ta - cur), Math.cos(ta - cur));
        const na = cur + Math.max(-6 * dt, Math.min(6 * dt, da));
        const sp = Math.hypot(p.vx, p.vy);
        p.vx = Math.cos(na) * sp; p.vy = Math.sin(na) * sp;
      }
    }
    // Roger-Dodger's Loop: blades orbit the owner before returning
    if (p.loopT > 0 && p.owner) {
      p.loopT -= dt;
      const oa = Math.atan2(p.y - p.owner.y, p.x - p.owner.x) + 4.2 * dt;
      const od = Math.min(150, Math.hypot(p.x - p.owner.x, p.y - p.owner.y));
      p.x = p.owner.x + Math.cos(oa) * od; p.y = p.owner.y + Math.sin(oa) * od;
      if (p.loopT % 0.3 < dt) p.hitList.length = 0;
    }
    if (p.boomerang) {
      if (!p.returning && p.t > p.life * 0.48) { p.returning = true; p.hitList.length = 0; }
      if (p.returning && p.owner) {
        const dx = p.owner.x - p.x, dy = p.owner.y - p.y;
        const d = Math.hypot(dx, dy) || 1;
        const sp = Math.hypot(p.vx, p.vy);
        p.vx += (dx / d * sp - p.vx) * 6 * dt;
        p.vy += (dy / d * sp - p.vy) * 6 * dt;
        if (d < 24 || p.t > p.life * 2.4) { p.alive = false; continue; }
      }
    } else if (p.t > p.life) {
      if (p.explode) explodeAt(p.x, p.y, p.explode, p.dmg * 0.8, p.src);
      p.alive = false; continue;
    }

    if (p.grow) p.size += p.grow * dt;
    if (G.windX) { p.vx += G.windX * dt; p.vy += G.windY * dt; }   // sky biome drift
    if (p.loopT <= 0) { p.x += p.vx * dt; p.y += p.vy * dt; }
    p.ang = Math.atan2(p.vy, p.vx);
    if (p.trail) { p.trail.push(p.x, p.y); if (p.trail.length > 8) p.trail.splice(0, 2); }

    // enemy collisions — now measured against the enemy's BODY centre
    let dead = false;
    const pr = p.size + 4;
    eachEnemyNear(p.x, p.y, pr + 44, e => {
      if (dead) return false;
      if (p.hitList.includes(e.id)) return;
      if ((e.x - p.x) ** 2 + (bodyY(e) - p.y) ** 2 > (pr + e.r) ** 2) return;
      p.hits++;
      // Peeta-Heater's Pressure Jet / Diver's Terminal Dive grow with pierces
      let dm = p.dmg;
      if (p.fx && p.fx.pressure) dm *= 1 + 0.18 * (p.hits - 1);
      if (p.fx && p.fx.drill) dm *= 1 + 0.22 * (p.hits - 1);
      const before = e.hp;
      damageEnemy(e, dm, { slow: p.slow, poison: p.poison, poisonT: p.poisonT, knock: p.knock,
        kx: p.vx, ky: p.vy, src: p.src, fromX: p.x - p.vx * 0.1, fromY: p.y - p.vy * 0.1 });
      if (p.fx && p.fx.bleed && e.alive) { e.burnT = Math.max(e.burnT || 0, 2.4); e.burnDps = (e.burnDps || 0) + dm * 0.12; e.burnSrc = p.src; }
      if (p.size >= 7 || !e.alive) impactSpark(p.x, p.y, Math.atan2(p.vy, p.vx) + Math.PI, p.color);
      p.hitList.push(e.id);
      // Ricochet: a projectile that KILLS bounces to a new target
      if (G.mods.ricochet && before > 0 && !e.alive && p.rico !== 1) {
        const n = nearestTarget(p.x, p.y, 260, false);
        if (n && !p.hitList.includes(n.id)) {
          const a = Math.atan2(bodyY(n) - p.y, n.x - p.x), sp = Math.hypot(p.vx, p.vy) || 300;
          p.vx = Math.cos(a) * sp; p.vy = Math.sin(a) * sp; p.rico = 1;
          spawnParts(p.x, p.y, '#80cbc4', 3, 90, 'spark', 0);
          return false;
        }
      }
      if (p.explode) { explodeAt(p.x, p.y, p.explode, p.dmg * 0.8, p.src); dead = true; return false; }
      if (p.split) {
        const n = p.split; p.split = 0;
        for (let s = 0; s < n; s++) {
          const a = Math.random() * 6.283;
          spawnProj({ x: p.x, y: p.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, dmg: p.dmg * 0.5,
            pierce: 0, size: p.size * 0.6, life: 0.5, color: p.color, src: p.src, art: 'shard' });
        }
      }
      if (p.bounces > 0) { p.bounces--; p.vx *= -0.85; p.vy *= -0.85; p.hitList.length = 0; return false; }
      if (p.pierce > 0) { p.pierce--; }
      else if (!p.boomerang && p.loopT <= 0) { dead = true; return false; }
    });
    if (dead) { p.alive = false; continue; }

    // boss collision (boss body centre sits ~70px above its feet anchor)
    if (G.boss && G.boss.alive && p.hitCd <= 0) {
      const b = G.boss;
      if ((b.x - p.x) ** 2 + (b.y - 70 - p.y) ** 2 < (pr + b.r) ** 2) {
        damageBoss(p.dmg, { slow: p.slow, src: p.src });
        if (p.explode) { explodeAt(p.x, p.y, p.explode, p.dmg * 0.8, p.src); p.alive = false; continue; }
        if (p.pierce > 0 || p.boomerang) { p.hitCd = 0.25; }
        else { p.alive = false; continue; }
      }
    }

    // cage collisions
    for (const c of cages) {
      if (c.broken) continue;
      if ((c.x - p.x) ** 2 + (c.y - p.y) ** 2 < (pr + 26) ** 2) {
        if (p.hitList.includes(-1000 - cages.indexOf(c))) continue;
        damageCage(c, p.dmg);
        p.hitList.push(-1000 - cages.indexOf(c));
        if (!(p.pierce > 0) && !p.boomerang) { p.alive = false; }
        break;
      }
    }
    if (!p.alive) continue;

    if (p.x < -50 || p.x > WORLD + 50 || p.y < -50 || p.y > WORLD + 50) p.alive = false;
  }
}

// ---------------- Enemy update ----------------
function updateEnemies(dt) {
  const px = player.x, py = player.y;
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = enemies[i];
    if (!e.alive) continue;

    // despawn if far away (keeps the horde around the player)
    const ddx = px - e.x, ddy = py - e.y;
    const dist = Math.hypot(ddx, ddy);
    if (dist > 1900) { e.alive = false; continue; }

    let sp = e.spd * (e.slowT > 0 ? 0.45 : 1);
    e.slowT -= dt;
    e.flash -= dt;

    // DoT now routes through damageEnemy so it credits the applying Guardian's
    // mastery and powershot charge. It used to subtract HP directly, which meant
    // Chocker — the poison hero — never levelled from his own primary damage.
    if (e.poisonT > 0) {
      e.poisonT -= dt;
      e.poisonTick -= dt;
      if (e.poisonTick <= 0) {
        e.poisonTick = 0.4;
        damageEnemy(e, e.poisonDps * 0.4, { src: e.poisonSrc, noCrit: 1, silent: 1 });
        if (!e.alive) continue;
      }
    }
    if (e.burnT > 0) {
      e.burnT -= dt; e.burnTick = (e.burnTick || 0) - dt;
      if (e.burnTick <= 0) {
        e.burnTick = 0.4;
        damageEnemy(e, e.burnDps * 0.4, { src: e.burnSrc, noCrit: 1, silent: 1 });
        if (!e.alive) continue;
      }
    }

    // ---- movement AI ----
    let mvx = ddx, mvy = ddy, mvd = dist;
    if (e.ai === 'ranged') {
      // Spitters now lead their target and fire a 3-shot spread — a single slow
      // bullet every 2s was trivially ignorable at player speed.
      const ideal = 240;
      if (dist < ideal - 40) { mvx = -ddx; mvy = -ddy; }
      else if (dist < ideal + 40) { mvx = -ddy; mvy = ddx; }   // strafe
      e.shootCd -= dt;
      if (e.shootCd <= 0 && dist < 520) {
        e.shootCd = 1.5 + Math.random() * 0.6;
        const [pmx, pmy] = moveVector();
        const lead = 0.42;
        const ang = Math.atan2(ddy + pmy * 200 * lead, ddx + pmx * 200 * lead);
        for (let s = -1; s <= 1; s++)
          spawnEBullet(e.x, bodyY(e), Math.cos(ang + s * 0.15) * 250, Math.sin(ang + s * 0.15) * 250, e.dmg * 0.75, 8, 3.2);
      }
    } else if (e.ai === 'runner') {
      if (e.hp < e.maxhp * 0.35) { e.fleeing = true; }
      if (e.fleeing) { mvx = -ddx; mvy = -ddy; sp *= 1.35; }
    } else if (e.ai === 'flee') {
      // the Golden One: sprints away, drops a chest if you catch it
      mvx = -ddx; mvy = -ddy;
      e.life = (e.life || 0) + dt;
      if (e.life > 22) { e.alive = false; continue; }
    } else if (e.ai === 'burrow') {
      // emerges beneath you after a telegraph — nothing else punishes standing still
      e.burrowT -= dt;
      if (e.burrowT > 0) { e.x = e.bx; e.y = e.by; continue; }
      if (!e.erupted) {
        e.erupted = 1;
        if ((player.x - e.x) ** 2 + (player.y - e.y) ** 2 < 3600) hurtPlayer(e.dmg, 'a Burrower');
        effects.push({ type: 'explo', x: e.x, y: e.y, r: 60, t: 0, dur: 0.3, color: '#8d6e63' });
        spawnParts(e.x, e.y, '#8d6e63', 14, 190, 'shard');
        shakeAt(e.x, e.y, 6);
      }
      sp = 46;
    } else if (e.ai === 'support') {
      // siren: hangs back and buffs neighbours — the first priority target
      const ideal = 300;
      if (dist < ideal) { mvx = -ddx; mvy = -ddy; }
      e.buffCd -= dt;
      if (e.buffCd <= 0) {
        e.buffCd = 3.5;
        let n = 0;
        eachEnemyNear(e.x, e.y, 190, o => { if (o !== e && o.alive && n < 8) { o.buffT = 4; n++; } });
        effects.push({ type: 'shock', x: e.x, y: bodyY(e), r: 190, t: 0, dur: 0.5, color: '#ce93d8' });
      }
    }
    if (e.buffT > 0) { e.buffT -= dt; sp *= 1.25; }
    // Elite 'swift' charges at you without warning
    if (e.elite && e.affix.id === 'swift') {
      e.chargeCd -= dt;
      if (e.chargeCd <= 0 && dist < 420) { e.chargeCd = 4.5; e.kbx = ddx / dist * 520; e.kby = ddy / dist * 520; }
    }
    if (e.elite && e.affix.id === 'warded' && dist < 210) {
      if (!e.chillT || e.chillT <= 0) { e.chillT = 1.2; G.chilled = 1.4; }
      e.chillT -= dt;
    }
    if (mvd > 1) { const inv = 1 / (Math.hypot(mvx, mvy) || 1); e.vx0 = mvx * inv; e.vy0 = mvy * inv; e.x += e.vx0 * sp * dt; e.y += e.vy0 * sp * dt; }
    // knockback decay
    e.x += e.kbx * dt; e.y += e.kby * dt;
    e.kbx *= Math.pow(0.002, dt); e.kby *= Math.pow(0.002, dt);

    // Separation: round-robin across the 3x3 neighbourhood so each enemy is
    // fully resolved every 3 frames. Checking 4 same-cell neighbours let the
    // horde collapse into a solid overlapping mat at 300 enemies.
    const phase = (i + G.frameN) % 3;
    const ecx = (e.x / CELL) | 0, ecy = (e.y / CELL) | 0;
    for (let cx = -1; cx <= 1; cx++) {
      if (((cx + 1) % 3) !== phase && G.sepBudget <= 0) continue;
      for (let cy = -1; cy <= 1; cy++) {
        const a = hash.get((ecx + cx) * 4096 + (ecy + cy));
        if (!a || a.gen !== hashGen) continue;
        let checked = 0;
        for (let j = 0; j < a.length && checked < 5; j++) {
          const o = a[j];
          if (o === e || !o.alive) continue;
          checked++;
          const dx = e.x - o.x, dy = e.y - o.y;
          const d2 = dx * dx + dy * dy, min = (e.r + o.r) * 0.78;
          if (d2 > 0.01 && d2 < min * min) {
            const d = Math.sqrt(d2);
            e.x += dx / d * (min - d) * 0.32;
            e.y += dy / d * (min - d) * 0.32;
          }
        }
      }
    }

    // contact damage
    if (dist < e.r + 15 && e.ai !== 'flee') hurtPlayer(e.dmg, enemyName(e));
  }
}
const enemyName = e => e.elite ? `a ${e.affix.name} ${e.type}` :
  ({ minyar: 'a Minyar', demonder: 'a Demonder', clubbo: 'a Clubbo', spitter: 'a Spitter',
     warden: 'a Warden', runner: 'a Runner', burrower: 'a Burrower', siren: 'a Siren' })[e.type] || 'the horde';

// ---------------- Boss ----------------
// Boss modifiers, drafted from round 3 — the same fight shouldn't be the payoff
// for every single run.
const BOSS_MODS = [
  { id: 'split', name: 'SPLIT CROWN', desc: 'two half-strength kings' },
  { id: 'famine', name: 'FAMINE', desc: 'no gems drop while he lives' },
  { id: 'lock', name: 'TIDE LOCK', desc: 'the arena closes in' },
];

function spawnBoss() {
  const a = Math.random() * 6.283;
  const diff = G.diff || DIFFICULTIES[0];
  const round = G.round || 1;
  // Alternate bosses on endless rounds. One boss for the entire game meant the
  // reward for 6-8 minutes of play was identical every time.
  const isReef = round % 2 === 0 && round > 1;
  const hp = BOSS.hp * diff.bhp * roundBossMul() * (G.mut.bHp || 1) * (isReef ? 1.15 : 1);
  const mod = round >= 3 ? BOSS_MODS[(Math.random() * BOSS_MODS.length) | 0] : null;
  G.boss = {
    alive: true, isBoss: true, kind: isReef ? 'reef' : 'glob', mod,
    x: Math.min(WORLD - 200, Math.max(200, player.x + Math.cos(a) * 640)),
    y: Math.min(WORLD - 200, Math.max(200, player.y + Math.sin(a) * 640)),
    hp: hp * (mod && mod.id === 'split' ? 0.5 : 1), maxhp: hp * (mod && mod.id === 'split' ? 0.5 : 1),
    r: BOSS.r, spd: BOSS.spd, dmg: BOSS.dmg * diff.edmg * roundDmgMul(),
    slowT: 0, flash: 0, wob: 0, enraged: round > 1, frenzy: false,
    volleyCd: 4, summonCd: 8, slamCd: 12, gorgeCd: 14, beamAng: 0, crowns: [],
  };
  if (G.boss.enraged) G.boss.spd *= 1.3;
  if (mod && mod.id === 'split') {
    // second king mirrors the first
    G.boss2 = Object.assign({}, G.boss, { x: G.boss.x + 220, y: G.boss.y + 140, crowns: [], volleyCd: 6, slamCd: 15 });
  } else G.boss2 = null;
  if (isReef) {
    G.boss.spd = 0;   // stationary arena boss — forces circle-strafing, not kiting
    Sound.playMusic('enemies/demonder.mp3', { fade: 1.2 });
    banner('🪸 THE REEF MOTHER RISES 🪸');
    banner('Her beams sweep the shallows. Keep moving around her.');
  } else {
    Sound.playMusic('enemies/glob.mp3', { fade: 1.2 });
    Sound.playFile('assets/audio/enemies/glob_entrance.wav', 0.95);
    schedule(1.4, () => Sound.playFile('assets/audio/enemies/glob_laugh.wav', 0.9));
    banner(round > 1 ? `👑 KING GLOB RETURNS — ROUND ${round} 👑` : '👑 KING GLOB HAS ARRIVED 👑');
  }
  if (mod) banner(`⚠ ${mod.name} — ${mod.desc}`);
  Sound.duckFor(1.5);
  shakeAt(G.boss.x, G.boss.y, 15);
  slowMo(0.35, 0.7);
  $('boss-hp-wrap').classList.remove('hidden');
  $('boss-hp-wrap').querySelector('span').textContent = isReef ? 'REEF MOTHER' : 'KING GLOB';
}

function updateBoss(dt) {
  const b = G.boss;
  if (!b || !b.alive) return;
  b.flash -= dt; b.slowT -= dt; b.wob += dt;
  const round = G.round || 1;
  const edmg = G.diff ? G.diff.edmg : 1;
  // phase 2 (enrage) at 50%, phase 3 (frenzy) at 20%
  if (!b.enraged && b.hp < b.maxhp * 0.5) {
    b.enraged = true; b.spd *= 1.3;
    Sound.playFile('assets/audio/enemies/glob_enrage.wav', 0.95);
    banner('KING GLOB IS FURIOUS!'); G.shake = Math.max(G.shake, 10);
  }
  if (!b.frenzy && b.hp < b.maxhp * 0.2) {
    b.frenzy = true; b.spd *= 1.2;
    Sound.playFile('assets/audio/enemies/glob_enrage.wav', 1);
    banner('👑 KING GLOB — FINAL FRENZY 👑'); G.shake = Math.max(G.shake, 14);
  }
  const dx = player.x - b.x, dy = player.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  // in frenzy he stops chasing and zones from range, forcing you to reposition
  const chase = b.frenzy ? 0.35 : 1;
  // he used to walk straight onto the player and stand there; now he keeps a
  // standoff distance so the fight is about his abilities, not his hitbox
  const standoff = 150;
  const sp = b.spd * (b.slowT > 0 ? 0.6 : 1) * chase * (d < standoff ? -0.6 : 1);
  b.x += dx / d * sp * dt; b.y += dy / d * sp * dt;

  if (d < b.r + 16) hurtPlayer(b.dmg, b.kind === 'reef' ? 'the Reef Mother' : 'King Glob');

  // ---- REEF MOTHER: rotating beams. A different verb — you circle her rather
  // than kite her, so the fight tests positioning instead of retreat speed.
  if (b.kind === 'reef') {
    b.beamAng += (b.frenzy ? 0.85 : b.enraged ? 0.6 : 0.42) * dt;
    const beams = b.frenzy ? 4 : b.enraged ? 3 : 2;
    b.beamTick = (b.beamTick || 0) - dt;
    const L = 640;
    if (b.beamTick <= 0) {
      b.beamTick = 0.1;
      for (let i = 0; i < beams; i++) {
        const a2 = b.beamAng + i / beams * 6.283;
        const bx = Math.cos(a2), by = Math.sin(a2);
        const px = player.x - b.x, py = player.y - b.y;
        const along = px * bx + py * by;
        if (along > 0 && along < L && Math.abs(px * by - py * bx) < 20) hurtPlayer(b.dmg * 0.35, 'a Reef beam');
      }
    }
    b.beams = beams; b.beamLen = L;
  }

  // ---- GORGE (phase 1): he inhales, dragging you in. Move or take it.
  b.gorgeCd -= dt;
  if (b.gorgeCd <= 0 && !b.frenzy) {
    b.gorgeCd = b.enraged ? 9 : 13;
    b.gorging = 2.2;
    banner('👑 HE INHALES — GET AWAY');
    Sound.sfx.surge();
  }
  if (b.gorging > 0) {
    b.gorging -= dt;
    const pull = 210 * dt;
    player.x -= dx / d * pull; player.y -= dy / d * pull;
    if (d < b.r + 60) hurtPlayer(b.dmg * 0.5, 'the Gorge');
    eachEnemyNear(b.x, b.y, 600, e => { e.kbx -= (e.x - b.x) * 0.6; e.kby -= (e.y - b.y) * 0.6; });
  }

  // ---- CROWN SPLIT (phase 2): destroy the fragments or he heals.
  if (b.enraged && !b.crownDone && !b.crowns.length) {
    b.crownDone = 1; b.crownT = 12;
    for (let i = 0; i < 4; i++) {
      const a2 = i / 4 * 6.283;
      b.crowns.push({ x: b.x + Math.cos(a2) * 200, y: b.y + Math.sin(a2) * 200, hp: b.maxhp * 0.03, alive: true });
    }
    banner('👑 THE CROWN SPLITS — BREAK THE FRAGMENTS');
  }
  if (b.crowns.length) {
    b.crownT -= dt;
    for (const c of b.crowns) {
      if (!c.alive) continue;
      eachProjNear(c.x, c.y, 34, p => { c.hp -= p.dmg; p.alive = false; });
      if (c.hp <= 0) { c.alive = false; spawnParts(c.x, c.y, '#ffd54f', 18, 200, 'shard'); Sound.sfx.wardBreak(); }
    }
    const left = b.crowns.filter(c => c.alive).length;
    if (!left) { b.crowns = []; banner('👑 THE CROWN IS BROKEN'); damageBoss(b.maxhp * 0.06, { src: player.heroIdx, noCrit: 1 }); }
    else if (b.crownT <= 0) {
      b.crowns = [];
      b.hp = Math.min(b.maxhp, b.hp + b.maxhp * 0.15);
      banner('👑 HE REFORGES HIS CROWN — HE HEALS');
      Sound.sfx.eliteSpawn();
    }
  }

  b.volleyCd -= dt;
  if (b.volleyCd <= 0) {
    b.volleyCd = (b.frenzy ? 2 : b.enraged ? 3.2 : 5) + Math.random() * 2;
    const base = Math.atan2(dy, dx);
    const spread = b.frenzy ? 14 : 10;
    for (let i = 0; i < spread; i++) {
      const a = base + (i - (spread - 1) / 2) * 0.14;
      spawnEBullet(b.x, b.y - 40, Math.cos(a) * 240, Math.sin(a) * 240, 22 * edmg, 10, 3.2);
    }
    // round 3+: a second radial ring; round 5+: a spiral burst
    if (round >= 3) for (let i = 0; i < 12; i++) { const a = b.wob + i / 12 * 6.283; spawnEBullet(b.x, b.y - 40, Math.cos(a) * 170, Math.sin(a) * 170, 18 * edmg, 8, 3.6); }
    Sound.sfx.nova();
  }
  b.summonCd -= dt;
  if (b.summonCd <= 0) {
    b.summonCd = b.frenzy ? 6 : 9;
    const kinds = round >= 4 ? ['minyar', 'spitter', 'runner'] : ['minyar'];
    for (let i = 0; i < (b.frenzy ? 9 : 7); i++) {
      const a = Math.random() * 6.283;
      spawnEnemy(kinds[(Math.random() * kinds.length) | 0], Math.min(5, 2 + (Math.random() * 4 | 0)), b.x + Math.cos(a) * 110, b.y + Math.sin(a) * 110);
    }
  }
  b.slamCd -= dt;
  if (b.slamCd <= 0 && (d < 420 || b.frenzy)) {
    b.slamCd = b.frenzy ? 5 : b.enraged ? 8 : 11;
    // frenzy: two slams — one on you, one predicting where you're headed
    telegraphs.push({ x: player.x, y: player.y, r: 165, t: 0, dur: 1.1, dmg: 38 * edmg });
    if (b.frenzy) {
      const [mvx, mvy] = moveVector();
      telegraphs.push({ x: player.x + mvx * 180, y: player.y + mvy * 180, r: 150, t: 0, dur: 1.2, dmg: 38 * edmg });
    }
    Sound.playFile('assets/audio/sfx/glob_slam.wav', 0.85);
  }
}

function spawnEBullet(x, y, vx, vy, dmg, size, life) {
  for (const eb of ebullets) {
    if (eb.alive) continue;
    eb.alive = true; eb.x = x; eb.y = y - 20; eb.vx = vx; eb.vy = vy;
    eb.dmg = dmg; eb.size = size; eb.life = life; eb.t = 0;
    return;
  }
}
function updateEbullets(dt) {
  for (const eb of ebullets) {
    if (!eb.alive) continue;
    eb.t += dt;
    if (eb.t > eb.life) { eb.alive = false; continue; }
    eb.x += eb.vx * dt; eb.y += eb.vy * dt;
    if ((eb.x - player.x) ** 2 + (eb.y - player.y) ** 2 < (eb.size + 14) ** 2) {
      hurtPlayer(eb.dmg);
      eb.alive = false;
    }
  }
}

// ---------------- Allies ----------------
// Ally damage falls off SUB-LINEARLY with squad size. Linear scaling meant the
// 23rd ally added as much as the 2nd, so by minute six the squad out-damaged the
// player ~10:1 and the run played itself.
const ACTIVE_ALLIES = 6;
function allyFalloff() {
  const n = Math.max(1, allies.length);
  return 0.55 * Math.pow(n, 0.62) / n;
}

// Formations turn the squad from an autopilot DPS engine into something you
// command. Cycled from the HUD or by swiping the powershot side.
const FORMATIONS = [
  { id: 'ring',     icon: '⭕', name: 'RING',     r: 78,  lead: 0,    desc: 'hold close and defend' },
  { id: 'vanguard', icon: '⚔️', name: 'VANGUARD', r: 155, lead: 170,  desc: 'push into the horde' },
  { id: 'focus',    icon: '🎯', name: 'FOCUS',    r: 120, lead: 0,    desc: 'converge on your target' },
];

function updateAllies(dt) {
  const n = allies.length;
  const form = FORMATIONS[G.formation || 0];
  // rank allies by distance — only the nearest few actually fire
  if ((G.frameN & 7) === 0) {
    for (const al of allies) al._d = (al.x - player.x) ** 2 + (al.y - player.y) ** 2;
    G.firing = allies.slice().sort((a, b) => a._d - b._d).slice(0, ACTIVE_ALLIES);
    G.firingSet = new Set(G.firing);
  }
  const [mvx, mvy] = moveVector();
  const focusT = form.id === 'focus' ? nearestTarget(player.x, player.y, 640, false) : null;
  for (let i = 0; i < n; i++) {
    const al = allies[i];
    // concentric rings sized to squad count, so 24 allies don't stack into one blob
    const ring = (i / 8) | 0;
    const perRing = Math.min(8, Math.max(3, n - ring * 8));
    const slotA = ((i % 8) / perRing) * 6.283 + G.time * 0.1 + ring * 0.4;
    const slotR = form.r + ring * 46;
    let tx = player.x + Math.cos(slotA) * slotR + mvx * form.lead;
    let ty = player.y + Math.sin(slotA) * slotR + mvy * form.lead;
    if (focusT) { tx = focusT.x + Math.cos(slotA) * (60 + ring * 34); ty = focusT.y + Math.sin(slotA) * (60 + ring * 34); }
    const dx = tx - al.x, dy = ty - al.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      const sp = Math.min(d * 3.2, HEROES[al.heroIdx].spd * (d > 260 ? 1.8 : 1.05));
      al.x += dx / d * sp * dt;
      al.y += dy / d * sp * dt;
      if (Math.abs(dx) > 2) al.fx = dx >= 0 ? 1 : -1;
    }
    al.active = !G.firingSet || G.firingSet.has(al);
    if (!al.active) continue;
    const hero = HEROES[al.heroIdx];
    for (let wi = 0; wi < hero.weapons.length; wi++)
      fireWeapon(al, hero.weapons[wi], al.ws[wi], true, dt);
  }
  // ghost relic mirrors your attacks
  for (const g of ghosts) {
    const a = G.time * 1.4 + g.off;
    g.x = player.x + Math.cos(a) * 92; g.y = player.y + Math.sin(a) * 92;
    const hero = HEROES[player.heroIdx];
    g.heroIdx = player.heroIdx;
    if (!g.ws || g.wsFor !== player.heroIdx) { g.ws = makeWS(player.heroIdx); g.wsFor = player.heroIdx; }
    for (let wi = 0; wi < hero.weapons.length; wi++)
      fireWeapon(g, hero.weapons[wi], g.ws[wi], true, dt);
  }
}
function cycleFormation() {
  G.formation = ((G.formation || 0) + 1) % FORMATIONS.length;
  const f = FORMATIONS[G.formation];
  banner(`${f.icon} ${f.name} — ${f.desc}`);
  Sound.sfx.uiSelect(); buzz(HAPTIC.tick);
  const el = $('formation-btn');
  if (el) el.textContent = f.icon;
}

// ================================================================
// RELICS — the second weapon slot.
// Hero weapons are fixed for the whole run, so build variety had nowhere to
// live. Relics are hero-agnostic on purpose: the same relic plays completely
// differently on 24 kits, which is where the combinatorics come from.
// ================================================================
function addRelic(defId) {
  const def = RELICS.find(r => r.id === defId);
  if (!def) return;
  const have = relics.find(r => r.def.id === defId);
  if (have) { have.lv = Math.min(4, have.lv + 1); G.relicDirty = 1; return have; }
  if (relics.length >= RELIC_SLOTS) return null;
  const r = { def, lv: 1, cd: 0, ang: Math.random() * 6.28, ws: {} };
  relics.push(r);
  G.relicDirty = 1;
  return r;
}
function updateRelics(dt) {
  for (const r of relics) {
    const w = r.def.w, lv = r.lv;
    const dmgMul = G.mods.dmg * (1 + (lv - 1) * 0.35) * (r.def.id === 'spire' ? 1 : 1);
    const areaMul = G.mods.area * (lv >= 2 ? 1.4 : 1);
    r.cd -= dt;
    switch (w.type) {
      case 'totem':
        if (r.cd <= 0) {
          r.cd = w.interval * G.mods.rate;
          const n = lv >= 4 ? 2 : 1;
          for (let i = 0; i < n; i++)
            totems.push({ x: player.x + (Math.random() - 0.5) * 60, y: player.y + (Math.random() - 0.5) * 60,
              r: w.radius * areaMul, dmg: w.dmg * dmgMul, life: w.life, pulse: 0, every: w.pulse, slow: lv >= 3 ? 1.5 : 0 });
        }
        break;
      case 'mine':
        if (r.cd <= 0) {
          r.cd = w.interval * G.mods.rate * (lv >= 3 ? 0.7 : 1);
          const n = lv >= 4 ? 2 : 1;
          for (let i = 0; i < n; i++)
            pools.push({ mine: 1, x: player.x + (Math.random() - 0.5) * 40, y: player.y + (Math.random() - 0.5) * 40,
              r: w.radius * (lv >= 2 ? 1.5 : 1), dmg: w.dmg * dmgMul, life: w.life, arm: lv >= 3 ? 0.4 : 0.9, color: w.color });
        }
        break;
      case 'sweep': {
        r.ang += w.rot * dt;
        const beams = lv >= 3 ? 2 : 1, L = w.length * (lv >= 2 ? 1.45 : 1) * G.mods.area;
        r.tick = (r.tick || 0) - dt;
        if (r.tick <= 0) {
          r.tick = 0.12;
          for (let b = 0; b < beams; b++) {
            const a = r.ang + b * Math.PI, dx = Math.cos(a), dy = Math.sin(a);
            eachEnemyNear(player.x + dx * L / 2, player.y + dy * L / 2, L / 2 + 50, e => {
              const px = e.x - player.x, py = bodyY(e) - player.y;
              const along = px * dx + py * dy;
              if (along < 0 || along > L) return;
              if (Math.abs(px * dy - py * dx) < 12 + e.r)
                damageEnemy(e, w.dmg * dmgMul * 0.5, { src: player.heroIdx, noCrit: 1, fromX: player.x, fromY: player.y,
                  burn: lv >= 4 ? 1.5 : 0, burnDps: w.dmg * dmgMul * 0.25 });
            });
          }
        }
        r.L = L; r.beams = beams;
        break;
      }
      case 'net':
        if (r.cd <= 0) {
          r.cd = w.interval * G.mods.rate;
          const [mx2, my2] = moveVector();
          const a = (mx2 || my2) ? Math.atan2(my2, mx2) : (r.ang += 1.1);
          const R = w.radius * (lv >= 2 ? 1.4 : 1) * G.mods.area, half = w.arc / 2;
          eachEnemyNear(player.x, player.y, R + 40, e => {
            const by = bodyY(e);
            if ((e.x - player.x) ** 2 + (by - player.y) ** 2 > R * R) return;
            let da = Math.atan2(by - player.y, e.x - player.x) - a;
            da = Math.atan2(Math.sin(da), Math.cos(da));
            if (Math.abs(da) > half) return;
            const d = Math.hypot(e.x - player.x, e.y - player.y) || 1;
            const pull = w.pull * (lv >= 3 ? 1.6 : 1);
            e.kbx -= (e.x - player.x) / d * pull; e.kby -= (e.y - player.y) / d * pull;
            e.slowT = Math.max(e.slowT, w.slow);
            if (lv >= 4) damageEnemy(e, w.dmg * dmgMul, { src: player.heroIdx, fromX: player.x, fromY: player.y });
          });
          effects.push({ type: 'cone', x: player.x, y: player.y, ang: a, r: R, arc: w.arc, t: 0, dur: 0.3, color: w.color });
          Sound.sfx.weapon('nova');
        }
        break;
      case 'bolt':
        if (r.cd <= 0) {
          r.cd = w.interval * G.mods.rate;
          const strikes = lv >= 3 ? 2 : 1;
          for (let s = 0; s < strikes; s++) {
            const t = nearestTarget(player.x + (Math.random() - 0.5) * 200, player.y + (Math.random() - 0.5) * 200, w.range, false);
            if (!t) break;
            const dmg = w.dmg * dmgMul * (lv >= 2 ? 1.5 : 1);
            explodeAt(t.x, bodyY(t), w.radius * G.mods.area, dmg, player.heroIdx);
            effects.push({ type: 'bolt', x: t.x, y: bodyY(t), t: 0, dur: 0.22, color: w.color });
            if (lv >= 4) {
              let n = 0;
              eachEnemyNear(t.x, t.y, 200, e => { if (e !== t && n < 2) { n++; damageEnemy(e, dmg * 0.6, { src: player.heroIdx }); } });
            }
          }
          shakeAt(player.x, player.y, 4);
        }
        break;
      case 'petal': {
        r.ang += w.rot * dt;
        const cnt = w.count + (lv >= 2 ? 1 : 0), R = w.radius * G.mods.area;
        r.cds = r.cds || [];
        for (let i = 0; i < cnt; i++) {
          r.cds[i] = (r.cds[i] || 0) - dt;
          if (r.cds[i] > 0) continue;
          const a = r.ang + i / cnt * 6.283;
          const ox = player.x + Math.cos(a) * R, oy = player.y + Math.sin(a) * R;
          let hit = false;
          eachEnemyNear(ox, oy, w.size + 24, e => {
            if ((e.x - ox) ** 2 + (bodyY(e) - oy) ** 2 < (w.size + 14 + e.r) ** 2) {
              damageEnemy(e, w.dmg * dmgMul, { src: player.heroIdx, knock: 70, kx: e.x - player.x, ky: e.y - player.y });
              hit = true; return false;
            }
          });
          if (hit) {
            r.cds[i] = 0.45;
            if (lv >= 4) explodeAt(ox, oy, 54, w.dmg * dmgMul * 0.6, player.heroIdx);
            const heal = maxHP() * (lv >= 3 ? 0.004 : 0.002);
            player.hp = Math.min(maxHP(), player.hp + heal); G.healed = 1;
          }
        }
        r.cnt = cnt; r.R = R;
        break;
      }
      case 'spire':
        if (r.cd <= 0) {
          r.cd = w.interval * G.mods.rate;
          if (spires.length < (lv >= 4 ? 2 : 1) + 1)
            spires.push({ x: player.x, y: player.y, life: w.life * (lv >= 3 ? 1.7 : 1),
              heroIdx: player.heroIdx, ws: makeWS(player.heroIdx), mul: w.dmg * (lv >= 2 ? 1.35 : 1) });
        }
        break;
      case 'ghost':
        if (ghosts.length < (lv >= 4 ? 2 : 1)) {
          for (let i = ghosts.length; i < (lv >= 4 ? 2 : 1); i++)
            ghosts.push({ x: player.x, y: player.y, off: i * 3.14, ghost: 1, ghostMul: w.mirror + (lv >= 2 ? 0.2 : 0), fx: 1, bob: 0 });
        }
        for (const g of ghosts) g.ghostMul = w.mirror + (lv >= 2 ? 0.2 : 0);
        break;
    }
  }
  // spires fight on their own
  for (let i = spires.length - 1; i >= 0; i--) {
    const s = spires[i];
    s.life -= dt;
    if (s.life <= 0) { spires.splice(i, 1); continue; }
    const hero = HEROES[s.heroIdx];
    for (let wi = 0; wi < hero.weapons.length; wi++) fireWeapon(s, hero.weapons[wi], s.ws[wi], true, dt);
  }
  // totems pulse
  for (let i = totems.length - 1; i >= 0; i--) {
    const t = totems[i];
    t.life -= dt; t.pulse -= dt;
    if (t.life <= 0) { totems.splice(i, 1); continue; }
    if (t.pulse <= 0) {
      t.pulse = t.every;
      effects.push({ type: 'shock', x: t.x, y: t.y, r: t.r, t: 0, dur: 0.45, color: '#4dd0e1' });
      eachEnemyNear(t.x, t.y, t.r + 30, e => {
        if ((e.x - t.x) ** 2 + (bodyY(e) - t.y) ** 2 < (t.r + e.r) ** 2) {
          damageEnemy(e, t.dmg, { src: player.heroIdx, knock: 120, kx: e.x - t.x, ky: e.y - t.y });
          if (t.slow) e.slowT = Math.max(e.slowT, t.slow);
        }
      });
    }
  }
}

// ================================================================
// DASH — a short-cooldown ability so positioning is an ACTIVE verb.
// The powershot was the only ability and it fires roughly once a minute, which
// left the player with nothing to do between them.
// ================================================================
function tryDash() {
  if (!G.running || G.over || !player || G.dashCd > 0) return false;
  const [mx, my] = moveVector();
  const a = (mx || my) ? Math.atan2(my, mx) : (player.fx >= 0 ? 0 : Math.PI);
  const tr = HERO_TRAIT[HEROES[player.heroIdx].id];
  G.dashCd = DASH_CD * (tr.k === 'dashCd' ? 1 - tr.v : 1);
  G.dashes++;
  const nx = clampW(player.x + Math.cos(a) * DASH_DIST), ny = clampW(player.y + Math.sin(a) * DASH_DIST);
  // afterimages along the path
  for (let i = 1; i <= 5; i++)
    effects.push({ type: 'ghost', x: player.x + (nx - player.x) * i / 6, y: player.y + (ny - player.y) * i / 6,
      heroIdx: player.heroIdx, fxDir: player.fx, t: -i * 0.012, dur: 0.3 });
  spawnParts(player.x, player.y, '#b2ebf2', 12, 170, 'puff', 0);
  player.x = nx; player.y = ny;
  player.iv = Math.max(player.iv, DASH_IFRAME);
  Sound.sfx.dash(); buzz(HAPTIC.dash);
  return true;
}

// ================================================================
// POSSESSION ECONOMY — Soul.
// Possession was free, instant and unlimited, so it carried no decision. Now it
// costs a charge, and rewards you for spending it well (Soulburn).
// ================================================================
const SOUL_MAX = 3, SOUL_REGEN = 25;
function tickSoul(dt) {
  if (G.soul < SOUL_MAX) {
    G.soulT -= dt;
    if (G.soulT <= 0) { G.soul++; G.soulT = SOUL_REGEN; Sound.sfx.soul(); }
  }
  if (G.burnT > 0) G.burnT -= dt;
  // Coral Ward / Yelp shield recharge
  if (!G.wardUp && (G.mods.ward || HERO_TRAIT[HEROES[player.heroIdx].id].k === 'shield')) {
    G.wardT -= dt;
    if (G.wardT <= 0) { G.wardUp = 1; Sound.sfx.wardUp(); }
  }
}

// ================================================================
// ACT STRUCTURE — a landmark roughly every 45 seconds.
// ================================================================
function runActBeats() {
  for (const b of ACT_BEATS) {
    if (G.beats[b.t] || G.time < b.t) continue;
    G.beats[b.t] = 1;
    fireBeat(b.k);
  }
}
function fireBeat(kind) {
  switch (kind) {
    case 'openRing': {
      // a scripted first fight: your first act is WINNING something, in 10s
      for (let i = 0; i < 9; i++) {
        const a = i / 9 * 6.283;
        spawnEnemy('minyar', 0, clampW(player.x + Math.cos(a) * 250), clampW(player.y + Math.sin(a) * 250));
      }
      banner('THEY FOUND YOU — BREAK THROUGH');
      break;
    }
    case 'elite': spawnElite(); if (G.diff.rule === 'tide') spawnElite(); break;
    case 'siege': startSiege(); break;
    case 'surge': startSurge(); break;
    case 'miniboss': spawnMiniboss(); break;
    case 'chest': {
      const a = Math.random() * 6.283;
      spawnChest(clampW(player.x + Math.cos(a) * 420), clampW(player.y + Math.sin(a) * 420), 'normal');
      banner('📦 A CACHE WASHED UP — GO GET IT');
      break;
    }
  }
}
function startSurge() {
  const a = Math.random() * 6.283;
  banner(SURGE_FLAVOR[(Math.random() * SURGE_FLAVOR.length) | 0]);
  Sound.sfx.surge();
  const tier = Math.min(TIERS.length - 1, 1 + ((G.time / 90) | 0));
  for (let i = 0; i < 42; i++) {
    const sp = a + (Math.random() - 0.5) * 1.1, d = 620 + Math.random() * 260;
    spawnEnemy(Math.random() < 0.18 ? 'runner' : 'minyar', tier,
      clampW(player.x + Math.cos(sp) * d), clampW(player.y + Math.sin(sp) * d));
  }
  // a directional warning so the surge is anticipated, not just suffered
  G.surgeWarn = { a, t: 2.5 };
}
// A cage siege: touch the cage and hold the line for 20 seconds. Turns the
// game's best structural idea (rescues) into its first real risk/reward moment.
function startSiege() {
  const c = cages.find(c => !c.broken);
  if (!c) return;
  c.siege = true; c.hp = CAGE_HP * 2.5;
  G.siegeCage = c;
  banner('⛓ A SIEGE CAGE — GUARDED. BREAK IT IF YOU CAN.');
  const tier = Math.min(TIERS.length - 1, 1 + ((G.time / 100) | 0));
  for (let i = 0; i < 10; i++) {
    const a = i / 10 * 6.283;
    spawnEnemy(i % 4 === 0 ? 'warden' : 'minyar', tier, c.x + Math.cos(a) * 130, c.y + Math.sin(a) * 130);
  }
}
function spawnMiniboss() {
  const a = Math.random() * 6.283;
  const e = spawnEnemy('clubbo', Math.min(5, 3 + ((G.time / 140) | 0)),
    clampW(player.x + Math.cos(a) * 520), clampW(player.y + Math.sin(a) * 520), true);
  if (!e) return;
  e.miniboss = 1; e.scale *= 1.5; e.maxhp *= 2.2; e.hp = e.maxhp;
  e.r = ENEMIES.clubbo.r * e.scale; e.cyOff = e.dh * e.scale * 0.45;
  e.affix = ELITE_AFFIXES[2];
  banner('🪨 THE STONE FATHER WAKES');
  Sound.playFile('assets/audio/enemies/clubbo_entrance.wav', 0.95);
  shakeAt(e.x, e.y, 12);
}

// ================================================================
// CHESTS — the jackpot moment the reward curve never had.
// ================================================================
function updateChests(dt) {
  for (let i = chests.length - 1; i >= 0; i--) {
    const c = chests[i];
    c.t += dt;
    if ((c.x - player.x) ** 2 + (c.y - player.y) ** 2 < 44 * 44 && !c.opened) {
      c.opened = true;
      openChest(c);
      chests.splice(i, 1);
    }
  }
}
function openChest(c) {
  G.chests++;
  const n = c.kind === 'gold' ? 3 + ((Math.random() * 3) | 0) : 1 + ((Math.random() * 2) | 0);
  spawnParts(c.x, c.y, '#ffd54f', 30, 250, 'spark');
  effects.push({ type: 'shock', x: c.x, y: c.y, r: 130, t: 0, dur: 0.5, color: '#ffd54f' });
  slowMo(0.35, 0.5); shakeAt(c.x, c.y, 7); buzz(HAPTIC.cage);
  Sound.sfx.chest();
  G.pendingChest = n;
  queueOverlay(() => showChest(n));
}

// ================================================================
// COMBO — continuous score feedback for aggression.
// ================================================================
function tickCombo(dt) {
  if (G.comboT > 0) {
    G.comboT -= dt;
    if (G.comboT <= 0) G.combo = 0;
  }
  G.comboMul = 1 + Math.min(2.5, G.combo * 0.02);   // caps at a ×125 chain
  const tr = HERO_TRAIT[HEROES[player.heroIdx].id];
  G.comboRateMul = tr.k === 'comboRate' ? 1 / (1 + Math.min(tr.v, G.combo * 0.01)) : 1;
}

// ---------------- Pickups / patches / effects ----------------
function updatePickups(dt) {
  const magR = 92 * G.mods.magnet;
  for (const g of gems) {
    if (!g.alive) continue;
    g.t += dt;
    const dx = player.x - g.x, dy = player.y - g.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < magR * magR) {
      const d = Math.sqrt(d2) || 1;
      const pull = 420 + (magR - d) * 6;
      g.vx = dx / d * pull; g.vy = dy / d * pull;
    } else { g.vx *= 0.9; g.vy *= 0.9; }
    g.x += g.vx * dt; g.y += g.vy * dt;
    if (d2 < 28 * 28) {
      g.alive = false;
      gainXP(g.val * G.mods.xpGain);
    }
  }
  for (let i = hearts.length - 1; i >= 0; i--) {
    const h = hearts[i];
    h.t += dt;
    if (h.t > 25) { hearts.splice(i, 1); continue; }
    if ((h.x - player.x) ** 2 + (h.y - player.y) ** 2 < (magR * 0.6) ** 2) {
      const d = Math.hypot(player.x - h.x, player.y - h.y) || 1;
      h.x += (player.x - h.x) / d * 300 * dt;
      h.y += (player.y - h.y) / d * 300 * dt;
    }
    if ((h.x - player.x) ** 2 + (h.y - player.y) ** 2 < 26 * 26) {
      hearts.splice(i, 1);
      const healAmt = Math.max(20, Math.round(maxHP() * 0.2));   // scales with HP pool
      player.hp = Math.min(maxHP(), player.hp + healAmt);
      Sound.sfx.heal();
      addFloater(player.x, player.y - 40, '+' + healAmt, '#69f0ae');
    }
  }
  for (let i = patches.length - 1; i >= 0; i--) {
    const pa = patches[i];
    pa.life -= dt; pa.tick -= dt;
    if (pa.life <= 0) { patches.splice(i, 1); continue; }
    if (pa.tick <= 0) {
      pa.tick = 0.25;
      eachEnemyNear(pa.x, pa.y, pa.r + 30, e => {
        if ((e.x - pa.x) ** 2 + (e.y - pa.y) ** 2 < (pa.r + e.r) ** 2)
          damageEnemy(e, pa.dps * 0.25, { src: pa.src });
      });
      if (G.boss && G.boss.alive && (G.boss.x - pa.x) ** 2 + (G.boss.y - pa.y) ** 2 < (pa.r + G.boss.r) ** 2)
        damageBoss(pa.dps * 0.25, { src: pa.src });
    }
  }
  for (let i = telegraphs.length - 1; i >= 0; i--) {
    const tg = telegraphs[i];
    tg.t += dt;
    if (tg.t >= tg.dur) {
      if (tg.dmg > 0) {
        if ((player.x - tg.x) ** 2 + (player.y - tg.y) ** 2 < tg.r * tg.r) hurtPlayer(tg.dmg, tg.src || 'a ground slam');
        effects.push({ type: 'explo', x: tg.x, y: tg.y, r: tg.r, t: 0, dur: 0.35, color: tg.color || '#8bc34a' });
        shakeAt(tg.x, tg.y, tg.small ? 5 : 9);
        Sound.sfx.slam();   // was bigKill() — a *reward* cue playing on player damage
      }
      telegraphs.splice(i, 1);
    }
  }
  // ground pools: mines (hostile-triggered), undertow slows, volatile burn
  for (let i = pools.length - 1; i >= 0; i--) {
    const pl = pools[i];
    pl.life -= dt;
    if (pl.life <= 0) { pools.splice(i, 1); continue; }
    if (pl.mine) {
      if (pl.arm > 0) { pl.arm -= dt; continue; }
      let boom = false;
      eachEnemyNear(pl.x, pl.y, pl.r * 0.5, e => {
        if ((e.x - pl.x) ** 2 + (e.y - pl.y) ** 2 < 900) { boom = true; return false; }
      });
      if (boom) {
        explodeAt(pl.x, pl.y, pl.r, pl.dmg, player.heroIdx);
        shakeAt(pl.x, pl.y, 5); Sound.sfx.nova();
        pools.splice(i, 1);
      }
      continue;
    }
    pl.tick = (pl.tick || 0) - dt;
    if (pl.tick <= 0) {
      pl.tick = 0.25;
      if (pl.hostile) {
        if ((player.x - pl.x) ** 2 + (player.y - pl.y) ** 2 < pl.r * pl.r) hurtPlayer(pl.dps * 0.25, 'burning ground');
      } else {
        eachEnemyNear(pl.x, pl.y, pl.r + 20, e => {
          if ((e.x - pl.x) ** 2 + (e.y - pl.y) ** 2 < pl.r * pl.r) {
            if (pl.slow) e.slowT = Math.max(e.slowT, pl.slow);
            if (pl.dps) damageEnemy(e, pl.dps * 0.25, { src: player.heroIdx, noCrit: 1 });
          }
        });
      }
    }
  }
  for (let i = corpses.length - 1; i >= 0; i--) {
    const c = corpses[i];
    c.t += dt;
    if (c.t > c.dur) { corpses.splice(i, 1); continue; }
    c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 520 * dt;
  }
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].t += dt;
    if (effects[i].t > effects[i].dur) effects.splice(i, 1);
  }
  for (let i = floaters.length - 1; i >= 0; i--) {
    floaters[i].t += dt;
    if (floaters[i].t > 0.8) floaters.splice(i, 1);
  }
  for (const p of parts) {
    if (!p.alive) continue;
    p.t += dt;
    if (p.t > p.dur) { p.alive = false; continue; }
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vx *= 0.92; p.vy *= 0.92;
  }
  // cage hit-flash decay (render skips off-screen cages, so decay it here)
  for (const c of cages) if (c.flash > 0) c.flash -= dt;
}

function gainXP(v) {
  if (G.over) return;   // no level-up prompts once the run has ended
  G.xp += v;
  Sound.sfx.gem();
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.level++;
    G.pendingLv++;
    // Flatter than the old 8*L^1.42+6: early levels arrive fast enough to teach
    // the draft, and the late curve doesn't stall out into a dead plateau.
    G.xpNext = Math.round(9 * Math.pow(G.level, 1.25) + 8);
    Sound.sfx.level();
    if (player) effects.push({ type: 'tierup', f: player, color: '#ffd54f', t: 0, dur: 0.8 });
  }
  if (G.pendingLv > 0 && !overlayOpen()) queueOverlay(showLevelUp);
}

// ---------------- Main update ----------------
let last = 0, rafId = 0, fpsAcc = 0, fpsN = 0, benchFrames = 0, adaptAcc = 0, adaptN = 0;
const MENU_IDS = ['screen-title', 'screen-story', 'screen-select', 'screen-records', 'screen-shop',
  'screen-settings', 'screen-howto', 'screen-over', 'screen-roster', 'screen-levelup', 'screen-chest', 'screen-mutator'];
function anyOverlayOpen() {
  for (const id of MENU_IDS) { const el = $(id); if (el && !el.classList.contains('hidden')) return true; }
  return false;
}
function frame(ts) {
  rafId = requestAnimationFrame(frame);
  let dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  // Frame cap (battery): skip work between capped frames rather than rendering
  // at 60 behind a menu the player is reading.
  if (prefs.fpsCap && prefs.fpsCap < 60) {
    G.capAcc = (G.capAcc || 0) + dt;
    if (G.capAcc < 1 / prefs.fpsCap) return;
    dt = G.capAcc; G.capAcc = 0;
  }
  // one-time boot benchmark → auto quality
  if (benchFrames < 300 && G.running) {
    benchFrames++; fpsAcc += dt; fpsN++;
    if (benchFrames === 300) autoQuality(fpsN / fpsAcc);
  } else if (G.running && (!prefs.quality || prefs.quality === 'auto')) {
    // Adaptive safety net: if the frame rate stays poor for ~3s (a real device
    // under a real peak horde, not a synthetic benchmark), step the preset down.
    adaptAcc += dt; adaptN++;
    if (adaptAcc >= 3) {
      const fps = adaptN / adaptAcc;
      adaptAcc = 0; adaptN = 0;
      if (fps < 44 && QL !== QUALITY.battery) {
        applyQuality(QL === QUALITY.high ? 'balanced' : 'battery');
        banner('⚙ QUALITY LOWERED FOR SMOOTHNESS — change it in Settings');
      }
    }
  }
  // Crash recovery: an exception inside the loop used to kill the rAF chain
  // permanently — the game froze with no message and the run was lost.
  try {
    // hit-stop: freeze the sim for a few frames on impactful hits so they land with weight
    if (G.hitStop > 0 && G.running && !G.over) { G.hitStop -= dt; render(0); return; }
    if (G.running && !G.over && window.innerWidth > window.innerHeight) update(dt * G.timeScale);
    // The game used to render a full 60fps playfield behind opaque full-screen
    // overlays. Nothing there changes — so don't draw it.
    if (anyOverlayOpen() && !G.running) {
      if ((G.frameN = (G.frameN || 0) + 1) % 4) return;
    }
    render(dt);
    G.errStreak = 0;
  } catch (err) {
    console.error('[balitopia] frame error', err);
    G.errStreak = (G.errStreak || 0) + 1;
    if (G.errStreak >= 3) {
      G.errStreak = 0;
      G.running = false;
      flushSave();
      try { if (!G.over && player) endGame(); } catch (e) {}
      showModal('Something went wrong', 'The run hit an unexpected error and has been saved. Sorry about that.',
        [{ label: 'Back to menu', primary: true, onClick: () => goTitle() }]);
    }
  }
}
function hitStop(dur) { if (prefs.motion) G.hitStop = Math.max(G.hitStop || 0, dur); }

function autoQuality(fps) {
  if (prefs.quality && prefs.quality !== 'auto') return;
  const q = fps < 42 ? 'battery' : fps < 55 ? 'balanced' : 'high';
  if (q !== 'high') { applyQuality(q); banner(`⚙ ${q.toUpperCase()} QUALITY — adjust in Settings`); }
}
function applyQuality(name) {
  QL = QUALITY[name] || QUALITY.high;
  resize();
}

function update(dt) {
  G.time += dt;
  G.frameN++;
  const m = G.mods;

  // player move
  const [mx, my] = computeMove();
  let spdMul = m.spd * (G.chilled ? 1 / G.chilled : 1);
  if (G.killSpeedT > 0) { G.killSpeedT -= dt; spdMul *= 1 + G.killSpeedV; }
  if (m.lowtide && player.hp < maxHP() * 0.35) spdMul *= 1.2;
  G.chilled = 0;
  const sp = HEROES[player.heroIdx].spd * spdMul;
  player.x = Math.max(24, Math.min(WORLD - 24, player.x + mx * sp * dt));
  player.y = Math.max(24, Math.min(WORLD - 24, player.y + my * sp * dt));
  if (Math.abs(mx) > 0.1) player.fx = mx >= 0 ? 1 : -1;
  player.iv -= dt;
  G.dashCd = Math.max(0, G.dashCd - dt);
  G.noHitT += dt;
  if (G.noHitT > G.bestNoHit) G.bestNoHit = G.noHitT;
  if (m.regen > 0) { player.hp = Math.min(maxHP(), player.hp + m.regen * dt); G.healed = 1; }
  if (heroState[player.heroIdx]) heroState[player.heroIdx].control += dt;   // time as active Guardian
  // Flick's burning wake trait
  if (HERO_TRAIT[HEROES[player.heroIdx].id].k === 'burnTrail' && (mx || my)) {
    G.trailAcc = (G.trailAcc || 0) + dt;
    if (G.trailAcc > 0.22 && patches.length < 70) {
      G.trailAcc = 0;
      patches.push({ x: player.x, y: player.y, r: 26, dps: 9 * m.dmg, life: 1.6, tick: 0, color: '#ffab40', src: player.heroIdx });
    }
  }

  tickTimeScale(dt);
  tickTimers(dt);
  tickSoul(dt);
  tickCombo(dt);
  // contextual coaching, fired once each, ever
  if (G.time > 2) coach('move');
  if (G.dashCd <= 0 && G.time > 12 && G.dashes === 0) coach('dash');
  if (allies.length >= 1) coach('ally');
  if (chests.length) coach('chest');
  for (const e of enemies) { if (e.alive && e.elite) { coach('elite'); break; } }
  buildHash();
  runActBeats();
  updateBiome(dt);
  updateTide(dt);
  spawnWave(dt);
  updateEnemies(dt);

  // player weapons
  const hero = HEROES[player.heroIdx];
  for (let wi = 0; wi < hero.weapons.length; wi++)
    fireWeapon(player, hero.weapons[wi], player.ws[wi], false, dt);

  updateRelics(dt);
  updateAllies(dt);
  updateProjs(dt);
  updatePowerWaves(dt);
  updateBoss(dt);
  updateMirror(dt);
  updateEbullets(dt);
  updateChests(dt);
  updatePickups(dt);
  G.flash = Math.max(0, G.flash - dt * 1.3);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt * 1.6);
  if (G.surgeWarn) { G.surgeWarn.t -= dt; if (G.surgeWarn.t <= 0) G.surgeWarn = null; }

  // boss timing
  if (!G.bossWarned && G.time >= G.nextBossAt - 15) {
    G.bossWarned = true;
    banner('⚠ THE GROUND IS SHAKING... ⚠');
    Sound.duckFor(1.2);
  }
  if (!G.boss && G.time >= G.nextBossAt) spawnBoss();

  // camera: lead the direction of travel, and pull back when things get busy
  const lead = 92;
  G.cam.tx = player.x + mx * lead;
  G.cam.ty = player.y + my * lead;
  G.cam.x += (G.cam.tx - G.cam.x) * Math.min(1, 6.5 * dt);
  G.cam.y += (G.cam.ty - G.cam.y) * Math.min(1, 6.5 * dt);
  const busy = (G.boss && G.boss.alive) ? 1.1 : Math.min(1.08, 1 + G.liveEnemies / 3000);
  G.cam.zoom += (busy - G.cam.zoom) * Math.min(1, 1.6 * dt);
  G.shake = Math.max(0, G.shake - 30 * dt);

  updateHud(dt);
}

// ================================================================
// BIOME MECHANICS
// The three biomes were a palette swap and a music track. Each now changes one
// rule, so "every run should feel different" is true of the ground you fight on.
// ================================================================
function updateBiome(dt) {
  if (G.biome === 'jungle' || G.biome === 'land') {
    // JUNGLE: dense growth slows the horde but not you — rewards using cover
    G.biomeTick = (G.biomeTick || 0) - dt;
    if (G.biomeTick <= 0) {
      G.biomeTick = 0.3;
      const B = DECOR_CELL;
      for (const e of (G.visBuf || [])) {
        const cell = decorGrid.get(((e.x / B) | 0) * 4096 + ((e.y / B) | 0));
        if (!cell) continue;
        for (let i = 0; i < cell.length; i += 3) {
          const d = cell[i];
          if ((d.x - e.x) ** 2 + (d.y - e.y) ** 2 < 2600) { e.slowT = Math.max(e.slowT, 0.35); break; }
        }
      }
    }
  } else if (G.biome === 'sea') {
    // SEA: periodic tide surges shove everything one way — repositioning is
    // taken out of your hands for a moment, and you plan around it
    G.surgeT = (G.surgeT || 14) - dt;
    if (G.surgeT <= 0) {
      G.surgeT = 16 + Math.random() * 6;
      G.tideDir = Math.random() * 6.283;
      G.tidePush = 1.6;
      banner('🌊 THE TIDE SURGES');
      Sound.sfx.surge();
    }
    if (G.tidePush > 0) {
      G.tidePush -= dt;
      const px = Math.cos(G.tideDir) * 130 * dt, py = Math.sin(G.tideDir) * 130 * dt;
      player.x = clampW(player.x + px); player.y = clampW(player.y + py);
      for (const e of (G.visBuf || [])) { e.x += px * 1.4; e.y += py * 1.4; }
    }
  } else if (G.biome === 'sky') {
    // SKY: a steady wind drifts projectiles, so aiming leads differently
    G.windAng = (G.windAng || 0) + dt * 0.12;
    G.windX = Math.cos(G.windAng) * 42; G.windY = Math.sin(G.windAng) * 42;
  }
}

// Cataclysm's rule: a rising tide sweeps the island and must be outrun.
function updateTide(dt) {
  if (!G.diff || G.diff.rule !== 'tide') { if (!G.mut.shrink) return; }
  if (G.mut.shrink) {
    G.safeR = Math.max(900, (G.safeR || 2600) - 14 * dt);
    const d = Math.hypot(player.x - WORLD / 2, player.y - WORLD / 2);
    if (d > G.safeR) { G.tideTick = (G.tideTick || 0) - dt; if (G.tideTick <= 0) { G.tideTick = 0.5; hurtPlayer(14 * (G.diff.edmg || 1), 'the closing tide'); } }
  }
  if (G.diff.rule === 'tide') {
    G.tideY = (G.tideY == null ? -400 : G.tideY) + 22 * dt;
    if (G.tideY > WORLD + 400) G.tideY = -400;
    if (Math.abs(player.y - G.tideY) < 90) {
      G.tideTick2 = (G.tideTick2 || 0) - dt;
      if (G.tideTick2 <= 0) { G.tideTick2 = 0.45; hurtPlayer(18 * G.diff.edmg, 'the Tide'); }
    }
  }
}

// The Mirror mutator: a dark copy of your Guardian hunts you across the island.
function updateMirror(dt) {
  if (!G.mut.mirror) return;
  if (!G.mirror) {
    const a = Math.random() * 6.283;
    G.mirror = { x: clampW(player.x + Math.cos(a) * 700), y: clampW(player.y + Math.sin(a) * 700),
      hp: 2600 * (G.diff.ehp || 1) * roundHpMul(), maxhp: 2600 * (G.diff.ehp || 1) * roundHpMul(),
      heroIdx: player.heroIdx, ws: makeWS(player.heroIdx), fx: 1, isMirror: 1, r: 22, cyOff: 24, flash: 0,
      alive: true, tier: 3, scale: 1, dh: 48, type: 'mirror', base: 'minyar', elite: false, dmg: 26 * (G.diff.edmg || 1) };
    banner('🪞 YOUR REFLECTION STEPS OUT OF THE WATER');
  }
  const M = G.mirror;
  if (!M.alive) return;
  M.flash -= dt;
  const dx = player.x - M.x, dy = player.y - M.y, d = Math.hypot(dx, dy) || 1;
  if (d > 130) { M.x += dx / d * 150 * dt; M.y += dy / d * 150 * dt; }
  M.fx = dx >= 0 ? 1 : -1;
  if (d < 34) hurtPlayer(M.dmg, 'your own reflection');
  const hero = HEROES[M.heroIdx];
  M.mirrorFire = (M.mirrorFire || 0) - dt;
  if (M.mirrorFire <= 0) {
    M.mirrorFire = 1.1;
    const a = Math.atan2(dy, dx);
    for (let i = -1; i <= 1; i++)
      spawnEBullet(M.x, M.y - 20, Math.cos(a + i * 0.2) * 260, Math.sin(a + i * 0.2) * 260, M.dmg * 0.7, 9, 3);
  }
  if (M.hp <= 0) {
    M.alive = false; G.mirror = null; G.mut.mirror = 0;
    banner('🪞 THE REFLECTION SHATTERS');
    spawnChest(M.x, M.y, 'gold');
    spawnParts(M.x, M.y, '#b39ddb', 34, 240, 'shard');
  }
}

// ---------------- Render ----------------
// Shadows are pre-baked at 8 discrete widths so the horde pass issues 1:1
// drawImage calls. A scaled drawImage per enemy per frame (300 of them) forces
// a resample every time and was a measurable slice of the frame.
const shadowBuckets = [];
function getShadow(w) {
  const i = Math.max(0, Math.min(7, Math.round(w / 12) - 1));
  if (!shadowBuckets[i]) {
    const W = (i + 1) * 12, H = Math.max(4, W >> 1);
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(W / 2, H / 2, 1, W / 2, H / 2, W / 2);
    g.addColorStop(0, 'rgba(0,0,0,.34)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.save(); x.translate(W / 2, H / 2); x.scale(1, 0.5); x.beginPath(); x.arc(0, 0, W / 2, 0, 7); x.fill(); x.restore();
    shadowBuckets[i] = c;
  }
  return shadowBuckets[i];
}
function shadow(x, y, w) {
  const s = getShadow(w);
  ctx.drawImage(s, (x - s.width / 2) | 0, (y - s.height / 2) | 0);
}

function render(dt) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b3d24';
  ctx.fillRect(0, 0, cw, ch);
  if (!player) return;

  // Directional trauma: shake along the impact axis with a decaying oscillation,
  // instead of one symmetric noise for every event in the game.
  const shakeMul = (prefs.motion ? 1 : 0.25) * ((prefs.shake == null ? 100 : prefs.shake) / 100);
  let shx = 0, shy = 0;
  if (G.shake > 0.2) {
    const osc = Math.sin(G.time * 62) * G.shake * shakeMul;
    shx = Math.cos(G.shakeAng) * osc + (Math.random() - 0.5) * G.shake * 0.35 * shakeMul;
    shy = Math.sin(G.shakeAng) * osc + (Math.random() - 0.5) * G.shake * 0.35 * shakeMul;
  }
  const zs = viewScale / G.cam.zoom;
  const vw = cw / zs, vh = ch / zs;
  const camX = G.cam.x - vw / 2 + shx, camY = G.cam.y - vh / 2 + shy;
  ctx.setTransform(dpr * zs, 0, 0, dpr * zs, -camX * dpr * zs, -camY * dpr * zs);

  // ---- ground: seamless base + a 768px overlay at a different period so the
  // eye can't lock onto a repeating grid (the old 256px tile was plainly visible)
  const biome = G.region ? G.region.split('-')[1] : 'land';
  const tile = Sprites.get('ground_' + biome);
  const ts = 768;
  const x0 = Math.floor(camX / ts) * ts, y0 = Math.floor(camY / ts) * ts;
  for (let tx = x0; tx < camX + vw; tx += ts)
    for (let ty = y0; ty < camY + vh; ty += ts)
      ctx.drawImage(tile, tx, ty);

  // world edge: a real coastline band rather than a stroked rectangle
  drawCoast(camX, camY, vw, vh);

  const onScreen = (x, y, pad) => x > camX - pad && x < camX + vw + pad && y > camY - pad && y < camY + vh + pad;

  // ---- decor ----
  // Bucketed into a coarse grid so raising density from 150 to ~900 props costs
  // a handful of cell lookups instead of 900 per-item visibility tests.
  {
    const B = DECOR_CELL;
    const bx0 = ((camX - 140) / B) | 0, bx1 = ((camX + vw + 140) / B) | 0;
    const by0 = ((camY - 140) / B) | 0, by1 = ((camY + vh + 140) / B) | 0;
    for (let bx = bx0; bx <= bx1; bx++) for (let by = by0; by <= by1; by++) {
      const cell = decorGrid.get(bx * 4096 + by);
      if (!cell) continue;
      for (let i = 0; i < cell.length; i++) {
        const d = cell[i];
        const s = Sprites.get(d.k);
        ctx.drawImage(s, d.x - s.width * d.s / 2, d.y - s.height * d.s, s.width * d.s, s.height * d.s);
      }
    }
  }

  // ---- ground pools (undertow / mines / volatile) ----
  for (const pl of pools) {
    if (!onScreen(pl.x, pl.y, 80)) continue;
    if (pl.mine) {
      const armed = pl.arm <= 0;
      ctx.globalAlpha = armed ? 0.55 + Math.sin(G.time * 9) * 0.25 : 0.3;
      ctx.fillStyle = armed ? '#ff7043' : '#a1887f';
      ctx.beginPath(); ctx.arc(pl.x, pl.y, 8, 0, 7); ctx.fill();
      ctx.strokeStyle = armed ? 'rgba(255,112,67,.5)' : 'rgba(160,160,160,.3)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r * 0.5, 0, 7); ctx.stroke();
    } else {
      ctx.globalAlpha = 0.3 * Math.min(1, pl.life);
      ctx.fillStyle = pl.color;
      ctx.beginPath(); ctx.arc(pl.x, pl.y, pl.r * (0.9 + Math.sin(G.time * 6 + pl.x) * 0.07), 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- fire patches ----
  for (const pa of patches) {
    if (!onScreen(pa.x, pa.y, 60)) continue;
    ctx.globalAlpha = 0.35 * Math.min(1, pa.life);
    ctx.fillStyle = pa.color;
    ctx.beginPath(); ctx.arc(pa.x, pa.y, pa.r * (0.85 + Math.sin(G.time * 10 + pa.x) * 0.1), 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- totems ----
  for (const t of totems) {
    if (!onScreen(t.x, t.y, 60)) continue;
    ctx.globalAlpha = 0.28; ctx.strokeStyle = '#4dd0e1'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, 7); ctx.stroke();
    ctx.globalAlpha = 1; ctx.fillStyle = '#26a69a';
    ctx.fillRect(t.x - 7, t.y - 26, 14, 30);
    ctx.fillStyle = '#b2ebf2';
    ctx.beginPath(); ctx.arc(t.x, t.y - 28, 6 + Math.sin(G.time * 5) * 1.5, 0, 7); ctx.fill();
  }

  // ---- telegraphs (threat colour law: hostile = magenta/white, never green) ----
  for (const tg of telegraphs) {
    const p = tg.t / tg.dur;
    const col = tg.color || '#ff4081';
    if (tg.mark) {   // elite spawn marker, not a damage zone
      ctx.strokeStyle = col; ctx.globalAlpha = 0.7 * (1 - p); ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r * (0.4 + p * 0.9), 0, 7); ctx.stroke();
      ctx.globalAlpha = 1; continue;
    }
    ctx.strokeStyle = col; ctx.globalAlpha = 0.55 + p * 0.4; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.14 + p * 0.24; ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r * p, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- chests ----
  for (const c of chests) {
    if (!onScreen(c.x, c.y, 60)) continue;
    const bob = Math.sin(G.time * 3 + c.x) * 3;
    const spr = Sprites.get('chest');
    ctx.globalAlpha = 0.5 + Math.sin(G.time * 4) * 0.2;
    ctx.drawImage(Sprites.get('glowGold'), c.x - 40, c.y - 40 + bob, 80, 80);
    ctx.globalAlpha = 1;
    ctx.drawImage(spr, c.x - 22, c.y - 30 + bob);
    if (c.kind === 'gold') {
      ctx.fillStyle = '#ffd54f'; ctx.font = 'bold 11px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('★', c.x, c.y - 34 + bob);
    }
  }

  // ---- corpses (death animation — enemies used to simply vanish) ----
  for (const c of corpses) {
    if (!onScreen(c.x, c.y, 90)) continue;
    const p = c.t / c.dur, spr = Sprites.get(c.spr);
    if (!spr) continue;
    const h = c.dh * c.scale, w2 = spr.width / spr.height * h;
    ctx.save();
    ctx.globalAlpha = 1 - p;
    ctx.translate(c.x, c.y - h * 0.45);
    ctx.rotate(c.rot * p);
    ctx.scale(1 + p * 0.5, 1 - p * 0.55);
    ctx.drawImage(spr, -w2 / 2, -h / 2, w2, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---- cages ----
  for (const c of cages) {
    if (c.broken || !onScreen(c.x, c.y, 80)) continue;
    shadow(c.x, c.y + 40, 70);
    const spr = Sprites.get('cage' + c.heroIdx);
    const bob = Math.sin(G.time * 2 + c.x) * 2;
    ctx.drawImage(spr, c.x - 38, c.y - 44 + bob);
    if (c.flash > 0) {
      ctx.globalAlpha = 0.5; ctx.fillStyle = '#fff';
      ctx.fillRect(c.x - 38, c.y - 44 + bob, 76, 88);
      ctx.globalAlpha = 1;
    }
    // cage HP bar
    if (c.hp < CAGE_HP) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(c.x - 26, c.y - 56, 52, 6);
      ctx.fillStyle = '#ffd54f'; ctx.fillRect(c.x - 25, c.y - 55, 50 * (c.hp / CAGE_HP), 4);
    }
  }

  // ---- gems & hearts ----
  const gs = Sprites.get('gemS'), gm = Sprites.get('gemM'), gl = Sprites.get('gemL');
  for (const g of gems) {
    if (!g.alive || !onScreen(g.x, g.y, 20)) continue;
    const spr = g.val >= 15 ? gl : g.val >= 4 ? gm : gs;
    const b = Math.sin(G.time * 5 + g.x) * 2;
    ctx.drawImage(spr, g.x - spr.width / 2, g.y - spr.height / 2 + b);
  }
  const hs = Sprites.get('heart');
  for (const h of hearts) {
    if (!onScreen(h.x, h.y, 20)) continue;
    ctx.drawImage(hs, h.x - 11, h.y - 10 + Math.sin(G.time * 4 + h.x) * 3);
  }

  // ---- enemies ----
  // Rewritten as a batched, depth-sorted pass. Status effects are pre-baked
  // sprites (they used to cost 6-9 beginPath/fill pairs each, per enemy, per
  // frame) and bars/pips are drawn in grouped passes so canvas state changes
  // don't dominate the loop.
  const vis = G.visBuf || (G.visBuf = []);
  vis.length = 0;
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = enemies[i];
    if (e.alive && onScreen(e.x, e.y, 100)) vis.push(e);
  }
  G.liveEnemies = vis.length;
  vis.sort((a, b) => (a.y - b.y) || (a.id - b.id));   // proper depth overlap

  // Under a heavy horde, drop the per-enemy breathe animation and shadows for
  // the small fry — they're indistinguishable in a 300-strong crowd and they're
  // the difference between 46 and 60 fps.
  const heavy = vis.length > 130;
  // pass 1: shadows (one bucketed sprite, no state changes)
  for (const e of vis) if (!heavy || e.r > 15 || e.elite) shadow(e.x, e.y + 2, e.dh * e.scale * 0.62);
  // pass 2: bodies + per-enemy decoration
  const fxBudget = QL.statusFx;
  let fxUsed = 0;
  for (const e of vis) {
    const spr = Sprites.get(e.base + e.tier);
    const h = e.dh * e.scale;
    const w = spr.width / spr.height * h;
    const cy = bodyY(e);
    if (e.ai === 'runner' && QL.trails) {
      const ma = Math.atan2(e.vy0 || 0, e.vx0 || 0);
      ctx.globalAlpha = 0.3; ctx.strokeStyle = '#fff59d'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let s = 1; s <= 2; s++) { ctx.moveTo(e.x - Math.cos(ma) * s * 8, cy - Math.sin(ma) * s * 8); ctx.lineTo(e.x - Math.cos(ma) * (s * 8 + 7), cy - Math.sin(ma) * (s * 8 + 7)); }
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    if (e.elite) {
      const ring = Sprites.get('elite_' + e.affix.id);
      const sc = (e.r + 16) / 34;
      ctx.globalAlpha = 0.8 + Math.sin(G.time * 4 + e.wob) * 0.2;
      ctx.drawImage(ring, e.x - 48 * sc, cy - 48 * sc, 96 * sc, 96 * sc);
      ctx.globalAlpha = 1;
    }
    // Quantised draw rect: integer, and the squash breathe is bucketed to 5%
    // steps so the browser can reuse a cached resample instead of resizing the
    // bitmap every single frame for every single enemy.
    const squash = heavy ? 1 : 1 + ((Math.sin(G.time * 9 + e.wob) * 20) | 0) / 400;
    if (e.ai === 'burrow' && e.burrowT > 0) continue;   // still underground
    if (e.buffT > 0) {
      ctx.globalAlpha = 0.5; ctx.drawImage(Sprites.get('glowW'), e.x - 26, cy - 26, 52, 52); ctx.globalAlpha = 1;
    }
    const dw = w | 0, dh2 = (h * squash) | 0;
    ctx.drawImage(spr, (e.x - dw / 2) | 0, (e.y - dh2 + 6) | 0, dw, dh2);
    if (e.ai === 'shielded') {
      // the arc faces the player and now MEANS something — flank it for full damage
      const fa = Math.atan2(player.y - e.y, player.x - e.x);
      ctx.strokeStyle = '#b0bec5'; ctx.lineWidth = 3.5; ctx.globalAlpha = 0.85;
      ctx.beginPath(); ctx.arc(e.x, cy, e.r + 6, fa - 0.9, fa + 0.9); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.ai === 'ranged') {
      ctx.globalAlpha = 0.6 + Math.sin(G.time * 8 + e.wob) * 0.3;
      ctx.fillStyle = '#ff4081';
      ctx.beginPath(); ctx.arc(e.x, cy - e.r * 0.3, 3.5, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (e.ai === 'support') {
      ctx.globalAlpha = 0.55 + Math.sin(G.time * 5 + e.wob) * 0.25;
      ctx.strokeStyle = '#ce93d8'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(e.x, cy, e.r + 10, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
    if (e.flash > 0) {
      ctx.globalAlpha = Math.min(0.75, e.flash * 6); ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x, cy, e.r, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // pre-baked status overlays, budgeted to the nearest N enemies
    if (fxUsed < fxBudget) {
      if (e.poisonT > 0) { ctx.drawImage(Sprites.statusFx('poison', e.r), e.x - e.r * 1.3, cy - e.r * 1.3, e.r * 2.6, e.r * 2.6); fxUsed++; }
      if (e.slowT > 0) { ctx.drawImage(Sprites.statusFx('frost', e.r), e.x - e.r * 1.3, cy - e.r * 1.3, e.r * 2.6, e.r * 2.6); fxUsed++; }
      if (e.burnT > 0) { ctx.drawImage(Sprites.statusFx('burn', e.r), e.x - e.r * 1.3, cy - e.r * 1.3, e.r * 2.6, e.r * 2.6); fxUsed++; }
    }
  }
  // pass 3: health bars — grouped so fillStyle changes twice, not 2n times
  ctx.fillStyle = 'rgba(0,0,0,.5)';
  for (const e of vis) if ((e.type !== 'minyar' || e.elite) && e.hp < e.maxhp)
    ctx.fillRect(e.x - 20, e.y - e.dh * e.scale - 4, 40, 5);
  for (const e of vis) if ((e.type !== 'minyar' || e.elite) && e.hp < e.maxhp) {
    ctx.fillStyle = e.elite ? e.affix.color : '#ef5350';
    ctx.fillRect(e.x - 19, e.y - e.dh * e.scale - 3, 38 * Math.max(0, e.hp / e.maxhp), 3);
  }
  // pass 4: elite name tags
  if (vis.some(e => e.elite)) {
    ctx.font = 'bold 10px "Trebuchet MS",sans-serif'; ctx.textAlign = 'center';
    for (const e of vis) if (e.elite) {
      ctx.fillStyle = '#000'; ctx.fillText(e.affix.name.toUpperCase(), e.x + 1, e.y - e.dh * e.scale - 9);
      ctx.fillStyle = e.affix.color; ctx.fillText(e.affix.name.toUpperCase(), e.x, e.y - e.dh * e.scale - 10);
    }
  }
  // pass 5: colorblind danger pips (batched: two fillStyle sets total)
  if (prefs.colorblind) {
    ctx.fillStyle = '#000';
    for (const e of vis) for (let k = 0; k < e.tier; k++)
      ctx.fillRect(e.x - (e.tier - 1) * 3 + k * 6 - 1, e.y - e.dh * e.scale + 1, 5, 5);
    ctx.fillStyle = '#fff';
    for (const e of vis) for (let k = 0; k < e.tier; k++)
      ctx.fillRect(e.x - (e.tier - 1) * 3 + k * 6, e.y - e.dh * e.scale + 2, 3, 3);
  }

  // ---- auras (under fighters) ----
  // Aura visuals now come from the SAME resolver the damage path uses, so
  // Gus's "+40% radius" actually grows the ring instead of silently widening an
  // invisible hitbox.
  const drawAura = (f, isAlly) => {
    const hero = HEROES[f.heroIdx];
    for (const w of hero.weapons) {
      if (w.type !== 'aura') continue;
      const E = effWeapon(f.heroIdx, w);
      const R = E.radius * (E.fx.constrict ? 1 + Math.min(0.5, (f.auraKills || 0) * 0.01) : 1);
      ctx.globalAlpha = 0.13 + Math.sin(G.time * 6) * 0.04;
      ctx.fillStyle = w.color;
      ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, 7); ctx.fill();
      ctx.globalAlpha = 0.35; ctx.strokeStyle = w.color; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(f.x, f.y, R, 0, 7); ctx.stroke();
      ctx.globalAlpha = 1;
    }
  };
  drawAura(player);
  for (const al of allies) drawAura(al, true);

  // ---- relic visuals ----
  for (const r of relics) {
    if (r.def.w.type === 'sweep' && r.L) {
      const col = r.def.w.color;
      for (let b = 0; b < r.beams; b++) {
        const a = r.ang + b * Math.PI;
        const ex = player.x + Math.cos(a) * r.L, ey = player.y + Math.sin(a) * r.L;
        ctx.lineCap = 'round';
        ctx.strokeStyle = col; ctx.globalAlpha = 0.2; ctx.lineWidth = 26;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = 0.8; ctx.lineWidth = 9;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.strokeStyle = '#fffde7'; ctx.globalAlpha = 0.95; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(player.x, player.y); ctx.lineTo(ex, ey); ctx.stroke();
        ctx.globalAlpha = 0.75;
        const bs = 26 + Math.sin(G.time * 12 + b) * 4;
        ctx.drawImage(Sprites.blast(col), ex - bs, ey - bs, bs * 2, bs * 2);
        emitLight(ex, ey, 90, col, 0.45);
        emitLight((player.x + ex) / 2, (player.y + ey) / 2, r.L * 0.5, col, 0.16);
      }
      ctx.globalAlpha = 1;
    }
    if (r.def.w.type === 'petal' && r.cnt) {
      for (let i = 0; i < r.cnt; i++) {
        const a = r.ang + i / r.cnt * 6.283;
        const px2 = player.x + Math.cos(a) * r.R, py2 = player.y + Math.sin(a) * r.R;
        ctx.drawImage(Sprites.proj('orb', r.def.w.color, r.def.w.size), px2 - r.def.w.size * 3, py2 - r.def.w.size * 3);
      }
    }
  }
  for (const s of spires) {
    ctx.fillStyle = '#26a69a'; ctx.fillRect(s.x - 6, s.y - 30, 12, 34);
    ctx.fillStyle = '#80cbc4';
    ctx.beginPath(); ctx.arc(s.x, s.y - 34, 7 + Math.sin(G.time * 6) * 1.5, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.35; ctx.strokeStyle = '#80cbc4'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, 30, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
  }

  // ---- fighters ----
  const drawFighter = (f, isPlayer, dim) => {
    if (!onScreen(f.x, f.y, 60)) return;
    const spr = Sprites.get('body' + f.heroIdx);
    const scale = isPlayer ? 1.18 : dim ? 0.82 : 1;   // the player reads clearly inside their own squad
    const h = 52 * scale, w = spr.width / spr.height * h;
    shadow(f.x, f.y + 2, Math.min(48, w * 0.9));
    const bob = Math.sin(G.time * 10 + f.bob) * 1.5;
    ctx.save();
    ctx.translate(f.x, f.y + bob);
    ctx.scale(f.fx, 1);
    if (f.ghost) ctx.globalAlpha = 0.5;
    else if (dim) ctx.globalAlpha = 0.55;
    if (isPlayer && player.iv > 0 && (G.time * 12 | 0) % 2) ctx.globalAlpha = 0.45;
    ctx.drawImage(spr, -w / 2, -h + 4, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (isPlayer) {
      ctx.strokeStyle = 'rgba(255,213,79,.9)'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.ellipse(f.x, f.y + 5, 18, 8, 0, 0, 7); ctx.stroke();
      // Soulburn window: a visible, temporary power state after a swap
      if (G.burnT > 0) {
        ctx.globalAlpha = 0.5 + Math.sin(G.time * 16) * 0.2;
        ctx.strokeStyle = '#ffd54f'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(f.x, f.y - 20, 30, 0, 7); ctx.stroke();
        ctx.globalAlpha = 1;
      }
      if (G.wardUp) {
        ctx.globalAlpha = 0.42 + Math.sin(G.time * 3) * 0.1;
        ctx.strokeStyle = '#80cbc4'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(f.x, f.y - 20, 34, 0, 7); ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
    // Orbit visuals now use the shared resolver: upgrades that add orbs
    // (Yelp's Fourth Orb, Skyjumper's Constellation, the +2 evolution) used to
    // add a damaging body that was never drawn.
    const hero = HEROES[f.heroIdx];
    for (let wi = 0; wi < hero.weapons.length; wi++) {
      const w2 = hero.weapons[wi];
      if (w2.type !== 'orbit') continue;
      const E = effWeapon(f.heroIdx, w2);
      const ws = f.ws[wi], R = E.radius, n = E.count;
      for (let k = 0; k < n; k++) {
        const a = ws.ang + k / n * 6.283;
        const ox = f.x + Math.cos(a) * R, oy = f.y + Math.sin(a) * R;
        const col = w2.rainbow ? `hsl(${(G.time * 200 + k * 72) % 360},95%,68%)` : w2.color;
        if (E.fx.arc && QL.trails) {
          ctx.globalAlpha = 0.28; ctx.strokeStyle = col; ctx.lineWidth = E.size * 0.8;
          ctx.beginPath(); ctx.arc(f.x, f.y, R, a - 0.55, a); ctx.stroke(); ctx.globalAlpha = 1;
        }
        ctx.drawImage(Sprites.proj('orb', col, E.size), ox - E.size * 3, oy - E.size * 3);
      }
    }
  };
  for (const al of allies) drawFighter(al, false, !al.active);
  for (const g of ghosts) drawFighter(g, false, false);
  drawFighter(player, true);

  // ---- mirror (Mirror mutator) ----
  if (G.mirror && G.mirror.alive) {
    const M = G.mirror, spr = Sprites.get('body' + M.heroIdx);
    const h = 56, w = spr.width / spr.height * h;
    shadow(M.x, M.y + 2, 44);
    ctx.save();
    ctx.translate(M.x, M.y); ctx.scale(M.fx, 1);
    ctx.filter = 'brightness(0.25) saturate(0.4)';
    ctx.drawImage(spr, -w / 2, -h + 4, w, h);
    ctx.filter = 'none';
    ctx.restore();
    ctx.strokeStyle = '#b39ddb'; ctx.lineWidth = 2; ctx.globalAlpha = 0.8;
    ctx.beginPath(); ctx.ellipse(M.x, M.y + 5, 18, 8, 0, 0, 7); ctx.stroke(); ctx.globalAlpha = 1;
    ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(M.x - 26, M.y - h - 10, 52, 5);
    ctx.fillStyle = '#b39ddb'; ctx.fillRect(M.x - 25, M.y - h - 9, 50 * Math.max(0, M.hp / M.maxhp), 3);
  }

  // ---- boss ----
  const drawBoss = b => {
    if (!b || !b.alive) return;
    const spr = Sprites.get('boss');
    const squash = 1 + Math.sin(b.wob * 3) * 0.04;
    const h = BOSS.dh * squash, w = spr.width / spr.height * BOSS.dh;
    // Reef Mother beams (under the body)
    if (b.kind === 'reef' && b.beams) {
      for (let i = 0; i < b.beams; i++) {
        const a2 = b.beamAng + i / b.beams * 6.283;
        ctx.strokeStyle = '#ff4081'; ctx.globalAlpha = 0.5; ctx.lineWidth = 34; ctx.lineCap = 'butt';
        ctx.beginPath(); ctx.moveTo(b.x, b.y - 40); ctx.lineTo(b.x + Math.cos(a2) * b.beamLen, b.y - 40 + Math.sin(a2) * b.beamLen); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.globalAlpha = 0.85; ctx.lineWidth = 8; ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    // Gorge: converging rings
    if (b.gorging > 0) {
      ctx.strokeStyle = '#ce93d8'; ctx.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const p = ((G.time * 1.4 + i / 3) % 1);
        ctx.globalAlpha = p * 0.6;
        ctx.beginPath(); ctx.arc(b.x, b.y - 40, 560 * (1 - p) + 60, 0, 7); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    shadow(b.x, b.y + 6, w * 1.05);
    // ground scorch + presence
    ctx.globalAlpha = 0.22; ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.ellipse(b.x, b.y + 6, w * 0.62, w * 0.22, 0, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
    if (b.kind === 'reef') ctx.filter = 'hue-rotate(220deg) saturate(1.4)';
    ctx.drawImage(spr, b.x - w / 2, b.y - h + 20, w, h);
    ctx.filter = 'none';
    if (b.flash > 0) {
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(b.x, b.y - 70, 90, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // crown fragments
    for (const c of (b.crowns || [])) {
      if (!c.alive) continue;
      ctx.fillStyle = '#ffd54f';
      ctx.save(); ctx.translate(c.x, c.y + Math.sin(G.time * 4 + c.x) * 4);
      ctx.beginPath();
      ctx.moveTo(-14, 10); ctx.lineTo(-14, -6); ctx.lineTo(-7, 2); ctx.lineTo(0, -10);
      ctx.lineTo(7, 2); ctx.lineTo(14, -6); ctx.lineTo(14, 10);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.restore();
    }
  };
  drawBoss(G.boss);
  drawBoss(G.boss2);

  // ---- projectiles: oriented, per-archetype sprites with trails ----
  for (const p of projs) {
    if (!p.alive || !onScreen(p.x, p.y, 40)) continue;
    const col = p.rainbow ? `hsl(${((G.time * 240 + p.x) | 0) % 360},95%,65%)` : p.color;
    if (p.trail && p.trail.length >= 4) {
      ctx.strokeStyle = col; ctx.lineWidth = p.size * 0.9; ctx.lineCap = 'round';
      ctx.globalAlpha = 0.28;
      ctx.beginPath(); ctx.moveTo(p.trail[0], p.trail[1]);
      for (let t = 2; t < p.trail.length; t += 2) ctx.lineTo(p.trail[t], p.trail[t + 1]);
      ctx.stroke(); ctx.globalAlpha = 1;
    }
    const spr = Sprites.proj(p.art, col, p.size);
    if (p.art === 'dot' || p.art === 'orb') {
      ctx.drawImage(spr, p.x - spr.width / 2, p.y - spr.height / 2);
    } else {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.ang);
      ctx.drawImage(spr, -spr.width / 2, -spr.height / 2);
      ctx.restore();
    }
  }
  // enemy bullets — magenta/white with a dark outline, per the threat colour law.
  // They used to be #7cb342 on #2f6b3d ground: a contrast ratio near 2:1, which
  // made them effectively undodgeable.
  const ebs = Sprites.get('ebullet');
  for (const eb of ebullets) {
    if (!eb.alive || !onScreen(eb.x, eb.y, 40)) continue;
    ctx.drawImage(ebs, eb.x - ebs.width / 2, eb.y - ebs.height / 2);
  }

  // ---- effects ----
  for (const fx of effects) {
    const p = 1 - fx.t / fx.dur;
    ctx.globalAlpha = p;
    if (fx.type === 'chain') {
      // jagged bolt with forked branches and a flash at every node, rather than
      // one thin polyline
      const seg = (x0, y0, x1, y1, w, col) => {
        ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round';
        ctx.beginPath(); ctx.moveTo(x0, y0);
        const n = 4;
        for (let s = 1; s < n; s++) {
          const t = s / n;
          ctx.lineTo(x0 + (x1 - x0) * t + (Math.random() - 0.5) * 16,
                     y0 + (y1 - y0) * t + (Math.random() - 0.5) * 16);
        }
        ctx.lineTo(x1, y1); ctx.stroke();
      };
      for (let i = 1; i < fx.pts.length; i++) {
        const a = fx.pts[i - 1], b2 = fx.pts[i];
        const ay = i === 1 ? a.y - 14 : a.y;
        seg(a.x, ay, b2.x, b2.y, 7 * p, `rgba(255,255,255,${p * 0.35})`);   // outer glow
        seg(a.x, ay, b2.x, b2.y, 2.5 * p, fx.color);                         // core
        if (Math.random() < 0.6) {                                           // fork
          const fa = Math.atan2(b2.y - ay, b2.x - a.x) + (Math.random() - 0.5) * 1.6;
          seg(b2.x, b2.y, b2.x + Math.cos(fa) * 26, b2.y + Math.sin(fa) * 26, 1.6 * p, fx.color);
        }
      }
      for (let i = 1; i < fx.pts.length; i++) {
        const n = 13 * p;
        ctx.globalAlpha = p * 0.8;
        ctx.drawImage(Sprites.get('glowW'), fx.pts[i].x - n, fx.pts[i].y - n, n * 2, n * 2);
        ctx.globalAlpha = p;
      }
    } else if (fx.type === 'beam') {
      // layered: wide soft glow, solid core, white centre, plus an impact burst
      // at the far end so the beam terminates on something
      const ex = fx.x + Math.cos(fx.ang) * fx.len, ey = fx.y - 12 + Math.sin(fx.ang) * fx.len;
      ctx.lineCap = 'round';
      ctx.globalAlpha = p * 0.28; ctx.strokeStyle = fx.color; ctx.lineWidth = fx.wid * 2.6;
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y - 12); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.globalAlpha = p; ctx.lineWidth = fx.wid * (0.6 + p * 0.4);
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y - 12); ctx.lineTo(ex, ey); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = Math.max(1.5, fx.wid * 0.3 * p);
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y - 12); ctx.lineTo(ex, ey); ctx.stroke();
      const bs = 30 * p;
      ctx.globalAlpha = p * 0.9;
      ctx.drawImage(Sprites.blast(fx.color), ex - bs, ey - bs, bs * 2, bs * 2);
    } else if (fx.type === 'slash') {
      // A tapered swoosh with a white-hot leading edge, swept through the arc,
      // instead of a uniform stroked arc segment.
      const spr = Sprites.slash(fx.color);
      const prog = fx.t / fx.dur;
      const R = fx.r * (0.82 + 0.18 * prog);
      const a = fx.ang - fx.arc / 2 + fx.arc * Math.min(1, prog * 1.35);
      ctx.save();
      ctx.translate(fx.x, fx.y - 10);
      ctx.rotate(a);
      ctx.globalAlpha = p;
      const s = R / 82;
      ctx.drawImage(spr, -96 * s, -96 * s, 192 * s, 192 * s);
      ctx.restore();
    } else if (fx.type === 'explo') {
      // three layers: white-hot core, expanding shock ring, drifting smoke
      const prog = fx.t / fx.dur;
      const core = fx.r * (0.55 + prog * 0.75);
      ctx.globalAlpha = p * p;
      const bs = Sprites.blast(fx.color);
      ctx.drawImage(bs, fx.x - core, fx.y - core, core * 2, core * 2);
      const rr = fx.r * (0.6 + prog * 1.35);
      ctx.globalAlpha = p * 0.85;
      const rs = Sprites.ring(fx.color);
      ctx.drawImage(rs, fx.x - rr, fx.y - rr, rr * 2, rr * 2);
      if (QL.trails) {
        ctx.globalAlpha = p * 0.35;
        const sm = Sprites.smoke(), ss = fx.r * (0.7 + prog * 0.9);
        ctx.drawImage(sm, fx.x - ss, fx.y - ss - prog * 14, ss * 2, ss * 2);
      }
    } else if (fx.type === 'shock') {
      const prog = fx.t / fx.dur;
      const pr = fx.r * prog;
      ctx.globalAlpha = p * 0.9;
      const rs = Sprites.ring(fx.color);
      ctx.drawImage(rs, fx.x - pr, fx.y - pr, pr * 2, pr * 2);
      ctx.globalAlpha = p * 0.55; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, pr, 0, 7); ctx.stroke();
    } else if (fx.type === 'muzzle') {
      const spr = Sprites.muzzle(fx.color);
      ctx.save();
      ctx.translate(fx.x, fx.y); ctx.rotate(fx.ang);
      ctx.globalAlpha = p;
      const s = fx.s || 1;
      ctx.drawImage(spr, -6 * s, -24 * s, 64 * s, 48 * s);
      ctx.restore();
    } else if (fx.type === 'impact') {
      // directional spark burst at the point of contact
      ctx.globalAlpha = p;
      ctx.strokeStyle = fx.color; ctx.lineWidth = 2.4 * p; ctx.lineCap = 'round';
      const prog = fx.t / fx.dur;
      ctx.beginPath();
      for (let k = 0; k < 5; k++) {
        const a = fx.ang + (k - 2) * 0.32;
        const r0 = 5 + prog * 16, r1 = r0 + 9 * p;
        ctx.moveTo(fx.x + Math.cos(a) * r0, fx.y + Math.sin(a) * r0);
        ctx.lineTo(fx.x + Math.cos(a) * r1, fx.y + Math.sin(a) * r1);
      }
      ctx.stroke();
      ctx.globalAlpha = p * p;
      const cs = 16 * (0.5 + prog);
      ctx.drawImage(Sprites.get('glowW'), fx.x - cs, fx.y - cs, cs * 2, cs * 2);
    } else if (fx.type === 'cone') {
      ctx.fillStyle = fx.color; ctx.globalAlpha = p * 0.35;
      ctx.beginPath(); ctx.moveTo(fx.x, fx.y);
      ctx.arc(fx.x, fx.y, fx.r, fx.ang - fx.arc / 2, fx.ang + fx.arc / 2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = fx.color; ctx.globalAlpha = p * 0.8; ctx.lineWidth = 2; ctx.stroke();
    } else if (fx.type === 'bolt') {
      ctx.strokeStyle = fx.color; ctx.lineWidth = 5 * p; ctx.lineCap = 'round';
      ctx.beginPath();
      let bx = fx.x, by = fx.y - 300;
      ctx.moveTo(bx, by);
      for (let s = 0; s < 6; s++) { bx += (Math.random() - 0.5) * 26; by += 50; ctx.lineTo(bx, by); }
      ctx.lineTo(fx.x, fx.y); ctx.stroke();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 2 * p; ctx.stroke();
    } else if (fx.type === 'ghost') {
      if (fx.t < 0) continue;
      const spr = Sprites.get('body' + fx.heroIdx);
      const h = 52, w2 = spr.width / spr.height * h;
      ctx.save(); ctx.globalAlpha = p * 0.45;
      ctx.translate(fx.x, fx.y); ctx.scale(fx.fxDir, 1);
      ctx.drawImage(spr, -w2 / 2, -h + 4, w2, h);
      ctx.restore();
    } else if (fx.type === 'tierup') {
      // ground rings + a rising column of motes + a halo — the previous version
      // was two ellipse strokes for what is a Guardian's biggest milestone
      const fx2 = fx.f, prog = fx.t / fx.dur;
      ctx.strokeStyle = fx.color; ctx.globalAlpha = p;
      for (let k = 0; k < 2; k++) {
        const rr = (10 + k * 10) + prog * (46 - k * 14);
        ctx.lineWidth = (3.5 - k * 1.4) * p;
        ctx.beginPath(); ctx.ellipse(fx2.x, fx2.y + 4, rr, rr * 0.45, 0, 0, 7); ctx.stroke();
      }
      ctx.fillStyle = fx.color;
      for (let k = 0; k < 7; k++) {
        const ph = (prog + k / 7) % 1;
        const a = k * 1.9 + G.time * 2;
        ctx.globalAlpha = p * (1 - ph) * 0.95;
        ctx.beginPath();
        ctx.arc(fx2.x + Math.cos(a) * (16 - ph * 8), fx2.y + 2 - ph * 64, 2.6 * (1 - ph) + 0.8, 0, 7);
        ctx.fill();
      }
      const hs = 46 * p;
      ctx.globalAlpha = p * 0.5;
      ctx.drawImage(Sprites.light(fx.color), fx2.x - hs, fx2.y - 20 - hs, hs * 2, hs * 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---- particles: spark / puff / shard / ring, not untextured squares ----
  const glowW = Sprites.get('glowW');
  for (const p of parts) {
    if (!p.alive) continue;
    const a = 1 - p.t / p.dur;
    ctx.globalAlpha = a;
    if (p.kind === 'puff') {
      ctx.globalCompositeOperation = 'lighter';
      const s = p.size * (3 + p.t * 22);
      ctx.globalAlpha = a * 0.5;
      ctx.drawImage(glowW, p.x - s / 2, p.y - s / 2, s, s);
      ctx.globalCompositeOperation = 'source-over';
    } else if (p.kind === 'shard') {
      ctx.save();
      ctx.translate(p.x, p.y); ctx.rotate(p.rot + p.spin * p.t);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.moveTo(p.size * 1.6, 0); ctx.lineTo(-p.size, p.size); ctx.lineTo(-p.size, -p.size);
      ctx.closePath(); ctx.fill();
      ctx.restore();
    } else {
      // spark: stretched along its velocity so motion reads
      const sp = Math.hypot(p.vx, p.vy);
      ctx.strokeStyle = p.color; ctx.lineWidth = p.size * 0.8; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x - p.vx / (sp || 1) * Math.min(14, sp * 0.03), p.y - p.vy / (sp || 1) * Math.min(14, sp * 0.03));
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;

  // ---- lighting: ambient shade + coloured emitters ----
  if (QL.light) { gatherLights(onScreen); drawLightLayer(camX, camY, zs, onScreen); }

  // ---- floaters ----
  ctx.textAlign = 'center';
  for (const fl of floaters) {
    const a = 1 - fl.t / 0.8;
    ctx.globalAlpha = a;
    const sz = Math.round(15 * fl.s);
    ctx.font = `bold ${sz}px "Trebuchet MS",sans-serif`;
    const ry = fl.y - fl.t * 40 - (fl.s > 1.3 ? fl.t * 14 : 0);
    ctx.fillStyle = '#000';
    ctx.fillText(fl.txt, fl.x + 1.5, ry + 1.5);
    ctx.fillStyle = fl.color;
    ctx.fillText(fl.txt, fl.x, ry);
  }
  ctx.globalAlpha = 1;

  // ---- edge arrows (screen space): nearest cage (gold) + King Glob (red) ----
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const edgeArrow = (tx, ty, minDist, color, ring, label) => {
    const dx = tx - player.x, dy = ty - player.y;
    const d = Math.hypot(dx, dy);
    if (d <= minDist) return;
    const a = Math.atan2(dy, dx);
    const ex = cw / 2 + Math.cos(a) * (Math.min(cw, ch) * (ring || 0.36));
    const ey = ch / 2 + Math.sin(a) * (Math.min(cw, ch) * (ring || 0.36));
    ctx.save();
    ctx.translate(ex, ey); ctx.rotate(a);
    ctx.globalAlpha = 0.5 + Math.sin(G.time * 4) * 0.25;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
    ctx.rotate(-a);
    ctx.font = 'bold 10px "Trebuchet MS",sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label !== undefined ? label : `${Math.round(d / 50) * 50 / 10}0m`, 0, 24);
    ctx.restore();
    ctx.globalAlpha = 1;
  };
  if (G.running && !G.over) {
    let nearest = null, nd = Infinity;
    for (const c of cages) {
      if (c.broken) continue;
      const d = (c.x - player.x) ** 2 + (c.y - player.y) ** 2;
      if (d < nd) { nd = d; nearest = c; }
    }
    if (nearest && nd < 400 * 400) coach('cage');
    if (nearest) edgeArrow(nearest.x, nearest.y, 330, '#ffd54f');
    if (G.boss && G.boss.alive) edgeArrow(G.boss.x, G.boss.y, 380, '#ff5252', 0.4, '👑');
  }

  // move-stick visual
  if (joyMove.active) {
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(joyMove.bx, joyMove.by, 46, 0, 7); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(joyMove.bx + joyMove.dx * 46, joyMove.by + joyMove.dy * 46, 20, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // powershot flash
  if (G.flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.55, G.flash)})`;
    ctx.fillRect(0, 0, cw, ch);
  }

  // damage feedback: red edge vignette on hit, soft pulse while low on HP
  let danger = G.hurtFlash;
  if (player && G.running && !G.over && player.hp < maxHP() * 0.3)
    danger = Math.max(danger, 0.16 + Math.sin(G.time * 5) * 0.08);
  if (danger > 0) {
    const vg = ctx.createRadialGradient(cw / 2, ch / 2, Math.min(cw, ch) * 0.36, cw / 2, ch / 2, Math.max(cw, ch) * 0.62);
    vg.addColorStop(0, 'rgba(200,0,0,0)');
    vg.addColorStop(1, `rgba(200,10,10,${Math.min(0.55, danger)})`);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, cw, ch);
  }

  // ---- minimap + surge warning (screen space) ----
  if (G.running && !G.over && prefs.minimap) drawMinimap();
  if (G.running && !G.over) drawSurgeWarning();
}

// A real coastline instead of a 20px stroked rectangle.
function drawCoast(camX, camY, vw, vh) {
  const near = camX < 260 || camY < 260 || camX + vw > WORLD - 260 || camY + vh > WORLD - 260;
  if (!near) return;
  ctx.save();
  ctx.fillStyle = 'rgba(224,204,150,.5)';
  ctx.fillRect(-90, -90, WORLD + 180, 96);
  ctx.fillRect(-90, WORLD - 6, WORLD + 180, 96);
  ctx.fillRect(-90, -90, 96, WORLD + 180);
  ctx.fillRect(WORLD - 6, -90, 96, WORLD + 180);
  ctx.fillStyle = 'rgba(12,60,80,.75)';
  ctx.fillRect(-420, -420, WORLD + 840, 340);
  ctx.fillRect(-420, WORLD + 80, WORLD + 840, 340);
  ctx.fillRect(-420, -420, 340, WORLD + 840);
  ctx.fillRect(WORLD + 80, -420, 340, WORLD + 840);
  // animated surf line
  ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 3;
  const surf = Math.sin(G.time * 1.6) * 7;
  ctx.strokeRect(-84 + surf, -84 + surf, WORLD + 168 - surf * 2, WORLD + 168 - surf * 2);
  ctx.restore();
}

// ================================================================
// LIGHTING
// The previous pass was a single additive white glow, which washes out against
// a fully-lit world — additive light only reads if something darkens the scene
// first. This is a two-part model: an ambient MULTIPLY tint that shades the
// world by biome and by how far into the run you are, then coloured additive
// emitters punched through it. The ambient darkening also doubles as a clock:
// the island dims as King Glob approaches.
// ================================================================
const AMBIENT = {
  land: { day: [255, 252, 236], dusk: [120, 116, 168], night: [58, 62, 112] },
  sea:  { day: [238, 250, 255], dusk: [104, 130, 176], night: [40, 66, 108] },
  sky:  { day: [255, 244, 252], dusk: [150, 122, 190], night: [72, 54, 122] },
};
// 0 = full day, 1 = full night. Ramps across the run and deepens for a boss.
// Capped well short of 1: "colour = danger" is the game's primary information
// channel, so the world may get moody but enemy tiers must stay readable.
const AMBIENT_MAX = 0.62;
function ambientPhase() {
  if (prefs.dayNight === 0) return 0;
  const t = Math.min(1, G.time / Math.max(60, G.nextBossAt));
  const base = Math.pow(t, 1.3) * 0.52;
  const bossDark = (G.boss && G.boss.alive) ? 0.18 : 0;
  return Math.min(AMBIENT_MAX, base + bossDark) * ((prefs.dayNight == null ? 100 : prefs.dayNight) / 100);
}
function ambientColor() {
  const A = AMBIENT[G.biome] || AMBIENT.land;
  const p = ambientPhase();
  const lerp = (a, b, k) => a + (b - a) * k;
  let from = A.day, to = A.dusk, k = p / 0.55;
  if (p > 0.55) { from = A.dusk; to = A.night; k = (p - 0.55) / 0.45; }
  k = Math.max(0, Math.min(1, k));
  return [lerp(from[0], to[0], k) | 0, lerp(from[1], to[1], k) | 0, lerp(from[2], to[2], k) | 0];
}

// Emitters are collected during the world pass, then drawn in one batch.
let lights = [], lightN = 0;
function emitLight(x, y, r, color, a) {
  if (!QL.light || lightN >= 90) return;
  const L = lights[lightN] || (lights[lightN] = {});
  L.x = x; L.y = y; L.r = r; L.c = color; L.a = a;
  lightN++;
}

function drawLightLayer(camX, camY, zs, onScreen) {
  // --- 1. ambient shade (multiply): this is what makes lights read at all ---
  const p = ambientPhase();
  if (p > 0.02) {
    const [r, g, b] = ambientColor();
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = 'multiply';
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(0, 0, cw, ch);
    ctx.restore();
  }

  // --- 2. coloured additive emitters, at half resolution ---
  const L = lightCtx, k = 0.5;
  L.setTransform(1, 0, 0, 1, 0, 0);
  L.clearRect(0, 0, lightCv.width, lightCv.height);
  L.setTransform(zs * k, 0, 0, zs * k, -camX * zs * k, -camY * zs * k);
  L.globalCompositeOperation = 'lighter';
  // brighter emitters when the world is darker, so the balance holds all run
  const boost = 0.55 + p * 0.85;
  for (let i = 0; i < lightN; i++) {
    const e = lights[i];
    const spr = Sprites.light(e.c);
    L.globalAlpha = Math.min(1, e.a * boost);
    L.drawImage(spr, e.x - e.r, e.y - e.r, e.r * 2, e.r * 2);
  }
  L.globalAlpha = 1;
  L.globalCompositeOperation = 'source-over';
  ctx.save();
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(lightCv, 0, 0, cw, ch);
  ctx.globalCompositeOperation = 'source-over';
  ctx.restore();
  lightN = 0;
}

// Collect the frame's emitters. Kept separate from drawing so the world pass
// can add one-off lights (explosions, muzzle flashes) as it goes.
function gatherLights(onScreen) {
  if (!QL.light) return;
  const hero = HEROES[player.heroIdx];
  // wide soft fill first, so the area you're actually fighting in stays legible
  emitLight(player.x, player.y - 18, 330, '#fff3d0', 0.13 + ambientPhase() * 0.16);
  emitLight(player.x, player.y - 18, 96, hero.accent, 0.34);
  if (G.burnT > 0) emitLight(player.x, player.y - 18, 150, '#ffd54f', 0.3);
  // projectiles: budgeted to the largest, so a 400-projectile screen can't
  // make the light pass the dominant frame cost
  let lb = 34;
  for (let i = 0; i < MAX_PROJ && lb > 0; i++) {
    const pr = projs[i];
    if (!pr.alive || pr.size < 5 || !onScreen(pr.x, pr.y, 20)) continue;
    emitLight(pr.x, pr.y, pr.size * 5.5, pr.color, 0.24); lb--;
  }
  for (const c of chests) emitLight(c.x, c.y, 78, '#ffd54f', 0.45);
  for (const t of totems) emitLight(t.x, t.y - 26, 70, '#4dd0e1', 0.3);
  for (const s of spires) emitLight(s.x, s.y - 30, 56, '#80cbc4', 0.28);
  for (const pa of patches) emitLight(pa.x, pa.y, pa.r * 1.7, pa.color, 0.3 * Math.min(1, pa.life));
  for (const pl of pools) if (!pl.mine) emitLight(pl.x, pl.y, pl.r * 1.5, pl.color, 0.22);
  for (const e of (G.visBuf || [])) {
    if (e.elite) emitLight(e.x, bodyY(e), 92, e.affix.color, 0.3);
    else if (e.burnT > 0) emitLight(e.x, bodyY(e), 44, '#ff7043', 0.22);
    else if (e.slowT > 0) emitLight(e.x, bodyY(e), 40, '#b3e5fc', 0.16);
  }
  for (const al of allies) if (al.active) emitLight(al.x, al.y - 14, 52, HEROES[al.heroIdx].accent, 0.16);
  for (const cg of cages) if (!cg.broken && onScreen(cg.x, cg.y, 90)) emitLight(cg.x, cg.y - 10, 62, '#ffd54f', 0.26);
  if (G.boss && G.boss.alive)
    emitLight(G.boss.x, G.boss.y - 70, 210, G.boss.kind === 'reef' ? '#ff4081' : '#9ccc65', 0.32 + (G.boss.frenzy ? 0.15 : 0));
  // effects contribute their own transient light
  for (const fx of effects) {
    const life = 1 - fx.t / fx.dur;
    if (fx.type === 'explo') emitLight(fx.x, fx.y, fx.r * 2.4 * (1.2 - life * 0.5), fx.color, life * 0.85);
    else if (fx.type === 'shock') emitLight(fx.x, fx.y, fx.r * (fx.t / fx.dur) * 1.4, fx.color, life * 0.5);
    else if (fx.type === 'bolt') emitLight(fx.x, fx.y, 190, fx.color, life * 0.8);
    else if (fx.type === 'muzzle') emitLight(fx.x, fx.y, 70, fx.color, life * 0.6);
    else if (fx.type === 'tierup') emitLight(fx.f.x, fx.f.y - 12, 130, fx.color, life * 0.6);
  }
}

// A LOCAL radar, not a whole-world map. The old version squeezed 5200px into
// ~78px, so cages were 3px dots in an undifferentiated cluster.
const RADAR_R = 2400;
function drawMinimap() {
  const size = Math.round(Math.min(cw, ch) * 0.19);
  const pad = 12 + (parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--sal')) || 0);
  const cx = pad + size / 2, cy = pad + size / 2 + 74;
  const R = size / 2, s = R / RADAR_R;
  ctx.save();
  ctx.globalAlpha = 0.8;
  ctx.fillStyle = 'rgba(6,26,18,.7)';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,.22)'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
  // current view rectangle
  ctx.strokeStyle = 'rgba(255,255,255,.18)';
  ctx.strokeRect(cx - viewW * s / 2, cy - viewH * s / 2, viewW * s, viewH * s);
  // blip: inside the radar it's positional; outside it clamps to the rim as a chevron
  const blip = (wx, wy, col, r, chev) => {
    let dx = (wx - player.x) * s, dy = (wy - player.y) * s;
    const d = Math.hypot(dx, dy);
    if (d > R - 4) {
      if (!chev) return;
      const a = Math.atan2(dy, dx);
      dx = Math.cos(a) * (R - 5); dy = Math.sin(a) * (R - 5);
      ctx.save(); ctx.translate(cx + dx, cy + dy); ctx.rotate(a);
      ctx.fillStyle = col;
      ctx.beginPath(); ctx.moveTo(4, 0); ctx.lineTo(-3, -3.4); ctx.lineTo(-3, 3.4); ctx.closePath(); ctx.fill();
      ctx.restore(); return;
    }
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(cx + dx, cy + dy, r, 0, 7); ctx.fill();
  };
  for (const c of cages) if (!c.broken) blip(c.x, c.y, c.siege ? '#ff8a80' : '#ffd54f', 2.6, true);
  for (const c of chests) blip(c.x, c.y, '#fff59d', 3, true);
  for (const e of enemies) if (e.alive && e.elite) blip(e.x, e.y, e.affix.color, 3, true);
  ctx.fillStyle = 'rgba(129,212,250,.8)';
  for (const al of allies) { const dx = (al.x - player.x) * s, dy = (al.y - player.y) * s; if (Math.hypot(dx, dy) < R - 3) ctx.fillRect(cx + dx - 1, cy + dy - 1, 2, 2); }
  if (G.boss && G.boss.alive) blip(G.boss.x, G.boss.y, '#ff5252', 4 + Math.sin(G.time * 6), true);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(cx, cy, 3, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(255,213,79,.9)'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, 5.5, 0, 7); ctx.stroke();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// Directional warning before a horde surge, so it's anticipated not just suffered.
function drawSurgeWarning() {
  if (!G.surgeWarn) return;
  const a = G.surgeWarn.a, p = G.surgeWarn.t / 2.5;
  const ex = cw / 2 + Math.cos(a) * Math.min(cw, ch) * 0.42;
  const ey = ch / 2 + Math.sin(a) * Math.min(cw, ch) * 0.42;
  ctx.save();
  ctx.translate(ex, ey); ctx.rotate(a);
  ctx.globalAlpha = 0.35 + Math.sin(G.time * 10) * 0.3 * p;
  ctx.fillStyle = '#ff4081';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(20 - i * 13, 0); ctx.lineTo(2 - i * 13, -15); ctx.lineTo(2 - i * 13, 15);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ---------------- HUD ----------------
const $ = id => document.getElementById(id);
let hudTick = 0;
const hudCache = {};   // skip DOM writes when the value hasn't changed
function setHud(id, prop, val) {
  if (hudCache[id] === val) return;
  hudCache[id] = val;
  if (prop === 'w') $(id).style.width = val; else $(id).textContent = val;
}
function updateHud(dt) {
  hudTick -= dt;
  if (hudTick > 0) return;
  hudTick = 0.12;
  setHud('hp-bar', 'w', Math.round(Math.max(0, player.hp / maxHP() * 100)) + '%');
  setHud('hp-text', 't', `${Math.ceil(player.hp)} / ${maxHP()}`);
  setHud('xp-bar', 'w', Math.round(Math.min(100, G.xp / G.xpNext * 100)) + '%');
  setHud('lvl-text', 't', 'LV ' + G.level);
  const t = G.time | 0;
  setHud('timer', 't', `${(t / 60) | 0}:${String(t % 60).padStart(2, '0')}`);
  setHud('kills', 't', '☠ ' + G.kills);
  if (G.boss && G.boss.alive)
    setHud('boss-hp-bar', 'w', Math.max(0, G.boss.hp / G.boss.maxhp * 100).toFixed(1) + '%');
  // King Glob countdown — lets players plan their cage route (and endless returns)
  const etaOn = !G.boss && G.time > G.nextBossAt - 120 && G.time < G.nextBossAt;
  if (hudCache.etaOn !== etaOn) { hudCache.etaOn = etaOn; $('boss-eta').classList.toggle('hidden', !etaOn); }
  if (etaOn) setHud('boss-eta', 't', `👑 ${fmtTime(G.nextBossAt - G.time)}`);
  // combo meter — continuous score feedback for playing aggressively
  const comboOn = G.combo >= 3;
  if (hudCache.comboOn !== comboOn) { hudCache.comboOn = comboOn; $('combo').classList.toggle('hidden', !comboOn); }
  if (comboOn) {
    setHud('combo-n', 't', '×' + G.combo);
    setHud('combo-mul', 't', G.comboMul.toFixed(2) + '×');
    $('combo-bar').style.width = Math.round(Math.min(1, G.comboT / 1.2) * 100) + '%';
  }
  // Soul pips (possession currency) + dash cooldown ring
  setHud('soul-pips', 't', '✦'.repeat(G.soul) + '·'.repeat(SOUL_MAX - G.soul));
  const dashPct = G.dashCd > 0 ? Math.round((1 - G.dashCd / DASH_CD) * 100) : 100;
  setHud('dash-fill', 'w', dashPct + '%');
  const dashReady = G.dashCd <= 0;
  if (hudCache.dashReady !== dashReady) { hudCache.dashReady = dashReady; $('dash-btn').classList.toggle('ready', dashReady); }
  // powershot button radial
  const hs = heroState[player.heroIdx];
  const pct = Math.round(Math.min(1, hs ? hs.charge : 0) * 100);
  setHud('ps-fill', 'w', pct + '%');
  const psReady = hs && hs.charge >= 1;
  if (hudCache.psReady !== psReady) { hudCache.psReady = psReady; $('ps-btn').classList.toggle('ready', !!psReady); }
  if (psReady) coach('power');
  if (G.relicDirty) { G.relicDirty = 0; renderRelicHud(); }
  maybeRefreshRibbon(0.12);
  updateStrip();
}
function renderRelicHud() {
  const el = $('relic-hud');
  if (!el) return;
  el.innerHTML = relics.map(r => `<span class="rh" title="${r.def.name}">${r.def.icon}<b>${r.lv}</b></span>`).join('');
}
function updateHudCounts() {
  $('freed').textContent = `⛓ ${freedSet.size}/24`;
}

// Banners queue instead of overwriting each other, so a tier-up right after
// a cage break still gets read. Spam beyond 4 drops the oldest.
let bannerQ = [], bannerNext = 0, bannerHide = null, bannerPump = null;
function banner(txt) {
  if (bannerQ.length > 3) bannerQ.shift();
  bannerQ.push(txt);
  pumpBanner();
}
function pumpBanner() {
  if (bannerPump) return;
  bannerPump = setTimeout(() => {
    bannerPump = null;
    const txt = bannerQ.shift();
    if (txt === undefined) return;
    const b = $('banner');
    b.textContent = txt;
    b.classList.remove('hidden');
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
    bannerNext = performance.now() + 1500;
    clearTimeout(bannerHide);
    bannerHide = setTimeout(() => b.classList.add('hidden'), 2600);
    if (bannerQ.length) pumpBanner();
  }, Math.max(0, bannerNext - performance.now()));
}

// ---------------- Facecard strip & possession ----------------
// One shared <video> shows the active hero's idle animation on their card.
const stripCards = new Map();   // heroIdx -> { card, bar }
let stripVideo = null;
function getStripVideo() {
  if (!stripVideo) {
    stripVideo = document.createElement('video');
    stripVideo.muted = true; stripVideo.loop = true; stripVideo.autoplay = true;
    stripVideo.playsInline = true; stripVideo.setAttribute('playsinline', '');
    stripVideo.className = 'fc-video';
    stripVideo.onerror = () => { stripVideo.style.display = 'none'; };
  }
  return stripVideo;
}

// The strip used to render every freed Guardian — 24 cards spanning the full
// width and eating the bottom ~90px of a 390px-tall landscape screen, i.e. both
// thumb zones. Now it's a 4-card quick-swap ribbon: you, plus the three best
// swap targets. The full roster is one tap away in the pause screen.
const RIBBON = 4;
function ribbonOrder() {
  const others = [...freedSet].filter(i => i !== (player && player.heroIdx));
  others.sort((a, b) => {
    const A = heroState[a] || {}, B = heroState[b] || {};
    return (B.charge >= 1 ? 2 : 0) + (B.tier || 0) * 0.1 - ((A.charge >= 1 ? 2 : 0) + (A.tier || 0) * 0.1)
      || (B.charge || 0) - (A.charge || 0);
  });
  const out = player ? [player.heroIdx] : [];
  for (const i of others) { if (out.length >= RIBBON) break; out.push(i); }
  return out;
}
function rebuildStrip() {
  const strip = $('facecard-strip');
  strip.innerHTML = '';
  stripCards.clear();
  for (const idx of ribbonOrder()) {
    const card = document.createElement('div');
    card.className = 'facecard';
    card.style.setProperty('--glow', HEROES[idx].accent);
    card.appendChild(Sprites.portrait(idx, 88));
    const bar = document.createElement('div');
    bar.className = 'fc-bar';
    bar.innerHTML = '<i></i>';
    card.appendChild(bar);
    const zap = document.createElement('div');
    zap.className = 'fc-zap';
    zap.textContent = '⚡';
    card.appendChild(zap);
    card.addEventListener('pointerdown', e => {
      e.stopPropagation();
      if (idx === player.heroIdx) powershot();   // your own card still works as a powershot button
      else possess(idx);
    });
    strip.appendChild(card);
    stripCards.set(idx, { card, bar: bar.firstChild });
  }
  // a "+N more" chip opens the full roster rather than showing all 24 inline
  const extra = freedSet.size - stripCards.size;
  if (extra > 0) {
    const more = document.createElement('div');
    more.className = 'facecard more';
    more.innerHTML = `<span>+${extra}</span>`;
    more.addEventListener('pointerdown', e => { e.stopPropagation(); openRoster(); });
    strip.appendChild(more);
  }
  updateStrip();
}
// keep the ribbon showing the best swap targets without rebuilding every frame
let ribbonTick = 0;
function maybeRefreshRibbon(dt) {
  ribbonTick -= dt;
  if (ribbonTick > 0) return;
  ribbonTick = 1.5;
  const want = ribbonOrder().join(',');
  if (want !== G.ribbonKey) { G.ribbonKey = want; rebuildStrip(); }
}

function updateStrip() {
  for (const [idx, els] of stripCards) {
    const hs = heroState[idx] || { tier: 0, charge: 0 };
    const active = player && idx === player.heroIdx;
    const cls = `facecard tier${hs.tier}` + (hs.charge >= 1 ? ' ready' : '') + (active ? ' active' : '');
    if (els.cls !== cls) { els.cls = cls; els.card.className = cls; }
    const barW = Math.round(Math.min(100, hs.charge * 100)) + '%';
    if (els.barW !== barW) { els.barW = barW; els.bar.style.width = barW; }
    if (active) {
      const v = getStripVideo();
      if (v.parentElement !== els.card || v.dataset.hero !== HEROES[idx].id) {
        v.dataset.hero = HEROES[idx].id;
        v.style.display = '';
        v.src = `assets/video/${HEROES[idx].id}.mp4`;
        els.card.appendChild(v);
        v.play().catch(() => {});
      }
    }
  }
}

function possess(idx) {
  if (G.over || idx === player.heroIdx || !freedSet.has(idx)) return;
  const ai = allies.findIndex(a => a.heroIdx === idx);
  if (ai < 0) return;
  // Possession now costs Soul. It used to be free, instant and unlimited, so the
  // game's signature verb carried no decision at all.
  if (G.soul <= 0) {
    banner('✦ NO SOUL — WAIT FOR A CHARGE');
    Sound.sfx.uiBack(); buzz(HAPTIC.tick);
    flashEl($('soul-pips'));
    return;
  }
  G.soul--;
  if (G.soul < SOUL_MAX) G.soulT = SOUL_REGEN;
  G.possessCount = (G.possessCount || 0) + 1;
  // Soulburn: a 3s power window on arrival. Chain-swapping through a horde is
  // now a genuine skill expression rather than a menu action.
  G.burnT = 3;
  G.possessedOther = true;   // for the 'Lone Guardian' achievement
  const al = allies[ai];
  const hpFrac = player.hp / maxHP();
  // souls swap bodies: control moves to the ally's body, old body keeps fighting
  const oldIdx = player.heroIdx, oldWs = player.ws, oldX = player.x, oldY = player.y, oldBob = player.bob;
  player.heroIdx = al.heroIdx; player.ws = al.ws; player.x = al.x; player.y = al.y; player.bob = al.bob;
  al.heroIdx = oldIdx; al.ws = oldWs; al.x = oldX; al.y = oldY; al.bob = oldBob;
  player.hp = maxHP() * hpFrac;
  // Diver's trait grants a longer guard window on arrival
  player.iv = Math.max(1.0, HERO_TRAIT[HEROES[idx].id].k === 'swapGuard' ? 0.9 : 0);
  spawnParts(player.x, player.y, '#ffd54f', 18, 180, 'spark');
  spawnParts(player.x, player.y, '#fff', 6, 110, 'puff');
  spawnParts(al.x, al.y, '#b39ddb', 10, 130, 'spark');
  effects.push({ type: 'shock', x: player.x, y: player.y, r: 120, t: 0, dur: 0.4, color: HEROES[idx].accent });
  // Resonance: swapping into an already-mastered Guardian buffs the whole squad
  const tier = heroState[idx] ? heroState[idx].tier : 0;
  if (tier >= 2) { G.resonance = Math.min(5, (G.resonance || 0) + 1); banner(`✦ RESONANCE ×${G.resonance}`); }
  Sound.sfx.possess();
  Sound.playFile(`assets/audio/heroes/${HEROES[idx].id}_entrance.wav`, 0.8);
  // The 24 hero themes were only ever heard as select-screen previews — play a
  // short flourish of the Guardian's own theme over the battle music.
  Sound.duckFor(1.6);
  Sound.heroFlourish(HEROES[idx].id);
  banner(`YOU ARE NOW ${HEROES[idx].name.toUpperCase()} — SOULBURN!`);
  buzz(HAPTIC.tick);
  if (heroState[idx] && heroState[idx].charge >= 1 && !G.powerHintShown) {
    G.powerHintShown = true;
    schedule(1.4, () => banner('⚡ TAP THE OTHER SIDE — POWERSHOT READY ⚡'));
  }
  updateStrip();
}
function flashEl(el) {
  if (!el) return;
  el.classList.remove('deny'); void el.offsetWidth; el.classList.add('deny');
}

// ---------------- Powershot ----------------
// Tapping the powershot side used to be a silent no-op whenever it wasn't
// charged — which is most of the time. One of only four verbs in the game
// appeared to be broken.
function tryPowershot() {
  if (!G.running || G.over || !player) return false;
  const hs = heroState[player.heroIdx];
  if (hs && hs.charge >= 1) return powershot();
  Sound.sfx.uiBack(); buzz(HAPTIC.tick);
  const els = stripCards.get(player.heroIdx);
  if (els) flashEl(els.card);
  G.powerDeny = 0.5;
  addFloater(player.x, player.y - 52, `${Math.round((hs ? hs.charge : 0) * 100)}%`, '#80cbc4', 1.1);
  return false;
}

function powershot() {
  if (!G.running || G.over || !player) return false;
  const idx = player.heroIdx, hs = heroState[idx];
  if (!hs || hs.charge < 1) return false;
  hs.charge = 0;
  G.psKills = 0;
  const hero = HEROES[idx];
  const w = hero.weapons[0];
  const mul = G.mods.dmg * heroDmgMul(idx);
  const base = w.dmg || 14;

  // shockwave: heavy damage + huge knockback around the hero
  const R = 350 * G.mods.area;
  let killed = 0;
  eachEnemyNear(player.x, player.y, R + 40, e => {
    if ((e.x - player.x) ** 2 + (bodyY(e) - player.y) ** 2 < (R + e.r) ** 2) {
      const wasAlive = e.alive;
      damageEnemy(e, base * 6 * mul, { knock: 520, kx: e.x - player.x, ky: e.y - player.y, src: idx, fromX: player.x, fromY: player.y });
      if (wasAlive && !e.alive) killed++;
    }
  });
  G.bestPowershot = Math.max(G.bestPowershot || 0, killed);
  if (killed >= 15) slowMo(0.3, 0.55);   // a screen-clearing blast earns a beat
  if (G.boss && G.boss.alive && (G.boss.x - player.x) ** 2 + (G.boss.y - player.y) ** 2 < (R + G.boss.r) ** 2)
    damageBoss(base * 8 * mul, { src: idx });
  for (const c of cages) {
    if (!c.broken && (c.x - player.x) ** 2 + (c.y - player.y) ** 2 < (R + 30) ** 2) damageCage(c, base * 6 * mul);
  }

  // three expanding rings of the hero's own projectiles
  for (let wv = 0; wv < 3; wv++) powerWaves.push({ t: wv * 0.14, idx, wave: wv });
  // Kindred: your two nearest allies mirror the powershot at 40%
  if (G.mods.kindred && G.firing) {
    for (let k = 0; k < Math.min(G.mods.kindred, G.firing.length); k++) {
      const al = G.firing[k];
      for (let wv = 0; wv < 2; wv++) powerWaves.push({ t: 0.1 + wv * 0.14, idx: al.heroIdx, wave: wv, mul: 0.4, at: al });
    }
  }

  effects.push({ type: 'shock', x: player.x, y: player.y, r: R, t: 0, dur: 0.5, color: hero.accent });
  spawnParts(player.x, player.y, hero.accent, 26, 260, 'spark');
  G.flash = prefs.flash === 0 ? 0.12 : 0.4 * ((prefs.flash == null ? 100 : prefs.flash) / 100);
  hitStop(0.08);   // brief punch of weight as the shockwave lands
  shakeAt(player.x, player.y - 1, 13);
  player.iv = Math.max(player.iv, 1.2);
  Sound.sfx.powershot();
  Sound.playFile(`assets/audio/heroes/${hero.id}_entrance.wav`, 0.9);
  buzz(HAPTIC.power);
  banner(`⚡ ${hero.name.toUpperCase()} POWERSHOT ⚡`);
  return true;
}

function updatePowerWaves(dt) {
  for (let i = powerWaves.length - 1; i >= 0; i--) {
    const pw = powerWaves[i];
    pw.t -= dt;
    if (pw.t > 0) continue;
    powerWaves.splice(i, 1);
    const f = pw.at || (player.heroIdx === pw.idx ? player : allies.find(a => a.heroIdx === pw.idx));
    if (!f) continue;
    const hero = HEROES[pw.idx], w = hero.weapons[0];
    const mul = G.mods.dmg * heroDmgMul(pw.idx) * (pw.mul || 1);
    const n = 16;
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.283 + pw.wave * 0.13;
      const spd = 330 + pw.wave * 70;
      spawnProj({
        x: f.x, y: f.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        dmg: (w.dmg || 14) * 1.6 * mul, pierce: 2, size: Math.max(8, (w.size || 7) * 1.2), life: 1.0,
        color: hero.accent, rainbow: w.rainbow, knock: 120, src: pw.idx, art: 'orb',
      });
    }
  }
}

// Build a signature-upgrade card object from HERO_UP data for a given hero.
function heroUpgradeCard(heroIdx, slot) {
  const [icon, name, desc, mod] = HERO_UP[HEROES[heroIdx].id][slot];
  return {
    id: `hero_${heroIdx}_${slot}`, icon, name: `${HEROES[heroIdx].name}: ${name}`, desc, once: true, hero: heroIdx,
    apply: () => {
      const hmod = heroMods[heroIdx];
      for (const k in mod) {
        if (k === 'rate') hmod.rate *= mod.rate;
        else if (k === 'dmg' || k === 'area' || k === 'speed' || k === 'exploadMul') hmod[k] *= mod[k];
        else hmod[k] += mod[k];   // pierceAdd / countAdd / jumpsAdd
      }
    },
  };
}
// Assemble the level-up draw pool: generic upgrades + signature upgrades for any
// freed Guardian, biased so the Guardian you're piloting shows up more.
// Relic cards: acquire a new relic (if a slot is free) or level an owned one.
function relicCards() {
  const out = [];
  for (const r of relics) {
    if (r.lv >= 4) continue;
    const nx = r.lv + 1;
    out.push({
      id: `relic_${r.def.id}_${nx}`, icon: r.def.icon, relic: 1,
      name: `${r.def.name} ${['I', 'II', 'III', 'IV'][nx - 1]}`,
      desc: r.def.lv[nx - 1], apply: () => addRelic(r.def.id),
    });
  }
  if (relics.length < RELIC_SLOTS) {
    for (const d of RELICS) {
      if (relics.some(r => r.def.id === d.id)) continue;
      out.push({ id: `relic_${d.id}_1`, icon: d.icon, relic: 1, newRelic: 1,
        name: d.name, desc: d.desc, apply: () => addRelic(d.id) });
    }
  }
  return out;
}
function levelUpPool() {
  const taken = G.mods.taken;
  const pool = UPGRADES.filter(u => !(u.once && taken[u.id])).map(u => ({ ...u }));
  for (const idx of freedSet) {
    if (!HERO_UP[HEROES[idx].id]) continue;
    for (let s = 0; s < 2; s++) {
      const c = heroUpgradeCard(idx, s);
      if (!taken[c.id]) { if (idx === player.heroIdx) pool.push(c, c); else pool.push(c); }  // double-weight your hero
    }
  }
  // relics get generous weight — they're the main source of build variety
  for (const c of relicCards()) pool.push(c, c, c);
  return pool;
}
// ---------------- Level up: 3 face-down mystery cards ----------------
function rollLevelUpCards(n) {
  const pool = levelUpPool();
  const chosen = [], seen = new Set();
  let guard = 400;
  while (chosen.length < n && pool.length && guard-- > 0) {
    const pick = pool.splice((Math.random() * pool.length) | 0, 1)[0];
    if (seen.has(pick.id)) continue;   // don't offer the same card twice (double-weighting can dup)
    seen.add(pick.id); chosen.push(pick);
  }
  return chosen;
}
function closeLevelUp() {
  G.pendingLv--;
  $('screen-levelup').classList.add('hidden');
  if (G.pendingLv > 0) { showLevelUp(); return; }
  overlayClosed();
}

// THE core fix. Cards used to be dealt FACE-DOWN — the player picked one of
// three unknowns, which turns the genre's central decision into a slot-machine
// pull and makes every system underneath (signatures, relics, synergies)
// invisible at the moment of choosing. The flip is now an ENTRANCE, not a
// concealment: cards deal in and auto-reveal in a stagger, then wait for input.
function showLevelUp() {
  G.running = false;
  const row = $('upgrade-row');
  const nCards = 3 + (loadSave().deep && loadSave().deep.charm ? 1 : 0);
  const chosen = rollLevelUpCards(nCards);
  let picked = false;
  const renderCards = cards => {
    row.innerHTML = '';
    cards.forEach((pick, i) => {
      const card = document.createElement('div');
      const kind = pick.relic ? ' relic' : pick.hero !== undefined ? ' signature' : '';
      card.className = 'upgrade-card mystery' + kind;
      card.innerHTML =
        `<div class="mc-inner">
           <div class="mc-face mc-front"><span>?</span></div>
           <div class="mc-face mc-back">
             ${pick.relic ? `<div class="mc-sig">${pick.newRelic ? 'NEW RELIC' : 'RELIC'}</div>`
               : pick.hero !== undefined ? '<div class="mc-sig">SIGNATURE</div>' : ''}
             <div class="uc-icon">${pick.icon}</div><h3>${pick.name}</h3><p>${pick.desc}</p>
           </div>
         </div>`;
      // auto-reveal, staggered — the flip animation is kept, the hidden
      // information is not. A card can't be chosen until it has actually
      // revealed, so a fast tap during the cascade can't blind-pick.
      let ready = false;
      setTimeout(() => { card.classList.add('flipped'); ready = true; }, 90 + i * 110);
      const choose = () => {
        if (picked || !ready) return;
        picked = true;
        Sound.sfx.uiClick(); buzz(HAPTIC.level);
        card.classList.add('chosen');
        row.querySelectorAll('.upgrade-card').forEach(c => { if (c !== card) c.classList.add('faded'); });
        if (pick.once || pick.relic) G.mods.taken[pick.id] = true;
        pick.apply(G.mods, G);
        if (!pick.relic && pick.hero === undefined) G.upTaken[pick.id] = (G.upTaken[pick.id] || 0) + 1;
        // rule-changer flags the sim reads directly
        if (pick.id === 'plague') G.plagueOn = 1;
        refreshBuildStrip();
        setTimeout(closeLevelUp, 420);
      };
      card.addEventListener('pointerdown', choose);
      row.appendChild(card);
    });
  };
  renderCards(chosen);
  refreshBuildStrip();
  const rerollN = $('lu-reroll-n');
  const rerollBtn = $('btn-lu-reroll');
  if (rerollN) rerollN.textContent = '×' + G.rerolls;
  if (rerollBtn) rerollBtn.classList.toggle('spent', G.rerolls <= 0);
  $('screen-levelup').classList.remove('hidden');
}

// A compact icon strip of what you've already taken, shown right under the
// cards — you can't draft well against a build you can't see.
function refreshBuildStrip() {
  const el = $('lu-build');
  if (!el) return;
  const items = [];
  for (const r of relics) items.push(`<span class="bs-item relic" title="${r.def.name} ${r.lv}">${r.def.icon}<b>${r.lv}</b></span>`);
  const counts = G.upTaken || (G.upTaken = {});
  for (const k in counts) {
    const u = UPGRADES.find(u => u.id === k);
    if (u) items.push(`<span class="bs-item" title="${u.name}">${u.icon}${counts[k] > 1 ? `<b>${counts[k]}</b>` : ''}</span>`);
  }
  el.innerHTML = items.length ? items.join('') : '<span class="bs-empty">no upgrades yet</span>';
}

// ================================================================
// OVERLAY QUEUE
// Level-up, chest reveal and the mutator draft can all be triggered while
// another is already open — a chest from a boss kill, a level-up from its
// gems, and the round's mutator draft can land in the same second. They used
// to stack on top of each other. Now they queue and play in order.
// ================================================================
const OVERLAY_IDS = ['screen-levelup', 'screen-chest', 'screen-mutator'];
let overlayQ = [];
const overlayOpen = () => OVERLAY_IDS.some(id => !$(id).classList.contains('hidden'));
function queueOverlay(fn) {
  overlayQ.push(fn);
  pumpOverlay();
}
function pumpOverlay() {
  if (overlayOpen() || !overlayQ.length) return;
  const fn = overlayQ.shift();
  try { fn(); } catch (e) { console.error(e); pumpOverlay(); }
}
// Called by every overlay's close path: hand control to the next one, or back
// to the game if the queue is empty.
function overlayClosed() {
  if (overlayQ.length) { pumpOverlay(); return; }
  if (!G.over && $('screen-roster').classList.contains('hidden')) G.running = true;
}

// ---------------- Chest reveal ----------------
// The slot-machine moment the reward curve never had.
function showChest(n) {
  G.running = false;
  const row = $('chest-row');
  row.innerHTML = '';
  $('chest-count').textContent = n;
  const picks = rollLevelUpCards(n);
  let revealed = 0;
  picks.forEach((pick, i) => {
    const card = document.createElement('div');
    card.className = 'chest-card' + (pick.relic ? ' relic' : pick.hero !== undefined ? ' signature' : '');
    card.innerHTML = `<div class="uc-icon">${pick.icon}</div><h3>${pick.name}</h3><p>${pick.desc}</p>`;
    row.appendChild(card);
    setTimeout(() => {
      card.classList.add('in');
      Sound.sfx.chestTick();
      if (pick.once || pick.relic) G.mods.taken[pick.id] = true;
      pick.apply(G.mods, G);
      if (!pick.relic && !pick.hero) G.upTaken[pick.id] = (G.upTaken[pick.id] || 0) + 1;
      if (++revealed === picks.length) setTimeout(() => $('btn-chest-close').classList.remove('hidden'), 350);
    }, 260 + i * 420);
  });
  $('btn-chest-close').classList.add('hidden');
  $('screen-chest').classList.remove('hidden');
}
function closeChest() {
  $('screen-chest').classList.add('hidden');
  Sound.sfx.uiClick();
  if (!G.over && G.pendingLv > 0) { showLevelUp(); return; }
  overlayClosed();
}

// ---------------- Mutator draft (endless) ----------------
function showMutatorDraft() {
  G.running = false;
  const row = $('mutator-row');
  row.innerHTML = '';
  const pool = MUTATORS.filter(m => !G.mutTaken[m.id]);
  if (pool.length < 2) { overlayClosed(); return; }
  const a = pool.splice((Math.random() * pool.length) | 0, 1)[0];
  const b = pool.splice((Math.random() * pool.length) | 0, 1)[0];
  for (const m of [a, b]) {
    const card = document.createElement('div');
    card.className = 'mut-card';
    card.innerHTML = `<div class="uc-icon">${m.icon}</div><h3>${m.name}</h3><p>${m.desc}</p>
      <div class="mut-score">+${Math.round(m.score * 100)}% SCORE</div>`;
    card.addEventListener('pointerdown', () => {
      G.mutTaken[m.id] = 1;
      m.apply(G.mut);
      G.mutScore += m.score;
      G.mutList.push(m);
      Sound.sfx.uiClick(); buzz(HAPTIC.tick);
      $('screen-mutator').classList.add('hidden');
      banner(`${m.icon} ${m.name.toUpperCase()} — ${m.desc}`);
      overlayClosed();
    });
    row.appendChild(card);
  }
  $('screen-mutator').classList.remove('hidden');
}

// ---------------- Roster ----------------
function openRoster() {
  G.running = false;
  const grid = $('roster-grid');
  grid.innerHTML = '';
  // Sort by usefulness as a swap target: charged first, then mastery. The
  // screen used to list 24 cards with a name and one of three words.
  const order = HEROES.map((h, i) => i).sort((a, b) => {
    const fa = freedSet.has(a), fb = freedSet.has(b);
    if (fa !== fb) return fb - fa;
    const A = heroState[a] || {}, B = heroState[b] || {};
    return ((B.charge >= 1) - (A.charge >= 1)) || (B.tier - A.tier) || (B.dmg - A.dmg);
  });
  order.forEach(i => {
    const h = HEROES[i];
    const card = document.createElement('div');
    const isYou = i === player.heroIdx;
    const freed = freedSet.has(i);
    const hs = heroState[i] || { tier: 0, charge: 0, dmg: 0, kills: 0 };
    card.className = 'hero-card roster' + (isYou ? ' you' : freed ? '' : ' caged') + (hs.charge >= 1 && freed ? ' charged' : '');
    const state = isYou ? 'YOU' : freed ? (G.soul > 0 ? 'TAP TO POSSESS' : 'NO SOUL') : 'IMPRISONED';
    card.innerHTML =
      `<div class="hc-name">${h.name}</div>` +
      `<div class="hc-state">${state}</div>` +
      (freed ? `<div class="hc-tier" style="color:${TIER_COLORS[hs.tier]}">${TIER_NAMES[hs.tier]}</div>
        <div class="hc-charge"><i style="width:${Math.round(Math.min(1, hs.charge) * 100)}%"></i></div>
        <div class="hc-dmg">${fmtNum(hs.dmg)} dmg · ${hs.kills}☠</div>` : '');
    if (freed) card.style.borderColor = TIER_COLORS[hs.tier];
    card.insertBefore(Sprites.portrait(i, 88), card.firstChild);
    if (freed && !isYou) card.addEventListener('pointerdown', () => {
      possess(i);
      if (G.soul >= 0) closeRoster();
    });
    grid.appendChild(card);
  });
  buildRosterBuild();
  $('screen-roster').classList.remove('hidden');
}
// Build inspection: you can't plan a draft against a build you can't audit.
function buildRosterBuild() {
  const el = $('roster-build');
  if (!el) return;
  const m = G.mods;
  const stat = (l, v) => `<span class="rb-stat"><b>${v}</b>${l}</span>`;
  const ups = Object.keys(G.upTaken || {}).map(k => {
    const u = UPGRADES.find(u => u.id === k);
    return u ? `<span class="bs-item" title="${u.name}: ${u.desc}">${u.icon}${G.upTaken[k] > 1 ? `<b>${G.upTaken[k]}</b>` : ''}</span>` : '';
  }).join('');
  const sigs = [];
  for (const id in m.taken) {
    if (!id.startsWith('hero_')) continue;
    const [, hi, slot] = id.split('_');
    const u = HERO_UP[HEROES[hi].id];
    if (u && u[slot]) sigs.push(`<span class="bs-item sig" title="${HEROES[hi].name}: ${u[slot][1]}">${u[slot][0]}</span>`);
  }
  el.innerHTML =
    `<div class="rb-row">${relics.length
      ? relics.map(r => `<span class="bs-item relic" title="${r.def.name} — ${r.def.lv[r.lv - 1]}">${r.def.icon}<b>${r.lv}</b></span>`).join('')
      : '<span class="bs-empty">no relics yet</span>'}${ups}${sigs.join('')}</div>
     <div class="rb-row stats">
       ${stat('DMG', '×' + m.dmg.toFixed(2))}${stat('RATE', '×' + (1 / m.rate).toFixed(2))}
       ${stat('AREA', '×' + m.area.toFixed(2))}${stat('SPD', '×' + m.spd.toFixed(2))}
       ${stat('CRIT', Math.round(m.crit * 100) + '%')}${stat('MAGNET', '×' + m.magnet.toFixed(2))}
     </div>`;
}
function closeRoster() {
  $('screen-roster').classList.add('hidden');
  // don't resume the simulation while a level-up choice is still on screen
  if (!G.over && $('screen-levelup').classList.contains('hidden')) G.running = true;
}

// ---------------- Daily challenge ----------------
// A date-seeded run with a fixed hero / difficulty / region / cage layout, so
// everyone plays the same setup each day and races a shared-format leaderboard.
function mulberry32(seed) {
  return function () {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const dayKey = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
// Short, human-typeable run seeds (no vowels, so no accidental words).
const SEED_ALPHA = 'BCDFGHJKLMNPQRSTVWXZ23456789';
let pendingSeed = null;
function makeSeed() {
  let s = '';
  for (let i = 0; i < 6; i++) s += SEED_ALPHA[(Math.random() * SEED_ALPHA.length) | 0];
  return s;
}
function seedToInt(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h | 0;
}
function promptSeed() {
  Sound.sfx.uiClick();
  showModal('Play a seed',
    'Enter a 6-character run code to play someone else\'s exact island.<br><input id="seed-input" maxlength="8" placeholder="ABC123" style="margin-top:12px;text-transform:uppercase;font-family:inherit;font-size:20px;letter-spacing:4px;text-align:center;width:180px;padding:8px;border-radius:10px;border:1.5px solid rgba(255,213,79,.6);background:rgba(0,0,0,.4);color:#ffd54f">',
    [{ label: 'Cancel' }, { label: 'Play it', primary: true, onClick: () => {
      const v = ($('seed-input') && $('seed-input').value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (v.length >= 3) { pendingSeed = v; goSelect(); }
    } }]);
}
function dailyRng() { const k = dayKey(); let s = 0; for (let i = 0; i < k.length; i++) s = (s * 31 + k.charCodeAt(i)) | 0; return mulberry32(s); }
function dailySetup() {
  const r = dailyRng();
  return { hero: (r() * HEROES.length) | 0, diff: (r() * 3) | 0, region: ['region-land', 'region-sea', 'region-sky'][(r() * 3) | 0], cageRot: r() * 6.283 };
}
function startDaily() {
  enterApp(); Sound.sfx.uiClick();
  const s = dailySetup();
  selectedHero = s.hero; selectedDiff = s.diff;
  MENU_SCREENS.forEach(id => $(id).classList.add('hidden'));
  newGame(s.hero, s.diff, s);
}

// ---------------- Daily streaks & objectives ----------------
// The daily was date-seeded but paid nothing and tracked no streak, so there was
// no reason to come back on any particular day.
const DAILY_OBJECTIVES = [
  { id: 'kills',  icon: '☠', desc: 'Slay 400 enemies',        shells: 40, test: c => c.kills >= 400 },
  { id: 'freed',  icon: '⛓', desc: 'Free 12 Guardians',       shells: 40, test: c => c.freed >= 12 },
  { id: 'combo',  icon: '🔗', desc: 'Reach a ×25 combo',       shells: 40, test: c => c.bestCombo >= 25 },
  { id: 'boss',   icon: '👑', desc: 'Defeat King Glob',        shells: 80, test: c => c.bossKills >= 1 },
  { id: 'elite',  icon: '💀', desc: 'Defeat 5 Elites',         shells: 40, test: c => c.eliteKills >= 5 },
  { id: 'relic',  icon: '🗿', desc: 'Take a Relic to level 3', shells: 40, test: c => c.maxRelicLv >= 3 },
];
function todaysObjectives() {
  const r = dailyRng();
  const pool = DAILY_OBJECTIVES.slice();
  const out = [];
  for (let i = 0; i < 3 && pool.length; i++) out.push(pool.splice((r() * pool.length) | 0, 1)[0]);
  return out;
}
const streakReward = n => n >= 30 ? 1000 : n >= 14 ? 400 : n >= 7 ? 200 : n >= 3 ? 80 : 25;
function resolveDaily(save, ctx) {
  const dk = dayKey();
  save.dailyMeta = save.dailyMeta || { streak: 0, last: null, done: {} };
  const dm = save.dailyMeta;
  const done = dm.done[dk] = dm.done[dk] || {};
  let earned = 0;
  const cleared = [];
  for (const o of todaysObjectives()) {
    if (!done[o.id] && o.test(ctx)) { done[o.id] = 1; earned += o.shells; cleared.push(o); }
  }
  if (!dm.last || dm.last !== dk) {
    // a grace day: missing one day doesn't wipe a long streak
    const y = new Date(); y.setDate(y.getDate() - 1);
    const yk = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
    const g = new Date(); g.setDate(g.getDate() - 2);
    const gk = `${g.getFullYear()}-${String(g.getMonth() + 1).padStart(2, '0')}-${String(g.getDate()).padStart(2, '0')}`;
    dm.streak = (dm.last === yk || dm.last === gk) ? dm.streak + 1 : 1;
    dm.last = dk;
    earned += streakReward(dm.streak);
    G.streakNow = dm.streak;
  }
  // keep only ~14 days of objective state
  const keys = Object.keys(dm.done).sort();
  while (keys.length > 14) delete dm.done[keys.shift()];
  save.shells = (save.shells || 0) + earned;
  G.dailyEarned = earned;
  G.dailyCleared = cleared;
  return earned;
}

// ---------------- Game flow ----------------
function newGame(heroIdx, diffIdx, daily) {
  const save = loadSave();
  G.running = true; G.over = false; G.victory = false; G.pendingLv = 0;
  G.time = 0; G.kills = 0; G.level = 1; G.xp = 0; G.xpNext = 16;
  G.spawnAcc = 0; G.boss = null; G.bossWarned = false; G.shake = 0; G.hitStop = 0;
  G.seen = {}; G.beats = {}; G.frameN = 0;
  G.flash = 0; G.hurtFlash = 0; G.powerHintShown = false;
  G.timeScale = 1; G.tsTarget = 1; G.tsHold = 0;
  G.combo = 0; G.comboT = 0; G.bestCombo = 0; G.comboMul = 1; G.comboRateMul = 1; G.comboScore = 0;
  G.crits = 0; G.dashes = 0; G.chests = 0; G.eliteKills = 0; G.minibossKills = 0;
  G.reefKills = 0; G.possessCount = 0; G.healed = 0; G.noHitT = 0; G.bestNoHit = 0;
  G.bestPowershot = 0; G.dashCd = 0; G.resonance = 0; G.burnT = 0;
  G.soul = SOUL_MAX; G.soulT = SOUL_REGEN;
  G.wardUp = 0; G.wardT = 12; G.killSpeedT = 0; G.killSpeedV = 0; G.chilled = 0;
  G.formation = 0; G.firing = null; G.firingSet = null; G.liveEnemies = 0;
  G.upTaken = {}; G.plagueOn = 0; G.shatterOn = 0; G.lastHurtBy = 'the horde';
  G.mut = { eHp: 1, eSpd: 1, xp: 1, spawn: 1, bHp: 1, allyRate: 1, playerDmgTaken: 1 };
  G.mutTaken = {}; G.mutScore = 0; G.mutList = [];
  G.safeR = 2600; G.tideY = null; G.mirror = null; G.surgeWarn = null;
  // Seeded runs: layout, biome and decor come from a short shareable code, so a
  // friend can play your exact island. The daily already did this; every run
  // now does, which also makes bugs reproducible.
  G.seed = (daily ? dayKey().replace(/-/g, '').slice(2) : (pendingSeed || makeSeed()));
  pendingSeed = null;
  G.rng = mulberry32(seedToInt(G.seed));
  G.daily = daily || null;
  G.diff = DIFFICULTIES[Math.max(0, Math.min(DIFFICULTIES.length - 1, diffIdx | 0))];
  G.startHero = heroIdx;
  G.possessedOther = false;
  G.round = 1; G.bossKills = 0; G.nextBossAt = BOSS_TIME;
  G.rerolls = 3 + (daily ? 0 : ((save.perks || {}).fortune || 0));
  G.cam.zoom = 1;
  heroState = HEROES.map(() => ({ dmg: 0, tier: 0, charge: 0, kills: 0, control: 0 }));
  heroMods = HEROES.map(freshHeroMod);
  powerWaves = []; relics = []; timers = []; overlayQ = [];
  chests = []; corpses = []; pools = []; ghosts = []; spires = []; totems = [];
  G.mods = {
    dmg: 1, rate: 1, spd: 1, hpBonus: 0, ally: 1, magnet: 1, regen: 0, area: 1,
    pierceBonus: 0, pspd: 1, plife: 1, chargeMul: 1, xpGain: 1, knockMul: 1, revive: 0,
    crit: 0.05, critMul: 2, lifesteal: 0, armor: 1, ward: 0, echo: 0, bloom: 0,
    ricochet: 0, undertow: 0, kindred: 0, riptide: 0, lowtide: 0,
    taken: {},   // `once` upgrades leave the pool after this
  };
  // permanent Shell Shrine perks (daily challenge ignores them for fairness)
  const perks = daily ? {} : (save.perks || {});
  for (const p of PERKS) { const lv = perks[p.id] || 0; if (lv > 0) p.apply(G.mods, lv); }
  G.headStart = daily ? 0 : (perks.start || 0);
  // Shrine tier 2 — one-time unlocks that change how a run is built
  const deep = daily ? {} : (save.deep || {});
  G.deep = deep;
  if (deep.echo) addRelic(RELICS[(Math.random() * RELICS.length) | 0].id);
  if (deep.chain) G.headStart = (G.headStart || 0) + 1;
  G.focusHero = deep.focus ? heroIdx : -1;

  for (const e of enemies) e.alive = false;
  for (const p of projs) p.alive = false;
  for (const g of gems) g.alive = false;
  for (const p of parts) p.alive = false;
  for (const eb of ebullets) eb.alive = false;
  hearts = []; patches = []; effects = []; floaters = []; telegraphs = [];
  allies = [];
  freedSet = new Set([heroIdx]);

  player = makeFighter(heroIdx, WORLD / 2, WORLD / 2);
  player.hp = maxHP(); player.iv = 1.5;
  G.cam.x = player.x; G.cam.y = player.y;

  // cages: golden spiral around spawn (daily uses a fixed rotation so the
  // layout is identical for everyone that day). The first cage now sits close
  // enough that the first rescue lands inside ~15 seconds.
  const cageRot = daily ? daily.cageRot : G.rng() * 6.283;
  cages = [];
  let ci = 0;
  for (let i = 0; i < HEROES.length; i++) {
    if (i === heroIdx) continue;
    const a = cageRot + ci * 2.39996;
    const d = 210 + ci * 86;
    cages.push({
      heroIdx: i, isCage: true,
      x: Math.max(120, Math.min(WORLD - 120, WORLD / 2 + Math.cos(a) * d)),
      y: Math.max(120, Math.min(WORLD - 120, WORLD / 2 + Math.sin(a) * d)),
      hp: CAGE_HP, broken: false, flash: 0,
    });
    ci++;
  }

  // decor
  // Decor: 150 props across 27 million square pixels read as an empty field.
  // Now ~900, CLUSTERED into groves and rock fields rather than uniform-random,
  // so the island looks authored. Culled by the existing onScreen check.
  decor = [];
  let seed = Math.abs(seedToInt(G.seed)) % 2147483646 + 1;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const target = Math.round(900 * QL.decor);
  while (decor.length < target) {
    // a cluster centre, then a scatter of props around it
    const cxw = 60 + rnd() * (WORLD - 120), cyw = 60 + rnd() * (WORLD - 120);
    const kinds = rnd() < 0.4 ? ['palm', 'palm', 'bush'] : rnd() < 0.7 ? ['bush', 'bush', 'palm'] : ['rock', 'rock', 'bush'];
    const n = 3 + ((rnd() * 9) | 0), spread = 90 + rnd() * 190;
    for (let j = 0; j < n && decor.length < target; j++) {
      const x = cxw + (rnd() - 0.5) * spread * 2, y = cyw + (rnd() - 0.5) * spread * 2;
      if (x < 40 || y < 40 || x > WORLD - 40 || y > WORLD - 40) continue;
      if (Math.hypot(x - WORLD / 2, y - WORLD / 2) < 190) continue;   // keep spawn clear
      decor.push({ k: kinds[(rnd() * kinds.length) | 0], x, y, s: 0.65 + rnd() * 0.75 });
    }
  }
  decor.sort((a, b) => a.y - b.y);
  buildDecorGrid();

  $('boss-hp-wrap').classList.add('hidden');
  $('screen-select').classList.add('hidden');
  $('screen-over').classList.add('hidden');
  $('hud').classList.remove('hidden');
  // Head Start perk: free the nearest N cages immediately
  for (let n = 0; n < (G.headStart || 0) && cages.length; n++) {
    const c = cages.filter(c => !c.broken).sort((a, b) =>
      ((a.x - player.x) ** 2 + (a.y - player.y) ** 2) - ((b.x - player.x) ** 2 + (b.y - player.y) ** 2))[0];
    if (c) { c.broken = true; allies.push(makeFighter(c.heroIdx, player.x, player.y)); freedSet.add(c.heroIdx); }
  }
  updateHudCounts();
  rebuildStrip();
  try {
    const save = loadSave();
    save.lastHero = heroIdx;
    saveGame(save);
  } catch (e) {}
  Sound.stopPreview();
  G.region = daily ? daily.region : ['region-land', 'region-sea', 'region-sky'][(G.rng() * 3) | 0];
  G.biome = G.region.split('-')[1];
  Sound.playMusic(`music/${G.region}.mp3`);
  Sound.playFile(`assets/audio/heroes/${HEROES[heroIdx].id}_entrance.wav`, 0.9);
  bannerQ.length = 0;
  banner(`${HEROES[heroIdx].name.toUpperCase()} — BREAK THE CAGES!`);
  if (G.diff.rule) banner(`◆ ${G.diff.name}: ${G.diff.ruleTxt}`);
  refreshBuildStrip();
  updateFormationBtn();
  coachReset();
}

// ================================================================
// CONTEXTUAL COACHING
// Onboarding used to be two banners that scrolled past in five seconds, so most
// players never discovered possession — the best mechanic in the game.
// ================================================================
const COACH = [
  { id: 'move',    txt: 'DRAG to move · DOUBLE-TAP to DASH', sub: 'the other side of the screen fires your powershot' },
  { id: 'cage',    txt: 'A CAGED GUARDIAN', sub: 'shoot the cage — the gold arrow points to the nearest one' },
  { id: 'ally',    txt: 'TAP THEIR CARD TO BECOME THEM', sub: 'possession costs ✦ Soul and grants a 3s Soulburn' },
  { id: 'power',   txt: 'POWERSHOT READY ⚡', sub: 'tap the right side of the screen' },
  { id: 'gold',    txt: 'GOLD MEANS DEADLY', sub: 'enemy colour tells you its power tier' },
  { id: 'elite',   txt: 'AN ELITE', sub: 'tough, but it drops something worth having' },
  { id: 'chest',   txt: 'A CACHE', sub: 'walk into it for several upgrades at once' },
  { id: 'dash',    txt: 'DASH IS READY', sub: 'double-tap the movement side to dodge through anything' },
];
function coachReset() {
  const save = loadSave();
  G.coachSeen = save.coach || {};
  G.coachQ = [];
}
function coach(id) {
  if (!G.coachSeen || G.coachSeen[id] || G.coachOpen) return;
  const c = COACH.find(c => c.id === id);
  if (!c) return;
  G.coachSeen[id] = 1;
  const save = loadSave(); save.coach = G.coachSeen; saveGame(save);
  G.coachOpen = 1;
  const el = $('coach');
  el.innerHTML = `<b>${c.txt}</b><span>${c.sub}</span>`;
  el.classList.remove('hidden');
  slowMo(0.25, 0.9);
  Sound.sfx.uiSelect();
  setTimeout(() => { el.classList.add('hidden'); G.coachOpen = 0; }, 2400);
}
function updateFormationBtn() {
  const el = $('formation-btn');
  if (el) el.textContent = FORMATIONS[G.formation || 0].icon;
}

// ---------------- Run stats, score & records ----------------
const fmtNum = n => n >= 1e6 ? (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M'
  : n >= 1e4 ? Math.round(n / 1e3) + 'k'
    : n >= 1e3 ? (n / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
      : String(Math.round(n));
const fmtTime = s => `${(s / 60) | 0}:${String((s | 0) % 60).padStart(2, '0')}`;

function bossPct() {
  // progress against the CURRENT boss only (kills are scored separately)
  if (G.boss) return Math.max(0, Math.min(1, 1 - G.boss.hp / G.boss.maxhp));
  return 0;
}
// Rebalanced toward RATE and RISK. The old formula paid `seconds x 4`, so
// surviving passively in a corner scored — a leaderboard that rewards patience
// over skill isn't interesting to climb.
function computeScore() {
  const diff = G.diff || DIFFICULTIES[0];
  const masterySum = heroState.reduce((s, hs) => s + hs.tier, 0);
  const base =
    G.comboScore                                   // kills, already combo-weighted
    + Math.floor(G.time) * 1                       // was x4
    + freedSet.size * 300
    + G.level * 50
    + masterySum * 400                             // reward deliberate mastery
    + G.eliteKills * 600
    + G.chests * 400
    + Math.round(G.bestNoHit) * 8                  // reward clean play
    + G.bestCombo * 60
    + Math.round(bossPct() * 3000)
    + G.bossKills * 8000
    + G.reefKills * 9000;
  const prestige = 1 + (loadSave().prestige || 0) * 0.25;
  return Math.round(base * diff.score * (1 + G.mutScore) * prestige);
}

// persist the run into the leaderboard + codex; returns its all-time rank (-1 if off-board)
function saveRun(score) {
  let rank = -1;
  try {
    const save = loadSave();
    const rec = {
      score, won: G.victory, heroId: HEROES[G.startHero].id, heroName: HEROES[G.startHero].name,
      diff: G.diff.id, kills: G.kills, time: G.time | 0, freed: freedSet.size, level: G.level,
      round: G.round, bossKills: G.bossKills, date: Date.now(),
      seed: G.seed, assist: prefs.assist ? 1 : 0, combo: G.bestCombo,
    };
    const records = Array.isArray(save.records) ? save.records : [];
    records.push(rec);
    records.sort((a, b) => b.score - a.score);
    save.records = records.slice(0, 12);
    rank = save.records.indexOf(rec);
    const mastery = save.mastery || {};
    heroState.forEach((hs, i) => {
      if (freedSet.has(i)) mastery[HEROES[i].id] = Math.max(mastery[HEROES[i].id] || 0, hs.tier);
    });
    save.mastery = mastery;
    if (G.victory) save.maxDiff = Math.max(save.maxDiff == null ? -1 : save.maxDiff, G.diff.id);
    save.bestScore = Math.max(save.bestScore || 0, score);
    save.bestKills = Math.max(save.bestKills || 0, G.kills);
    save.wins = (save.wins || 0) + (G.victory ? 1 : 0);
    if (!G.daily) { save.lastHero = G.startHero; save.lastDiff = G.diff.id; }
    // daily challenge best (keyed by date)
    if (G.daily) {
      const dk = dayKey();
      save.daily = save.daily || {};
      save.daily[dk] = Math.max(save.daily[dk] || 0, score);
      // keep only the last ~10 days
      const keys = Object.keys(save.daily).sort();
      while (keys.length > 10) delete save.daily[keys.shift()];
    }
    // shells (meta currency)
    G.shellsEarned = Math.floor(score / SHELLS_PER_SCORE);
    save.shells = (save.shells || 0) + G.shellsEarned;
    // lifetime stats
    const st = save.stats || (save.stats = { kills: 0, dmg: 0 });
    st.kills += G.kills;
    st.dmg += heroState.reduce((s, hs) => s + hs.dmg, 0);
    // achievements + Guardian unlocks
    const ctx = runContext(save);
    if (G.daily) resolveDaily(save, ctx);
    G.newAch = checkAchievements(save, ctx);
    G.newUnlocks = checkUnlocks(save, ctx);
    G.shellsEarned += G.newAch.reduce((s, a) => s + (a.shells || 0), 0);
    saveGame(save);
    flushSave();   // a completed run is worth an immediate durable write
  } catch (e) {}
  return rank;
}

// One context object drives both achievements and Guardian unlocks.
function runContext(save) {
  const codexComplete = HEROES.every(h => (save.mastery[h.id] || 0) >= 4);
  return {
    bossKills: G.bossKills, freed: freedSet.size, round: G.round, diff: G.diff.id,
    maxTier: heroState.reduce((m, hs) => Math.max(m, hs.tier), 0),
    possessed: G.possessedOther, codexComplete, kills: G.kills, level: G.level,
    time: G.time, bestCombo: G.bestCombo, crits: G.crits, dashes: G.dashes,
    chests: G.chests, eliteKills: G.eliteKills, minibossKills: G.minibossKills,
    reefKills: G.reefKills, possessCount: G.possessCount, healed: G.healed,
    noHitTime: G.bestNoHit, bestPowershot: G.bestPowershot,
    relicCount: relics.length, maxRelicLv: relics.reduce((m, r) => Math.max(m, r.lv), 0),
    lifeKills: save.stats.kills, lifeDmg: save.stats.dmg,
  };
}
function checkAchievements(save, ctx) {
  const ach = save.ach || (save.ach = {});
  const unlocked = [];
  for (const a of ACHIEVEMENTS) {
    if (!ach[a.id] && a.test(ctx)) {
      ach[a.id] = Date.now(); unlocked.push(a);
      save.shells = (save.shells || 0) + (a.shells || 0);   // achievements now PAY
    }
  }
  return unlocked;
}
// The unlock cascade: the genre's most reliable retention engine, on a roster of
// 24 that previously gated nothing at all.
function checkUnlocks(save, ctx) {
  const got = [];
  for (const u of UNLOCKS) {
    if (save.unlocked.includes(u.id)) continue;
    if (u.test(ctx)) { save.unlocked.push(u.id); got.push(u); }
  }
  return got;
}
// The three nearest unlocks with live progress — shown at the exact moment the
// player decides whether to press Play Again.
function nextGoals(save) {
  const ach = save.ach || {};
  const out = [];
  for (const u of UNLOCKS) {
    if (save.unlocked.includes(u.id)) continue;
    out.push({ icon: '🔓', name: HEROES.find(h => h.id === u.id).name, desc: u.desc });
    if (out.length >= 2) break;
  }
  for (const a of ACHIEVEMENTS) {
    if (ach[a.id]) continue;
    out.push({ icon: a.icon, name: a.name, desc: a.desc, shells: a.shells });
    if (out.length >= 3) break;
  }
  return out.slice(0, 3);
}

function buildStatsScreen(rank) {
  const won = G.victory, diff = G.diff;
  $('over-title').textContent =
    G.bossKills > 1 ? `GLOB SLAIN ×${G.bossKills}!` : won ? 'BALITOPIA IS FREE!' : 'THE TIDE TAKES YOU';
  $('over-title').style.color = won ? '#ffd54f' : '#ef9a9a';
  $('over-diff').innerHTML =
    (G.daily ? `<span class="diff-badge" style="color:#ffd54f;border-color:#ffd54f">☀ DAILY</span>` : '') +
    `<span class="diff-badge" style="color:${diff.color};border-color:${diff.color}">◆ ${diff.name}</span>` +
    (G.round > 1 ? `<span class="diff-badge" style="color:#b388ff;border-color:#b388ff">🌀 ROUND ${G.round}</span>` : '');
  const flav = won
    ? (G.bossKills > 1 ? 'The Hungry King kept coming back. You kept ending him.' : 'King Glob is unmade — the Balance holds.')
    : 'The horde was too many. This time.';
  const newAch = (G.newAch && G.newAch.length)
    ? `<div class="ach-unlocked">${G.newAch.map(a => `<span>🏆 ${a.icon} ${a.name}${a.shells ? ` +🐚${a.shells}` : ''}</span>`).join('')}</div>` : '';
  const newHeroes = (G.newUnlocks && G.newUnlocks.length)
    ? `<div class="hero-unlocked">${G.newUnlocks.map(u => `<span>🔓 ${HEROES.find(h => h.id === u.id).name} UNLOCKED</span>`).join('')}</div>` : '';
  // Cause of death: "every death should motivate another attempt" needs the
  // player to learn something from it. The old screen never said what killed you.
  const cause = won ? '' : `<div class="death-cause">Killed by <b>${G.lastHurtBy || 'the horde'}</b>` +
    (G.rerolls > 0 ? ` · you finished with <b>${G.rerolls}</b> reroll${G.rerolls > 1 ? 's' : ''} unused` : '') +
    (!G.possessCount ? ' · <b>you never possessed anyone</b> — swapping is a free heal and a 3s damage window' : '') +
    (relics.length === 0 ? ' · <b>you took no Relics</b> — they are the biggest damage boost in the draft' : '') +
    '</div>';
  $('over-flavor').innerHTML = flav + cause + newHeroes + newAch;
  // Next goals — the single highest-leverage retention element in the game.
  const goals = nextGoals(loadSave());
  $('over-goals').innerHTML = goals.length
    ? `<div class="over-sec-label">NEXT GOALS</div><div class="goal-row">` +
      goals.map(g => `<div class="goal"><span class="goal-ic">${g.icon}</span><div><b>${g.name}</b><span>${g.desc}</span></div></div>`).join('') +
      '</div>' : '';
  $('over-score').innerHTML =
    `<div class="score-num">${G.score.toLocaleString()}</div>
     <div class="score-lbl">SCORE${rank >= 0 ? ` · #${rank + 1} ALL-TIME` : ''}${rank === 0 ? ' <span class="newbest">NEW BEST!</span>' : ''}</div>
     ${G.shellsEarned ? `<div class="shells-earned">🐚 +${G.shellsEarned} shells</div>` : ''}`;
  const t = G.time | 0;
  $('over-summary').innerHTML = [
    ['⏱', fmtTime(t), 'survived'],
    ['☠', G.kills, 'slain'],
    ['⛓', `${freedSet.size}/24`, 'freed'],
    ['★', G.level, 'level'],
    ['👑', G.bossKills > 0 ? '×' + G.bossKills : `${Math.round(bossPct() * 100)}%`, 'Glob slain'],
    ['🔗', '×' + G.bestCombo, 'best combo'],
    ['💥', G.crits, 'crits'],
    ['💀', G.eliteKills, 'elites'],
  ].map(([ic, v, l]) => `<div class="sum-tile"><span class="sum-ic">${ic}</span><b>${v}</b><span>${l}</span></div>`).join('')
    + `<div class="sum-tile seed"><span class="sum-ic">🔗</span><b>${G.seed}</b><span>seed</span></div>`;

  const rows = heroState.map((hs, i) => ({ i, hs })).filter(x => x.hs.dmg > 0 || freedSet.has(x.i))
    .sort((a, b) => b.hs.dmg - a.hs.dmg);
  const maxDmg = Math.max(1, ...rows.map(r => r.hs.dmg));
  const totalDmg = rows.reduce((s, r) => s + r.hs.dmg, 0) || 1;
  const wrap = $('over-heroes');
  wrap.innerHTML = '';
  rows.forEach(({ i, hs }) => {
    const row = document.createElement('div');
    row.className = 'hero-row';
    const pct = Math.round(hs.dmg / totalDmg * 100);
    row.innerHTML =
      `<div class="hr-port" style="border-color:${TIER_COLORS[hs.tier]}"></div>
       <div class="hr-mid">
         <div class="hr-name">${HEROES[i].name}${i === G.startHero ? ' <span class="hr-lead">★</span>' : ''}
           <span class="hr-tier" style="color:${TIER_COLORS[hs.tier]}">${TIER_NAMES[hs.tier]}</span></div>
         <div class="hr-bar"><i style="width:${Math.max(3, hs.dmg / maxDmg * 100)}%;background:${TIER_COLORS[hs.tier]}"></i></div>
       </div>
       <div class="hr-stats"><b>${fmtNum(hs.dmg)}</b><span>${pct}% · ${hs.kills}☠ · ${fmtTime(hs.control)}</span></div>`;
    row.querySelector('.hr-port').appendChild(Sprites.portrait(i, 64));
    wrap.appendChild(row);
  });
  $('over-heroes').scrollTop = 0;
}

// ---------------- Shareable run-recap card ----------------
// Composes a 1080×1080 poster of the run (lead Guardian, score, key stats,
// unlocked achievements) and hands it to the Web Share API, falling back to a
// PNG download. A genuine "show your friends" wow-moment.
function buildRecapCanvas() {
  const S = 1080, c = document.createElement('canvas');
  c.width = S; c.height = S;
  const score = G.score || 0;
  const x = c.getContext('2d');
  // backdrop
  const bg = x.createLinearGradient(0, 0, 0, S);
  const won = G.victory;
  bg.addColorStop(0, won ? '#123a1f' : '#2a1216');
  bg.addColorStop(1, '#05140d');
  x.fillStyle = bg; x.fillRect(0, 0, S, S);
  // vignette frame
  x.strokeStyle = won ? 'rgba(255,213,79,.5)' : 'rgba(239,154,154,.4)'; x.lineWidth = 6;
  x.strokeRect(28, 28, S - 56, S - 56);
  x.textAlign = 'center';
  // title
  x.fillStyle = '#ffd54f'; x.font = 'bold 60px "Trebuchet MS",sans-serif';
  x.fillText('BALITOPIA', S / 2, 118);
  x.fillStyle = '#9fd8b4'; x.font = '26px "Trebuchet MS",sans-serif';
  x.fillText('GUARDIANS OF THE BROKEN CAGES', S / 2, 158);
  // lead portrait
  const port = Sprites.portrait(G.startHero, 300);
  const pw = port.width || 300;
  x.save();
  x.shadowColor = 'rgba(0,0,0,.6)'; x.shadowBlur = 30;
  x.drawImage(port, S / 2 - pw / 2, 200, pw, pw);
  x.restore();
  const lead = HEROES[G.startHero];
  x.fillStyle = '#fff'; x.font = 'bold 46px "Trebuchet MS",sans-serif';
  x.fillText(lead.name.toUpperCase(), S / 2, 560);
  const leadTier = heroState[G.startHero] ? heroState[G.startHero].tier : 0;
  x.fillStyle = TIER_COLORS[leadTier]; x.font = 'bold 26px "Trebuchet MS",sans-serif';
  x.fillText(TIER_NAMES[leadTier] + '  ·  ◆ ' + G.diff.name + (G.round > 1 ? '  ·  🌀 ROUND ' + G.round : ''), S / 2, 598);
  // score
  x.fillStyle = won ? '#ffd54f' : '#ef9a9a'; x.font = 'bold 130px "Trebuchet MS",sans-serif';
  x.fillText(score.toLocaleString(), S / 2, 740);
  x.fillStyle = '#9fd8b4'; x.font = '28px "Trebuchet MS",sans-serif';
  x.fillText(won ? (G.bossKills > 1 ? `KING GLOB SLAIN ×${G.bossKills}` : 'KING GLOB SLAIN') : 'FINAL SCORE', S / 2, 782);
  // The defining moment of the run, and the build — people share stories and
  // flexes, not stat tables.
  const topHero = heroState.map((hs, i) => ({ i, hs })).sort((a, b) => b.hs.dmg - a.hs.dmg)[0];
  let moment = '';
  if (G.bestCombo >= 25) moment = `A ×${G.bestCombo} KILL CHAIN`;
  else if (topHero && topHero.hs.tier >= 4) moment = `${HEROES[topHero.i].name.toUpperCase()} ASCENDED`;
  else if (G.eliteKills >= 5) moment = `${G.eliteKills} ELITES DOWN`;
  else if (freedSet.size >= 16) moment = `${freedSet.size} GUARDIANS FREED`;
  else if (G.bestPowershot >= 12) moment = `${G.bestPowershot} SLAIN IN ONE BLAST`;
  else moment = `${G.kills.toLocaleString()} OF THE HORDE UNMADE`;
  x.fillStyle = '#80cbc4'; x.font = 'italic 30px "Trebuchet MS",sans-serif';
  x.fillText(moment, S / 2, 640);
  // relic loadout
  if (relics.length) {
    x.font = '34px "Trebuchet MS",sans-serif';
    x.fillText(relics.map(r => `${r.def.icon}${r.lv}`).join('   '), S / 2, 682);
  }
  const stats = [
    ['⏱', fmtTime(G.time | 0)], ['☠', G.kills.toLocaleString()],
    ['⛓', freedSet.size + '/' + HEROES.length], ['★', 'LV ' + G.level],
  ];
  const bw = 224, gap = 12, totalW = stats.length * bw + (stats.length - 1) * gap, sx = S / 2 - totalW / 2, sy = 830;
  stats.forEach(([ic, v], i) => {
    const bx = sx + i * (bw + gap);
    x.fillStyle = 'rgba(255,255,255,.06)'; roundRect(x, bx, sy, bw, 110, 16); x.fill();
    x.fillStyle = '#ffd54f'; x.font = '38px "Trebuchet MS",sans-serif';
    x.fillText(ic, bx + bw / 2, sy + 50);
    x.fillStyle = '#fff'; x.font = 'bold 34px "Trebuchet MS",sans-serif';
    x.fillText(v, bx + bw / 2, sy + 92);
  });
  // Seed: a friend can play the exact same run. "Beat my score on this seed" is
  // a genuine share hook; a stat table isn't.
  x.fillStyle = '#ffd54f'; x.font = 'bold 24px "Trebuchet MS",sans-serif';
  x.fillText(`SEED  ${G.seed}`, S / 2, 972);
  x.fillStyle = '#cfd8e6'; x.font = 'italic 25px "Trebuchet MS",sans-serif';
  x.fillText(G.victory ? 'Play my seed. Beat my score.' : 'Can you break more cages?', S / 2, 1012);
  return c;
}
function roundRect(x, rx, ry, rw, rh, r) {
  x.beginPath();
  x.moveTo(rx + r, ry); x.arcTo(rx + rw, ry, rx + rw, ry + rh, r);
  x.arcTo(rx + rw, ry + rh, rx, ry + rh, r); x.arcTo(rx, ry + rh, rx, ry, r);
  x.arcTo(rx, ry, rx + rw, ry, r); x.closePath();
}
async function shareRecap() {
  Sound.sfx.uiClick();
  let canvas;
  try { canvas = buildRecapCanvas(); } catch (e) { return; }
  canvas.toBlob(async blob => {
    if (!blob) return;
    const file = new File([blob], 'balitopia-run.png', { type: 'image/png' });
    // native share sheet where supported (mobile), otherwise download
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Balitopia', text: `I scored ${G.score.toLocaleString()} in Balitopia!` });
        return;
      } catch (e) { /* user cancelled or unsupported — fall through to download */ }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'balitopia-run.png';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }, 'image/png');
}

function endGame() {
  if (G.over) return;
  G.over = true;
  // endless: a run always ends in death, but killing Glob at least once counts as a win
  const won = G.victory = G.bossKills > 0;
  Sound.stopMusic(0.6);
  Sound.stopFlourish();
  Sound.playFile('assets/audio/sfx/captured.mp3', 0.9);
  setTimeout(() => {
    if (G.over) Sound.playMusic(won ? 'music/victory.mp3' : 'music/bgm_gameover.mp3', { loop: false, vol: 0.6 });
  }, 1800);
  G.score = computeScore();
  const rank = saveRun(G.score);
  setTimeout(() => {
    G.running = false;
    G.pendingLv = 0;
    overlayQ = [];
    OVERLAY_IDS.forEach(id => $(id).classList.add('hidden'));   // clear overlays caught mid-transition
    $('screen-roster').classList.add('hidden');
    buildStatsScreen(rank);
    $('hud').classList.add('hidden');
    $('screen-over').classList.remove('hidden');
  }, 1100);
}

// ---------------- Records screen (leaderboard + codex) ----------------
function buildRecordsScreen() {
  const save = loadSave();
  const records = Array.isArray(save.records) ? save.records : [];
  const mastery = save.mastery || {};
  const medal = ['🥇', '🥈', '🥉'];
  // today's daily challenge summary
  const s = dailySetup();
  const dBest = (save.daily && save.daily[dayKey()]) || 0;
  const dd = DIFFICULTIES[s.diff];
  const dm = save.dailyMeta || { streak: 0, done: {} };
  const doneToday = dm.done[dayKey()] || {};
  const objs = todaysObjectives();
  let html = `<div class="rec-block"><div class="rec-h">☀ TODAY'S DAILY <span class="rec-sub">🔥 ${dm.streak || 0}-day streak</span></div>
    <div class="daily-card">
      <div>Guardian: <b>${HEROES[s.hero].name}</b> · <span style="color:${dd.color}">${dd.name}</span> · ${s.region.split('-')[1]}</div>
      <div>Your best today: <b>${dBest ? dBest.toLocaleString() : '—'}</b></div>
      <div class="daily-objs">${objs.map(o =>
        `<span class="dobj${doneToday[o.id] ? ' done' : ''}">${doneToday[o.id] ? '✓' : o.icon} ${o.desc} <b>🐚${o.shells}</b></span>`).join('')}</div>
      <div class="daily-next">Tomorrow's streak reward: <b>🐚${streakReward((dm.streak || 0) + 1)}</b> · one missed day is forgiven</div>
    </div></div>`;
  html += '<div class="rec-block"><div class="rec-h">BEST RUNS</div>';
  if (!records.length) html += '<div class="rec-empty">No runs yet — go make history.</div>';
  else {
    html += '<div class="rec-list">';
    records.forEach((r, i) => {
      const d = DIFFICULTIES[r.diff] || DIFFICULTIES[0];
      const crowns = r.bossKills > 1 ? `👑×${r.bossKills} ` : r.won ? '👑 ' : '';
      html += `<div class="rec-row${r.won ? ' won' : ''}">
        <span class="rec-rank">${medal[i] || ('#' + (i + 1))}</span>
        <span class="rec-score">${r.score.toLocaleString()}</span>
        <span class="rec-hero">${crowns}${r.heroName}${r.assist ? ' <i class="rec-assist">assist</i>' : ''}</span>
        <span class="rec-diff" style="color:${d.color}">${d.name}</span>
        <span class="rec-meta">${fmtTime(r.time)} · ${r.kills}☠ · ${r.freed}/${HEROES.length}${r.seed ? ' · ' + r.seed : ''}</span>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';
  // achievements
  const ach = save.ach || {};
  const gotN = ACHIEVEMENTS.filter(a => ach[a.id]).length;
  html += `<div class="rec-block"><div class="rec-h">ACHIEVEMENTS <span class="rec-sub">${gotN}/${ACHIEVEMENTS.length}</span></div><div class="ach-grid">`;
  for (const a of ACHIEVEMENTS) {
    const got = !!ach[a.id];
    html += `<div class="ach-cell${got ? ' got' : ''}"><div class="ach-ic">${got ? a.icon : '🔒'}</div><div class="ach-tx"><b>${a.name}</b><span>${a.desc}</span></div></div>`;
  }
  html += '</div></div>';
  // Codex milestones now pay out, and completing it unlocks Prestige. A 100-hour
  // goal with no payoff is a checklist, not a progression system.
  const done = HEROES.filter(h => (mastery[h.id] || 0) >= 4).length;
  const seen = HEROES.filter(h => mastery[h.id] != null).length;
  const claimed = save.codexClaimed || (save.codexClaimed = {});
  const MILESTONES = [[6, 150], [12, 350], [18, 600], [24, 1200]];
  let msHtml = '';
  for (const [n, reward] of MILESTONES) {
    const hit = done >= n, got = claimed['m' + n];
    msHtml += `<span class="codex-ms${hit ? (got ? ' got' : ' ready') : ''}" data-ms="${n}" data-reward="${reward}">${n} ASCENDANT · 🐚${reward}${got ? ' ✓' : hit ? ' — CLAIM' : ''}</span>`;
  }
  html += `<div class="rec-block"><div class="rec-h">GUARDIAN CODEX <span class="rec-sub">${done}/${HEROES.length} mastered · ${seen} seen</span></div>
    <div class="codex-ms-row">${msHtml}</div>
    ${done >= HEROES.length ? `<div class="prestige-card">
      <b>🌅 PRESTIGE AVAILABLE</b>
      <span>Reset your Shrine perks and start again with a permanent <b>+25% score</b> multiplier, stacking. Unlocked Guardians, records and achievements are kept.</span>
      <button class="menu-btn2" id="btn-prestige">PRESTIGE (${save.prestige || 0})</button></div>` : ''}
    <div id="codex-grid"></div></div>`;
  $('records-body').innerHTML = html;
  const grid = $('codex-grid');
  HEROES.forEach((h, i) => {
    const tier = mastery[h.id];
    const cell = document.createElement('div');
    cell.className = 'codex-cell' + (tier == null ? ' locked' : '');
    if (tier != null) cell.style.borderColor = TIER_COLORS[tier];
    cell.appendChild(Sprites.portrait(i, 64));
    const lbl = document.createElement('span');
    lbl.textContent = tier != null ? TIER_NAMES[tier] : 'unseen';
    if (tier != null) lbl.style.color = TIER_COLORS[tier];
    cell.appendChild(lbl);
    grid.appendChild(cell);
  });
  // claim codex milestone rewards
  $('records-body').querySelectorAll('.codex-ms.ready').forEach(el => {
    el.addEventListener('click', () => {
      const s = loadSave(), n = el.dataset.ms, reward = +el.dataset.reward;
      s.codexClaimed = s.codexClaimed || {};
      if (s.codexClaimed['m' + n]) return;
      s.codexClaimed['m' + n] = 1;
      s.shells = (s.shells || 0) + reward;
      saveGame(s); flushSave();
      Sound.sfx.unlock(); buzz(HAPTIC.unlock);
      buildRecordsScreen();
    });
  });
  const pb = $('btn-prestige');
  if (pb) pb.addEventListener('click', () => {
    confirmModal('Prestige?', 'Your Shrine perks and shells reset. You keep every Guardian, record and achievement, and gain a permanent <b>+25% score</b> multiplier that stacks with each prestige.', () => {
      const s = loadSave();
      s.prestige = (s.prestige || 0) + 1;
      s.perks = {}; s.deep = {}; s.shells = 0;
      saveGame(s); flushSave();
      Sound.sfx.unlock();
      buildRecordsScreen();
      banner(`🌅 PRESTIGE ${s.prestige} — THE ISLAND REMEMBERS`);
    }, 'Prestige');
  });
  $('records-body').scrollTop = 0;
}
function openRecords() { Sound.sfx.uiClick(); buildRecordsScreen(); $('screen-records').classList.remove('hidden'); }
function closeRecords() { Sound.sfx.uiBack(); $('screen-records').classList.add('hidden'); }

// ---------------- Shell Shrine (meta shop) ----------------
function buildShop() {
  const save = loadSave();
  const shells = save.shells || 0;
  const perks = save.perks || {};
  $('shop-shell-count').textContent = shells.toLocaleString();
  const body = $('shop-body');
  body.innerHTML = '';
  for (const p of PERKS) {
    const lv = perks[p.id] || 0;
    const maxed = lv >= p.max;
    const cost = maxed ? 0 : p.cost(lv);
    const row = document.createElement('div');
    row.className = 'shop-row' + (maxed ? ' maxed' : '');
    row.innerHTML =
      `<div class="shop-ic">${p.icon}</div>
       <div class="shop-mid"><b>${p.name}</b><span>${p.desc}</span>
         <div class="shop-dots">${Array.from({ length: p.max }, (_, i) => `<i class="${i < lv ? 'on' : ''}"></i>`).join('')}</div></div>
       <button class="shop-buy" ${maxed || shells < cost ? 'disabled' : ''}>${maxed ? 'MAX' : '🐚 ' + cost}</button>`;
    if (!maxed) row.querySelector('.shop-buy').addEventListener('click', () => {
      const s = loadSave();
      if ((s.shells || 0) < cost) return;
      s.shells -= cost;
      s.perks = s.perks || {}; s.perks[p.id] = (s.perks[p.id] || 0) + 1;
      saveGame(s); flushSave();
      Sound.sfx.uiClick(); buzz(HAPTIC.tick);
      buildShop();
    });
    body.appendChild(row);
  }
  // Tier 2: one-time unlocks that change how a run is BUILT. The flat perks
  // above are exhausted in ~26 runs; these give the shop a ~100-run horizon.
  const deep = save.deep || {};
  const head = document.createElement('div');
  head.className = 'shop-head';
  head.innerHTML = 'DEEP SHRINE <span>permanent changes to how a run plays</span>';
  body.appendChild(head);
  for (const p of DEEP_PERKS) {
    const owned = !!deep[p.id];
    const row = document.createElement('div');
    row.className = 'shop-row deep' + (owned ? ' maxed' : '');
    row.innerHTML =
      `<div class="shop-ic">${p.icon}</div>
       <div class="shop-mid"><b>${p.name}</b><span>${p.desc}</span></div>
       <button class="shop-buy" ${owned || shells < p.cost ? 'disabled' : ''}>${owned ? 'OWNED' : '🐚 ' + p.cost}</button>`;
    if (!owned) row.querySelector('.shop-buy').addEventListener('click', () => {
      const s = loadSave();
      if ((s.shells || 0) < p.cost) return;
      s.shells -= p.cost;
      s.deep = s.deep || {}; s.deep[p.id] = 1;
      saveGame(s); flushSave();
      Sound.sfx.unlock(); buzz(HAPTIC.unlock);
      buildShop();
    });
    body.appendChild(row);
  }
}
function openShop() { Sound.ensure(); Sound.sfx.uiClick(); buildShop(); $('screen-shop').classList.remove('hidden'); }
function closeShop() { Sound.sfx.uiBack(); $('screen-shop').classList.add('hidden'); }

// ---------------- Settings ----------------
function bindSettings() {
  const sync = () => {
    $('set-music').value = prefs.musicVol; $('set-music-v').textContent = prefs.musicVol + '%';
    $('set-sfx').value = prefs.sfxVol; $('set-sfx-v').textContent = prefs.sfxVol + '%';
    $('set-haptics').checked = !!prefs.haptics;
    $('set-motion').checked = !prefs.motion;         // checkbox = "reduced motion ON"
    $('set-colorblind').checked = !!prefs.colorblind;
    $('set-minimap').checked = !!prefs.minimap;
    $('set-uiscale').value = prefs.uiscale; $('set-uiscale-v').textContent = prefs.uiscale + '%';
    $('set-stickside').value = prefs.stickSide;
    $('set-sticktype').value = prefs.stickType;
    $('set-sticksize').value = prefs.stickSize; $('set-sticksize-v').textContent = prefs.stickSize + '%';
    $('set-deadzone').value = prefs.deadzone; $('set-deadzone-v').textContent = prefs.deadzone + '%';
    $('set-quality').value = prefs.quality;
    $('set-fps').value = String(prefs.fpsCap);
    $('set-shake').value = prefs.shake; $('set-shake-v').textContent = prefs.shake + '%';
    $('set-flash').value = prefs.flash; $('set-flash-v').textContent = prefs.flash + '%';
    $('set-daynight').value = prefs.dayNight; $('set-daynight-v').textContent = prefs.dayNight + '%';
    $('set-dmgnum').value = prefs.dmgnum;
    $('set-cvd').value = prefs.cvd;
    $('set-assist').checked = !!prefs.assist;
  };
  // simple binder for the new controls
  const bindRange = (id, key) => $(id).addEventListener('input', e => {
    prefs[key] = +e.target.value; $(id + '-v').textContent = prefs[key] + '%'; savePrefs();
  });
  const bindSel = (id, key, num) => $(id).addEventListener('change', e => {
    prefs[key] = num ? +e.target.value : e.target.value; savePrefs(); Sound.sfx.uiSelect();
  });
  bindRange('set-sticksize', 'stickSize');
  bindRange('set-deadzone', 'deadzone');
  bindRange('set-shake', 'shake');
  bindRange('set-flash', 'flash');
  bindRange('set-daynight', 'dayNight');
  bindSel('set-stickside', 'stickSide');
  bindSel('set-sticktype', 'stickType');
  bindSel('set-quality', 'quality');
  bindSel('set-fps', 'fpsCap', true);
  bindSel('set-dmgnum', 'dmgnum');
  bindSel('set-cvd', 'cvd');
  $('set-assist').addEventListener('change', e => { prefs.assist = e.target.checked ? 1 : 0; savePrefs(); });
  $('set-music').addEventListener('input', e => { prefs.musicVol = +e.target.value; $('set-music-v').textContent = prefs.musicVol + '%'; savePrefs(); });
  $('set-sfx').addEventListener('input', e => { prefs.sfxVol = +e.target.value; $('set-sfx-v').textContent = prefs.sfxVol + '%'; savePrefs(); });
  $('set-sfx').addEventListener('change', () => Sound.sfx.uiSelect());
  $('set-haptics').addEventListener('change', e => { prefs.haptics = e.target.checked ? 1 : 0; savePrefs(); if (prefs.haptics) buzz(20); });
  $('set-motion').addEventListener('change', e => { prefs.motion = e.target.checked ? 0 : 1; savePrefs(); });
  $('set-colorblind').addEventListener('change', e => { prefs.colorblind = e.target.checked ? 1 : 0; savePrefs(); });
  $('set-minimap').addEventListener('change', e => { prefs.minimap = e.target.checked ? 1 : 0; savePrefs(); });
  $('set-uiscale').addEventListener('input', e => { prefs.uiscale = +e.target.value; $('set-uiscale-v').textContent = prefs.uiscale + '%'; savePrefs(); });
  $('btn-export-save').addEventListener('click', exportSave);
  $('btn-import-save').addEventListener('click', importSave);
  $('btn-wipe-save').addEventListener('click', wipeSave);
  window.__syncSettings = sync;
}
function openSettings(fromScreen) {
  Sound.sfx.uiClick();
  window.__settingsFrom = fromScreen || 'screen-title';
  window.__syncSettings && window.__syncSettings();
  $('screen-settings').classList.remove('hidden');
}
function closeSettings() {
  Sound.sfx.uiBack();
  $('screen-settings').classList.add('hidden');
}
function exportSave() {
  const data = localStorage.getItem('balitopia') || '{}';
  try {
    navigator.clipboard.writeText(data);
    banner ? null : null;
  } catch (e) {}
  const blob = new Blob([data], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = 'balitopia-save.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function importSave() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const parsed = JSON.parse(r.result);
        if (parsed && typeof parsed === 'object') {
          saveCache = parsed; saveDirty = true; flushSave();
          loadPrefs(); window.__syncSettings && window.__syncSettings();
          showModal('Save imported', 'Your progress has been restored. Reload to see everything.',
            [{ label: 'Reload', primary: true, onClick: () => location.reload() }, { label: 'Later' }]);
        }
      } catch (e) { showModal('Import failed', 'That file was not a valid Balitopia save.'); }
    };
    r.readAsText(f);
  };
  inp.click();
}
function wipeSave() {
  confirmModal('Erase all progress?',
    'This deletes your records, unlocked Guardians, mastery, shells and settings. It cannot be undone.',
    () => {
      try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem(SAVE_BAK); } catch (e) {}
      saveCache = null; saveDirty = false;
      prefs = { ...PREF_DEFAULTS }; applyPrefs();
      location.reload();
    }, 'Erase everything');
}

// ---------------- How to play ----------------
function buildHowto() {
  const side = prefs.stickSide === 'right' ? 'right' : 'left';
  const other = side === 'left' ? 'right' : 'left';
  $('howto-body').innerHTML = `
    <h3>CONTROLS</h3>
    <div class="ht-row"><span class="ht-key">Move</span><span>Drag anywhere on the <b>${side} half</b> of the screen (or WASD / arrows). Swap sides in Settings.</span></div>
    <div class="ht-row"><span class="ht-key">Dash ⟫</span><span><b>Double-tap</b> the ${side} half, or press the dash button — a short dodge with invulnerability. 6s cooldown.</span></div>
    <div class="ht-row"><span class="ht-key">Attack</span><span>Automatic — every Guardian auto-aims at the nearest threat</span></div>
    <div class="ht-row"><span class="ht-key">Powershot ⚡</span><span>Tap the <b>${other} half</b> (or Space) when the button glows — a screen-clearing signature blast</span></div>
    <div class="ht-row"><span class="ht-key">Possess</span><span>Tap a freed Guardian's card in the ribbon. Costs <b>✦ Soul</b> (3 max, one recharges every 25s) and grants <b>Soulburn</b>: +40% damage for 3s.</span></div>
    <div class="ht-row"><span class="ht-key">Formation ⭕</span><span>Cycle your squad between <b>Ring</b> (defend), <b>Vanguard</b> (push) and <b>Focus</b> (converge)</span></div>
    <div class="ht-row"><span class="ht-key">Pause</span><span>Tap ☰ (or Esc / P) for the roster, your current build, and settings</span></div>
    <h3>THE ISLAND</h3>
    <div class="ht-row"><span class="ht-ico">⛓</span><span><b>Free the Guardians.</b> Shoot a cage until it breaks — that Guardian fights beside you and becomes a body you can possess. The <b>gold arrow</b> points to the nearest one. Some cages are <b>guarded</b>.</span></div>
    <div class="ht-row"><span class="ht-ico">🎨</span><span><b>Colour = danger.</b> Six power tiers by hue: green → blue → purple → pink → orange → gold. Turn on <em>Colorblind danger pips</em> or a <em>Colour vision</em> mode in Settings for redundant cues.</span></div>
    <div class="ht-row"><span class="ht-ico">💀</span><span><b>Elites</b> carry an affix and a name tag — <em>Gilded</em> pays out, <em>Splitting</em> multiplies, <em>Volatile</em> leaves fire. Kill them for chests.</span></div>
    <div class="ht-row"><span class="ht-ico">📦</span><span><b>Caches</b> give several upgrades at once. Chase the <b>Golden One</b> if you see it run.</span></div>
    <div class="ht-row"><span class="ht-ico">👑</span><span><b>King Glob</b> arrives at 6:00. Beat him and endless rounds begin — each one lets you draft a <b>curse</b> for bonus score, and the <b>Reef Mother</b> alternates in.</span></div>
    <div class="ht-row"><span class="ht-ico">🏝</span><span><b>Biomes matter.</b> Jungle growth slows the horde, the sea surges and shoves everything sideways, sky winds bend your shots.</span></div>
    <h3>BUILDING A RUN</h3>
    <div class="ht-row"><span class="ht-ico">★</span><span><b>Level up</b> to draft an upgrade. Cards are face-up — read them. <b>Reroll</b> or <b>Skip</b> for HP if you don't like the hand.</span></div>
    <div class="ht-row"><span class="ht-ico">🗿</span><span><b>Relics</b> are your second weapon slot (two max, four levels each). They're hero-agnostic, so the same relic plays differently on every Guardian — this is where build variety lives.</span></div>
    <div class="ht-row"><span class="ht-ico">🔗</span><span><b>Combo.</b> Kills within two seconds chain a multiplier onto your score. Aggression pays.</span></div>
    <div class="ht-row"><span class="ht-ico">🟩</span><span><b>Mastery.</b> Each Guardian levels from the damage <em>they</em> deal: SPROUT → TIDE → STORM → ELDER → <b>ASCENDANT</b>, where their weapon evolves.</span></div>
    <h3>BEYOND ONE RUN</h3>
    <div class="ht-row"><span class="ht-ico">🔓</span><span><b>Unlock Guardians</b> by meeting specific goals. The next three are always shown on the select and death screens.</span></div>
    <div class="ht-row"><span class="ht-ico">🐚</span><span><b>Shells</b> buy Shrine perks, then <b>Deep Shrine</b> unlocks that change how a run is built.</span></div>
    <div class="ht-row"><span class="ht-ico">🔗</span><span><b>Seeds.</b> Every run has a code. Share it, or play a friend's from the title menu.</span></div>
  `;
}
function openHowto() { Sound.sfx.uiClick(); buildHowto(); $('screen-howto').classList.remove('hidden'); }
function closeHowto() { Sound.sfx.uiBack(); $('screen-howto').classList.add('hidden'); }

// ---------------- Save data (versioned) ----------------
const SAVE_VERSION = 3;
const SAVE_KEY = 'balitopia', SAVE_BAK = 'balitopia_bak';
let saveCache = null, saveDirty = false, saveTimer = 0;

// A tiny checksum so a truncated or corrupted write is detectable rather than
// silently misread. Writes are debounced and rotate between two slots, so a
// failure mid-write can never destroy the only copy of the player's progress.
function checksum(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0;
  return h >>> 0;
}
function readSlot(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o !== 'object') return null;
    if (o.__ck !== undefined) {
      const ck = o.__ck; delete o.__ck;
      if (checksum(JSON.stringify(o)) !== ck) return null;   // corrupted
    }
    return o;
  } catch (e) { return null; }
}
function loadSave() {
  if (saveCache) return saveCache;
  let s = readSlot(SAVE_KEY) || readSlot(SAVE_BAK) || {};
  if (!s.v) {                                  // v1 (unversioned) → v2
    s.records = Array.isArray(s.records) ? s.records : [];
    s.mastery = s.mastery && typeof s.mastery === 'object' ? s.mastery : {};
    s.v = 2;
  }
  if (s.v < 3) {
    // v2 → v3. Players who already have progress keep every Guardian they had
    // access to — the unlock cascade must never take content away from someone
    // who was already playing. A genuinely fresh save starts with the starters.
    const hadProgress = (s.records && s.records.length) || s.lastHero !== undefined ||
      (s.mastery && Object.keys(s.mastery).length) || s.bestScore;
    if (!s.unlocked) s.unlocked = hadProgress ? HEROES.map(h => h.id) : STARTER_HEROES.slice();
    s.deep = s.deep || {};
    s.coach = s.coach || {};
    s.v = 3;
    s.__fresh = 1;
  }
  if (!Array.isArray(s.unlocked) || !s.unlocked.length) { s.unlocked = STARTER_HEROES.slice(); s.__fresh = 1; }
  saveCache = s;
  // persist the initialised/migrated shape immediately, so the unlock roster
  // exists on disk from the very first visit rather than only after a run
  if (s.__fresh || s.v !== SAVE_VERSION) { delete s.__fresh; saveGame(s); }
  return s;
}
function saveGame(s) {
  s.v = SAVE_VERSION;
  saveCache = s;
  saveDirty = true;
  if (!saveTimer) saveTimer = setTimeout(flushSave, 500);
}
let saveFailed = false;
function flushSave() {
  saveTimer = 0;
  if (!saveDirty || !saveCache) return;
  saveDirty = false;
  try {
    const body = JSON.stringify(saveCache);
    const out = JSON.stringify(Object.assign({}, saveCache, { __ck: checksum(body) }));
    // keep the previous good copy before overwriting the primary
    const prev = localStorage.getItem(SAVE_KEY);
    if (prev) { try { localStorage.setItem(SAVE_BAK, prev); } catch (e) {} }
    localStorage.setItem(SAVE_KEY, out);
    saveFailed = false;
  } catch (e) {
    // Storage quota / private mode / eviction. This used to be swallowed
    // entirely, so a player could lose everything with no signal at all.
    if (!saveFailed) {
      saveFailed = true;
      showModal('Progress could not be saved', 'Your browser is blocking local storage (private mode, or storage is full). Export your save from Settings to keep it.', [{ label: 'OK' }]);
    }
  }
}
const isUnlocked = id => loadSave().unlocked.includes(id);

// ---------------- In-game modal (replaces alert/confirm) ----------------
// Native browser dialogs put the site's URL on screen — the single loudest
// "this is a web page" signal in a game that's meant to feel like an app.
function showModal(title, body, buttons) {
  const wasRunning = G.running;
  G.running = false;
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = body;
  const row = $('modal-btns');
  row.innerHTML = '';
  (buttons || [{ label: 'OK' }]).forEach(b => {
    const el = document.createElement('button');
    el.className = b.danger ? 'menu-btn2 danger' : b.primary ? 'big-btn' : 'menu-btn2';
    el.textContent = b.label;
    el.addEventListener('click', () => {
      $('screen-modal').classList.add('hidden');
      Sound.sfx.uiClick();
      if (wasRunning && !G.over && $('screen-levelup').classList.contains('hidden')) G.running = true;
      if (b.onClick) b.onClick();
    });
    row.appendChild(el);
  });
  $('screen-modal').classList.remove('hidden');
}
const confirmModal = (title, body, onYes, yesLabel) =>
  showModal(title, body, [
    { label: 'Cancel' },
    { label: yesLabel || 'Confirm', danger: true, onClick: onYes },
  ]);

// ---------------- Preferences ----------------
const PREF_DEFAULTS = {
  musicVol: 80, sfxVol: 100, haptics: 1, motion: 1, colorblind: 0, uiscale: 100, minimap: 1,
  stickSide: 'left', stickType: 'float', stickSize: 100, deadzone: 8,
  quality: 'auto', fpsCap: 60, shake: 100, flash: 100, dmgnum: 'all', cvd: 'none', assist: 0, dayNight: 100,
};
let prefs = { ...PREF_DEFAULTS };
function loadPrefs() {
  const save = loadSave();
  prefs = { ...PREF_DEFAULTS, ...(save.prefs || {}) };
  applyPrefs();
}
function applyPrefs() {
  Sound.setMusicVol(prefs.musicVol / 100);
  Sound.setSfxVol(prefs.sfxVol / 100);
  document.body.classList.toggle('reduce-motion', !prefs.motion);
  document.body.classList.toggle('stick-right', prefs.stickSide === 'right');
  document.body.dataset.cvd = prefs.cvd || 'none';
  document.documentElement.style.setProperty('--ui-scale', prefs.uiscale / 100);
  if (prefs.quality && prefs.quality !== 'auto') applyQuality(prefs.quality);
}
function savePrefs() {
  const save = loadSave();
  save.prefs = prefs;
  saveGame(save);
  applyPrefs();
}

// ---------------- Menus ----------------
let selectedHero = 0;

function enterApp() {
  Sound.ensure();   // the caller (goStory / goSelect) owns music from here
  try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
  try {
    const fs = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
    if (fs && fs.catch) fs.catch(() => {});
  } catch (e) {}
}

// menu-screen navigation (keeps only one visible; manages menu music)
const MENU_SCREENS = ['screen-title', 'screen-story', 'screen-select'];
let lastScreen = null;
function showScreen(id, music) {
  MENU_SCREENS.forEach(s => $(s).classList.toggle('hidden', s !== id));
  if (lastScreen && lastScreen !== id) Sound.playFile('assets/audio/sfx/whoosh.mp3', 0.5);
  lastScreen = id;
  if (music === 'title') Sound.playMusic('music/title.mp3');
  else if (music === 'none') { Sound.stopMusic(); Sound.stopPreview(); }
}
function goTitle()  { Sound.stopPreview(); $('screen-over').classList.add('hidden'); $('screen-records').classList.add('hidden'); showScreen('screen-title', 'title'); }
function goStory()  { Sound.stopPreview(); showScreen('screen-story', 'title'); }
function goSelect() { buildSelect(); showScreen('screen-select', 'none'); }  // quiet for hero previews

let selectedDiff = 0;
function buildDiffSelector() {
  const save = loadSave();
  const unlocked = Math.min(DIFFICULTIES.length - 1, (save.maxDiff == null ? -1 : save.maxDiff) + 1);
  if (save.lastDiff != null) selectedDiff = save.lastDiff;
  selectedDiff = Math.min(selectedDiff, unlocked);
  const el = $('diff-select');
  el.innerHTML = '';
  DIFFICULTIES.forEach(d => {
    const locked = d.id > unlocked;
    const chip = document.createElement('button');
    chip.className = 'diff-chip' + (d.id === selectedDiff ? ' on' : '') + (locked ? ' locked' : '');
    chip.style.setProperty('--dc', d.color);
    chip.textContent = locked ? `🔒 ${d.name}` : d.name;
    if (!locked) chip.addEventListener('pointerdown', e => {
      e.stopPropagation();
      selectedDiff = d.id;
      Sound.sfx.uiSelect();
      el.querySelectorAll('.diff-chip').forEach(c => c.classList.toggle('on', c.textContent === d.name));
    });
    el.appendChild(chip);
  });
}

function buildTitle() {
  $('story-box').innerHTML = STORY.intro.map(p => `<p>${p}</p>`).join('');
  $('threat-row').innerHTML =
    `<figure class="threat-card"><img src="assets/img/poster_minyar.jpg" alt="Minyar"><figcaption>MINYAR</figcaption></figure>
     <figure class="threat-card"><img src="assets/img/poster_demonder.jpg" alt="Demonder"><figcaption>DEMONDER</figcaption></figure>
     <figure class="threat-card"><img src="assets/img/poster_clubbo.jpg" alt="Clubbo"><figcaption>CLUBBO</figcaption></figure>`;

  // restore persisted preferences
  const save = loadSave();
  if (save.muted) { Sound.setMuted(true); $('btn-mute').classList.add('muted'); }

  // CONTINUE appears once the island knows you (any previous run)
  if (save.lastHero !== undefined) {
    selectedHero = Math.max(0, Math.min(HEROES.length - 1, save.lastHero));
    $('btn-menu-continue').classList.remove('hidden');
  }

  $('btn-menu-start').addEventListener('click', () => { enterApp(); Sound.sfx.uiClick(); goStory(); });
  $('btn-menu-continue').addEventListener('click', () => { enterApp(); Sound.sfx.uiClick(); goSelect(); });
  $('btn-menu-records').addEventListener('click', () => { enterApp(); openRecords(); });
  $('btn-menu-daily').addEventListener('click', startDaily);
  $('btn-menu-shop').addEventListener('click', openShop);
  $('btn-shop-back').addEventListener('click', closeShop);
  $('btn-story-continue').addEventListener('click', () => { Sound.sfx.uiClick(); goSelect(); });
  $('btn-story-back').addEventListener('click', () => { Sound.sfx.uiBack(); goTitle(); });
  $('btn-select-back').addEventListener('click', () => { Sound.sfx.uiBack(); goStory(); });
  $('btn-records-back').addEventListener('click', closeRecords);
  $('btn-over-records').addEventListener('click', openRecords);
  $('btn-over-share').addEventListener('click', shareRecap);
  $('btn-over-menu').addEventListener('click', () => { Sound.sfx.uiBack(); goTitle(); });
  $('btn-menu-settings').addEventListener('click', () => { Sound.ensure(); openSettings('screen-title'); });
  $('btn-settings-back').addEventListener('click', closeSettings);
  $('btn-menu-howto').addEventListener('click', () => { Sound.ensure(); openHowto(); });
  $('btn-menu-seed').addEventListener('click', () => { Sound.ensure(); promptSeed(); });
  $('btn-howto-back').addEventListener('click', closeHowto);
  bindSettings();
}

function buildSelect() {
  const grid = $('hero-grid');
  const save = loadSave();
  grid.innerHTML = '';
  // ensure the preselected hero is actually available
  if (!isUnlocked(HEROES[selectedHero].id))
    selectedHero = HEROES.findIndex(h => isUnlocked(h.id));
  HEROES.forEach((h, i) => {
    const locked = !isUnlocked(h.id);
    const card = document.createElement('div');
    card.className = 'hero-card' + (i === selectedHero ? ' selected' : '') + (locked ? ' locked' : '');
    card.dataset.idx = i;
    const un = UNLOCKS.find(u => u.id === h.id);
    card.innerHTML = `<div class="hc-name">${locked ? '🔒' : h.name}</div>`;
    card.insertBefore(Sprites.portrait(i, 96), card.firstChild);
    card.addEventListener('pointerdown', () => {
      if (locked) {
        Sound.sfx.uiBack();
        showModal(`${h.name} is caged`, un ? `Unlock by: <b>${un.desc}</b>` : 'Keep playing to unlock.', [{ label: 'OK', primary: true }]);
        return;
      }
      selectedHero = i;
      grid.querySelectorAll('.hero-card').forEach(c => c.classList.toggle('selected', +c.dataset.idx === i));
      showDetail(i);
      Sound.sfx.uiSelect();
      Sound.preview(`assets/audio/heroes/${HEROES[i].id}.mp3`);   // hero theme snippet
    });
    grid.appendChild(card);
  });
  // the three nearest unlocks, always visible — a concrete reason to replay
  const goals = nextGoals(save);
  const gEl = $('select-goals');
  gEl.innerHTML = goals.length
    ? goals.map(g => `<span class="sg"><b>${g.icon} ${g.name}</b> ${g.desc}</span>`).join('')
    : '<span class="sg">Every Guardian is free. Now master them.</span>';
  const total = HEROES.length, have = save.unlocked.length;
  $('select-count').textContent = `${have}/${total} GUARDIANS`;
  buildDiffSelector();
  showDetail(selectedHero);
}
function showDetail(i) {
  const h = HEROES[i];
  const pd = $('hero-detail-portrait');
  pd.innerHTML = '';
  pd.appendChild(Sprites.portrait(i, 128));
  // idle animation over the portrait (portrait stays as fallback if the video can't play)
  const v = document.createElement('video');
  v.muted = true; v.loop = true; v.autoplay = true;
  v.playsInline = true; v.setAttribute('playsinline', '');
  v.className = 'detail-video';
  v.onerror = () => v.remove();
  v.src = `assets/video/${h.id}.mp4`;
  pd.appendChild(v);
  v.play().catch(() => v.remove());
  $('hero-detail-name').textContent = `${h.name} — ${h.title}`;
  $('hero-detail-power').textContent = h.power;
  $('hero-detail-desc').textContent = h.desc;
  // stat bars (HP / SPEED / POWER), normalized across the roster
  const R = heroStatRanges();
  const nrm = (v, lo, hi) => Math.round(Math.max(8, Math.min(100, (v - lo) / (hi - lo) * 92 + 8)));
  const bars = [
    ['HP', nrm(h.hp, R.hp[0], R.hp[1]), '#ef5350'],
    ['SPEED', nrm(h.spd, R.spd[0], R.spd[1]), '#4dd0e1'],
    ['POWER', nrm(heroPower(h), R.pow[0], R.pow[1]), '#ffd54f'],
  ];
  let stats = document.getElementById('hero-detail-stats');
  if (!stats) { stats = document.createElement('div'); stats.id = 'hero-detail-stats'; $('hero-detail-text').appendChild(stats); }
  stats.innerHTML = bars.map(([lbl, w, c]) =>
    `<div class="hstat"><span>${lbl}</span><div class="hstat-bar"><i style="width:${w}%;background:${c}"></i></div></div>`).join('');
  // Preview the playstyle: the passive trait and both signature upgrades. The
  // choice used to be made on artwork alone.
  let kit = document.getElementById('hero-detail-kit');
  if (!kit) { kit = document.createElement('div'); kit.id = 'hero-detail-kit'; $('hero-detail-text').appendChild(kit); }
  const tr = HERO_TRAIT[h.id], ups = HERO_UP[h.id] || [];
  const save = loadSave();
  const m = save.mastery && save.mastery[h.id];
  kit.innerHTML =
    `<div class="kit-row trait"><b>PASSIVE</b><span>${tr ? tr.txt : '—'}</span></div>` +
    ups.map((u, i) => `<div class="kit-row${i === 0 ? ' sig' : ''}"><b>${u[0]} ${u[1]}</b><span>${u[2]}</span></div>`).join('') +
    (m != null ? `<div class="kit-row mastery"><b>BEST</b><span style="color:${TIER_COLORS[m]}">${TIER_NAMES[m]}</span></div>` : '');
  $('hero-detail').classList.remove('hidden');
}
// rough sustained-DPS estimate so heroes can be compared at a glance
function heroPower(h) {
  let p = 0;
  for (const w of h.weapons) {
    const c = w.count || 1, iv = w.interval || 0.3;
    if (w.type === 'orbit') p += w.dmg * c * 3;
    else if (w.type === 'aura' || w.type === 'beam' || w.type === 'trail') p += w.dmg / iv * 1.4;
    else if (w.type === 'chain') p += w.dmg * ((w.jumps || 1) + 1) / iv;
    else p += w.dmg * c / iv;   // shot / nova / slash
  }
  return p;
}
let _statRanges = null;
function heroStatRanges() {
  if (_statRanges) return _statRanges;
  const hp = HEROES.map(h => h.hp), spd = HEROES.map(h => h.spd), pow = HEROES.map(heroPower);
  _statRanges = { hp: [Math.min(...hp), Math.max(...hp)], spd: [Math.min(...spd), Math.max(...spd)], pow: [Math.min(...pow), Math.max(...pow)] };
  return _statRanges;
}

// ---------------- Wire up ----------------
function wire() {
  $('btn-start').addEventListener('click', () => { Sound.ensure(); Sound.sfx.uiClick(); newGame(selectedHero, selectedDiff); });
  $('btn-retry').addEventListener('click', () => {
    Sound.sfx.uiClick();
    $('screen-over').classList.add('hidden');
    if (G.daily) startDaily(); else goSelect();   // replay the same daily
  });
  $('btn-roster').addEventListener('click', () => {
    if ($('screen-roster').classList.contains('hidden')) openRoster();
    else closeRoster();
  });
  $('btn-roster-close').addEventListener('click', closeRoster);
  $('btn-roster-settings').addEventListener('click', () => openSettings('screen-roster'));
  $('btn-roster-forfeit').addEventListener('click', () => {
    confirmModal('End this run?', 'Your score so far will be recorded.', () => {
      Sound.sfx.uiBack();
      $('screen-roster').classList.add('hidden');
      endGame();
    }, 'End run');
  });
  $('btn-chest-close').addEventListener('click', closeChest);
  $('formation-btn').addEventListener('click', e => { e.stopPropagation(); cycleFormation(); });
  $('dash-btn').addEventListener('pointerdown', e => { e.stopPropagation(); tryDash(); });
  $('ps-btn').addEventListener('pointerdown', e => { e.stopPropagation(); tryPowershot(); });
  $('btn-lu-reroll').addEventListener('click', () => {
    if (G.rerolls <= 0) return;
    G.rerolls--;
    Sound.sfx.uiSelect();
    showLevelUp();   // deal a fresh hand
  });
  $('btn-lu-skip').addEventListener('click', () => {
    Sound.sfx.uiBack();
    if (player) player.hp = Math.min(maxHP(), player.hp + maxHP() * 0.15);   // reward: patch up instead of powering up
    closeLevelUp();
  });
  $('btn-mute').addEventListener('click', () => {
    const m = Sound.toggleMute();
    $('btn-mute').classList.toggle('muted', m);
    try {
      const save = loadSave();
      save.muted = m;
      saveGame(save);
    } catch (e) {}
  });
  // Interruption handling. Previously: the roster opened (even on top of an
  // active modal), the music kept playing through a phone call, the rAF loop
  // kept burning battery, and unsaved progress could be lost on a tab kill.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (G.running && !G.over && !anyOverlayOpen()) openRoster();
      G.running = false;
      Sound.pauseAll();
      flushSave();
      if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
    } else {
      Sound.resumeAll();
      last = performance.now();
      if (!rafId) rafId = requestAnimationFrame(frame);
      requestWakeLock();
    }
  });
  window.addEventListener('pagehide', flushSave);
  window.addEventListener('beforeunload', flushSave);
}

// Keep the screen awake during a run so it can't dim mid-boss.
let wakeLock = null;
async function requestWakeLock() {
  try {
    if (!navigator.wakeLock || wakeLock) return;
    wakeLock = await navigator.wakeLock.request('screen');
    wakeLock.addEventListener('release', () => { wakeLock = null; });
  } catch (e) {}
}

// iOS Safari has never implemented the Fullscreen API on iPhone, so
// requestFullscreen() is a silent no-op there — Add to Home Screen is the ONLY
// route to a fullscreen, chrome-free game. Offered once, after the player has
// finished a run and is actually invested.
function maybeOfferInstall() {
  const save = loadSave();
  if (save.a2hsShown) return;
  const isIOS = /iP(hone|ad|od)/.test(navigator.userAgent) && !window.MSStream;
  const standalone = window.navigator.standalone || window.matchMedia('(display-mode: fullscreen)').matches
    || window.matchMedia('(display-mode: standalone)').matches;
  if (!isIOS || standalone) return;
  save.a2hsShown = 1; saveGame(save);
  showModal('Play fullscreen', 'Tap <b>Share</b> then <b>Add to Home Screen</b> to play Balitopia without the browser bars — and offline.',
    [{ label: 'Got it', primary: true }]);
}

// ---------------- Boot ----------------
Sprites.init().then(() => {
  buildTitle();
  wire();
  loadPrefs();
  rafId = requestAnimationFrame(frame);
  document.body.dataset.ready = '1';
}).catch(err => {
  console.error(err);
  document.body.dataset.ready = '1';
});

// Service worker: makes a second visit instant, enables offline play, and is a
// hard prerequisite for the install prompt (and therefore for iOS fullscreen).
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

// debug/testing handle
window.__balitopia = {
  G, enemies,
  player: () => player,
  allies: () => allies,
  cages: () => cages,
  freed: () => freedSet,
  heroState: () => heroState,
  telegraphs: () => telegraphs,
  gems: () => gems,
  heroMods: () => heroMods,
  joys: { move: joyMove },
  hurtPlayer, dropGem, gainXP, levelUpPool, showLevelUp,
  possess, breakCage, newGame, spawnEnemy, spawnBoss, powershot, addDamage,
  buildRecapCanvas, hitStop, prefs: () => prefs,
  // systems added in the polish pass
  relics: () => relics, chests: () => chests, pools: () => pools,
  addRelic, tryDash, tryPowershot, spawnElite, fireBeat, spawnChest, openChest,
  cycleFormation, showMutatorDraft, showChest, computeScore, effWeapon, bodyY,
  loadSave, saveGame, flushSave, nextGoals, runContext, checkUnlocks, isUnlocked,
  applyQuality, coach, showModal, allyFalloff, ambientPhase, ambientColor, heroState: () => heroState,
};

})();
