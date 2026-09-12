/* Cosmetic-only monster gore. Cached disintegration sprites make every death
 * visible, even when the separately budgeted flying-fragment pool is full. */
'use strict';
const Gore = (() => {
  const TILE = 512, RES = 128, MAX_BITS = 320, QUEUE = 256, MAX_BODIES = 19;
  const TAU = Math.PI * 2;
  function create({ makeCanvas, world = 5200, onLand = () => {} }) {
    let seed = 1, atlas = null, cursor = 0, active = 0, emitted = 0;
    let popCursor = 0, pops = 0, head = 0, pending = 0, clock = 0, painted = 0, evicted = 0;
    let level = 'full', motion = true, limit = 240, tileLimit = 48, burstLimit = 96;
    let breakupLimit = 240, burstCell = 0, merged = 0, paintLimit = 24;
    const bits = Array.from({ length: MAX_BITS }, () => ({ alive: false }));
    const bursts = Array.from({ length: MAX_BITS }, () => ({ alive: false }));
    const queue = Array.from({ length: QUEUE }, () => ({}));
    const tiles = new Map(), bodies = new Map(), burstCells = new Map();
    const random = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    function surface(w, h) { const c = makeCanvas(); c.width = w; c.height = h; return c; }
    function buildAtlas() {
      if (atlas) return;
      atlas = surface(512, 256);
      const c = atlas.getContext('2d');
      // Opaque scarlet puddles, satellite drops and long directional streaks.
      // Prepainted once: no gradients, filters or paths in the live gore pass.
      for (let v = 0; v < 8; v++) {
        c.save(); c.translate(v * 64 + 32, 32);
        c.fillStyle = '#870916';
        c.beginPath();
        for (let j = 0; j < 24; j++) {
          const a = j / 24 * TAU, r = 13 + random() * 10;
          const x = Math.cos(a) * r, y = Math.sin(a) * r * 0.78;
          if (j) c.lineTo(x, y); else c.moveTo(x, y);
        }
        c.closePath(); c.fill();
        c.fillStyle = '#d91025';
        c.beginPath(); c.ellipse(-1, -1, 16, 10, 0.2, 0, TAU); c.fill();
        c.strokeStyle = '#e61b2b'; c.lineCap = 'round';
        for (let j = 0; j < 20; j++) {
          const a = random() * TAU, r = 18 + random() * 12;
          c.lineWidth = 1 + random() * 2;
          c.beginPath(); c.moveTo(Math.cos(a) * 9, Math.sin(a) * 6);
          c.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.8); c.stroke();
          c.beginPath(); c.ellipse(Math.cos(a) * r, Math.sin(a) * r * 0.8,
            1 + random() * 2.4, 0.8 + random() * 1.4, a, 0, TAU); c.fill();
        }
        c.fillStyle = '#ff4050';
        c.beginPath(); c.ellipse(-5, -4, 7, 2.2, -0.2, 0, TAU); c.fill();
        c.restore();
      }
      const colors = ['#e42034', '#ffe0ac', '#bd1630', '#ff4552'];
      for (let kind = 0; kind < 4; kind++) for (let rot = 0; rot < 8; rot++) {
        c.save(); c.translate((kind * 8 + rot) * 16 + 8, 80); c.rotate(rot * TAU / 8);
        c.fillStyle = '#650815';
        c.beginPath(); c.moveTo(-6, -3); c.lineTo(-1, -6); c.lineTo(5, -3);
        c.lineTo(6, 2); c.lineTo(1, 5); c.lineTo(-4, 3); c.closePath(); c.fill();
        c.fillStyle = colors[kind];
        if (kind === 1) { c.fillRect(-5, -1.5, 10, 3); c.fillRect(-5, -3, 3, 6); }
        else { c.beginPath(); c.moveTo(-4, -2); c.lineTo(1, -4); c.lineTo(4, 0); c.lineTo(0, 3); c.closePath(); c.fill(); }
        c.fillStyle = kind === 1 ? '#fff5db' : '#ff7178'; c.fillRect(-2, -2, 3, 1.5);
        c.restore();
      }
      // Eight animation frames of a radial blood spray, on a transparent sheet.
      for (let f = 0; f < 8; f++) {
        const p = f / 7;
        c.save(); c.translate(f * 64 + 32, 160);
        c.strokeStyle = '#ed1028'; c.fillStyle = '#ff233d'; c.lineCap = 'round';
        for (let i = 0; i < 22; i++) {
          const a = i * 2.39996, r = 9 + p * (15 + (i % 5) * 1.7);
          c.lineWidth = 2.8 - p * 1.4;
          c.beginPath(); c.moveTo(Math.cos(a) * r * 0.45, Math.sin(a) * r * 0.45);
          c.lineTo(Math.cos(a) * r, Math.sin(a) * r); c.stroke();
          c.beginPath(); c.ellipse(Math.cos(a) * r, Math.sin(a) * r, 1.3 + (i % 3) * 0.5, 1, a, 0, TAU); c.fill();
        }
        c.fillStyle = '#ce0b21';
        c.beginPath(); c.arc(0, 0, 9 * (1 - p) + 1, 0, TAU); c.fill();
        c.restore();
      }
    }
    function prepareBody(key, source) {
      if (level === 'off' || bodies.has(key) || !source || bodies.size >= MAX_BODIES) return;
      buildAtlas();
      const chunks = surface(192, 144), cc = chunks.getContext('2d');
      // Cut six different pieces from the actual enemy: its face, sides and
      // lower body, with a red torn edge. Rotations are also baked at run start.
      for (let piece = 0; piece < 6; piece++) for (let rot = 0; rot < 8; rot++) {
        cc.save(); cc.translate(rot * 24 + 12, piece * 24 + 12); cc.rotate(rot * TAU / 8);
        cc.beginPath(); cc.moveTo(-8, -6); cc.lineTo(1, -9); cc.lineTo(8, -4);
        cc.lineTo(6, 7); cc.lineTo(-3, 8); cc.lineTo(-8, 2); cc.closePath();
        cc.fillStyle = '#ec1632'; cc.fill(); cc.save(); cc.clip();
        cc.drawImage(source, (piece % 3) * source.width / 3, Math.floor(piece / 3) * source.height / 2,
          source.width / 3, source.height / 2, -7, -7, 14, 14);
        cc.restore(); cc.strokeStyle = '#590b16'; cc.lineWidth = 1; cc.stroke();
        cc.fillStyle = '#e21a31'; cc.fillRect(-4, 5, 8, 2); cc.restore();
      }
      const sheet = surface(512, 64), sc = sheet.getContext('2d');
      for (let f = 0; f < 8; f++) {
        sc.drawImage(atlas, f * 64, 128, 64, 64, f * 64, 0, 64, 64);
        for (let piece = 0; piece < 6; piece++) {
          const a = piece * TAU / 6 - 1.2, r = 3 + f * 3.1, s = 14 - f * 0.35;
          sc.drawImage(chunks, ((f + piece) & 7) * 24, piece * 24, 24, 24,
            f * 64 + 32 + Math.cos(a) * r - s / 2, 30 + Math.sin(a) * r - s / 2, s, s);
        }
      }
      bodies.set(key, { chunks, sheet });
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
    function stamp(x, y, size, angle, sprite = -1, body = null) {
      if (level === 'off' || !Number.isFinite(x + y + size)) return;
      const s = queue[(head + pending) % QUEUE];
      s.x = x; s.y = y; s.size = size; s.angle = angle; s.sprite = sprite; s.body = body;
      s.variant = (random() * 8) | 0;
      if (pending === QUEUE) head = (head + 1) % QUEUE; else pending++;
    }
    function paint(s) {
      const r = s.size * 0.72;
      const max = Math.ceil(world / TILE) - 1;
      const x0 = Math.max(0, Math.floor((s.x - r) / TILE)), x1 = Math.min(max, Math.floor((s.x + r) / TILE));
      const y0 = Math.max(0, Math.floor((s.y - r) / TILE)), y1 = Math.min(max, Math.floor((s.y + r) / TILE));
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) {
        const c = tileAt(x, y).ctx, k = RES / TILE;
        c.setTransform(k, 0, 0, k, -x * TILE * k, -y * TILE * k); c.translate(s.x, s.y); c.rotate(s.angle);
        if (s.sprite < 0) c.drawImage(atlas, s.variant * 64, 0, 64, 64, -s.size / 2, -s.size / 2, s.size, s.size);
        else if (s.body) c.drawImage(s.body.chunks, (s.sprite & 7) * 24, (s.sprite >> 3) * 24, 24, 24, -s.size / 2, -s.size / 2, s.size, s.size);
        else c.drawImage(atlas, s.sprite * 16, 72, 16, 16, -s.size / 2, -s.size / 2, s.size, s.size);
      }
      painted++;
    }
    function clear() {
      for (const p of bits) { p.alive = false; p.body = null; }
      for (const b of bursts) { b.alive = false; b.body = null; }
      for (const s of queue) s.body = null;
      for (const t of tiles.values()) { t.canvas.width = 0; t.canvas.height = 0; }
      tiles.clear(); head = 0; pending = 0; active = 0; emitted = 0; cursor = 0; pops = 0; popCursor = 0;
      painted = 0; evicted = 0; clock = 0; merged = 0; burstCells.clear();
    }
    function configure(options) {
      level = ['full', 'light', 'off'].includes(options.level) ? options.level : 'full';
      motion = options.motion !== false;
      limit = Math.max(0, Math.min(MAX_BITS, options.bits ?? 240));
      tileLimit = Math.max(4, Math.min(64, options.tiles ?? 48));
      burstLimit = Math.max(0, Math.min(limit, options.burst ?? 96));
      breakupLimit = Math.max(0, Math.min(limit, options.breakups ?? limit));
      paintLimit = Math.max(1, Math.min(24, options.paint ?? 24));
      const cell = Math.max(0, options.burstCell || 0);
      if (cell !== burstCell) {
        burstCells.clear();
        for (const b of bursts) b.cell = null;
        burstCell = cell;
      }
      if (level === 'off') { clear(); return; }
      buildAtlas();
      while (tiles.size > tileLimit) retireTile(oldestKey(), true);
      for (const p of bits) if (p.alive && (active > limit || !motion)) { p.alive = false; active--; }
      for (const b of bursts) if (b.alive && (pops > breakupLimit || !motion)) retireBurst(b);
    }
    function retireBurst(b) {
      if (burstCells.get(b.cell) === b) burstCells.delete(b.cell);
      b.alive = false; b.body = null; b.cell = null; pops--;
    }
    function reset(runSeed) { clear(); if (level !== 'off') buildAtlas(); seed = (runSeed | 0) || 1; }
    function burst(x, y, height, size, hit = {}) {
      if (level === 'off') return;
      const scale = Math.max(0.7, Math.min(2.8, size / 18));
      const blast = !!hit.blast, boss = !!hit.boss;
      const angle = Number.isFinite(hit.fromX) && Number.isFinite(hit.fromY) && Math.abs(x - hit.fromX) + Math.abs(y - hit.fromY) > 1
        ? Math.atan2(y - hit.fromY, x - hit.fromX) : random() * TAU;
      stamp(x, y, (blast ? 175 : 130) * scale, angle);
      // Satellite splashes are optional; reserve queue space for later deaths.
      if (level === 'full' && pending < 128) for (let i = 0; i < 2; i++) {
        const a = angle + (random() - 0.5) * 3, r = (25 + random() * 60) * scale;
        stamp(x + Math.cos(a) * r, y + Math.sin(a) * r * 0.75, (45 + random() * 45) * scale, a);
      }
      if (!motion || hit.visible === false || !limit) return;
      const body = bodies.get(hit.body) || null;
      // Separate from the flying-particle budget. Dense groups can share spray;
      // the latest death stays visible when the pool is full.
      const cell = burstCell ? Math.floor(x / burstCell) + ':' + Math.floor(y / burstCell) : null;
      const nearby = cell === null ? null : burstCells.get(cell);
      let slot = nearby ? nearby.slot : -1;
      if (nearby) merged++;
      if (slot < 0 && pops < breakupLimit) for (let i = 0; i < MAX_BITS; i++) {
        const index = (popCursor + i) % MAX_BITS;
        if (!bursts[index].alive) { slot = index; break; }
      }
      if (slot < 0 && breakupLimit) { // Replace the oldest animation; keep new kills visible.
        let age = -1;
        for (let i = 0; i < MAX_BITS; i++) {
          const index = (popCursor + i) % MAX_BITS;
          if (bursts[index].alive && bursts[index].t > age) { slot = index; age = bursts[index].t; }
        }
      }
      if (slot >= 0) {
        const b = bursts[slot], previousSize = nearby ? b.size : 0;
        popCursor = (slot + 1) % MAX_BITS;
        if (b.alive) retireBurst(b);
        pops++; b.alive = true; b.x = x; b.y = y - height; b.t = 0; b.body = body;
        b.slot = slot; b.cell = cell;
        if (cell !== null) burstCells.set(cell, b);
        // Nearby simultaneous deaths share the spray; chunks and every ground
        // stain remain independently emitted. Avoid hundreds of overlapping quads.
        b.size = Math.max(previousSize, (blast ? 150 : 110) * scale);
        b.dur = level === 'light' ? 0.38 : 0.52;
      }
      const desired = level === 'light' ? (boss ? 18 : blast ? 9 : 6) : (boss ? 54 : blast ? 30 : 18);
      const n = Math.max(0, Math.min(desired, limit - active, burstLimit - emitted));
      for (let i = 0; i < n; i++) {
        while (bits[cursor].alive) cursor = (cursor + 1) % MAX_BITS;
        const p = bits[cursor]; cursor = (cursor + 1) % MAX_BITS;
        const a = angle + (random() - 0.5) * (blast ? 2.5 : TAU);
        const speed = (blast ? 240 : 110) + random() * (blast ? 330 : 180);
        p.alive = true; p.x = x; p.y = y; p.z = Math.max(8, height);
        p.vx = Math.cos(a) * speed; p.vy = Math.sin(a) * speed * 0.75;
        p.vz = 100 + random() * (blast ? 250 : 150);
        p.kind = i % 3 === 2 ? 0 : 1;
        p.body = p.kind ? body : null;
        p.sprite = p.body ? (i % 6) * 8 + ((random() * 8) | 0) : (i % 7 === 0 ? 8 : 0) + ((random() * 8) | 0);
        p.size = (p.kind ? 16 + random() * 9 : 4 + random() * 5) * scale;
        p.t = 0; p.bounce = 0; p.trail = 0; p.spin = (random() - 0.5) * 22;
        active++; emitted++;
      }
    }
    function update(dt) {
      emitted = 0;
      if (level === 'off') return;
      dt = Math.max(0, Math.min(dt, 0.1));
      const drag = Math.exp(-1.8 * dt);
      for (const b of bursts) if (b.alive) { b.t += dt; if (b.t >= b.dur) retireBurst(b); }
      for (const p of bits) {
        if (!p.alive) continue;
        p.t += dt; p.x += p.vx * dt; p.y += p.vy * dt;
        p.z += p.vz * dt; p.vz -= 720 * dt; p.vx *= drag; p.vy *= drag;
        p.trail += dt;
        if (p.kind && level === 'full' && p.trail > 0.14 && pending < 64) {
          p.trail = 0; stamp(p.x, p.y, 18 + p.size, 0);
        }
        if (p.z <= 0 || p.t > 2) {
          if(p.kind && !p.bounce) onLand(p.x,p.y,Math.max(1,Math.min(3,p.size/18*Math.abs(p.vz)/260)));
          p.z = 0;
          if (p.kind && !p.bounce && p.t < 1.4) { p.bounce = 1; p.vz = Math.abs(p.vz) * 0.24; }
          else {
            if (pending < 192) {
              stamp(p.x, p.y, p.kind ? p.size * 3 : p.size * 5, 0);
              if (p.kind) stamp(p.x, p.y, p.size, 0, p.sprite, p.body);
            }
            p.alive = false; active--;
          }
        }
      }
      let budget = Math.min(paintLimit, level === 'light' ? 12 : 24);
      while (pending && budget-- > 0) { const s = queue[head]; paint(s); s.body = null; head = (head + 1) % QUEUE; pending--; }
    }
    function drawGround(c, x, y, w, h) {
      if (level === 'off') return;
      // Nearest-neighbour sampling avoids translucent seams between low-res
      // tiles and keeps the splatter crisp at the reduced render resolution.
      const smoothing = c.imageSmoothingEnabled; c.imageSmoothingEnabled = false;
      const max = Math.ceil(world / TILE) - 1;
      for (let tx = Math.max(0, Math.floor(x / TILE)); tx <= Math.min(max, Math.floor((x + w) / TILE)); tx++)
        for (let ty = Math.max(0, Math.floor(y / TILE)); ty <= Math.min(max, Math.floor((y + h) / TILE)); ty++) {
          const t = tiles.get(tx + ':' + ty);
          if (t) { t.used = ++clock; c.drawImage(t.canvas, tx * TILE, ty * TILE, TILE, TILE); }
        }
      c.imageSmoothingEnabled = smoothing;
    }
    function drawAir(c, onScreen) {
      if (level === 'off') return;
      for (const b of bursts) {
        if (!b.alive || !onScreen(b.x, b.y, b.size)) continue;
        const progress = b.t / b.dur, frame = Math.min(7, (progress * 8) | 0);
        c.globalAlpha = Math.min(1, (1 - progress) * 3);
        c.drawImage(b.body ? b.body.sheet : atlas, frame * 64, b.body ? 0 : 128, 64, 64,
          b.x - b.size / 2, b.y - b.size / 2, b.size, b.size);
      }
      c.globalAlpha = 1;
      c.fillStyle = '#fa1832';
      for (const p of bits) {
        if (!p.alive || !onScreen(p.x, p.y - p.z, p.size)) continue;
        if (p.kind) {
          const frame = (p.sprite & ~7) + (((p.sprite + p.t * p.spin) | 0) & 7);
          if (p.body) c.drawImage(p.body.chunks, (frame & 7) * 24, (frame >> 3) * 24, 24, 24,
            p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size);
          else c.drawImage(atlas, frame * 16, 72, 16, 16, p.x - p.size / 2, p.y - p.z - p.size / 2, p.size, p.size);
        } else {
          // Cheap wet streak + drop, without a path or a rotation per droplet.
          c.fillRect(p.x - p.vx * 0.018, p.y - p.z, Math.max(p.size, Math.abs(p.vx) * 0.025), Math.max(2, p.size * 0.55));
        }
      }
    }
    function stats() {
      return { active, bursts: pops, pending, tiles: tiles.size, painted, evicted, limit, tileLimit, bodies: bodies.size,
        breakupLimit, burstCell, merged, burstCells: burstCells.size, paintLimit,
        textureBytes: tiles.size * RES * RES * 4 + (atlas ? 512 * 256 * 4 : 0) + bodies.size * (192 * 144 + 512 * 64) * 4 };
    }
    return { configure, reset, prepareBody, burst, update, drawGround, drawAir, stats,
      atlas: () => atlas, fragments: () => bits.filter(p => p.alive).map(p => ({ ...p })) };
  }
  return { create };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Gore;
