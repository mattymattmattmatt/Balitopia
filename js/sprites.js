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
  function portrait(i, size) {
    return mk(size, size, (x, w, h) => {
      const hero = HEROES[i], img = imgs.portraits[i];
      if (img) {
        // cover-fit the 88x88 webp face card
        const s = Math.max(w / img.width, h / img.height);
        x.drawImage(img, (w - img.width * s) / 2, (h - img.height * s) / 2, img.width * s, img.height * s);
        return;
      }
      // fallback: accent tile with initial
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
  function groundTile() {
    return mk(256, 256, (x, w, h) => {
      x.fillStyle = '#2f6b3d'; x.fillRect(0, 0, w, h);
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      for (let i = 0; i < 26; i++) {
        x.fillStyle = `rgba(20,60,32,${0.12 + rnd() * 0.12})`;
        x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 14 + rnd() * 30, 10 + rnd() * 22, rnd() * 3, 0, 7); x.fill();
      }
      for (let i = 0; i < 6; i++) {
        x.fillStyle = 'rgba(194,178,128,.10)';
        x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 18 + rnd() * 26, 12 + rnd() * 18, rnd() * 3, 0, 7); x.fill();
      }
      x.strokeStyle = 'rgba(140,200,110,.5)'; x.lineWidth = 1.6; x.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        const gx = rnd() * w, gy = rnd() * h;
        for (let b = -1; b <= 1; b++) {
          x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + b * 3, gy - 5 - rnd() * 3); x.stroke();
        }
      }
      for (let i = 0; i < 10; i++) {
        x.fillStyle = ['#f8bbd0', '#fff59d', '#e1bee7'][i % 3];
        x.beginPath(); x.arc(rnd() * w, rnd() * h, 2, 0, 7); x.fill();
      }
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
    get('heart', heart);
    get('ground', groundTile);
    get('palm', palm);
    get('rock', rock);
    get('bush', bush);
  }

  return { init, get, portrait, shade };
})();
