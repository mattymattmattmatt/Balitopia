// ============================================================
// BALITOPIA — sprite pipeline.
// Loads the real art from assets/ (portraits, hero bodies,
// enemy renders) and pre-bakes hue-tier tinted variants.
// Anything missing falls back to procedural canvas art.
// See ASSETS.md for the file layout.
// ============================================================
'use strict';

const Sprites = (() => {
  const imgs = { portraits: [], bodies: [], enemies: {} };

  function mk(w, h, fn) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const x = c.getContext('2d');
    fn(x, w, h);
    return c;
  }
  function rr(x, px, py, w, h, r) {
    x.beginPath();
    x.moveTo(px + r, py);
    x.arcTo(px + w, py, px + w, py + h, r);
    x.arcTo(px + w, py + h, px, py + h, r);
    x.arcTo(px, py + h, px, py, r);
    x.arcTo(px, py, px + w, py, r);
    x.closePath();
  }
  const shade = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    r = Math.max(0, Math.min(255, Math.round(r * f)));
    g = Math.max(0, Math.min(255, Math.round(g * f)));
    b = Math.max(0, Math.min(255, Math.round(b * f)));
    return `rgb(${r},${g},${b})`;
  };
  const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

  const loadImage = src => new Promise(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(null);
    img.src = src;
  });

  // ---------------- Hero portraits (face cards) ----------------
  // The rendered pixels are cached per (hero,size); each call still returns its
  // OWN canvas (a DOM node can only live in one place) but just blits the cache
  // instead of re-doing the cover-fit / gradient / text every time. Opening the
  // roster or codex (24 portraits) is now a batch of cheap blits.
  const portraitCache = {};
  function portraitSrc(i, size) {
    const key = i + ':' + size;
    if (portraitCache[key]) return portraitCache[key];
    return portraitCache[key] = mk(size, size, (x, w, h) => {
      const hero = HEROES[i], img = imgs.portraits[i];
      if (img) {
        const s = Math.max(w / img.width, h / img.height);
        x.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
        return;
      }
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, shade(hero.accent, 0.75));
      g.addColorStop(1, '#0d2229');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = '#fff';
      x.font = `bold ${h * 0.55}px "Trebuchet MS",sans-serif`;
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(hero.name[0], w / 2, h * 0.55);
    });
  }
  function portrait(i, size) {
    const src = portraitSrc(i, size);
    return mk(size, size, x => x.drawImage(src, 0, 0));
  }

  // ---------------- Hero bodies (world sprites) ----------------
  // File art is normalized into a canvas; missing art gets a
  // procedural critter (bo has a bespoke rainbow-blackbird).
  function boBird() {
    return mk(96, 96, (x, w, h) => {
      const cx = 44, cy = 56;
      // rainbow wing (fanned arcs behind body)
      const cols = ['#e53935', '#fb8c00', '#fdd835', '#43a047', '#1e88e5', '#8e24aa'];
      for (let i = 0; i < 6; i++) {
        x.strokeStyle = cols[i]; x.lineWidth = 6; x.lineCap = 'round';
        x.beginPath();
        x.moveTo(cx + 6, cy - 6);
        const a = -0.5 - i * 0.28;
        x.quadraticCurveTo(cx + 26, cy - 26, cx + 12 + Math.cos(a) * 42, cy - 4 + Math.sin(a) * 42);
        x.stroke();
      }
      // tail
      x.fillStyle = '#263238';
      x.beginPath(); x.moveTo(cx - 12, cy + 2); x.lineTo(cx - 38, cy + 14); x.lineTo(cx - 14, cy + 16); x.fill();
      // body
      x.fillStyle = '#37474f';
      x.beginPath(); x.ellipse(cx, cy, 22, 18, -0.15, 0, 7); x.fill();
      x.strokeStyle = '#1c262b'; x.lineWidth = 3; x.stroke();
      // head
      x.fillStyle = '#37474f';
      x.beginPath(); x.arc(cx + 16, cy - 16, 13, 0, 7); x.fill();
      x.strokeStyle = '#1c262b'; x.stroke();
      // beak
      x.fillStyle = '#fb8c00';
      x.beginPath(); x.moveTo(cx + 27, cy - 18); x.lineTo(cx + 40, cy - 13); x.lineTo(cx + 27, cy - 10); x.fill();
      // eye
      x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + 18, cy - 19, 4.5, 0, 7); x.fill();
      x.fillStyle = '#000'; x.beginPath(); x.arc(cx + 19.5, cy - 18.5, 2.2, 0, 7); x.fill();
      // legs
      x.strokeStyle = '#fb8c00'; x.lineWidth = 3;
      x.beginPath(); x.moveTo(cx - 4, cy + 16); x.lineTo(cx - 6, cy + 30); x.stroke();
      x.beginPath(); x.moveTo(cx + 6, cy + 16); x.lineTo(cx + 8, cy + 30); x.stroke();
      // chest flash
      x.fillStyle = '#e53935';
      x.beginPath(); x.ellipse(cx + 8, cy + 2, 7, 9, 0.4, 0, 7); x.fill();
    });
  }
  function critter(hero) {
    return mk(80, 88, (x, w, h) => {
      const cx = w / 2, cy = h - 30, a = hero.accent;
      x.fillStyle = a;
      x.beginPath(); x.ellipse(cx, cy, 24, 26, 0, 0, 7); x.fill();
      x.strokeStyle = shade(a, 0.5); x.lineWidth = 3.5; x.stroke();
      x.fillStyle = shade(a, 1.25);
      x.beginPath(); x.ellipse(cx, cy + 8, 14, 12, 0, 0, 7); x.fill();
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(cx - 9, cy - 8, 6.5, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 9, cy - 8, 6.5, 0, 7); x.fill();
      x.fillStyle = '#212121';
      x.beginPath(); x.arc(cx - 8, cy - 7, 3, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 10, cy - 7, 3, 0, 7); x.fill();
      x.strokeStyle = shade(a, 0.4); x.lineWidth = 2.5; x.lineCap = 'round';
      x.beginPath(); x.arc(cx, cy + 4, 7, 0.3, Math.PI - 0.3); x.stroke();
    });
  }
  function heroBody(i) {
    const img = imgs.bodies[i];
    if (!img) return HEROES[i].id === 'bo' ? boBird() : critter(HEROES[i]);
    return mk(img.width, img.height, x => x.drawImage(img, 0, 0));
  }

  // ---------------- Enemies ----------------
  // Real art tinted per power tier; procedural fallbacks below.
  function tintedEnemy(img, tier) {
    return mk(img.width, img.height, (x, w, h) => {
      x.drawImage(img, 0, 0);
      if (tier > 0) {
        x.globalCompositeOperation = 'source-atop';
        x.fillStyle = hsl(TIERS[tier].hue, 80, 55);
        x.globalAlpha = 0.42;
        x.fillRect(0, 0, w, h);
        x.globalAlpha = 1;
        x.globalCompositeOperation = 'source-over';
      }
    });
  }

  function minyarProc(hue) {
    return mk(56, 56, (x, w, h) => {
      const cx = w / 2, cy = h / 2 + 4;
      x.fillStyle = hsl(hue, 60, 28);
      x.beginPath(); x.ellipse(cx - 10, h - 6, 7, 5, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(cx + 10, h - 6, 7, 5, 0, 0, 7); x.fill();
      x.fillStyle = hsl(hue, 45, 75);
      x.beginPath(); x.moveTo(cx - 14, cy - 14); x.lineTo(cx - 20, cy - 26); x.lineTo(cx - 7, cy - 19); x.fill();
      x.beginPath(); x.moveTo(cx + 14, cy - 14); x.lineTo(cx + 20, cy - 26); x.lineTo(cx + 7, cy - 19); x.fill();
      x.fillStyle = hsl(hue, 65, 48);
      x.beginPath(); x.ellipse(cx, cy, 19, 21, 0, 0, 7); x.fill();
      x.strokeStyle = hsl(hue, 70, 26); x.lineWidth = 2.5; x.stroke();
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(cx - 7, cy - 5, 5.5, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 7, cy - 5, 5.5, 0, 7); x.fill();
      x.fillStyle = '#1a1a1a';
      x.beginPath(); x.arc(cx - 6, cy - 4, 2.6, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 8, cy - 4, 2.6, 0, 7); x.fill();
      x.fillStyle = hsl(hue, 70, 22);
      x.beginPath(); x.arc(cx, cy + 3, 7, 0.15, Math.PI - 0.15); x.fill();
    });
  }
  function demonderProc(hue) {
    return mk(84, 96, (x, w, h) => {
      const cx = w / 2;
      x.fillStyle = hsl(hue, 55, 22);
      rr(x, cx - 16, h - 26, 13, 22, 5); x.fill();
      rr(x, cx + 3, h - 26, 13, 22, 5); x.fill();
      x.fillStyle = hsl(hue, 60, 34);
      rr(x, cx - 20, 34, 40, 42, 13); x.fill();
      x.strokeStyle = hsl(hue, 65, 16); x.lineWidth = 3; x.stroke();
      x.fillStyle = hsl(hue, 62, 38);
      x.beginPath(); x.arc(cx, 26, 15, 0, 7); x.fill();
      x.fillStyle = '#f5f5f5';
      x.beginPath(); x.moveTo(cx - 10, 16); x.quadraticCurveTo(cx - 26, 4, cx - 14, 6); x.quadraticCurveTo(cx - 12, 8, cx - 4, 13); x.fill();
      x.beginPath(); x.moveTo(cx + 10, 16); x.quadraticCurveTo(cx + 26, 4, cx + 14, 6); x.quadraticCurveTo(cx + 12, 8, cx + 4, 13); x.fill();
      x.fillStyle = '#ffee58';
      x.beginPath(); x.ellipse(cx - 6, 25, 3.6, 2.4, 0.3, 0, 7); x.fill();
      x.beginPath(); x.ellipse(cx + 6, 25, 3.6, 2.4, -0.3, 0, 7); x.fill();
    });
  }
  function clubboProc(hue) {
    return mk(120, 128, (x, w, h) => {
      const cx = w / 2 - 6;
      x.fillStyle = hsl(hue, 40, 26);
      rr(x, cx - 26, h - 32, 20, 28, 8); x.fill();
      rr(x, cx + 6, h - 32, 20, 28, 8); x.fill();
      x.fillStyle = hsl(hue, 45, 40);
      x.beginPath(); x.ellipse(cx, 66, 38, 42, 0, 0, 7); x.fill();
      x.strokeStyle = hsl(hue, 50, 20); x.lineWidth = 4; x.stroke();
      x.fillStyle = hsl(hue, 45, 44);
      x.beginPath(); x.arc(cx, 28, 22, 0, 7); x.fill();
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(cx, 24, 9, 0, 7); x.fill();
      x.fillStyle = '#d32f2f';
      x.beginPath(); x.arc(cx, 24, 4.4, 0, 7); x.fill();
    });
  }
  function kingGlobProc() {
    return mk(220, 200, (x, w, h) => {
      const cx = w / 2, base = h - 16;
      const g = x.createRadialGradient(cx - 30, 60, 20, cx, 110, 130);
      g.addColorStop(0, '#9ccc65'); g.addColorStop(0.7, '#558b2f'); g.addColorStop(1, '#33691e');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(cx - 95, base);
      x.bezierCurveTo(cx - 110, 70, cx - 60, 18, cx, 20);
      x.bezierCurveTo(cx + 60, 18, cx + 110, 70, cx + 95, base);
      x.closePath(); x.fill();
      x.strokeStyle = '#1b5e20'; x.lineWidth = 5; x.stroke();
      x.fillStyle = '#ffd54f';
      x.beginPath();
      x.moveTo(cx - 34, 30); x.lineTo(cx - 34, 2); x.lineTo(cx - 17, 18); x.lineTo(cx, 0);
      x.lineTo(cx + 17, 18); x.lineTo(cx + 34, 2); x.lineTo(cx + 34, 30); x.fill();
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(cx - 26, 72, 20, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 28, 68, 12, 0, 7); x.fill();
      x.fillStyle = '#bf360c';
      x.beginPath(); x.arc(cx - 22, 74, 9, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 30, 70, 5.5, 0, 7); x.fill();
      x.fillStyle = '#1b5e20';
      x.beginPath(); x.arc(cx, 108, 46, 0.25, Math.PI - 0.25); x.fill();
    });
  }

  // ---------------- Cage ----------------
  function cage(heroIdx) {
    const P = portrait(heroIdx, 44);
    return mk(76, 88, (x, w, h) => {
      x.fillStyle = 'rgba(10,20,16,.88)';
      rr(x, 8, 10, w - 16, h - 18, 10); x.fill();
      x.save(); x.globalAlpha = 0.85;
      x.drawImage(P, w / 2 - 22, h / 2 - 20);
      x.restore();
      x.fillStyle = 'rgba(20,40,30,.45)';
      rr(x, 8, 10, w - 16, h - 18, 10); x.fill();
      for (let i = 0; i < 5; i++) {
        const bx = 10 + i * (w - 24) / 4;
        const g = x.createLinearGradient(bx, 0, bx + 7, 0);
        g.addColorStop(0, '#8d6e63'); g.addColorStop(0.5, '#d7a86e'); g.addColorStop(1, '#795548');
        x.fillStyle = g;
        rr(x, bx, 6, 7, h - 10, 3); x.fill();
        x.fillStyle = '#5d4037';
        x.fillRect(bx, h * 0.4, 7, 2); x.fillRect(bx, h * 0.72, 7, 2);
      }
      x.fillStyle = '#4e342e';
      rr(x, 4, 2, w - 8, 9, 4); x.fill();
      rr(x, 4, h - 9, w - 8, 8, 4); x.fill();
      x.fillStyle = '#7e57c2';
      x.beginPath(); x.arc(w / 2, 6, 5, 0, 7); x.fill();
      x.fillStyle = '#d1c4e9';
      x.beginPath(); x.arc(w / 2, 6, 2.2, 0, 7); x.fill();
    });
  }

  // ---------------- Pickups ----------------
  function gem(color, s) {
    return mk(s, s, (x, w, h) => {
      const cx = w / 2, cy = h / 2;
      x.fillStyle = color;
      x.beginPath();
      x.moveTo(cx, 2); x.lineTo(w - 2, cy); x.lineTo(cx, h - 2); x.lineTo(2, cy);
      x.closePath(); x.fill();
      x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1.5; x.stroke();
      x.fillStyle = 'rgba(255,255,255,.5)';
      x.beginPath(); x.moveTo(cx, 4); x.lineTo(cx + (w / 2 - 4) * 0.5, cy - (h / 2 - 4) * 0.5); x.lineTo(cx, cy); x.closePath(); x.fill();
    });
  }
  function heart() {
    return mk(22, 20, (x, w, h) => {
      x.fillStyle = '#ef5350';
      x.beginPath();
      x.moveTo(w / 2, h - 3);
      x.bezierCurveTo(-4, h * 0.45, 3, -4, w / 2, 6);
      x.bezierCurveTo(w - 3, -4, w + 4, h * 0.45, w / 2, h - 3);
      x.fill();
      x.strokeStyle = '#b71c1c'; x.lineWidth = 1.5; x.stroke();
    });
  }

  // ---------------- Ground & decor ----------------
  // three biome palettes so the land / sea / sky region music has a matching look
  const BIOMES = {
    land: { base: '#2f6b3d', patch: '20,60,32', sand: '194,178,128', tuft: '140,200,110', flowers: ['#f8bbd0', '#fff59d', '#e1bee7'] },
    sea:  { base: '#1f6b70', patch: '12,60,66',  sand: '224,204,150', tuft: '90,210,210',  flowers: ['#ffe0b2', '#b2ebf2', '#fff59d'] },
    sky:  { base: '#5a5a8f', patch: '40,40,80',   sand: '210,210,255', tuft: '190,180,255', flowers: ['#ffffff', '#e1bee7', '#b3e5fc'] },
  };
  // SEAMLESS tiling: every feature is drawn nine times at (±w, ±h) offsets, so
  // anything crossing an edge reappears on the opposite side. Without this the
  // 256px grid is plainly visible across the whole playfield.
  function groundTile(region, size, detail) {
    const p = BIOMES[region] || BIOMES.land;
    const S = size || 256;
    return mk(S, S, (x, w, h) => {
      // wrap(fn) runs fn once per 3x3 offset so shapes tile without seams
      const wrap = fn => {
        for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) {
          x.save(); x.translate(ox * w, oy * h); fn(); x.restore();
        }
      };
      x.fillStyle = p.base; x.fillRect(0, 0, w, h);
      let seed = detail || 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const blobs = [], sands = [], tufts = [], flowers = [];
      for (let i = 0; i < 26; i++) blobs.push([rnd() * w, rnd() * h, 14 + rnd() * 30, 10 + rnd() * 22, rnd() * 3, 0.12 + rnd() * 0.12]);
      for (let i = 0; i < 6; i++) sands.push([rnd() * w, rnd() * h, 18 + rnd() * 26, 12 + rnd() * 18, rnd() * 3]);
      for (let i = 0; i < 46; i++) tufts.push([rnd() * w, rnd() * h, rnd(), rnd(), rnd()]);
      for (let i = 0; i < 10; i++) flowers.push([rnd() * w, rnd() * h, i % 3]);

      wrap(() => { for (const [bx, by, rx, ry, rot, a] of blobs) {
        x.fillStyle = `rgba(${p.patch},${a})`;
        x.beginPath(); x.ellipse(bx, by, rx, ry, rot, 0, 7); x.fill();
      } });
      wrap(() => { for (const [bx, by, rx, ry, rot] of sands) {
        x.fillStyle = `rgba(${p.sand},.10)`;
        x.beginPath(); x.ellipse(bx, by, rx, ry, rot, 0, 7); x.fill();
      } });
      x.strokeStyle = `rgba(${p.tuft},.5)`; x.lineWidth = 1.6; x.lineCap = 'round';
      wrap(() => { for (const [gx, gy, r1, r2, r3] of tufts) {
        const rs = [r1, r2, r3];
        for (let b = -1; b <= 1; b++) {
          x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + b * 3, gy - 5 - rs[b + 1] * 3); x.stroke();
        }
      } });
      wrap(() => { for (const [fx2, fy, fi] of flowers) {
        x.fillStyle = p.flowers[fi];
        x.beginPath(); x.arc(fx2, fy, 2, 0, 7); x.fill();
      } });
    });
  }

  // The large-scale variation is BAKED INTO a single 768px tile rather than
  // drawn as a second full-screen layer. Two overlapping ground passes doubled
  // the frame's fill cost, which profiling showed was the dominant expense.
  // One tile, one pass, same "no visible grid" result.
  function groundBaked(region) {
    const p = BIOMES[region] || BIOMES.land;
    const S = 768;
    return mk(S, S, (x, w, h) => {
      // 3x3 of the 256px seamless base fills the 768 tile exactly
      const base = groundTile(region);
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) x.drawImage(base, i * 256, j * 256);
      // large-scale blobs on top, wrapped so the 768 tile is itself seamless
      const wrap = fn => { for (let ox = -1; ox <= 1; ox++) for (let oy = -1; oy <= 1; oy++) { x.save(); x.translate(ox * w, oy * h); fn(); x.restore(); } };
      let seed = 991;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      const shapes = [];
      for (let i = 0; i < 16; i++) shapes.push([rnd() * w, rnd() * h, 90 + rnd() * 200, 70 + rnd() * 160, rnd() * 3, 0.06 + rnd() * 0.07]);
      wrap(() => { for (const [bx, by, rx, ry, rot, a] of shapes) {
        x.fillStyle = `rgba(${p.patch},${a})`;
        x.beginPath(); x.ellipse(bx, by, rx, ry, rot, 0, 7); x.fill();
      } });
      // a few bright sand sweeps for large-scale interest
      wrap(() => { for (let i = 0; i < 5; i++) {
        x.fillStyle = `rgba(${p.sand},.07)`;
        x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 120 + rnd() * 160, 60 + rnd() * 90, rnd() * 3, 0, 7); x.fill();
      } });
    });
  }
  function palm() {
    return mk(96, 120, (x, w, h) => {
      const bx = w / 2;
      x.fillStyle = 'rgba(0,0,0,.22)';
      x.beginPath(); x.ellipse(bx, h - 8, 24, 8, 0, 0, 7); x.fill();
      x.strokeStyle = '#8d6e63'; x.lineWidth = 9; x.lineCap = 'round';
      x.beginPath(); x.moveTo(bx - 6, h - 10); x.quadraticCurveTo(bx + 4, h - 60, bx + 12, 36); x.stroke();
      x.strokeStyle = '#388e3c'; x.lineWidth = 7;
      for (let i = 0; i < 6; i++) {
        const a = -0.4 - i * 0.45;
        x.beginPath(); x.moveTo(bx + 12, 36);
        x.quadraticCurveTo(bx + 12 + Math.cos(a) * 30, 36 + Math.sin(a) * 30 - 8, bx + 12 + Math.cos(a) * 44, 36 + Math.sin(a) * 44 + 10);
        x.stroke();
      }
      x.fillStyle = '#5d4037';
      x.beginPath(); x.arc(bx + 7, 42, 5, 0, 7); x.fill();
      x.beginPath(); x.arc(bx + 17, 44, 5, 0, 7); x.fill();
    });
  }
  function rock() {
    return mk(60, 44, (x, w, h) => {
      x.fillStyle = 'rgba(0,0,0,.2)';
      x.beginPath(); x.ellipse(w / 2, h - 5, 24, 6, 0, 0, 7); x.fill();
      x.fillStyle = '#78909c';
      x.beginPath();
      x.moveTo(8, h - 8); x.lineTo(14, 12); x.lineTo(30, 5); x.lineTo(48, 14); x.lineTo(w - 6, h - 8);
      x.closePath(); x.fill();
      x.strokeStyle = '#455a64'; x.lineWidth = 2.5; x.stroke();
      x.fillStyle = '#90a4ae';
      x.beginPath(); x.moveTo(14, 12); x.lineTo(30, 5); x.lineTo(34, 16); x.lineTo(18, 22); x.closePath(); x.fill();
    });
  }
  function bush() {
    return mk(56, 44, (x, w, h) => {
      x.fillStyle = 'rgba(0,0,0,.18)';
      x.beginPath(); x.ellipse(w / 2, h - 4, 22, 5, 0, 0, 7); x.fill();
      for (const [bx, by, br, c] of [[18, 26, 14, '#2e7d32'], [38, 26, 14, '#388e3c'], [28, 16, 14, '#43a047']]) {
        x.fillStyle = c;
        x.beginPath(); x.arc(bx, by, br, 0, 7); x.fill();
      }
      x.fillStyle = '#f06292';
      for (const [fx, fy] of [[16, 20], [36, 14], [42, 30]]) {
        x.beginPath(); x.arc(fx, fy, 2.6, 0, 7); x.fill();
      }
    });
  }

  // ---------------- Pre-baked status overlays ----------------
  // These used to be 6-9 beginPath/fill pairs per affected enemy per frame.
  // Baking them once at load turns each into a single drawImage.
  function statusPoison(r) {
    const S = Math.ceil(r * 2.6);
    return mk(S, S, (x, w, h) => {
      const c = w / 2;
      const g = x.createRadialGradient(c, c, r * 0.15, c, c, r * 0.95);
      g.addColorStop(0, 'rgba(139,195,74,.55)'); g.addColorStop(1, 'rgba(139,195,74,0)');
      x.fillStyle = g; x.beginPath(); x.arc(c, c, r * 0.95, 0, 7); x.fill();
      x.fillStyle = 'rgba(197,225,165,.8)';
      for (let k = 0; k < 4; k++) {
        const a = k / 4 * 6.283 + 0.6;
        x.beginPath(); x.arc(c + Math.cos(a) * r * 0.5, c + Math.sin(a) * r * 0.5, 2.2, 0, 7); x.fill();
      }
    });
  }
  function statusFrost(r) {
    const S = Math.ceil(r * 2.6);
    return mk(S, S, (x, w, h) => {
      const c = w / 2;
      x.globalAlpha = 0.3; x.fillStyle = '#b3e5fc';
      x.beginPath(); x.arc(c, c, r * 0.92, 0, 7); x.fill();
      x.globalAlpha = 0.9; x.strokeStyle = '#e1f5fe'; x.lineWidth = 1.6;
      for (let k = 0; k < 5; k++) {
        const a = k / 5 * 6.283;
        const ix = c + Math.cos(a) * r * 0.8, iy = c + Math.sin(a) * r * 0.8;
        x.beginPath(); x.moveTo(ix, iy); x.lineTo(ix + Math.cos(a) * 4.5, iy + Math.sin(a) * 4.5); x.stroke();
      }
    });
  }
  function statusBurn(r) {
    const S = Math.ceil(r * 2.6);
    return mk(S, S, (x, w) => {
      const c = w / 2;
      const g = x.createRadialGradient(c, c, r * 0.1, c, c, r * 0.9);
      g.addColorStop(0, 'rgba(255,167,38,.6)'); g.addColorStop(1, 'rgba(255,87,34,0)');
      x.fillStyle = g; x.beginPath(); x.arc(c, c, r * 0.9, 0, 7); x.fill();
    });
  }
  // Elite ring — one drawImage instead of a stroked arc + glow per elite.
  function eliteRing(color) {
    const S = 96;
    return mk(S, S, (x, w) => {
      const c = w / 2;
      x.strokeStyle = color; x.lineWidth = 3; x.globalAlpha = 0.9;
      x.beginPath(); x.arc(c, c, 34, 0, 7); x.stroke();
      x.globalAlpha = 0.28; x.lineWidth = 10;
      x.beginPath(); x.arc(c, c, 34, 0, 7); x.stroke();
      x.globalAlpha = 0.5; x.lineWidth = 1.5;
      for (let k = 0; k < 8; k++) {
        const a = k / 8 * 6.283;
        x.beginPath();
        x.moveTo(c + Math.cos(a) * 38, c + Math.sin(a) * 38);
        x.lineTo(c + Math.cos(a) * 45, c + Math.sin(a) * 45);
        x.stroke();
      }
    });
  }

  // ---------------- Projectile art ----------------
  // Every weapon used to render as the same flat circle. Each archetype now has
  // a pre-baked, tinted sprite so weapon fantasy actually reads on screen.
  function projSprite(kind, color, size) {
    const S = Math.ceil(size * 6) + 8;
    return mk(S, S, (x, w, h) => {
      const c = w / 2, r = size;
      x.translate(c, c);
      if (kind === 'bolt') {                 // elongated capsule + trail
        const g = x.createLinearGradient(-r * 2.6, 0, r * 1.4, 0);
        g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, color);
        x.fillStyle = g;
        x.beginPath(); x.ellipse(-r * 0.6, 0, r * 2.2, r * 0.72, 0, 0, 7); x.fill();
        x.fillStyle = color;
        x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.9)';
        x.beginPath(); x.arc(r * 0.22, -r * 0.2, r * 0.42, 0, 7); x.fill();
      } else if (kind === 'shard') {         // rotating triangle
        x.fillStyle = color;
        x.beginPath(); x.moveTo(r * 1.5, 0); x.lineTo(-r, r * 0.9); x.lineTo(-r * 0.4, 0); x.lineTo(-r, -r * 0.9);
        x.closePath(); x.fill();
        x.strokeStyle = 'rgba(255,255,255,.75)'; x.lineWidth = 1; x.stroke();
      } else if (kind === 'orb') {           // soft glowing sphere
        const g = x.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.5);
        g.addColorStop(0, '#fff'); g.addColorStop(0.35, color); g.addColorStop(1, 'rgba(0,0,0,0)');
        x.fillStyle = g; x.beginPath(); x.arc(0, 0, r * 1.5, 0, 7); x.fill();
      } else if (kind === 'wave') {          // crescent slab
        x.strokeStyle = color; x.lineWidth = r * 0.85; x.lineCap = 'round';
        x.beginPath(); x.arc(-r * 0.5, 0, r * 1.25, -1.1, 1.1); x.stroke();
        x.strokeStyle = 'rgba(255,255,255,.55)'; x.lineWidth = r * 0.3;
        x.beginPath(); x.arc(-r * 0.5, 0, r * 1.25, -0.8, 0.8); x.stroke();
      } else {                               // 'dot' — small, crisp
        x.fillStyle = color;
        x.beginPath(); x.arc(0, 0, r, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.8)';
        x.beginPath(); x.arc(-r * 0.25, -r * 0.25, r * 0.4, 0, 7); x.fill();
      }
    });
  }
  // Enemy bullets follow the threat colour law: never green, always outlined.
  function enemyBullet(size) {
    const S = size * 6;
    return mk(S, S, (x, w) => {
      const c = w / 2;
      const g = x.createRadialGradient(c, c, 1, c, c, size * 2.4);
      g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(0.4, '#ff4081'); g.addColorStop(1, 'rgba(255,64,129,0)');
      x.fillStyle = g; x.beginPath(); x.arc(c, c, size * 2.4, 0, 7); x.fill();
      x.fillStyle = '#fff'; x.beginPath(); x.arc(c, c, size * 0.5, 0, 7); x.fill();
      x.strokeStyle = 'rgba(60,0,25,.9)'; x.lineWidth = 1.5;
      x.beginPath(); x.arc(c, c, size, 0, 7); x.stroke();
    });
  }
  // Soft radial used for the additive light layer + puff particles.
  function glow(color) {
    return mk(64, 64, (x, w) => {
      const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, color); g.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = g; x.fillRect(0, 0, w, w);
    });
  }
  function chestSprite(open) {
    return mk(44, 40, (x, w, h) => {
      x.fillStyle = 'rgba(0,0,0,.25)';
      x.beginPath(); x.ellipse(w / 2, h - 4, 16, 5, 0, 0, 7); x.fill();
      x.fillStyle = '#6d4c41'; rr(x, 6, 14, w - 12, h - 18, 4); x.fill();
      x.strokeStyle = '#3e2723'; x.lineWidth = 2; x.stroke();
      x.fillStyle = open ? '#8d6e63' : '#795548';
      if (open) { x.save(); x.translate(w / 2, 15); x.rotate(-0.7); rr(x, -16, -11, 32, 12, 4); x.fill(); x.restore(); }
      else { rr(x, 5, 6, w - 10, 12, 4); x.fill(); }
      x.strokeStyle = '#ffd54f'; x.lineWidth = 2;
      x.beginPath(); x.moveTo(6, 20); x.lineTo(w - 6, 20); x.stroke();
      x.fillStyle = '#ffd54f';
      x.beginPath(); x.arc(w / 2, 22, 3.4, 0, 7); x.fill();
      if (open) { x.fillStyle = 'rgba(255,213,79,.55)'; x.beginPath(); x.ellipse(w / 2, 16, 15, 7, 0, 0, 7); x.fill(); }
    });
  }

  // ---------------- Cache & init ----------------
  const cache = {};
  function get(key, maker) {
    if (!cache[key]) cache[key] = maker();
    return cache[key];
  }

  async function init() {
    // load real art in parallel (missing files resolve to null → fallbacks)
    const pLoads = HEROES.map((h, i) => loadImage(`assets/img/portraits/${h.id}.webp`).then(img => imgs.portraits[i] = img));
    const bLoads = HEROES.map((h, i) => loadImage(`assets/img/heroes/${h.id}.png`).then(img => imgs.bodies[i] = img));
    const eLoads = ['minyar', 'demonder', 'clubbo', 'kingglob'].map(n => loadImage(`assets/img/enemies/${n}.png`).then(img => imgs.enemies[n] = img));
    await Promise.all([...pLoads, ...bLoads, ...eLoads]);

    // enemy tier variants (tinted real art, or hue-drawn procedural)
    const procs = { minyar: minyarProc, demonder: demonderProc, clubbo: clubboProc };
    TIERS.forEach((t, i) => {
      for (const n of ['minyar', 'demonder', 'clubbo']) {
        get(n + i, () => imgs.enemies[n] ? tintedEnemy(imgs.enemies[n], i) : procs[n](t.hue));
      }
    });
    get('boss', () => imgs.enemies.kingglob
      ? mk(imgs.enemies.kingglob.width, imgs.enemies.kingglob.height, x => x.drawImage(imgs.enemies.kingglob, 0, 0))
      : kingGlobProc());

    HEROES.forEach((_, i) => {
      get('body' + i, () => heroBody(i));
      get('cage' + i, () => cage(i));
    });
    get('gemS', () => gem('#69f0ae', 14));
    get('gemM', () => gem('#40c4ff', 16));
    get('gemL', () => gem('#ffd740', 20));
    get('gemXL', () => gem('#ff80ab', 24));    // elite gem
    get('gemBoss', () => gem('#fff59d', 28));  // boss gem
    get('heart', heart);
    for (const b of ['land', 'sea', 'sky']) get('ground_' + b, () => groundBaked(b));
    get('palm', palm);
    get('rock', rock);
    get('bush', bush);
    get('chest', () => chestSprite(false));
    get('chestOpen', () => chestSprite(true));
    get('ebullet', () => enemyBullet(8));
    get('glowW', () => glow('rgba(255,255,255,.85)'));
    get('glowGold', () => glow('rgba(255,213,79,.9)'));
    // status overlays at the few radii actually used, rounded to 4px buckets
    for (let r = 12; r <= 44; r += 4) {
      get('poison' + r, () => statusPoison(r));
      get('frost' + r, () => statusFrost(r));
      get('burn' + r, () => statusBurn(r));
    }
    for (const a of ELITE_AFFIXES) get('elite_' + a.id, () => eliteRing(a.color));
  }

  // Projectile sprites are made on demand and cached by (kind,color,size) —
  // the set is small and bounded because size is bucketed to whole pixels.
  function proj(kind, color, size) {
    const s = Math.max(2, Math.round(size));
    return get(`p_${kind}_${color}_${s}`, () => projSprite(kind, color, s));
  }
  function statusFx(kind, r) {
    const b = Math.min(44, Math.max(12, Math.round(r / 4) * 4));
    return get(kind + b, () => (kind === 'poison' ? statusPoison : kind === 'frost' ? statusFrost : statusBurn)(b));
  }

  return { init, get, portrait, shade, proj, statusFx, groundTile };
})();
