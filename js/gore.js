/* Cosmetic-only monster gore. Fixed particle/queue budgets, a reusable atlas,
 * and sparse ground tiles: no per-stain entities in the frame loop. */
'use strict';
const Gore = (() => {
  const TILE = 512, RES = 128, MAX_BITS = 320, QUEUE = 256;
  const TAU = Math.PI * 2;
  function create({ makeCanvas, world = 5200 }) {
    let seed = 1, atlas = null, cursor = 0, active = 0, emitted = 0;
    let head = 0, pending = 0, clock = 0, painted = 0, evicted = 0;
    let level = 'full', motion = true, limit = 240, tileLimit = 48, burstLimit = 96;
    const bits = Array.from({ length: MAX_BITS }, () => ({ alive: false }));
    const queue = Array.from({ length: QUEUE }, () => ({}));
    const tiles = new Map();
    const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    function surface(w, h) { const c = makeCanvas(); c.width = w; c.height = h; return c; }
    function buildAtlas() {
      if (atlas) return;
      atlas = surface(512, 128);
      const c = atlas.getContext('2d');
      // Eight torn puddles with directional spatters. These are drawn once,
      // then stamped into low-resolution ground tiles only when a kill lands.
      for (let v = 0; v < 8; v++) {
        c.save(); c.translate(v * 64 + 32, 32);
        c.fillStyle = '#49111d';
        c.beginPath();
        for (let j = 0; j < 18; j++) {
          const a = j / 18 * TAU, r = 10 + random() * 10;
          const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.7;
          if (j) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.closePath(); c.fill();
        c.fillStyle = '#8e2030'; c.globalAlpha = 0.75;
        c.beginPath(); c.ellipse(-2, -1, 11, 6, 0.2, 0, TAU); c.fill();
        c.fillStyle = '#731526'; c.globalAlpha = 0.88;
        for (let j = 0; j < 16; j++) {
          const a = random() * TAU, r = 15 + random() * 13;
          c.beginPath(); c.ellipse(Math.cos(a) * r, Math.sin(a) * r * 0.78,
            0.8 + random() * 2.5, 0.6 + random() * 1.2, a, 0, TAU); c.fill();
        }
        c.restore();
      }
      // Flesh, bone, hide and droplets, pre-rotated into eight directions.
      // Live fragments need one blit, with no per-fragment rotate/save/restore.
      const colors = ['#aa253b', '#e6c89c', '#346b62', '#641c40'];
      for (let kind = 0; kind < 4; kind++) for (let rot = 0; rot < 8; rot++) {
        c.save(); c.translate((kind * 8 + rot) * 16 + 8, 80); c.rotate(rot * TAU / 8);
        c.fillStyle = '#36121e';
        c.beginPath(); c.moveTo(-6, -3); c.lineTo(-1, -6); c.lineTo(5, -3);
        c.lineTo(6, 2); c.lineTo(1, 5); c.lineTo(-4, 3); c.closePath(); c.fill();
        c.fillStyle = colors[kind];
        if (kind === 1) { c.fillRect(-5, -1.5, 10, 3); c.fillRect(-5, -3, 3, 6); }
        else { c.beginPath(); c.moveTo(-4, -2); c.lineTo(1, -4); c.lineTo(4, 0); c.lineTo(0, 3); c.closePath(); c.fill(); }
        c.fillStyle = kind === 1 ? '#fff0cc' : '#df6870'; c.fillRect(-2, -2, 3, 1.5);
        c.restore();
      }
    }
    function retireTile(key, release) {
      const tile = tiles.get(key); tiles.delete(key); evicted++;
      if (release) { tile.canvas.width = 0; tile.canvas.height = 0; }
      return tile;
    }
    function oldestKey() {
      let key, age = Infinity;
      for (const [k, t] of tiles) if (t.used < age) { key = k; age = t.used; }
      return key;
    }
    function tileAt(x, y) {
      const key = x + ':' + y;
      let t = tiles.get(key);
      if (!t) {
        if (tiles.size >= tileLimit) {
          t = retireTile(oldestKey(), false);
          t.ctx.setTransform(1, 0, 0, 1, 0, 0); t.ctx.clearRect(0, 0, RES, RES);
        } else { const canvas = surface(RES, RES); t = { canvas, ctx: canvas.getContext('2d') }; }
        t.x = x; t.y = y; tiles.set(key, t);
      }
      t.used = ++clock;
      return t;
    }
    function stamp(x, y, size, angle, sprite = -1) {
      if (level === 'off' || !Number.isFinite(x + y + size)) return;
      const index = (head + pending) % QUEUE;
      const s = queue[index];
      s.x = x; s.y = y; s.size = size; s.angle = angle; s.sprite = sprite;
      s.variant = (random() * 8) | 0;
      if (pending === QUEUE) head = (head + 1) % QUEUE; else pending++;
    }
    function paint(s) {
      const r = s.size * 0.72; // includes rotated corners, including tile seams
      const max = Math.ceil(world / TILE) - 1;
      const x0 = Math.max(0, Math.floor((s.x - r) / TILE)), x1 = Math.min(max, Math.floor((s.x + r) / TILE));
      const y0 = Math.max(0, Math.floor((s.y - r) / TILE)), y1 = Math.min(max, Math.floor((s.y + r) / TILE));
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const c = tileAt(x, y).ctx, k = RES / TILE;
        c.setTransform(k, 0, 0, k, -x * TILE * k, -y * TILE * k);
        c.translate(s.x, s.y); c.rotate(s.angle);
        if (s.sprite < 0) c.drawImage(atlas, s.variant * 64, 0, 64, 64, -s.size / 2, -s.size / 2, s.size, s.size);
        else c.drawImage(atlas, s.sprite * 16, 72, 16, 16, -s.size / 2, -s.size / 2, s.size, s.size);
      }
      painted++;
    }
    function clear() {
      for (const p of bits) p.alive = false;
      for (const t of tiles.values()) { t.canvas.width = 0; t.canvas.height = 0; }
      tiles.clear(); head = 0; pending = 0; active = 0; emitted = 0; cursor = 0;
      painted = 0; evicted = 0; clock = 0;
    }
    function configure(options) {
      level = ['full', 'light', 'off'].includes(options.level) ? options.level : 'full';
      motion = options.motion !== false;
      limit = Math.max(0, Math.min(MAX_BITS, options.bits || 240));
      tileLimit = Math.max(4, Math.min(64, options.tiles || 48));
      burstLimit = Math.min(limit, options.burst || 96);
      if (level === 'off') { clear(); return; }
      buildAtlas();
      while (tiles.size > tileLimit) retireTile(oldestKey(), true);
      for (const p of bits) if (p.alive && (active > limit || !motion)) { p.alive = false; active--; }
    }
    function reset(runSeed) { clear(); if (level !== 'off') buildAtlas(); seed = (runSeed | 0) || 1; }
    function burst(x, y, height, size, hit = {}) {
      if (level === 'off') return;
      const scale = Math.max(0.7, Math.min(2.8, size / 18));
      const blast = !!hit.blast, boss = !!hit.boss;
      const angle = Number.isFinite(hit.fromX) && Number.isFinite(hit.fromY) && Math.abs(x - hit.fromX) + Math.abs(y - hit.fromY) > 1
        ? Math.atan2(y - hit.fromY, x - hit.fromX) : random() * TAU;
      stamp(x, y, (blast ? 115 : 78) * scale, angle);
      if (!motion || hit.visible === false) return;
      const desired = level === 'light' ? (boss ? 18 : blast ? 9 : 5) : (boss ? 54 : blast ? 24 : 12);
      const n = Math.max(0, Math.min(desired, limit - active, burstLimit - emitted));
      for (let i = 0; i < n; i++) {
        while (bits[cursor].alive) cursor = (cursor + 1) % MAX_BITS;
        const p = bits[cursor]; cursor = (cursor + 1) % MAX_BITS;
        const a = angle + (random() - 0.5) * (blast ? 1.9 : 4.5);
        const speed = (blast ? 210 : 80) + random() * (blast ? 270 : 120);
        p.alive = true; p.x = x; p.y = y; p.z = Math.max(8, height);
        p.vx = Math.cos(a) * speed; p.vy = Math.sin(a) * speed * 0.75;
        p.vz = 90 + random() * (blast ? 230 : 120);
        p.kind = i % 3 === 0 ? (i % 12 === 0 ? 1 : i % 6 === 0 ? 2 : 3) : 0;
        p.sprite = (p.kind === 1 ? 8 : p.kind === 2 ? 16 : 0) + ((random() * 8) | 0);
        p.size = (p.kind ? 10 + random() * 8 : 3 + random() * 5) * scale;
        p.t = 0; p.bounce = 0; p.spin = (random() - 0.5) * 22;
        active++; emitted++;
      }
    }
    function update(dt) {
      emitted = 0;
      if (level === 'off') return;
      dt = Math.max(0, Math.min(dt, 0.1));
      const drag = Math.exp(-2.2 * dt);
      for (const p of bits) {
        if (!p.alive) continue;
        p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
        p.z += p.vz * dt; p.vz -= 660 * dt; p.vx *= drag; p.vy *= drag;
        if (p.z <= 0 || p.t > 2) {
          p.z = 0;
          if (p.kind && !p.bounce && p.t < 1.4) { p.bounce = 1; p.vz = Math.abs(p.vz) * 0.25; }
          else {
            stamp(p.x, p.y, p.kind ? p.size * 2.8 : p.size * 4, 0);
            if (p.kind) stamp(p.x, p.y, p.size, p.t * p.spin, p.sprite);
            p.alive = false; active--;
          }
        }
      }
      // Spread a mass kill's texture writes over several frames. The queue and
      // tile pool stay bounded even when hundreds of enemies die together.
      let budget = level === 'light' ? 12 : 24;
      while (pending && budget-- > 0) { paint(queue[head]); head = (head + 1) % QUEUE; pending--; }
    }
    function drawGround(c, x, y, w, h) {
      if (level === 'off') return;
      const max = Math.ceil(world / TILE) - 1;
      for (let tx = Math.max(0, Math.floor(x / TILE)); tx <= Math.min(max, Math.floor((x + w) / TILE)); tx++)
        for (let ty = Math.max(0, Math.floor(y / TILE)); ty <= Math.min(max, Math.floor((y + h) / TILE)); ty++) {
          const t = tiles.get(tx + ':' + ty);
          if (t) { t.used = ++clock; c.drawImage(t.canvas, tx * TILE, ty * TILE, TILE, TILE); }
        }
    }
    function drawAir(c, onScreen) {
      if (level === 'off') return;
      for (const p of bits) {
        if (!p.alive || !onScreen(p.x, p.y - p.z, p.size)) continue;
        if (p.kind) {
          const frame = (p.sprite & ~7) + (((p.sprite + p.t * p.spin) | 0) & 7);
          c.drawImage(atlas, frame * 16, 72, 16, 16, p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size);
        } else {
          c.fillStyle = '#a51f37'; c.fillRect(p.x, p.y - p.z, p.size, Math.max(2, p.size * 0.6));
        }
      }
    }
    function stats() {
      return { active, pending, tiles: tiles.size, painted, evicted, limit, tileLimit,
        textureBytes: tiles.size * RES * RES * 4 + (atlas ? 512 * 128 * 4 : 0) };
    }
    return { configure, reset, burst, update, drawGround, drawAir, stats,
      atlas: () => atlas, fragments: () => bits.filter(p => p.alive).map(p => ({ ...p })) };
  }
  return { create };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Gore;
