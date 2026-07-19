// ============================================================
// BALITOPIA — Guardians of the Broken Cages
// Vampire-survivors-style horde game. Landscape mobile first.
// ============================================================
'use strict';

(() => {

// ---------------- Constants ----------------
const VIEW_H = 540;                 // logical viewport height (world px)
const WORLD = 5200;                 // world is WORLD x WORLD
const CELL = 88;                    // spatial hash cell
const MAX_ENEMIES = 300;
const MAX_PROJ = 400;
const MAX_GEMS = 500;
const MAX_PARTS = 260;

// ---------------- Canvas ----------------
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
let cw = 0, ch = 0, viewScale = 1, viewW = VIEW_H, dpr = 1;

function resize() {
  dpr = Math.min(2, window.devicePixelRatio || 1);
  cw = window.innerWidth; ch = window.innerHeight;
  canvas.width = cw * dpr; canvas.height = ch * dpr;
  viewScale = ch / VIEW_H;
  viewW = cw / viewScale;
}
window.addEventListener('resize', resize);
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

// Controls: left half of the screen is the move stick; tapping the right half
// fires your powershot (weapons auto-aim). Face cards still swap Guardians.
const joyMove = { id: null, bx: 0, by: 0, dx: 0, dy: 0, active: false };

canvas.addEventListener('pointerdown', e => {
  if (e.clientX >= cw / 2) { powershot(); return; }   // right-half tap = powershot
  if (joyMove.id !== null) return;
  joyMove.id = e.pointerId; joyMove.bx = e.clientX; joyMove.by = e.clientY;
  joyMove.dx = 0; joyMove.dy = 0; joyMove.active = true;
});
window.addEventListener('pointermove', e => {
  if (e.pointerId !== joyMove.id) return;
  let dx = e.clientX - joyMove.bx, dy = e.clientY - joyMove.by;
  const len = Math.hypot(dx, dy), max = 58;
  if (len > max) {
    // drag the base along so direction changes feel instant
    joyMove.bx = e.clientX - dx / len * max;
    joyMove.by = e.clientY - dy / len * max;
    dx = dx / len * max; dy = dy / len * max;
  }
  joyMove.dx = dx / max; joyMove.dy = dy / max;
});
const joyEnd = e => {
  if (e.pointerId !== joyMove.id) return;
  joyMove.id = null; joyMove.active = false; joyMove.dx = 0; joyMove.dy = 0;
};
window.addEventListener('pointerup', joyEnd);
window.addEventListener('pointercancel', joyEnd);

function moveVector() {
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (joyMove.active) { mx = joyMove.dx; my = joyMove.dy; }
  const l = Math.hypot(mx, my);
  if (l > 1) { mx /= l; my /= l; }
  return [mx, my];
}

const buzz = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch (e) {} };

// ---------------- Game state ----------------
const G = {
  running: false, over: false, time: 0, kills: 0,
  cam: { x: 0, y: 0 }, shake: 0, hurtFlash: 0,
  level: 1, xp: 0, xpNext: 10,
  spawnAcc: 0,
  boss: null, bossWarned: false, victory: false,
  healPct(p) { player.hp = Math.min(maxHP(), player.hp + maxHP() * p); },
};

let player = null;             // { heroIdx, x, y, hp, iv, fx, ws[] }
let allies = [];               // fighters
let cages = [];                // { heroIdx, x, y, hp, broken }
let freedSet = new Set();      // heroIdx freed this run (incl. starter)
let decor = [];
let heroState = [];            // per-hero mastery: { dmg, tier, charge }
let powerWaves = [];           // queued powershot projectile rings

function addDamage(src, amt) {
  if (src === undefined || src === null || G.over) return;
  const hs = heroState[src];
  if (!hs) return;
  hs.dmg += amt;
  while (hs.tier < 4 && hs.dmg >= TIER_DMG[hs.tier + 1]) {
    hs.tier++;
    banner(`${HEROES[src].name.toUpperCase()} → ${TIER_NAMES[hs.tier]}!`);
    Sound.sfx.tierup();
    buzz(30);
    const f = player.heroIdx === src ? player : allies.find(a => a.heroIdx === src);
    if (f) {
      spawnParts(f.x, f.y - 20, TIER_COLORS[hs.tier], 18, 170);
      effects.push({ type: 'tierup', f, color: TIER_COLORS[hs.tier], t: 0, dur: 0.9 });
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
function spawnEnemy(type, tier, x, y) {
  let e = null;
  for (let i = 0; i < MAX_ENEMIES; i++) if (!enemies[i].alive) { e = enemies[i]; e.id = i; break; }
  if (!e) return null;
  const def = ENEMIES[type];
  const scale = type === 'minyar' ? 0.72 + Math.random() * 0.85 : 0.85 + Math.random() * 0.5;
  const timeMult = 1 + (G.time / 60) * 0.18;
  const tm = TIERS[tier].mult;
  const diff = G.diff || DIFFICULTIES[0];
  const roundHp = 1 + ROUND_EHP * ((G.round || 1) - 1);     // endless escalation
  const roundDmg = 1 + ROUND_EDMG * ((G.round || 1) - 1);
  e.alive = true; e.type = type; e.tier = tier; e.scale = scale;
  e.x = x; e.y = y;
  e.maxhp = def.hp * tm * Math.pow(scale, 1.7) * timeMult * diff.ehp * roundHp;
  e.hp = e.maxhp;
  e.spd = def.spd * (1.12 - scale * 0.18) * (0.9 + Math.random() * 0.25);
  e.dmg = def.dmg * (1 + tier * 0.3) * scale * diff.edmg * roundDmg;
  e.lastSrc = undefined;
  e.xp = Math.max(1, Math.round(def.xp * (1 + tier * 0.9) * scale));
  e.r = def.r * scale;
  e.slowT = 0; e.poisonT = 0; e.poisonDps = 0; e.poisonTick = 0;
  e.kbx = 0; e.kby = 0; e.flash = 0;
  e.wob = Math.random() * 6.28;
  return e;
}

function spawnWave(dt) {
  const t = G.time;
  const rate = Math.min(15, 1.4 + t * 0.024) * ((G.diff || DIFFICULTIES[0]).menace);
  G.spawnAcc += rate * dt;
  const maxTier = Math.min(TIERS.length - 1, (t / 85) | 0);
  while (G.spawnAcc >= 1) {
    G.spawnAcc -= 1;
    const a = Math.random() * 6.283;
    const d = Math.hypot(viewW, VIEW_H) / 2 + 70 + Math.random() * 220;
    const x = Math.min(WORLD - 30, Math.max(30, player.x + Math.cos(a) * d));
    const y = Math.min(WORLD - 30, Math.max(30, player.y + Math.sin(a) * d));
    const tier = Math.max(0, maxTier - ((Math.random() ** 2) * 3 | 0));
    let type = 'minyar';
    const r = Math.random();
    if (t > 210 && r < Math.min(0.05, (t - 210) / 7000)) type = 'clubbo';
    else if (t > 75 && r < Math.min(0.14, 0.025 + t / 2400)) type = 'demonder';
    spawnEnemy(type, tier, x, y);
    // herald the first elite of each kind
    if (type === 'demonder' && !G.sawDemonder) {
      G.sawDemonder = true;
      banner('A DEMONDER STALKS THE JUNGLE!');
      Sound.playFile('assets/audio/enemies/demonder_entrance.wav', 0.85);
    } else if (type === 'clubbo' && !G.sawClubbo) {
      G.sawClubbo = true;
      banner('CLUBBO! RUN. OR DON\'T.');
      Sound.playFile('assets/audio/enemies/clubbo_entrance.wav', 0.9);
    }
  }
}

// ---------------- Damage ----------------
function addFloater(x, y, txt, color) {
  if (floaters.length > 38) floaters.shift();
  floaters.push({ x, y, txt, color, t: 0 });
}
function spawnParts(x, y, color, n, spd) {
  let made = 0;
  for (let i = 0; i < MAX_PARTS && made < n; i++) {
    const p = parts[i];
    if (p.alive) continue;
    p.alive = true; p.x = x; p.y = y;
    const a = Math.random() * 6.283, v = spd * (0.4 + Math.random() * 0.8);
    p.vx = Math.cos(a) * v; p.vy = Math.sin(a) * v;
    p.t = 0; p.dur = 0.3 + Math.random() * 0.35; p.color = color;
    p.size = 2 + Math.random() * 3;
    made++;
  }
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

function killEnemy(e) {
  e.alive = false;
  G.kills++;
  if (e.lastSrc != null && heroState[e.lastSrc]) heroState[e.lastSrc].kills++;
  dropGem(e.x, e.y, e.xp);
  const tint = `hsl(${TIERS[e.tier].hue},65%,55%)`;
  spawnParts(e.x, e.y, tint, e.type === 'minyar' ? 6 : 12, 140);
  if (e.type === 'clubbo') {
    Sound.playFile('assets/audio/enemies/clubbo_defeat.wav', 0.85);
    G.shake = Math.max(G.shake, 6);
    if (Math.random() < 0.4) hearts.push({ x: e.x, y: e.y, t: 0 });
  } else if (e.type === 'demonder') {
    Sound.playFile('assets/audio/enemies/demonder_defeat.wav', 0.7);
    if (Math.random() < 0.14) hearts.push({ x: e.x, y: e.y, t: 0 });
  } else if (Math.random() < 0.25) Sound.sfx.kill();
}

function damageEnemy(e, dmg, o) {
  o = o || {};
  if (e.isBoss) return damageBoss(dmg, o);
  if (e.isCage) return damageCage(e, dmg);
  if (!e.alive) return;
  e.hp -= dmg;
  e.flash = 0.09;
  if (o.src != null) e.lastSrc = o.src;
  addDamage(o.src, dmg);
  if (o.slow) e.slowT = Math.max(e.slowT, o.slow);
  if (o.poison) { e.poisonT = o.poisonT; e.poisonDps = Math.max(e.poisonDps, o.poison); }
  if (o.knock) {
    const kl = Math.hypot(o.kx, o.ky) || 1;
    e.kbx += o.kx / kl * o.knock; e.kby += o.ky / kl * o.knock;
  }
  if (dmg >= 18 || e.type !== 'minyar') addFloater(e.x, e.y - e.r - 8, Math.round(dmg), '#fff');
  if (e.hp <= 0) killEnemy(e);
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
  spawnParts(b.x, b.y, '#8bc34a', 60, 260);
  spawnParts(b.x, b.y, '#ffd54f', 40, 200);
  for (let i = 0; i < 6; i++)
    dropGem(b.x + (Math.random() - 0.5) * 120, b.y + (Math.random() - 0.5) * 90, 25);
  Sound.playFile('assets/audio/enemies/glob_defeat.wav', 1);
  setTimeout(() => Sound.playFile('assets/audio/sfx/crown_crack.wav', 0.9), 900);
  G.boss = null;
  G.round++;
  G.nextBossAt = G.time + BOSS_RESPAWN;
  G.bossWarned = false;
  G.healPct(0.5);
  $('boss-hp-wrap').classList.add('hidden');
  banner(G.bossKills === 1 ? '👑 KING GLOB IS DOWN — BALITOPIA IS FREE!' : `👑 GLOB SLAIN ×${G.bossKills}!`);
  banner(`🌀 ROUND ${G.round} — THE ISLAND TREMBLES AGAIN`);
  buzz(60);
  Sound.playMusic('music/victory.mp3', { loop: false, vol: 0.6 });
  setTimeout(() => {
    if (!G.over && !G.boss) Sound.playMusic(`music/${G.region}.mp3`);
  }, 7000);
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

function hurtPlayer(dmg) {
  if (player.iv > 0 || G.over) return;
  player.hp -= dmg;
  player.iv = 0.6;
  G.shake = Math.max(G.shake, 4);
  G.hurtFlash = 0.4;
  Sound.sfx.hurt();
  buzz(25);
  if (player.hp <= 0) {
    if (G.mods.revive > 0) {                      // Second Wind: cheat death once
      G.mods.revive--;
      player.hp = maxHP() * 0.5;
      player.iv = 2;
      G.flash = 0.35;
      banner('🕯️ SECOND WIND!');
      Sound.sfx.heal();
      effects.push({ type: 'tierup', f: player, color: '#fff59d', t: 0, dur: 0.9 });
      return;
    }
    player.hp = 0;
    endGame();
  }
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
      explode: o.explode || 0, split: !!o.split, slow: o.slow || 0,
      poison: o.poison || 0, poisonT: o.poisonT || 0, knock: o.knock || 0,
      owner: o.owner || null, src: o.src, t: 0, hitCd: 0,
    });
    p.hitList.length = 0;
    return p;
  }
  return null;
}

function fireWeapon(f, w, ws, isAlly, dt) {
  const m = G.mods;
  const src = f.heroIdx;
  const rateMul = m.rate * (isAlly ? 1.25 : 1);
  const dmgMul = m.dmg * (isAlly ? 0.55 * m.ally : 1) * heroDmgMul(src);
  const areaMul = m.area;

  if (w.type === 'orbit') {
    ws.ang += w.rot * dt;
    const R = w.radius * areaMul;
    for (let i = 0; i < w.count; i++) {
      ws.cds[i] -= dt;
      const a = ws.ang + i / w.count * 6.283;
      const ox = f.x + Math.cos(a) * R, oy = f.y + Math.sin(a) * R;
      if (ws.cds[i] <= 0) {
        let hit = false;
        const rr = w.size * areaMul + 14;
        eachEnemyNear(ox, oy, rr + 20, e => {
          if ((e.x - ox) ** 2 + (e.y - oy) ** 2 < (rr + e.r) ** 2) {
            damageEnemy(e, w.dmg * dmgMul, { knock: 60, kx: e.x - f.x, ky: e.y - f.y, src });
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
    const R = w.radius * areaMul;
    eachEnemyNear(f.x, f.y, R + 30, e => {
      if ((e.x - f.x) ** 2 + (e.y - f.y) ** 2 < (R + e.r) ** 2)
        damageEnemy(e, w.dmg * dmgMul, { src });
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
    patches.push({ x: f.x, y: f.y, r: w.radius * areaMul, dps: w.dmg * dmgMul, life: w.patchLife, tick: 0, color: w.color, src });
    return;
  }

  if (w.type === 'nova') {
    const t = nearestTarget(f.x, f.y, 700, true);
    if (!t) return;                     // hold fire until something's near
    ws.cd = interval;
    for (let i = 0; i < w.count; i++) {
      const a = i / w.count * 6.283 + Math.random() * 0.2;
      spawnProj({
        x: f.x, y: f.y, vx: Math.cos(a) * w.speed * m.pspd, vy: Math.sin(a) * w.speed * m.pspd,
        dmg: w.dmg * dmgMul, pierce: 1 + m.pierceBonus, size: w.size * areaMul, life: w.life * m.plife,
        color: w.color, knock: (w.knock || 0) * m.knockMul, src,
      });
    }
    if (!isAlly) Sound.sfx.nova();
    return;
  }

  // ----- aimed weapons need a target -----
  const range = w.type === 'beam' ? (w.length * areaMul) : (isAlly ? 540 : 640);
  let target = nearestTarget(f.x, f.y, range, true);
  // rescue priority: a cage right next to you outranks the horde
  const closeCage = nearestCage(f.x, f.y, isAlly ? 210 : 250);
  if (closeCage) target = closeCage;
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
    for (let j = 0; j <= w.jumps && cur; j++) {
      pts.push({ x: cur.x, y: cur.y });
      damageEnemy(cur, w.dmg * dmgMul * Math.pow(0.85, j), { src });
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
    effects.push({ type: 'chain', pts, t: 0, dur: 0.18, color: w.color });
    if (!isAlly) Sound.sfx.shoot();
    return;
  }

  if (w.type === 'beam') {
    const L = w.length * areaMul, W2 = (w.width * areaMul) / 2;
    const dx = Math.cos(ang), dy = Math.sin(ang);
    eachEnemyNear(f.x + dx * L / 2, f.y + dy * L / 2, L / 2 + 60, e => {
      const px = e.x - f.x, py = e.y - f.y;
      const along = px * dx + py * dy;
      if (along < -e.r || along > L + e.r) return;
      const perp = Math.abs(px * dy - py * dx);
      if (perp < W2 + e.r) damageEnemy(e, w.dmg * dmgMul, { src });
    });
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
    effects.push({ type: 'beam', x: f.x, y: f.y, ang, len: L, wid: w.width * areaMul, t: 0, dur: 0.15, color: w.color });
    if (!isAlly) Sound.sfx.shoot();
    return;
  }

  if (w.type === 'slash') {
    const R = w.radius * areaMul, half = w.arc / 2;
    eachEnemyNear(f.x, f.y, R + 40, e => {
      const d2 = (e.x - f.x) ** 2 + (e.y - f.y) ** 2;
      if (d2 > (R + e.r) ** 2) return;
      let da = Math.atan2(e.y - f.y, e.x - f.x) - ang;
      da = Math.atan2(Math.sin(da), Math.cos(da));
      if (Math.abs(da) < half + 0.25)
        damageEnemy(e, w.dmg * dmgMul, { knock: 90, kx: e.x - f.x, ky: e.y - f.y, src });
    });
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
    effects.push({ type: 'slash', x: f.x, y: f.y, ang, r: R, arc: w.arc, t: 0, dur: 0.18, color: w.color });
    if (!isAlly) Sound.sfx.shoot();
    return;
  }

  // ----- shot -----
  for (let i = 0; i < w.count; i++) {
    let a = ang;
    if (w.count > 1) a += (i - (w.count - 1) / 2) * (w.spread / Math.max(1, w.count - 1)) * 2;
    else if (w.spread) a += (Math.random() - 0.5) * w.spread;
    spawnProj({
      x: f.x, y: f.y - 12,
      vx: Math.cos(a) * w.speed * m.pspd, vy: Math.sin(a) * w.speed * m.pspd,
      dmg: w.dmg * dmgMul, pierce: (w.pierce || 0) + m.pierceBonus, size: w.size * areaMul, life: w.life * m.plife,
      color: w.color, rainbow: w.rainbow, homing: w.homing, boomerang: w.boomerang, explode: w.explode ? w.explode * areaMul : 0,
      split: w.split, slow: w.slow, poison: w.poison ? w.poison * dmgMul / Math.max(1, w.dmg) * w.dmg : 0,
      poisonT: w.poisonT, knock: (w.knock || 0) * m.knockMul, owner: f, src,
    });
  }
  if (!isAlly) Sound.sfx.shoot();
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

    p.x += p.vx * dt; p.y += p.vy * dt;

    // enemy collisions
    let dead = false;
    const pr = p.size + 4;
    eachEnemyNear(p.x, p.y, pr + 34, e => {
      if (dead) return false;
      if (p.hitList.includes(e.id)) return;
      if ((e.x - p.x) ** 2 + (e.y - p.y) ** 2 > (pr + e.r) ** 2) return;
      damageEnemy(e, p.dmg, { slow: p.slow, poison: p.poison, poisonT: p.poisonT, knock: p.knock, kx: p.vx, ky: p.vy, src: p.src });
      p.hitList.push(e.id);
      if (p.explode) { explodeAt(p.x, p.y, p.explode, p.dmg * 0.8, p.src); dead = true; return false; }
      if (p.split) {
        p.split = false;
        for (let s = 0; s < 3; s++) {
          const a = Math.random() * 6.283;
          spawnProj({ x: p.x, y: p.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, dmg: p.dmg * 0.5, pierce: 0, size: p.size * 0.6, life: 0.5, color: p.color, src: p.src });
        }
      }
      if (p.pierce > 0) { p.pierce--; }
      else if (!p.boomerang) { dead = true; return false; }
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

    if (e.poisonT > 0) {
      e.poisonT -= dt;
      e.poisonTick -= dt;
      if (e.poisonTick <= 0) {
        e.poisonTick = 0.4;
        e.hp -= e.poisonDps * 0.4;
        if (e.hp <= 0) { killEnemy(e); continue; }
      }
    }

    if (dist > 1) { e.x += ddx / dist * sp * dt; e.y += ddy / dist * sp * dt; }
    // knockback decay
    e.x += e.kbx * dt; e.y += e.kby * dt;
    e.kbx *= Math.pow(0.002, dt); e.kby *= Math.pow(0.002, dt);

    // separation (cheap: only same cell, first few)
    const a = hash.get(((e.x / CELL) | 0) * 4096 + ((e.y / CELL) | 0));
    if (a && a.gen === hashGen) {
      let checked = 0;
      for (let j = 0; j < a.length && checked < 4; j++) {
        const o = a[j];
        if (o === e || !o.alive) continue;
        checked++;
        const dx = e.x - o.x, dy = e.y - o.y;
        const d2 = dx * dx + dy * dy, min = (e.r + o.r) * 0.8;
        if (d2 > 0.01 && d2 < min * min) {
          const d = Math.sqrt(d2);
          e.x += dx / d * (min - d) * 0.35;
          e.y += dy / d * (min - d) * 0.35;
        }
      }
    }

    // contact damage
    if (dist < e.r + 15) hurtPlayer(e.dmg);
  }
}

// ---------------- Boss ----------------
function spawnBoss() {
  const a = Math.random() * 6.283;
  const diff = G.diff || DIFFICULTIES[0];
  const round = G.round || 1;
  const hp = BOSS.hp * diff.bhp * (1 + ROUND_BHP * (round - 1));
  G.boss = {
    alive: true, isBoss: true,
    x: Math.min(WORLD - 200, Math.max(200, player.x + Math.cos(a) * 640)),
    y: Math.min(WORLD - 200, Math.max(200, player.y + Math.sin(a) * 640)),
    hp, maxhp: hp, r: BOSS.r, spd: BOSS.spd, dmg: BOSS.dmg * diff.edmg * (1 + ROUND_EDMG * (round - 1)),
    slowT: 0, flash: 0, wob: 0, enraged: round > 1,   // returning Glob starts angry
    volleyCd: 4, summonCd: 8, slamCd: 12,
  };
  if (G.boss.enraged) G.boss.spd *= 1.3;
  Sound.playMusic('enemies/glob.mp3');                      // King Glob's theme
  Sound.playFile('assets/audio/enemies/glob_entrance.wav', 0.95);
  setTimeout(() => Sound.playFile('assets/audio/enemies/glob_laugh.wav', 0.9), 1400);
  G.shake = 14;
  banner(round > 1 ? `👑 KING GLOB RETURNS — ROUND ${round} 👑` : '👑 KING GLOB HAS ARRIVED 👑');
  document.getElementById('boss-hp-wrap').classList.remove('hidden');
}

function updateBoss(dt) {
  const b = G.boss;
  if (!b || !b.alive) return;
  b.flash -= dt; b.slowT -= dt; b.wob += dt;
  if (!b.enraged && b.hp < b.maxhp / 2) {
    b.enraged = true;
    b.spd *= 1.3;
    Sound.playFile('assets/audio/enemies/glob_enrage.wav', 0.95);
    banner('KING GLOB IS FURIOUS!');
    G.shake = Math.max(G.shake, 10);
  }
  const dx = player.x - b.x, dy = player.y - b.y;
  const d = Math.hypot(dx, dy) || 1;
  const sp = b.spd * (b.slowT > 0 ? 0.6 : 1);
  b.x += dx / d * sp * dt; b.y += dy / d * sp * dt;

  if (d < b.r + 16) hurtPlayer(b.dmg);

  b.volleyCd -= dt;
  if (b.volleyCd <= 0) {
    b.volleyCd = (b.enraged ? 3.2 : 5) + Math.random() * 2;
    const base = Math.atan2(dy, dx);
    for (let i = 0; i < 10; i++) {
      const a = base + (i - 4.5) * 0.14;
      for (let k = 0; k < ebullets.length; k++) {
        const eb = ebullets[k];
        if (eb.alive) continue;
        eb.alive = true; eb.x = b.x; eb.y = b.y - 40;
        eb.vx = Math.cos(a) * 240; eb.vy = Math.sin(a) * 240;
        eb.dmg = 22; eb.size = 10; eb.life = 3.2; eb.t = 0;
        break;
      }
    }
    Sound.sfx.nova();
  }
  b.summonCd -= dt;
  if (b.summonCd <= 0) {
    b.summonCd = 9;
    for (let i = 0; i < 7; i++) {
      const a = Math.random() * 6.283;
      spawnEnemy('minyar', Math.min(5, 2 + (Math.random() * 4 | 0)), b.x + Math.cos(a) * 110, b.y + Math.sin(a) * 110);
    }
  }
  b.slamCd -= dt;
  if (b.slamCd <= 0 && d < 420) {
    // ground-target the PLAYER's position — a readable, dodgeable AoE
    b.slamCd = b.enraged ? 8 : 11;
    telegraphs.push({ x: player.x, y: player.y, r: 165, t: 0, dur: 1.1, dmg: 38 * (G.diff ? G.diff.edmg : 1) });
    Sound.playFile('assets/audio/sfx/glob_slam.wav', 0.85);
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
function updateAllies(dt) {
  const n = allies.length;
  for (let i = 0; i < n; i++) {
    const al = allies[i];
    const slotA = (i / Math.max(6, n)) * 6.283 + G.time * 0.1;
    const slotR = 70 + (i % 3) * 34;
    const tx = player.x + Math.cos(slotA) * slotR;
    const ty = player.y + Math.sin(slotA) * slotR;
    const dx = tx - al.x, dy = ty - al.y;
    const d = Math.hypot(dx, dy);
    if (d > 8) {
      const sp = Math.min(d * 3.2, HEROES[al.heroIdx].spd * (d > 260 ? 1.8 : 1.05));
      al.x += dx / d * sp * dt;
      al.y += dy / d * sp * dt;
      if (Math.abs(dx) > 2) al.fx = dx >= 0 ? 1 : -1;
    }
    const hero = HEROES[al.heroIdx];
    for (let wi = 0; wi < hero.weapons.length; wi++)
      fireWeapon(al, hero.weapons[wi], al.ws[wi], true, dt);
  }
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
      if ((player.x - tg.x) ** 2 + (player.y - tg.y) ** 2 < tg.r * tg.r) hurtPlayer(tg.dmg);
      effects.push({ type: 'explo', x: tg.x, y: tg.y, r: tg.r, t: 0, dur: 0.35, color: '#8bc34a' });
      G.shake = Math.max(G.shake, 8);
      Sound.sfx.bigKill();
      telegraphs.splice(i, 1);
    }
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
    G.xpNext = Math.round(8 * Math.pow(G.level, 1.42) + 6);
    Sound.sfx.level();
    if (player) effects.push({ type: 'tierup', f: player, color: '#ffd54f', t: 0, dur: 0.8 });
  }
  if (G.pendingLv > 0 && $('screen-levelup').classList.contains('hidden')) showLevelUp();
}

// ---------------- Main update ----------------
let last = 0;
function frame(ts) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (ts - last) / 1000 || 0.016);
  last = ts;
  if (G.running && !G.over && window.innerWidth > window.innerHeight) update(dt);
  render(dt);
}

function update(dt) {
  G.time += dt;
  const m = G.mods;

  // player move
  const [mx, my] = moveVector();
  const sp = HEROES[player.heroIdx].spd * m.spd;
  player.x = Math.max(24, Math.min(WORLD - 24, player.x + mx * sp * dt));
  player.y = Math.max(24, Math.min(WORLD - 24, player.y + my * sp * dt));
  if (Math.abs(mx) > 0.1) player.fx = mx >= 0 ? 1 : -1;
  player.iv -= dt;
  if (m.regen > 0) player.hp = Math.min(maxHP(), player.hp + m.regen * dt);
  if (heroState[player.heroIdx]) heroState[player.heroIdx].control += dt;   // time as active Guardian

  buildHash();
  spawnWave(dt);
  updateEnemies(dt);

  // player weapons
  const hero = HEROES[player.heroIdx];
  for (let wi = 0; wi < hero.weapons.length; wi++)
    fireWeapon(player, hero.weapons[wi], player.ws[wi], false, dt);

  updateAllies(dt);
  updateProjs(dt);
  updatePowerWaves(dt);
  updateBoss(dt);
  updateEbullets(dt);
  updatePickups(dt);
  G.flash = Math.max(0, G.flash - dt * 1.3);
  G.hurtFlash = Math.max(0, G.hurtFlash - dt * 1.6);

  // boss timing (round 1 at 8:00, endless returns every BOSS_RESPAWN after)
  if (!G.bossWarned && G.time >= G.nextBossAt - 15) {
    G.bossWarned = true;
    banner('⚠ THE GROUND IS SHAKING... ⚠');
  }
  if (!G.boss && G.time >= G.nextBossAt) spawnBoss();

  // camera
  G.cam.x += (player.x - G.cam.x) * Math.min(1, 8 * dt);
  G.cam.y += (player.y - G.cam.y) * Math.min(1, 8 * dt);
  G.shake = Math.max(0, G.shake - 30 * dt);

  updateHud(dt);
}

// ---------------- Render ----------------
let shadowSpr = null;
function getShadow() {
  if (!shadowSpr) {
    shadowSpr = document.createElement('canvas');
    shadowSpr.width = 64; shadowSpr.height = 32;
    const x = shadowSpr.getContext('2d');
    const g = x.createRadialGradient(32, 16, 2, 32, 16, 30);
    g.addColorStop(0, 'rgba(0,0,0,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.save(); x.translate(32, 16); x.scale(1, 0.5); x.beginPath(); x.arc(0, 0, 30, 0, 7); x.fill(); x.restore();
  }
  return shadowSpr;
}
function shadow(x, y, w) {
  ctx.drawImage(getShadow(), x - w / 2, y - w / 8, w, w / 2);
}

function render(dt) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#0b3d24';
  ctx.fillRect(0, 0, cw, ch);
  if (!player) return;

  const shx = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  const shy = G.shake ? (Math.random() - 0.5) * G.shake : 0;
  const camX = G.cam.x - viewW / 2 + shx, camY = G.cam.y - VIEW_H / 2 + shy;
  ctx.setTransform(dpr * viewScale, 0, 0, dpr * viewScale, -camX * dpr * viewScale, -camY * dpr * viewScale);

  // ---- ground ----
  const tile = Sprites.get('ground');
  const ts = 256;
  const x0 = Math.floor(camX / ts) * ts, y0 = Math.floor(camY / ts) * ts;
  for (let tx = x0; tx < camX + viewW; tx += ts)
    for (let ty = y0; ty < camY + VIEW_H; ty += ts)
      ctx.drawImage(tile, tx, ty);

  // world edge
  ctx.strokeStyle = 'rgba(10,40,60,.8)'; ctx.lineWidth = 20;
  ctx.strokeRect(-10, -10, WORLD + 20, WORLD + 20);

  const onScreen = (x, y, pad) => x > camX - pad && x < camX + viewW + pad && y > camY - pad && y < camY + VIEW_H + pad;

  // ---- decor ----
  for (const d of decor) {
    if (!onScreen(d.x, d.y, 120)) continue;
    const s = Sprites.get(d.k);
    ctx.drawImage(s, d.x - s.width * d.s / 2, d.y - s.height * d.s, s.width * d.s, s.height * d.s);
  }

  // ---- fire patches ----
  for (const pa of patches) {
    if (!onScreen(pa.x, pa.y, 60)) continue;
    ctx.globalAlpha = 0.35 * Math.min(1, pa.life);
    ctx.fillStyle = pa.color;
    ctx.beginPath(); ctx.arc(pa.x, pa.y, pa.r * (0.85 + Math.sin(G.time * 10 + pa.x) * 0.1), 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }

  // ---- telegraphs ----
  for (const tg of telegraphs) {
    const p = tg.t / tg.dur;
    ctx.strokeStyle = `rgba(255,80,80,${0.5 + p * 0.4})`; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r, 0, 7); ctx.stroke();
    ctx.fillStyle = `rgba(255,60,60,${0.12 + p * 0.18})`;
    ctx.beginPath(); ctx.arc(tg.x, tg.y, tg.r * p, 0, 7); ctx.fill();
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
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = enemies[i];
    if (!e.alive || !onScreen(e.x, e.y, 90)) continue;
    const spr = Sprites.get(e.type + e.tier);
    const h = ENEMIES[e.type].dh * e.scale;
    const w = spr.width / spr.height * h;
    shadow(e.x, e.y + 2, w * 0.9);
    const squash = 1 + Math.sin(G.time * 9 + e.wob) * 0.05;
    ctx.drawImage(spr, e.x - w / 2, e.y - h * squash + 6, w, h * squash);
    if (e.flash > 0) {
      ctx.globalAlpha = 0.55; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(e.x, e.y - h / 2 + 6, e.r, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (e.poisonT > 0) {
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#8bc34a';
      ctx.beginPath(); ctx.arc(e.x, e.y - h / 2 + 6, e.r * 0.6, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
    if (e.type !== 'minyar' && e.hp < e.maxhp) {
      ctx.fillStyle = 'rgba(0,0,0,.5)'; ctx.fillRect(e.x - 20, e.y - h - 4, 40, 5);
      ctx.fillStyle = '#ef5350'; ctx.fillRect(e.x - 19, e.y - h - 3, 38 * Math.max(0, e.hp / e.maxhp), 3);
    }
  }

  // ---- auras (under fighters) ----
  const drawAura = (f, isAlly) => {
    const hero = HEROES[f.heroIdx];
    for (const w of hero.weapons) {
      if (w.type !== 'aura') continue;
      const R = w.radius * G.mods.area;
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

  // ---- fighters ----
  const drawFighter = (f, isPlayer) => {
    if (!onScreen(f.x, f.y, 60)) return;
    const spr = Sprites.get('body' + f.heroIdx);
    const h = 48, w = spr.width / spr.height * h;
    shadow(f.x, f.y + 2, Math.min(44, w * 0.9));
    const bob = Math.sin(G.time * 10 + f.bob) * 1.5;
    ctx.save();
    ctx.translate(f.x, f.y + bob);
    ctx.scale(f.fx, 1);
    if (isPlayer && player.iv > 0 && (G.time * 12 | 0) % 2) ctx.globalAlpha = 0.45;
    ctx.drawImage(spr, -w / 2, -h + 4, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
    if (isPlayer) {
      // marker ring
      ctx.strokeStyle = 'rgba(255,213,79,.85)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(f.x, f.y + 5, 16, 7, 0, 0, 7); ctx.stroke();
    }
    // orbit weapons visual
    const hero = HEROES[f.heroIdx];
    for (let wi = 0; wi < hero.weapons.length; wi++) {
      const w2 = hero.weapons[wi];
      if (w2.type !== 'orbit') continue;
      const ws = f.ws[wi], R = w2.radius * G.mods.area;
      for (let k = 0; k < w2.count; k++) {
        const a = ws.ang + k / w2.count * 6.283;
        const ox = f.x + Math.cos(a) * R, oy = f.y + Math.sin(a) * R;
        ctx.fillStyle = w2.rainbow ? `hsl(${(G.time * 200 + k * 72) % 360},95%,68%)` : w2.color;
        ctx.beginPath(); ctx.arc(ox, oy, w2.size, 0, 7); ctx.fill();
        ctx.globalAlpha = 0.4;
        ctx.beginPath(); ctx.arc(ox - Math.cos(a + 1.2) * 6, oy - Math.sin(a + 1.2) * 6, w2.size * 0.6, 0, 7); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  };
  for (const al of allies) drawFighter(al, false);
  drawFighter(player, true);

  // ---- boss ----
  if (G.boss && G.boss.alive) {
    const b = G.boss;
    const spr = Sprites.get('boss');
    const squash = 1 + Math.sin(b.wob * 3) * 0.04;
    const h = BOSS.dh * squash, w = spr.width / spr.height * BOSS.dh;
    shadow(b.x, b.y + 6, w * 1.05);
    ctx.drawImage(spr, b.x - w / 2, b.y - h + 20, w, h);
    if (b.flash > 0) {
      ctx.globalAlpha = 0.4; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(b.x, b.y - 70, 90, 0, 7); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ---- projectiles ----
  for (const p of projs) {
    if (!p.alive || !onScreen(p.x, p.y, 30)) continue;
    ctx.fillStyle = p.rainbow ? `hsl(${(G.time * 240 + p.x) % 360},95%,65%)` : p.color;
    ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, 7); ctx.fill();
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(p.x - p.vx * 0.02, p.y - p.vy * 0.02, p.size * 0.7, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
  // enemy bullets
  for (const eb of ebullets) {
    if (!eb.alive) continue;
    ctx.fillStyle = '#7cb342';
    ctx.beginPath(); ctx.arc(eb.x, eb.y, eb.size, 0, 7); ctx.fill();
    ctx.strokeStyle = '#33691e'; ctx.lineWidth = 2; ctx.stroke();
  }

  // ---- effects ----
  for (const fx of effects) {
    const p = 1 - fx.t / fx.dur;
    ctx.globalAlpha = p;
    if (fx.type === 'chain') {
      ctx.strokeStyle = fx.color; ctx.lineWidth = 3;
      ctx.beginPath();
      for (let i = 0; i < fx.pts.length; i++) {
        const pt = fx.pts[i];
        const jx = i === 0 ? 0 : (Math.random() - 0.5) * 10;
        if (i === 0) ctx.moveTo(pt.x, pt.y - 14);
        else ctx.lineTo(pt.x + jx, pt.y - 14 + jx);
      }
      ctx.stroke();
    } else if (fx.type === 'beam') {
      ctx.strokeStyle = fx.color; ctx.lineWidth = fx.wid * p; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(fx.x, fx.y - 12);
      ctx.lineTo(fx.x + Math.cos(fx.ang) * fx.len, fx.y - 12 + Math.sin(fx.ang) * fx.len);
      ctx.stroke();
      ctx.lineWidth = fx.wid * p * 0.4; ctx.strokeStyle = '#fff';
      ctx.stroke();
    } else if (fx.type === 'slash') {
      ctx.strokeStyle = fx.color; ctx.lineWidth = 10 * p; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(fx.x, fx.y, fx.r * (0.7 + 0.3 * (1 - p)), fx.ang - fx.arc / 2, fx.ang + fx.arc / 2);
      ctx.stroke();
    } else if (fx.type === 'explo') {
      ctx.fillStyle = fx.color;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, fx.r * (1 - p * 0.5), 0, 7); ctx.fill();
    } else if (fx.type === 'shock') {
      const pr = fx.r * (fx.t / fx.dur);
      ctx.strokeStyle = fx.color; ctx.lineWidth = 16 * p;
      ctx.beginPath(); ctx.arc(fx.x, fx.y, pr, 0, 7); ctx.stroke();
      ctx.globalAlpha = p * 0.3; ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(fx.x, fx.y, pr, 0, 7); ctx.fill();
    } else if (fx.type === 'tierup') {
      // level-up burst that follows the Guardian: two expanding rings + a rising halo
      const fx2 = fx.f, prog = fx.t / fx.dur;
      ctx.strokeStyle = fx.color; ctx.lineWidth = 3.5 * p; ctx.globalAlpha = p;
      ctx.beginPath(); ctx.ellipse(fx2.x, fx2.y + 4, 16 + prog * 44, (16 + prog * 44) * 0.45, 0, 0, 7); ctx.stroke();
      ctx.lineWidth = 2 * p;
      ctx.beginPath(); ctx.ellipse(fx2.x, fx2.y + 4, 8 + prog * 30, (8 + prog * 30) * 0.45, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = p * 0.9;
      ctx.beginPath(); ctx.arc(fx2.x, fx2.y - 30 - prog * 36, 5 * p + 1, 0, 7);
      ctx.fillStyle = fx.color; ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---- particles ----
  for (const p of parts) {
    if (!p.alive) continue;
    ctx.globalAlpha = 1 - p.t / p.dur;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
  }
  ctx.globalAlpha = 1;

  // ---- floaters ----
  ctx.font = 'bold 15px "Trebuchet MS",sans-serif';
  ctx.textAlign = 'center';
  for (const fl of floaters) {
    ctx.globalAlpha = 1 - fl.t / 0.8;
    ctx.fillStyle = '#000';
    ctx.fillText(fl.txt, fl.x + 1, fl.y - fl.t * 40 + 1);
    ctx.fillStyle = fl.color;
    ctx.fillText(fl.txt, fl.x, fl.y - fl.t * 40);
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
  updateStrip();
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

function rebuildStrip() {
  const strip = $('facecard-strip');
  strip.innerHTML = '';
  stripCards.clear();
  for (const idx of freedSet) {
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
  // shrink the cards a touch once the roster grows so 2 rows still fit low
  strip.classList.toggle('dense', freedSet.size > 14);
  updateStrip();
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
  const al = allies[ai];
  const hpFrac = player.hp / maxHP();
  // souls swap bodies: control moves to the ally's body, old body keeps fighting
  const oldIdx = player.heroIdx, oldWs = player.ws, oldX = player.x, oldY = player.y, oldBob = player.bob;
  player.heroIdx = al.heroIdx; player.ws = al.ws; player.x = al.x; player.y = al.y; player.bob = al.bob;
  al.heroIdx = oldIdx; al.ws = oldWs; al.x = oldX; al.y = oldY; al.bob = oldBob;
  player.hp = maxHP() * hpFrac;
  player.iv = 1.0;
  spawnParts(player.x, player.y, '#ffd54f', 16, 170);
  spawnParts(al.x, al.y, '#b39ddb', 10, 130);
  Sound.sfx.possess();
  Sound.playFile(`assets/audio/heroes/${HEROES[idx].id}_entrance.wav`, 0.8);
  banner(`YOU ARE NOW ${HEROES[idx].name.toUpperCase()}`);
  if (heroState[idx] && heroState[idx].charge >= 1 && !G.powerHintShown) {
    G.powerHintShown = true;
    setTimeout(() => banner('⚡ TAP YOUR CARD AGAIN — POWERSHOT READY ⚡'), 1400);
  }
  updateStrip();
}

// ---------------- Powershot ----------------
function powershot() {
  if (!G.running || G.over || !player) return false;
  const idx = player.heroIdx, hs = heroState[idx];
  if (!hs || hs.charge < 1) return false;
  hs.charge = 0;
  const hero = HEROES[idx];
  const w = hero.weapons[0];
  const mul = G.mods.dmg * heroDmgMul(idx);
  const base = w.dmg || 14;

  // shockwave: heavy damage + huge knockback around the hero
  const R = 350 * G.mods.area;
  eachEnemyNear(player.x, player.y, R + 40, e => {
    if ((e.x - player.x) ** 2 + (e.y - player.y) ** 2 < (R + e.r) ** 2)
      damageEnemy(e, base * 6 * mul, { knock: 520, kx: e.x - player.x, ky: e.y - player.y, src: idx });
  });
  if (G.boss && G.boss.alive && (G.boss.x - player.x) ** 2 + (G.boss.y - player.y) ** 2 < (R + G.boss.r) ** 2)
    damageBoss(base * 8 * mul, { src: idx });
  for (const c of cages) {
    if (!c.broken && (c.x - player.x) ** 2 + (c.y - player.y) ** 2 < (R + 30) ** 2) damageCage(c, base * 6 * mul);
  }

  // three expanding rings of the hero's own projectiles
  for (let wv = 0; wv < 3; wv++) powerWaves.push({ t: wv * 0.14, idx, wave: wv });

  effects.push({ type: 'shock', x: player.x, y: player.y, r: R, t: 0, dur: 0.5, color: hero.accent });
  G.flash = 0.4;
  G.shake = Math.max(G.shake, 12);
  player.iv = Math.max(player.iv, 1.2);
  Sound.sfx.powershot();
  Sound.playFile(`assets/audio/heroes/${hero.id}_entrance.wav`, 0.9);
  buzz(70);
  banner(`⚡ ${hero.name.toUpperCase()} POWERSHOT ⚡`);
  return true;
}

function updatePowerWaves(dt) {
  for (let i = powerWaves.length - 1; i >= 0; i--) {
    const pw = powerWaves[i];
    pw.t -= dt;
    if (pw.t > 0) continue;
    powerWaves.splice(i, 1);
    const f = player.heroIdx === pw.idx ? player : allies.find(a => a.heroIdx === pw.idx);
    if (!f) continue;
    const hero = HEROES[pw.idx], w = hero.weapons[0];
    const mul = G.mods.dmg * heroDmgMul(pw.idx);
    const n = 16;
    for (let k = 0; k < n; k++) {
      const a = k / n * 6.283 + pw.wave * 0.13;
      const spd = 330 + pw.wave * 70;
      spawnProj({
        x: f.x, y: f.y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        dmg: (w.dmg || 14) * 1.6 * mul, pierce: 2, size: Math.max(8, (w.size || 7) * 1.2), life: 1.0,
        color: hero.accent, rainbow: w.rainbow, knock: 120, src: pw.idx,
      });
    }
  }
}

// ---------------- Level up: 3 face-down mystery cards ----------------
function showLevelUp() {
  G.running = false;
  const row = $('upgrade-row');
  row.innerHTML = '';
  const pool = UPGRADES.filter(u => !(u.once && G.mods.taken[u.id]));
  let picked = false;
  for (let i = 0; i < 3 && pool.length; i++) {
    const pick = pool.splice((Math.random() * pool.length) | 0, 1)[0];
    const card = document.createElement('div');
    card.className = 'upgrade-card mystery';
    card.innerHTML =
      `<div class="mc-inner">
         <div class="mc-face mc-front"><span>?</span></div>
         <div class="mc-face mc-back">
           <div class="uc-icon">${pick.icon}</div><h3>${pick.name}</h3><p>${pick.desc}</p>
         </div>
       </div>`;
    card.addEventListener('pointerdown', () => {
      if (picked) return;
      picked = true;
      Sound.sfx.uiClick();
      card.classList.add('flipped');
      row.querySelectorAll('.upgrade-card').forEach(c => { if (c !== card) c.classList.add('faded'); });
      if (pick.once) G.mods.taken[pick.id] = true;
      pick.apply(G.mods, G);
      setTimeout(() => {
        G.pendingLv--;
        $('screen-levelup').classList.add('hidden');
        if (G.pendingLv > 0) showLevelUp();
        else if (!G.over) G.running = true;
      }, 850);
    });
    row.appendChild(card);
  }
  $('screen-levelup').classList.remove('hidden');
}

// ---------------- Roster ----------------
function openRoster() {
  G.running = false;
  const grid = $('roster-grid');
  grid.innerHTML = '';
  HEROES.forEach((h, i) => {
    const card = document.createElement('div');
    const isYou = i === player.heroIdx;
    const freed = freedSet.has(i);
    card.className = 'hero-card' + (isYou ? ' you' : freed ? '' : ' caged');
    const hs = heroState[i] || { tier: 0 };
    const state = isYou ? 'YOU' : freed ? 'TAP TO POSSESS' : 'IMPRISONED';
    card.innerHTML = `<div class="hc-name">${h.name}</div><div class="hc-state">${state}${freed ? ' · ' + TIER_NAMES[hs.tier] : ''}</div>`;
    if (freed) card.style.borderColor = TIER_COLORS[hs.tier];
    card.insertBefore(Sprites.portrait(i, 88), card.firstChild);
    if (freed && !isYou) card.addEventListener('pointerdown', () => {
      possess(i);
      closeRoster();
    });
    grid.appendChild(card);
  });
  $('screen-roster').classList.remove('hidden');
}
function closeRoster() {
  $('screen-roster').classList.add('hidden');
  // don't resume the simulation while a level-up choice is still on screen
  if (!G.over && $('screen-levelup').classList.contains('hidden')) G.running = true;
}

// ---------------- Game flow ----------------
function newGame(heroIdx, diffIdx) {
  G.running = true; G.over = false; G.victory = false; G.pendingLv = 0;
  G.time = 0; G.kills = 0; G.level = 1; G.xp = 0; G.xpNext = 10;
  G.spawnAcc = 0; G.boss = null; G.bossWarned = false; G.shake = 0;
  G.sawDemonder = false; G.sawClubbo = false;
  G.flash = 0; G.hurtFlash = 0; G.powerHintShown = false;
  G.diff = DIFFICULTIES[Math.max(0, Math.min(DIFFICULTIES.length - 1, diffIdx | 0))];
  G.startHero = heroIdx;
  G.round = 1; G.bossKills = 0; G.nextBossAt = BOSS_TIME;
  heroState = HEROES.map(() => ({ dmg: 0, tier: 0, charge: 0, kills: 0, control: 0 }));
  powerWaves = [];
  G.mods = {
    dmg: 1, rate: 1, spd: 1, hpBonus: 0, ally: 1, magnet: 1, regen: 0, area: 1,
    pierceBonus: 0, pspd: 1, plife: 1, chargeMul: 1, xpGain: 1, knockMul: 1, revive: 0,
    taken: {},   // `once` upgrades leave the pool after this
  };

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

  // cages: golden spiral around spawn
  cages = [];
  let ci = 0;
  for (let i = 0; i < HEROES.length; i++) {
    if (i === heroIdx) continue;
    const a = ci * 2.39996 + Math.random() * 0.3;
    const d = 460 + ci * 82;
    cages.push({
      heroIdx: i, isCage: true,
      x: Math.max(120, Math.min(WORLD - 120, WORLD / 2 + Math.cos(a) * d)),
      y: Math.max(120, Math.min(WORLD - 120, WORLD / 2 + Math.sin(a) * d)),
      hp: CAGE_HP, broken: false, flash: 0,
    });
    ci++;
  }

  // decor
  decor = [];
  let seed = 1234;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 150; i++) {
    const kinds = ['palm', 'rock', 'bush', 'bush'];
    const k = kinds[(rnd() * kinds.length) | 0];
    const x = 60 + rnd() * (WORLD - 120), y = 60 + rnd() * (WORLD - 120);
    // keep the very center clear
    if (Math.hypot(x - WORLD / 2, y - WORLD / 2) < 200) continue;
    decor.push({ k, x, y, s: 0.7 + rnd() * 0.6 });
  }

  $('boss-hp-wrap').classList.add('hidden');
  $('screen-select').classList.add('hidden');
  $('screen-over').classList.add('hidden');
  $('hud').classList.remove('hidden');
  updateHudCounts();
  rebuildStrip();
  try {
    const save = loadSave();
    save.lastHero = heroIdx;
    localStorage.setItem('balitopia', JSON.stringify(save));
  } catch (e) {}
  Sound.stopPreview();
  G.region = ['region-land', 'region-sea', 'region-sky'][(Math.random() * 3) | 0];
  Sound.playMusic(`music/${G.region}.mp3`);
  Sound.playFile(`assets/audio/heroes/${HEROES[heroIdx].id}_entrance.wav`, 0.9);
  bannerQ.length = 0;
  banner(`${HEROES[heroIdx].name.toUpperCase()} — BREAK THE CAGES!`);
  // one-time control hints for brand-new players
  try {
    const save = loadSave();
    if (!save.seenHints) {
      save.seenHints = 1;
      localStorage.setItem('balitopia', JSON.stringify(save));
      banner('◀ DRAG LEFT SIDE TO MOVE · TAP RIGHT SIDE FOR POWERSHOT ⚡');
      banner('⛓ FOLLOW THE GOLD ARROW TO A CAGE — FREE YOUR KIN');
    }
  } catch (e) {}
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
function computeScore() {
  const diff = G.diff || DIFFICULTIES[0];
  const base = G.kills * 10 + Math.floor(G.time) * 4 + freedSet.size * 300
    + G.level * 50 + Math.round(bossPct() * 3000) + G.bossKills * 8000;
  return Math.round(base * diff.score);
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
    save.lastHero = G.startHero; save.lastDiff = G.diff.id;
    localStorage.setItem('balitopia', JSON.stringify(save));
  } catch (e) {}
  return rank;
}

function buildStatsScreen(rank) {
  const won = G.victory, diff = G.diff;
  $('over-title').textContent =
    G.bossKills > 1 ? `GLOB SLAIN ×${G.bossKills}!` : won ? 'BALITOPIA IS FREE!' : 'THE TIDE TAKES YOU';
  $('over-title').style.color = won ? '#ffd54f' : '#ef9a9a';
  $('over-diff').innerHTML =
    `<span class="diff-badge" style="color:${diff.color};border-color:${diff.color}">◆ ${diff.name}</span>` +
    (G.round > 1 ? `<span class="diff-badge" style="color:#b388ff;border-color:#b388ff">🌀 ROUND ${G.round}</span>` : '');
  $('over-flavor').textContent = won
    ? (G.bossKills > 1 ? 'The Hungry King kept coming back. You kept ending him.' : 'King Glob is unmade — the Balance holds.')
    : 'The horde was too many. This time.';
  $('over-score').innerHTML =
    `<div class="score-num">${G.score.toLocaleString()}</div>
     <div class="score-lbl">SCORE${rank >= 0 ? ` · #${rank + 1} ALL-TIME` : ''}${rank === 0 ? ' <span class="newbest">NEW BEST!</span>' : ''}</div>`;
  const t = G.time | 0;
  $('over-summary').innerHTML = [
    ['⏱', fmtTime(t), 'survived'],
    ['☠', G.kills, 'slain'],
    ['⛓', `${freedSet.size}/24`, 'freed'],
    ['★', G.level, 'level'],
    ['👑', G.bossKills > 0 ? '×' + G.bossKills : `${Math.round(bossPct() * 100)}%`, 'Glob slain'],
  ].map(([ic, v, l]) => `<div class="sum-tile"><span class="sum-ic">${ic}</span><b>${v}</b><span>${l}</span></div>`).join('');

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

function endGame() {
  if (G.over) return;
  G.over = true;
  // endless: a run always ends in death, but killing Glob at least once counts as a win
  const won = G.victory = G.bossKills > 0;
  Sound.stopMusic();
  Sound.playFile('assets/audio/sfx/captured.mp3', 0.9);
  setTimeout(() => {
    if (G.over) Sound.playMusic(won ? 'music/victory.mp3' : 'music/bgm_gameover.mp3', { loop: false, vol: 0.6 });
  }, 1800);
  G.score = computeScore();
  const rank = saveRun(G.score);
  setTimeout(() => {
    G.running = false;
    G.pendingLv = 0;
    $('screen-levelup').classList.add('hidden');   // clear any overlay caught mid-transition
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
  let html = '<div class="rec-block"><div class="rec-h">BEST RUNS</div>';
  if (!records.length) html += '<div class="rec-empty">No runs yet — go make history.</div>';
  else {
    html += '<div class="rec-list">';
    records.forEach((r, i) => {
      const d = DIFFICULTIES[r.diff] || DIFFICULTIES[0];
      const crowns = r.bossKills > 1 ? `👑×${r.bossKills} ` : r.won ? '👑 ' : '';
      html += `<div class="rec-row${r.won ? ' won' : ''}">
        <span class="rec-rank">${medal[i] || ('#' + (i + 1))}</span>
        <span class="rec-score">${r.score.toLocaleString()}</span>
        <span class="rec-hero">${crowns}${r.heroName}</span>
        <span class="rec-diff" style="color:${d.color}">${d.name}</span>
        <span class="rec-meta">${fmtTime(r.time)} · ${r.kills}☠ · ${r.freed}/24</span>
      </div>`;
    });
    html += '</div>';
  }
  html += '</div>';
  const done = HEROES.filter(h => (mastery[h.id] || 0) >= 4).length;
  html += `<div class="rec-block"><div class="rec-h">GUARDIAN CODEX <span class="rec-sub">${done}/24 mastered</span></div><div id="codex-grid"></div></div>`;
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
  $('records-body').scrollTop = 0;
}
function openRecords() { Sound.sfx.uiClick(); buildRecordsScreen(); $('screen-records').classList.remove('hidden'); }
function closeRecords() { Sound.sfx.uiBack(); $('screen-records').classList.add('hidden'); }

// ---------------- Menus ----------------
let selectedHero = 0;
const loadSave = () => { try { return JSON.parse(localStorage.getItem('balitopia') || '{}'); } catch (e) { return {}; } };

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
  $('btn-story-continue').addEventListener('click', () => { Sound.sfx.uiClick(); goSelect(); });
  $('btn-story-back').addEventListener('click', () => { Sound.sfx.uiBack(); goTitle(); });
  $('btn-select-back').addEventListener('click', () => { Sound.sfx.uiBack(); goStory(); });
  $('btn-records-back').addEventListener('click', closeRecords);
  $('btn-over-records').addEventListener('click', openRecords);
  $('btn-over-menu').addEventListener('click', () => { Sound.sfx.uiBack(); goTitle(); });
}

function buildSelect() {
  const grid = $('hero-grid');
  grid.innerHTML = '';
  HEROES.forEach((h, i) => {
    const card = document.createElement('div');
    card.className = 'hero-card' + (i === selectedHero ? ' selected' : '');
    card.dataset.idx = i;
    card.innerHTML = `<div class="hc-name">${h.name}</div>`;
    card.insertBefore(Sprites.portrait(i, 96), card.firstChild);
    card.addEventListener('pointerdown', () => {
      selectedHero = i;
      grid.querySelectorAll('.hero-card').forEach(c => c.classList.toggle('selected', +c.dataset.idx === i));
      showDetail(i);
      Sound.sfx.uiSelect();
      Sound.preview(`assets/audio/heroes/${HEROES[i].id}.mp3`);   // hero theme snippet
    });
    grid.appendChild(card);
  });
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
  $('hero-detail').classList.remove('hidden');
}

// ---------------- Wire up ----------------
function wire() {
  $('btn-start').addEventListener('click', () => { Sound.ensure(); Sound.sfx.uiClick(); newGame(selectedHero, selectedDiff); });
  $('btn-retry').addEventListener('click', () => {
    Sound.sfx.uiClick();
    $('screen-over').classList.add('hidden');
    goSelect();
  });
  $('btn-roster').addEventListener('click', () => {
    if ($('screen-roster').classList.contains('hidden')) openRoster();
    else closeRoster();
  });
  $('btn-roster-close').addEventListener('click', closeRoster);
  $('btn-mute').addEventListener('click', () => {
    const m = Sound.toggleMute();
    $('btn-mute').classList.toggle('muted', m);
    try {
      const save = loadSave();
      save.muted = m;
      localStorage.setItem('balitopia', JSON.stringify(save));
    } catch (e) {}
  });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && G.running && !G.over) openRoster();
  });
}

// ---------------- Boot ----------------
Sprites.init().then(() => {
  buildTitle();
  wire();
  requestAnimationFrame(frame);
  document.body.dataset.ready = '1';
});

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
  joys: { move: joyMove },
  hurtPlayer, dropGem, gainXP,
  possess, breakCage, newGame, spawnEnemy, spawnBoss, powershot, addDamage,
};

})();
