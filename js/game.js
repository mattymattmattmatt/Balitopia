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
const MAX_GEMS = 320;
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
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });

const joy = { id: null, bx: 0, by: 0, dx: 0, dy: 0, active: false };
canvas.addEventListener('pointerdown', e => {
  if (joy.id !== null) return;
  joy.id = e.pointerId; joy.bx = e.clientX; joy.by = e.clientY;
  joy.dx = 0; joy.dy = 0; joy.active = true;
});
window.addEventListener('pointermove', e => {
  if (e.pointerId !== joy.id) return;
  let dx = e.clientX - joy.bx, dy = e.clientY - joy.by;
  const len = Math.hypot(dx, dy), max = 58;
  if (len > max) {
    // drag the base along so direction changes feel instant
    joy.bx = e.clientX - dx / len * max;
    joy.by = e.clientY - dy / len * max;
    dx = dx / len * max; dy = dy / len * max;
  }
  joy.dx = dx / max; joy.dy = dy / max;
});
const joyEnd = e => {
  if (e.pointerId !== joy.id) return;
  joy.id = null; joy.active = false; joy.dx = 0; joy.dy = 0;
};
window.addEventListener('pointerup', joyEnd);
window.addEventListener('pointercancel', joyEnd);

function moveVector() {
  let mx = 0, my = 0;
  if (keys.KeyW || keys.ArrowUp) my -= 1;
  if (keys.KeyS || keys.ArrowDown) my += 1;
  if (keys.KeyA || keys.ArrowLeft) mx -= 1;
  if (keys.KeyD || keys.ArrowRight) mx += 1;
  if (joy.active) { mx = joy.dx; my = joy.dy; }
  const l = Math.hypot(mx, my);
  if (l > 1) { mx /= l; my /= l; }
  return [mx, my];
}

// ---------------- Game state ----------------
const G = {
  running: false, over: false, time: 0, kills: 0,
  cam: { x: 0, y: 0 }, shake: 0,
  level: 1, xp: 0, xpNext: 10,
  spawnAcc: 0, hueSeen: 0,
  boss: null, bossWarned: false, victory: false,
  healPct(p) { player.hp = Math.min(maxHP(), player.hp + maxHP() * p); },
};
const mods = () => G.mods;

let player = null;             // { heroIdx, x, y, hp, iv, fx, ws[] }
let allies = [];               // fighters
let cages = [];                // { heroIdx, x, y, hp, broken }
let freedSet = new Set();      // heroIdx freed this run (incl. starter)
let decor = [];

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
let hash = new Map();
function buildHash() {
  hash.clear();
  for (let i = 0; i < MAX_ENEMIES; i++) {
    const e = enemies[i];
    if (!e.alive) continue;
    const k = ((e.x / CELL) | 0) * 4096 + ((e.y / CELL) | 0);
    let a = hash.get(k);
    if (!a) { a = []; hash.set(k, a); }
    a.push(e);
  }
}
function eachEnemyNear(x, y, r, cb) {
  const x0 = ((x - r) / CELL) | 0, x1 = ((x + r) / CELL) | 0;
  const y0 = ((y - r) / CELL) | 0, y1 = ((y + r) / CELL) | 0;
  for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) {
    const a = hash.get(cx * 4096 + cy);
    if (a) for (let i = 0; i < a.length; i++) { if (cb(a[i]) === false) return; }
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
  const timeMult = 1 + (G.time / 60) * 0.16;
  const tm = TIERS[tier].mult;
  e.alive = true; e.type = type; e.tier = tier; e.scale = scale;
  e.x = x; e.y = y;
  e.maxhp = def.hp * tm * Math.pow(scale, 1.7) * timeMult;
  e.hp = e.maxhp;
  e.spd = def.spd * (1.12 - scale * 0.18) * (0.9 + Math.random() * 0.25);
  e.dmg = def.dmg * (1 + tier * 0.3) * scale;
  e.xp = Math.max(1, Math.round(def.xp * (1 + tier * 0.9) * scale));
  e.r = def.r * scale;
  e.slowT = 0; e.poisonT = 0; e.poisonDps = 0; e.poisonTick = 0;
  e.kbx = 0; e.kby = 0; e.flash = 0;
  e.wob = Math.random() * 6.28;
  return e;
}

function spawnWave(dt) {
  const t = G.time;
  const rate = Math.min(13, 1.4 + t * 0.024);
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
function dropGem(x, y, val) {
  let g = null, oldest = null, ot = -1;
  for (let i = 0; i < MAX_GEMS; i++) {
    if (!gems[i].alive) { g = gems[i]; break; }
    if (gems[i].t > ot) { ot = gems[i].t; oldest = gems[i]; }
  }
  if (!g) { oldest.val += val; return; }  // merge into oldest gem
  g.alive = true; g.x = x + (Math.random() - 0.5) * 14; g.y = y + (Math.random() - 0.5) * 14;
  g.val = val; g.t = 0; g.vx = 0; g.vy = 0;
}

function killEnemy(e) {
  e.alive = false;
  G.kills++;
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
  if (o.slow) b.slowT = Math.max(b.slowT, o.slow * 0.3);
  addFloater(b.x + (Math.random() - 0.5) * 60, b.y - 90, Math.round(dmg), '#ffd54f');
  Sound.sfx.bossHit();
  if (b.hp <= 0) {
    b.alive = false;
    G.shake = 18;
    spawnParts(b.x, b.y, '#8bc34a', 60, 260);
    spawnParts(b.x, b.y, '#ffd54f', 40, 200);
    Sound.playFile('assets/audio/enemies/glob_defeat.wav', 1);
    setTimeout(() => Sound.playFile('assets/audio/sfx/crown_crack.wav', 0.9), 900);
    endGame(true);
  }
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
  Sound.sfx.hurt();
  if (player.hp <= 0) { player.hp = 0; endGame(false); }
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
      owner: o.owner || null, t: 0, hitCd: 0,
    });
    p.hitList.length = 0;
    return p;
  }
  return null;
}

function fireWeapon(f, w, ws, isAlly, dt) {
  const m = G.mods;
  const rateMul = m.rate * (isAlly ? 1.25 : 1);
  const dmgMul = m.dmg * (isAlly ? 0.6 * m.ally : 1);
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
            damageEnemy(e, w.dmg * dmgMul, { knock: 60, kx: e.x - f.x, ky: e.y - f.y });
            hit = true; return false;
          }
        });
        if (!hit && G.boss && G.boss.alive) {
          const b = G.boss;
          if ((b.x - ox) ** 2 + (b.y - oy) ** 2 < (rr + b.r) ** 2) { damageBoss(w.dmg * dmgMul, {}); hit = true; }
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
        damageEnemy(e, w.dmg * dmgMul, {});
    });
    if (G.boss && G.boss.alive && (G.boss.x - f.x) ** 2 + (G.boss.y - f.y) ** 2 < (R + G.boss.r) ** 2)
      damageBoss(w.dmg * dmgMul, {});
    for (const c of cages) {
      if (!c.broken && (c.x - f.x) ** 2 + (c.y - f.y) ** 2 < (R + 30) ** 2) damageCage(c, w.dmg * dmgMul);
    }
    return;
  }

  if (w.type === 'trail') {
    ws.cd = interval;
    if (patches.length > 70) patches.shift();
    patches.push({ x: f.x, y: f.y, r: w.radius * areaMul, dps: w.dmg * dmgMul, life: w.patchLife, tick: 0, color: w.color });
    return;
  }

  if (w.type === 'nova') {
    const t = nearestTarget(f.x, f.y, 700, true);
    if (!t) return;                     // hold fire until something's near
    ws.cd = interval;
    for (let i = 0; i < w.count; i++) {
      const a = i / w.count * 6.283 + Math.random() * 0.2;
      spawnProj({
        x: f.x, y: f.y, vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
        dmg: w.dmg * dmgMul, pierce: 1, size: w.size * areaMul, life: w.life,
        color: w.color, knock: w.knock || 0,
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
      damageEnemy(cur, w.dmg * dmgMul * Math.pow(0.85, j), {});
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
      if (perp < W2 + e.r) damageEnemy(e, w.dmg * dmgMul, {});
    });
    if (G.boss && G.boss.alive) {
      const b = G.boss, px = b.x - f.x, py = b.y - f.y;
      const along = px * dx + py * dy;
      if (along > -b.r && along < L + b.r && Math.abs(px * dy - py * dx) < W2 + b.r) damageBoss(w.dmg * dmgMul, {});
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
        damageEnemy(e, w.dmg * dmgMul, { knock: 90, kx: e.x - f.x, ky: e.y - f.y });
    });
    if (G.boss && G.boss.alive) {
      const b = G.boss, d2 = (b.x - f.x) ** 2 + (b.y - f.y) ** 2;
      if (d2 < (R + b.r) ** 2) {
        let da = Math.atan2(b.y - f.y, b.x - f.x) - ang;
        da = Math.atan2(Math.sin(da), Math.cos(da));
        if (Math.abs(da) < half + 0.3) damageBoss(w.dmg * dmgMul, {});
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
      vx: Math.cos(a) * w.speed, vy: Math.sin(a) * w.speed,
      dmg: w.dmg * dmgMul, pierce: w.pierce, size: w.size * areaMul, life: w.life,
      color: w.color, rainbow: w.rainbow, homing: w.homing, boomerang: w.boomerang, explode: w.explode ? w.explode * areaMul : 0,
      split: w.split, slow: w.slow, poison: w.poison ? w.poison * dmgMul / Math.max(1, w.dmg) * w.dmg : 0,
      poisonT: w.poisonT, knock: w.knock, owner: f,
    });
  }
  if (!isAlly) Sound.sfx.shoot();
}

function explodeAt(x, y, r, dmg) {
  eachEnemyNear(x, y, r + 30, e => {
    if ((e.x - x) ** 2 + (e.y - y) ** 2 < (r + e.r) ** 2) damageEnemy(e, dmg, {});
  });
  if (G.boss && G.boss.alive && (G.boss.x - x) ** 2 + (G.boss.y - y) ** 2 < (r + G.boss.r) ** 2) damageBoss(dmg, {});
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
      if (p.explode) explodeAt(p.x, p.y, p.explode, p.dmg * 0.8);
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
      damageEnemy(e, p.dmg, { slow: p.slow, poison: p.poison, poisonT: p.poisonT, knock: p.knock, kx: p.vx, ky: p.vy });
      p.hitList.push(e.id);
      if (p.explode) { explodeAt(p.x, p.y, p.explode, p.dmg * 0.8); dead = true; return false; }
      if (p.split) {
        p.split = false;
        for (let s = 0; s < 3; s++) {
          const a = Math.random() * 6.283;
          spawnProj({ x: p.x, y: p.y, vx: Math.cos(a) * 320, vy: Math.sin(a) * 320, dmg: p.dmg * 0.5, pierce: 0, size: p.size * 0.6, life: 0.5, color: p.color });
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
        damageBoss(p.dmg, { slow: p.slow });
        if (p.explode) { explodeAt(p.x, p.y, p.explode, p.dmg * 0.8); p.alive = false; continue; }
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
    if (a) {
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
  G.boss = {
    alive: true, isBoss: true,
    x: Math.min(WORLD - 200, Math.max(200, player.x + Math.cos(a) * 640)),
    y: Math.min(WORLD - 200, Math.max(200, player.y + Math.sin(a) * 640)),
    hp: BOSS.hp, maxhp: BOSS.hp, r: BOSS.r, spd: BOSS.spd, dmg: BOSS.dmg,
    slowT: 0, flash: 0, wob: 0, enraged: false,
    volleyCd: 4, summonCd: 8, slamCd: 12,
  };
  Sound.playMusic('enemies/glob.mp3');                      // King Glob's theme
  Sound.playFile('assets/audio/enemies/glob_entrance.wav', 0.95);
  setTimeout(() => Sound.playFile('assets/audio/enemies/glob_laugh.wav', 0.9), 1400);
  G.shake = 14;
  banner('👑 KING GLOB HAS ARRIVED 👑');
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
  if (b.slamCd <= 0 && d < 330) {
    b.slamCd = 11;
    telegraphs.push({ x: b.x, y: b.y, r: 190, t: 0, dur: 1.0, dmg: 38 });
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
      gainXP(g.val);
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
      player.hp = Math.min(maxHP(), player.hp + 20);
      Sound.playFile('assets/audio/sfx/catch.wav', 0.7);
      addFloater(player.x, player.y - 40, '+20', '#69f0ae');
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
          damageEnemy(e, pa.dps * 0.25, {});
      });
      if (G.boss && G.boss.alive && (G.boss.x - pa.x) ** 2 + (G.boss.y - pa.y) ** 2 < (pa.r + G.boss.r) ** 2)
        damageBoss(pa.dps * 0.25, {});
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
}

function gainXP(v) {
  G.xp += v;
  Sound.sfx.gem();
  while (G.xp >= G.xpNext) {
    G.xp -= G.xpNext;
    G.level++;
    G.pendingLv++;
    G.xpNext = Math.round(6 * Math.pow(G.level, 1.3) + 5);
    Sound.sfx.level();
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

  buildHash();
  spawnWave(dt);
  updateEnemies(dt);

  // player weapons
  const hero = HEROES[player.heroIdx];
  for (let wi = 0; wi < hero.weapons.length; wi++)
    fireWeapon(player, hero.weapons[wi], player.ws[wi], false, dt);

  updateAllies(dt);
  updateProjs(dt);
  updateBoss(dt);
  updateEbullets(dt);
  updatePickups(dt);

  // boss timing
  if (!G.bossWarned && G.time >= BOSS_TIME - 15) {
    G.bossWarned = true;
    banner('⚠ THE GROUND IS SHAKING... ⚠');
  }
  if (!G.boss && G.time >= BOSS_TIME) spawnBoss();

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
      c.flash -= dt;
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

  // ---- cage arrows (screen space) ----
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  let nearest = null, nd = Infinity;
  for (const c of cages) {
    if (c.broken) continue;
    const d = (c.x - player.x) ** 2 + (c.y - player.y) ** 2;
    if (d < nd) { nd = d; nearest = c; }
  }
  if (nearest && G.running && !G.over) {
    const dx = nearest.x - player.x, dy = nearest.y - player.y;
    const d = Math.sqrt(nd);
    if (d > 330) {
      const a = Math.atan2(dy, dx);
      const ex = cw / 2 + Math.cos(a) * (Math.min(cw, ch) * 0.36);
      const ey = ch / 2 + Math.sin(a) * (Math.min(cw, ch) * 0.36);
      ctx.save();
      ctx.translate(ex, ey); ctx.rotate(a);
      ctx.globalAlpha = 0.5 + Math.sin(G.time * 4) * 0.25;
      ctx.fillStyle = '#ffd54f';
      ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -9); ctx.lineTo(-4, 0); ctx.lineTo(-8, 9); ctx.closePath(); ctx.fill();
      ctx.rotate(-a);
      ctx.font = 'bold 10px "Trebuchet MS",sans-serif';
      ctx.fillText(`${Math.round(d / 50) * 50 / 10}0m`, 0, 24);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  // joystick visual
  if (joy.active) {
    ctx.globalAlpha = 0.25;
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(joy.bx, joy.by, 46, 0, 7); ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(joy.bx + joy.dx * 46, joy.by + joy.dy * 46, 20, 0, 7); ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// ---------------- HUD ----------------
const $ = id => document.getElementById(id);
let hudTick = 0;
function updateHud(dt) {
  hudTick -= dt;
  if (hudTick > 0) return;
  hudTick = 0.12;
  $('hp-bar').style.width = Math.max(0, player.hp / maxHP() * 100) + '%';
  $('hp-text').textContent = `${Math.ceil(player.hp)} / ${maxHP()}`;
  $('xp-bar').style.width = Math.min(100, G.xp / G.xpNext * 100) + '%';
  $('lvl-text').textContent = 'LV ' + G.level;
  const t = G.time | 0;
  $('timer').textContent = `${(t / 60) | 0}:${String(t % 60).padStart(2, '0')}`;
  $('kills').textContent = '☠ ' + G.kills;
  if (G.boss && G.boss.alive)
    $('boss-hp-bar').style.width = Math.max(0, G.boss.hp / G.boss.maxhp * 100) + '%';
}
function updateHudCounts() {
  $('freed').textContent = `⛓ ${freedSet.size}/24`;
}

let bannerTimer = null;
function banner(txt) {
  const b = $('banner');
  b.textContent = txt;
  b.classList.remove('hidden');
  b.style.animation = 'none';
  void b.offsetWidth;
  b.style.animation = '';
  clearTimeout(bannerTimer);
  bannerTimer = setTimeout(() => b.classList.add('hidden'), 2600);
}

// ---------------- Facecard strip & possession ----------------
function rebuildStrip() {
  const strip = $('facecard-strip');
  strip.innerHTML = '';
  const list = [...freedSet];
  for (const idx of list) {
    const card = document.createElement('div');
    card.className = 'facecard' + (idx === player.heroIdx ? ' active' : '');
    card.appendChild(Sprites.portrait(idx, 88));
    card.addEventListener('pointerdown', e => {
      e.stopPropagation();
      possess(idx);
    });
    strip.appendChild(card);
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
  rebuildStrip();
}

// ---------------- Level up ----------------
function showLevelUp() {
  G.running = false;
  const row = $('upgrade-row');
  row.innerHTML = '';
  const pool = [...UPGRADES];
  for (let i = 0; i < 3 && pool.length; i++) {
    const pick = pool.splice((Math.random() * pool.length) | 0, 1)[0];
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `<div class="uc-icon">${pick.icon}</div><h3>${pick.name}</h3><p>${pick.desc}</p>`;
    card.addEventListener('pointerdown', () => {
      pick.apply(G.mods, G);
      G.pendingLv--;
      $('screen-levelup').classList.add('hidden');
      if (G.pendingLv > 0) showLevelUp();
      else if (!G.over) G.running = true;
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
    card.innerHTML = `<div class="hc-name">${h.name}</div><div class="hc-state">${isYou ? 'YOU' : freed ? 'TAP TO POSSESS' : 'IMPRISONED'}</div>`;
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
  if (!G.over) G.running = true;
}

// ---------------- Game flow ----------------
function newGame(heroIdx) {
  G.running = true; G.over = false; G.victory = false; G.pendingLv = 0;
  G.time = 0; G.kills = 0; G.level = 1; G.xp = 0; G.xpNext = 10;
  G.spawnAcc = 0; G.boss = null; G.bossWarned = false; G.shake = 0;
  G.sawDemonder = false; G.sawClubbo = false;
  G.mods = { dmg: 1, rate: 1, spd: 1, hpBonus: 0, ally: 1, magnet: 1, regen: 0, area: 1 };

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
  Sound.stopPreview();
  const region = ['region-land', 'region-sea', 'region-sky'][(Math.random() * 3) | 0];
  Sound.playMusic(`music/${region}.mp3`);
  Sound.playFile(`assets/audio/heroes/${HEROES[heroIdx].id}_entrance.wav`, 0.9);
  banner(`${HEROES[heroIdx].name.toUpperCase()} — BREAK THE CAGES!`);
}

function endGame(won) {
  if (G.over) return;
  G.over = true; G.victory = won;
  Sound.stopMusic();
  if (won) Sound.playMusic('music/victory.mp3', { loop: false, vol: 0.65 });
  else {
    Sound.playFile('assets/audio/sfx/captured.mp3', 0.9);
    setTimeout(() => { if (G.over && !G.victory) Sound.playMusic('music/bgm_gameover.mp3', { loop: false, vol: 0.6 }); }, 1800);
  }

  // persist bests
  try {
    const best = JSON.parse(localStorage.getItem('balitopia') || '{}');
    best.bestKills = Math.max(best.bestKills || 0, G.kills);
    best.bestTime = Math.max(best.bestTime || 0, G.time | 0);
    best.wins = (best.wins || 0) + (won ? 1 : 0);
    localStorage.setItem('balitopia', JSON.stringify(best));
  } catch (e) {}

  setTimeout(() => {
    G.running = false;
    $('over-title').textContent = won ? 'BALITOPIA IS FREE!' : 'THE TIDE TAKES YOU';
    $('over-title').style.color = won ? '#ffd54f' : '#ef9a9a';
    $('over-story').textContent = won ? STORY.victory : STORY.defeat;
    const t = G.time | 0;
    $('over-stats').innerHTML =
      `<div><b>${(t / 60) | 0}:${String(t % 60).padStart(2, '0')}</b>survived</div>` +
      `<div><b>${G.kills}</b>enemies slain</div>` +
      `<div><b>${freedSet.size}/24</b>guardians freed</div>` +
      `<div><b>${G.level}</b>level</div>`;
    $('hud').classList.add('hidden');
    $('screen-over').classList.remove('hidden');
  }, won ? 1600 : 900);
}

// ---------------- Menus ----------------
let selectedHero = 0;
function buildTitle() {
  $('story-box').innerHTML = STORY.intro.map(p => `<p>${p}</p>`).join('') +
    `<div id="poster-row">
       <figure><img src="assets/img/poster_minyar.jpg" alt="Minyar"><figcaption>MINYAR</figcaption></figure>
       <figure><img src="assets/img/poster_demonder.jpg" alt="Demonder"><figcaption>DEMONDER</figcaption></figure>
       <figure><img src="assets/img/poster_clubbo.jpg" alt="Clubbo"><figcaption>CLUBBO</figcaption></figure>
     </div>`;
  $('btn-title-continue').addEventListener('click', () => {
    Sound.ensure();
    Sound.playMusic('music/title.mp3');
    try { screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape').catch(() => {}); } catch (e) {}
    try {
      const fs = document.documentElement.requestFullscreen && document.documentElement.requestFullscreen();
      if (fs && fs.catch) fs.catch(() => {});
    } catch (e) {}
    $('screen-title').classList.add('hidden');
    buildSelect();
    $('screen-select').classList.remove('hidden');
  });
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
      Sound.preview(`assets/audio/heroes/${HEROES[i].id}.mp3`);   // hero theme snippet
    });
    grid.appendChild(card);
  });
  showDetail(selectedHero);
}
function showDetail(i) {
  const h = HEROES[i];
  const pd = $('hero-detail-portrait');
  pd.innerHTML = '';
  pd.appendChild(Sprites.portrait(i, 128));
  $('hero-detail-name').textContent = `${h.name} — ${h.title}`;
  $('hero-detail-power').textContent = h.power;
  $('hero-detail-desc').textContent = h.desc;
  $('hero-detail').classList.remove('hidden');
}

// ---------------- Wire up ----------------
function wire() {
  $('btn-start').addEventListener('click', () => { Sound.ensure(); newGame(selectedHero); });
  $('btn-retry').addEventListener('click', () => {
    $('screen-over').classList.add('hidden');
    buildSelect();
    $('screen-select').classList.remove('hidden');
    Sound.playMusic('music/title.mp3');
  });
  $('btn-roster').addEventListener('click', () => {
    if ($('screen-roster').classList.contains('hidden')) openRoster();
    else closeRoster();
  });
  $('btn-roster-close').addEventListener('click', closeRoster);
  $('btn-mute').addEventListener('click', () => {
    const m = Sound.toggleMute();
    $('btn-mute').classList.toggle('muted', m);
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
  possess, breakCage, newGame, spawnEnemy, spawnBoss,
};

})();
