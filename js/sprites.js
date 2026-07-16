// ============================================================
// BALITOPIA — procedural sprites (all art drawn in code).
// Any sprite can be overridden by a PNG: put files in assets/img/
// and list them in assets/manifest.json  →  ["minyar.png", ...]
// See ASSETS.md for the full art list & sizes.
// ============================================================
'use strict';

const Sprites = (() => {
  const overrides = {};   // key -> Image

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

  // ---------------- Hero faces ----------------
  function drawFace(x, hero, s) {
    // s = size of square. face fills it.
    const cx = s / 2, cy = s / 2 + s * 0.04, R = s * 0.34;
    // hair behind
    if (hero.hat !== 'hood') {
      x.fillStyle = hero.hair;
      x.beginPath(); x.arc(cx, cy - s * 0.05, R * 1.12, Math.PI * 0.95, Math.PI * 2.05); x.fill();
    }
    // head
    x.fillStyle = hero.skin;
    x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
    x.strokeStyle = shade(hero.skin, 0.7); x.lineWidth = s * 0.02; x.stroke();
    // fringe
    if (!['hood', 'spike', 'ears'].includes(hero.hat)) {
      x.fillStyle = hero.hair;
      x.beginPath(); x.arc(cx, cy - R * 0.35, R * 0.95, Math.PI * 1.05, Math.PI * 1.95); x.fill();
    }
    const acc = hero.accent, out = hero.outfit;
    switch (hero.hat) {
      case 'band':
        x.fillStyle = acc; x.fillRect(cx - R, cy - R * 0.55, R * 2, s * 0.09); break;
      case 'flower': {
        x.fillStyle = acc;
        const fx = cx + R * 0.72, fy = cy - R * 0.72;
        for (let i = 0; i < 5; i++) {
          const a = i / 5 * 6.283;
          x.beginPath(); x.arc(fx + Math.cos(a) * s * 0.055, fy + Math.sin(a) * s * 0.055, s * 0.05, 0, 7); x.fill();
        }
        x.fillStyle = '#ffee58'; x.beginPath(); x.arc(fx, fy, s * 0.04, 0, 7); x.fill(); break;
      }
      case 'leaf':
        x.fillStyle = '#66bb6a';
        x.beginPath(); x.ellipse(cx, cy - R * 1.15, R * 0.55, R * 0.22, -0.5, 0, 7); x.fill(); break;
      case 'spike':
        x.fillStyle = hero.hair;
        for (let i = -2; i <= 2; i++) {
          x.beginPath();
          x.moveTo(cx + i * R * 0.38 - R * 0.18, cy - R * 0.6);
          x.lineTo(cx + i * R * 0.38, cy - R * 1.45 - Math.abs(i) * -R * 0.1);
          x.lineTo(cx + i * R * 0.38 + R * 0.18, cy - R * 0.6);
          x.fill();
        } break;
      case 'crescent':
        x.fillStyle = acc;
        x.beginPath(); x.arc(cx + R * 0.7, cy - R * 1.05, R * 0.34, 0, 7); x.fill();
        x.fillStyle = hero.hair;
        x.beginPath(); x.arc(cx + R * 0.82, cy - R * 1.12, R * 0.28, 0, 7); x.fill(); break;
      case 'hood':
        x.fillStyle = out;
        x.beginPath(); x.arc(cx, cy - s * 0.02, R * 1.18, Math.PI * 0.75, Math.PI * 2.25); x.fill();
        x.fillStyle = hero.skin;
        x.beginPath(); x.arc(cx, cy + s * 0.03, R * 0.82, 0, 7); x.fill(); break;
      case 'crown':
        x.fillStyle = '#ffd54f';
        x.beginPath();
        x.moveTo(cx - R * 0.75, cy - R * 0.75); x.lineTo(cx - R * 0.75, cy - R * 1.35);
        x.lineTo(cx - R * 0.35, cy - R * 0.95); x.lineTo(cx, cy - R * 1.5);
        x.lineTo(cx + R * 0.35, cy - R * 0.95); x.lineTo(cx + R * 0.75, cy - R * 1.35);
        x.lineTo(cx + R * 0.75, cy - R * 0.75); x.fill(); break;
      case 'ears':
        x.fillStyle = hero.hair;
        x.beginPath(); x.arc(cx - R * 0.8, cy - R * 0.85, R * 0.4, 0, 7); x.fill();
        x.beginPath(); x.arc(cx + R * 0.8, cy - R * 0.85, R * 0.4, 0, 7); x.fill(); break;
      case 'horns':
        x.fillStyle = '#eceff1';
        x.beginPath(); x.moveTo(cx - R * 0.9, cy - R * 0.4); x.quadraticCurveTo(cx - R * 1.5, cy - R * 1.2, cx - R * 0.7, cy - R * 1.5); x.lineTo(cx - R * 0.55, cy - R * 0.7); x.fill();
        x.beginPath(); x.moveTo(cx + R * 0.9, cy - R * 0.4); x.quadraticCurveTo(cx + R * 1.5, cy - R * 1.2, cx + R * 0.7, cy - R * 1.5); x.lineTo(cx + R * 0.55, cy - R * 0.7); x.fill(); break;
      case 'mask':
        x.fillStyle = out; x.fillRect(cx - R, cy - R * 0.32, R * 2, R * 0.55); break;
    }
    // eyes
    const ey = cy - R * 0.02, eo = R * 0.4;
    if (hero.hat === 'mask') {
      x.fillStyle = '#fff';
      x.beginPath(); x.ellipse(cx - eo, ey - R * 0.05, R * 0.16, R * 0.1, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(cx + eo, ey - R * 0.05, R * 0.16, R * 0.1, 0, 0, 7); x.fill();
    } else {
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(cx - eo, ey, R * 0.2, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + eo, ey, R * 0.2, 0, 7); x.fill();
      x.fillStyle = '#212121';
      x.beginPath(); x.arc(cx - eo + R * 0.04, ey, R * 0.1, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + eo + R * 0.04, ey, R * 0.1, 0, 7); x.fill();
    }
    // mouth
    x.strokeStyle = shade(hero.skin, 0.55); x.lineWidth = s * 0.022; x.lineCap = 'round';
    x.beginPath(); x.arc(cx, cy + R * 0.35, R * 0.28, 0.35, Math.PI - 0.35); x.stroke();
  }

  function portrait(i, size) {
    const key = `portrait_${String(i).padStart(2, '0')}`;
    return mk(size, size, (x, w, h) => {
      if (overrides[key]) { x.drawImage(overrides[key], 0, 0, w, h); return; }
      const hero = HEROES[i];
      const g = x.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, shade(hero.accent, 0.55));
      g.addColorStop(1, '#0d2229');
      x.fillStyle = g; x.fillRect(0, 0, w, h);
      x.fillStyle = hero.outfit;
      x.beginPath(); x.arc(w / 2, h * 1.12, w * 0.42, 0, 7); x.fill(); // shoulders
      drawFace(x, hero, size);
    });
  }

  // ---------------- Hero body (world sprite) ----------------
  function heroBody(i) {
    const key = `hero_${String(i).padStart(2, '0')}`;
    const S = 72; // drawn at 2x, world size ~36
    return mk(S, S + 12, (x, w, h) => {
      if (overrides[key]) { x.drawImage(overrides[key], 0, 0, w, h); return; }
      const hero = HEROES[i];
      const cx = w / 2;
      // legs
      x.fillStyle = shade(hero.outfit, 0.6);
      rr(x, cx - 13, h - 20, 10, 16, 4); x.fill();
      rr(x, cx + 3, h - 20, 10, 16, 4); x.fill();
      // body
      x.fillStyle = hero.outfit;
      rr(x, cx - 15, h - 44, 30, 30, 9); x.fill();
      x.fillStyle = hero.accent;
      rr(x, cx - 15, h - 30, 30, 6, 3) ; x.fill(); // belt
      // arms
      x.fillStyle = hero.skin;
      x.beginPath(); x.arc(cx - 18, h - 34, 6, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 18, h - 34, 6, 0, 7); x.fill();
      // head (reuse face, scaled & positioned)
      x.save();
      x.translate(cx - 26, -4); x.scale(52 / 100, 52 / 100);
      drawFace(x, hero, 100);
      x.restore();
    });
  }

  // ---------------- Enemies ----------------
  const hsl = (h, s, l) => `hsl(${h},${s}%,${l}%)`;

  function minyar(hue) {
    return mk(56, 56, (x, w, h) => {
      if (overrides.minyar) { x.drawImage(overrides.minyar, 0, 0, w, h); return; }
      const cx = w / 2, cy = h / 2 + 4;
      // feet
      x.fillStyle = hsl(hue, 60, 28);
      x.beginPath(); x.ellipse(cx - 10, h - 6, 7, 5, 0, 0, 7); x.fill();
      x.beginPath(); x.ellipse(cx + 10, h - 6, 7, 5, 0, 0, 7); x.fill();
      // horn nubs
      x.fillStyle = hsl(hue, 45, 75);
      x.beginPath(); x.moveTo(cx - 14, cy - 14); x.lineTo(cx - 20, cy - 26); x.lineTo(cx - 7, cy - 19); x.fill();
      x.beginPath(); x.moveTo(cx + 14, cy - 14); x.lineTo(cx + 20, cy - 26); x.lineTo(cx + 7, cy - 19); x.fill();
      // blob body
      x.fillStyle = hsl(hue, 65, 48);
      x.beginPath(); x.ellipse(cx, cy, 19, 21, 0, 0, 7); x.fill();
      x.strokeStyle = hsl(hue, 70, 26); x.lineWidth = 2.5; x.stroke();
      // belly
      x.fillStyle = hsl(hue, 55, 62);
      x.beginPath(); x.ellipse(cx, cy + 8, 11, 9, 0, 0, 7); x.fill();
      // angry eyes
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(cx - 7, cy - 5, 5.5, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 7, cy - 5, 5.5, 0, 7); x.fill();
      x.fillStyle = '#1a1a1a';
      x.beginPath(); x.arc(cx - 6, cy - 4, 2.6, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 8, cy - 4, 2.6, 0, 7); x.fill();
      x.strokeStyle = hsl(hue, 70, 22); x.lineWidth = 2.5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - 12, cy - 12); x.lineTo(cx - 3, cy - 8); x.stroke();
      x.beginPath(); x.moveTo(cx + 12, cy - 12); x.lineTo(cx + 3, cy - 8); x.stroke();
      // grin with teeth
      x.fillStyle = hsl(hue, 70, 22);
      x.beginPath(); x.arc(cx, cy + 3, 7, 0.15, Math.PI - 0.15); x.fill();
      x.fillStyle = '#fff';
      x.beginPath(); x.moveTo(cx - 5, cy + 4); x.lineTo(cx - 2.5, cy + 8); x.lineTo(cx, cy + 4); x.lineTo(cx + 2.5, cy + 8); x.lineTo(cx + 5, cy + 4); x.fill();
    });
  }

  function demonder(hue) {
    return mk(84, 96, (x, w, h) => {
      if (overrides.demonder) { x.drawImage(overrides.demonder, 0, 0, w, h); return; }
      const cx = w / 2;
      // legs
      x.fillStyle = hsl(hue, 55, 22);
      rr(x, cx - 16, h - 26, 13, 22, 5); x.fill();
      rr(x, cx + 3, h - 26, 13, 22, 5); x.fill();
      // wings
      x.fillStyle = hsl(hue, 50, 18);
      x.beginPath(); x.moveTo(cx - 18, 42); x.quadraticCurveTo(cx - 44, 26, cx - 38, 54); x.quadraticCurveTo(cx - 30, 50, cx - 18, 56); x.fill();
      x.beginPath(); x.moveTo(cx + 18, 42); x.quadraticCurveTo(cx + 44, 26, cx + 38, 54); x.quadraticCurveTo(cx + 30, 50, cx + 18, 56); x.fill();
      // torso
      x.fillStyle = hsl(hue, 60, 34);
      rr(x, cx - 20, 34, 40, 42, 13); x.fill();
      x.strokeStyle = hsl(hue, 65, 16); x.lineWidth = 3; x.stroke();
      // pecs line
      x.strokeStyle = hsl(hue, 60, 22); x.lineWidth = 2;
      x.beginPath(); x.moveTo(cx, 46); x.lineTo(cx, 66); x.stroke();
      // arms with claws
      x.fillStyle = hsl(hue, 60, 30);
      x.beginPath(); x.arc(cx - 24, 58, 8, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 24, 58, 8, 0, 7); x.fill();
      x.fillStyle = '#eceff1';
      for (const s of [-1, 1]) for (let i = 0; i < 3; i++) {
        x.beginPath();
        x.moveTo(cx + s * (20 + i * 4), 62);
        x.lineTo(cx + s * (22 + i * 4), 72);
        x.lineTo(cx + s * (24 + i * 4), 62);
        x.fill();
      }
      // head
      x.fillStyle = hsl(hue, 62, 38);
      x.beginPath(); x.arc(cx, 26, 15, 0, 7); x.fill();
      x.strokeStyle = hsl(hue, 65, 16); x.lineWidth = 3; x.stroke();
      // big horns
      x.fillStyle = '#f5f5f5';
      x.beginPath(); x.moveTo(cx - 10, 16); x.quadraticCurveTo(cx - 26, 4, cx - 14, -2 + 8); x.quadraticCurveTo(cx - 12, 8, cx - 4, 13); x.fill();
      x.beginPath(); x.moveTo(cx + 10, 16); x.quadraticCurveTo(cx + 26, 4, cx + 14, 6); x.quadraticCurveTo(cx + 12, 8, cx + 4, 13); x.fill();
      // glowing eyes
      x.fillStyle = '#ffee58';
      x.beginPath(); x.ellipse(cx - 6, 25, 3.6, 2.4, 0.3, 0, 7); x.fill();
      x.beginPath(); x.ellipse(cx + 6, 25, 3.6, 2.4, -0.3, 0, 7); x.fill();
      // mouth fangs
      x.fillStyle = hsl(hue, 65, 14);
      x.beginPath(); x.arc(cx, 33, 6, 0.2, Math.PI - 0.2); x.fill();
      x.fillStyle = '#fff';
      x.beginPath(); x.moveTo(cx - 4, 34); x.lineTo(cx - 2.5, 38); x.lineTo(cx - 1, 34); x.fill();
      x.beginPath(); x.moveTo(cx + 4, 34); x.lineTo(cx + 2.5, 38); x.lineTo(cx + 1, 34); x.fill();
    });
  }

  function clubbo(hue) {
    return mk(120, 128, (x, w, h) => {
      if (overrides.clubbo) { x.drawImage(overrides.clubbo, 0, 0, w, h); return; }
      const cx = w / 2 - 6;
      // club (behind, raised right)
      x.save();
      x.translate(cx + 34, 52); x.rotate(0.5);
      x.fillStyle = '#6d4c41';
      rr(x, -6, -46, 12, 52, 5); x.fill();
      x.fillStyle = '#5d4037';
      x.beginPath(); x.ellipse(0, -50, 16, 20, 0, 0, 7); x.fill();
      x.fillStyle = '#8d6e63';
      for (const [sx, sy] of [[-7, -58], [6, -50], [-3, -42]]) {
        x.beginPath(); x.arc(sx, sy, 3, 0, 7); x.fill();
      }
      x.restore();
      // legs
      x.fillStyle = hsl(hue, 40, 26);
      rr(x, cx - 26, h - 32, 20, 28, 8); x.fill();
      rr(x, cx + 6, h - 32, 20, 28, 8); x.fill();
      // big belly body
      x.fillStyle = hsl(hue, 45, 40);
      x.beginPath(); x.ellipse(cx, 66, 38, 42, 0, 0, 7); x.fill();
      x.strokeStyle = hsl(hue, 50, 20); x.lineWidth = 4; x.stroke();
      // belly plate
      x.fillStyle = hsl(hue, 38, 52);
      x.beginPath(); x.ellipse(cx, 76, 22, 24, 0, 0, 7); x.fill();
      // loincloth
      x.fillStyle = '#795548';
      x.beginPath(); x.moveTo(cx - 22, 92); x.lineTo(cx + 22, 92); x.lineTo(cx + 12, 112); x.lineTo(cx - 12, 112); x.fill();
      // arms
      x.fillStyle = hsl(hue, 45, 36);
      x.beginPath(); x.arc(cx - 38, 62, 13, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 38, 46, 13, 0, 7); x.fill();
      // head sunk into shoulders
      x.fillStyle = hsl(hue, 45, 44);
      x.beginPath(); x.arc(cx, 28, 22, 0, 7); x.fill();
      x.strokeStyle = hsl(hue, 50, 20); x.lineWidth = 4; x.stroke();
      // single cyclops eye
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(cx, 24, 9, 0, 7); x.fill();
      x.strokeStyle = hsl(hue, 50, 20); x.lineWidth = 2.5; x.stroke();
      x.fillStyle = '#d32f2f';
      x.beginPath(); x.arc(cx, 24, 4.4, 0, 7); x.fill();
      x.fillStyle = '#000';
      x.beginPath(); x.arc(cx, 24, 2, 0, 7); x.fill();
      // heavy brow
      x.strokeStyle = hsl(hue, 50, 18); x.lineWidth = 5; x.lineCap = 'round';
      x.beginPath(); x.moveTo(cx - 12, 14); x.lineTo(cx + 12, 14); x.stroke();
      // underbite tusks
      x.fillStyle = hsl(hue, 50, 20);
      rr(x, cx - 12, 36, 24, 7, 3); x.fill();
      x.fillStyle = '#fff';
      x.beginPath(); x.moveTo(cx - 10, 38); x.lineTo(cx - 7, 31); x.lineTo(cx - 4, 38); x.fill();
      x.beginPath(); x.moveTo(cx + 10, 38); x.lineTo(cx + 7, 31); x.lineTo(cx + 4, 38); x.fill();
    });
  }

  function kingGlob() {
    return mk(220, 200, (x, w, h) => {
      if (overrides.kingglob) { x.drawImage(overrides.kingglob, 0, 0, w, h); return; }
      const cx = w / 2, base = h - 16;
      // drips
      x.fillStyle = '#66bb6a';
      for (const [dx, dw, dh] of [[-80, 14, 22], [-40, 10, 14], [30, 12, 18], [72, 15, 24], [0, 9, 12]]) {
        x.beginPath(); x.ellipse(cx + dx, base + 4, dw / 2, dh / 2, 0, 0, 7); x.fill();
      }
      // slime dome
      const g = x.createRadialGradient(cx - 30, 60, 20, cx, 110, 130);
      g.addColorStop(0, '#9ccc65'); g.addColorStop(0.7, '#558b2f'); g.addColorStop(1, '#33691e');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(cx - 95, base);
      x.bezierCurveTo(cx - 110, 70, cx - 60, 18, cx, 20);
      x.bezierCurveTo(cx + 60, 18, cx + 110, 70, cx + 95, base);
      x.closePath(); x.fill();
      x.strokeStyle = '#1b5e20'; x.lineWidth = 5; x.stroke();
      // glisten
      x.fillStyle = 'rgba(255,255,255,.25)';
      x.beginPath(); x.ellipse(cx - 45, 55, 22, 34, 0.5, 0, 7); x.fill();
      // trapped junk in the slime
      x.fillStyle = 'rgba(27,94,32,.55)';
      for (const [bx, by, br] of [[cx + 40, 120, 9], [cx - 55, 130, 7], [cx + 10, 150, 11], [cx - 20, 95, 6]]) {
        x.beginPath(); x.arc(bx, by, br, 0, 7); x.fill();
      }
      // crown
      x.fillStyle = '#ffd54f';
      x.beginPath();
      x.moveTo(cx - 34, 30); x.lineTo(cx - 34, 2); x.lineTo(cx - 17, 18); x.lineTo(cx, 0);
      x.lineTo(cx + 17, 18); x.lineTo(cx + 34, 2); x.lineTo(cx + 34, 30); x.fill();
      x.strokeStyle = '#a35c00'; x.lineWidth = 3; x.stroke();
      x.fillStyle = '#e53935';
      x.beginPath(); x.arc(cx, 24, 5, 0, 7); x.fill();
      // eyes: one huge, one small
      x.fillStyle = '#fff';
      x.beginPath(); x.arc(cx - 26, 72, 20, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 28, 68, 12, 0, 7); x.fill();
      x.strokeStyle = '#1b5e20'; x.lineWidth = 3;
      x.beginPath(); x.arc(cx - 26, 72, 20, 0, 7); x.stroke();
      x.beginPath(); x.arc(cx + 28, 68, 12, 0, 7); x.stroke();
      x.fillStyle = '#bf360c';
      x.beginPath(); x.arc(cx - 22, 74, 9, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 30, 70, 5.5, 0, 7); x.fill();
      x.fillStyle = '#000';
      x.beginPath(); x.arc(cx - 22, 74, 4, 0, 7); x.fill();
      x.beginPath(); x.arc(cx + 30, 70, 2.5, 0, 7); x.fill();
      // vast grin
      x.fillStyle = '#1b5e20';
      x.beginPath(); x.arc(cx, 108, 46, 0.25, Math.PI - 0.25); x.fill();
      x.fillStyle = '#fff';
      for (let i = 0; i < 7; i++) {
        const tx = cx - 36 + i * 12;
        x.beginPath(); x.moveTo(tx, 116); x.lineTo(tx + 6, 130 + (i % 2) * 4); x.lineTo(tx + 12, 116); x.fill();
      }
      // tongue
      x.fillStyle = '#e57373';
      x.beginPath(); x.ellipse(cx + 8, 138, 18, 9, 0.1, 0, Math.PI); x.fill();
    });
  }

  // ---------------- Cage ----------------
  function cage(heroIdx) {
    const P = portrait(heroIdx, 40);
    return mk(76, 88, (x, w, h) => {
      if (overrides.cage) { x.drawImage(overrides.cage, 0, 0, w, h); }
      else {
        // dark interior
        x.fillStyle = 'rgba(10,20,16,.88)';
        rr(x, 8, 10, w - 16, h - 18, 10); x.fill();
        // trapped hero, dimmed
        x.save(); x.globalAlpha = 0.85;
        x.drawImage(P, w / 2 - 20, h / 2 - 18);
        x.restore();
        x.fillStyle = 'rgba(20,40,30,.45)';
        rr(x, 8, 10, w - 16, h - 18, 10); x.fill();
        // bamboo bars
        for (let i = 0; i < 5; i++) {
          const bx = 10 + i * (w - 24) / 4;
          const g = x.createLinearGradient(bx, 0, bx + 7, 0);
          g.addColorStop(0, '#8d6e63'); g.addColorStop(0.5, '#d7a86e'); g.addColorStop(1, '#795548');
          x.fillStyle = g;
          rr(x, bx, 6, 7, h - 10, 3); x.fill();
          x.fillStyle = '#5d4037';
          x.fillRect(bx, h * 0.4, 7, 2); x.fillRect(bx, h * 0.72, 7, 2);
        }
        // top & bottom bands
        x.fillStyle = '#4e342e';
        rr(x, 4, 2, w - 8, 9, 4); x.fill();
        rr(x, 4, h - 9, w - 8, 8, 4); x.fill();
        // cursed glow knot
        x.fillStyle = '#7e57c2';
        x.beginPath(); x.arc(w / 2, 6, 5, 0, 7); x.fill();
        x.fillStyle = '#d1c4e9';
        x.beginPath(); x.arc(w / 2, 6, 2.2, 0, 7); x.fill();
      }
    });
  }

  // ---------------- Pickups ----------------
  function gem(color, s) {
    return mk(s, s, (x, w, h) => {
      if (overrides.gem) { x.drawImage(overrides.gem, 0, 0, w, h); return; }
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
      if (overrides.heart) { x.drawImage(overrides.heart, 0, 0, w, h); return; }
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
      if (overrides.ground) { x.drawImage(overrides.ground, 0, 0, w, h); return; }
      x.fillStyle = '#2f6b3d'; x.fillRect(0, 0, w, h);
      let seed = 7;
      const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
      // mottled darker patches
      for (let i = 0; i < 26; i++) {
        x.fillStyle = `rgba(20,60,32,${0.12 + rnd() * 0.12})`;
        x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 14 + rnd() * 30, 10 + rnd() * 22, rnd() * 3, 0, 7); x.fill();
      }
      // sandy patches
      for (let i = 0; i < 6; i++) {
        x.fillStyle = 'rgba(194,178,128,.10)';
        x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 18 + rnd() * 26, 12 + rnd() * 18, rnd() * 3, 0, 7); x.fill();
      }
      // grass tufts
      x.strokeStyle = 'rgba(140,200,110,.5)'; x.lineWidth = 1.6; x.lineCap = 'round';
      for (let i = 0; i < 46; i++) {
        const gx = rnd() * w, gy = rnd() * h;
        for (let b = -1; b <= 1; b++) {
          x.beginPath(); x.moveTo(gx, gy); x.lineTo(gx + b * 3, gy - 5 - rnd() * 3); x.stroke();
        }
      }
      // tiny flowers
      for (let i = 0; i < 10; i++) {
        x.fillStyle = ['#f8bbd0', '#fff59d', '#e1bee7'][i % 3];
        x.beginPath(); x.arc(rnd() * w, rnd() * h, 2, 0, 7); x.fill();
      }
    });
  }

  function palm() {
    return mk(96, 120, (x, w, h) => {
      if (overrides.palm) { x.drawImage(overrides.palm, 0, 0, w, h); return; }
      const bx = w / 2;
      x.fillStyle = 'rgba(0,0,0,.22)';
      x.beginPath(); x.ellipse(bx, h - 8, 24, 8, 0, 0, 7); x.fill();
      // trunk
      x.strokeStyle = '#8d6e63'; x.lineWidth = 9; x.lineCap = 'round';
      x.beginPath(); x.moveTo(bx - 6, h - 10); x.quadraticCurveTo(bx + 4, h - 60, bx + 12, 36); x.stroke();
      x.strokeStyle = '#6d4c41'; x.lineWidth = 2;
      for (let i = 1; i < 6; i++) {
        const t = i / 6;
        const px = bx - 6 + (bx + 12 - (bx - 6)) * t, py = (h - 10) + (36 - (h - 10)) * t;
        x.beginPath(); x.moveTo(px - 5, py); x.lineTo(px + 5, py); x.stroke();
      }
      // fronds
      x.strokeStyle = '#388e3c'; x.lineWidth = 7; x.lineCap = 'round';
      for (let i = 0; i < 6; i++) {
        const a = -0.4 - i * 0.45;
        x.beginPath(); x.moveTo(bx + 12, 36);
        x.quadraticCurveTo(bx + 12 + Math.cos(a) * 30, 36 + Math.sin(a) * 30 - 8, bx + 12 + Math.cos(a) * 44, 36 + Math.sin(a) * 44 + 10);
        x.stroke();
      }
      // coconuts
      x.fillStyle = '#5d4037';
      x.beginPath(); x.arc(bx + 7, 42, 5, 0, 7); x.fill();
      x.beginPath(); x.arc(bx + 17, 44, 5, 0, 7); x.fill();
    });
  }

  function rock() {
    return mk(60, 44, (x, w, h) => {
      if (overrides.rock) { x.drawImage(overrides.rock, 0, 0, w, h); return; }
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
      if (overrides.bush) { x.drawImage(overrides.bush, 0, 0, w, h); return; }
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
    // Optional PNG overrides listed in assets/manifest.json
    try {
      const res = await fetch('assets/manifest.json');
      if (res.ok) {
        const list = await res.json();
        await Promise.all(list.map(f => new Promise(done => {
          const img = new Image();
          img.onload = () => { overrides[f.replace(/\.png$/i, '')] = img; done(); };
          img.onerror = () => done();
          img.src = 'assets/img/' + f;
        })));
      }
    } catch (e) { /* no manifest — pure procedural art */ }

    // Pre-render everything heavy up front
    TIERS.forEach((t, i) => {
      get('minyar' + i, () => minyar(t.hue));
      get('demonder' + i, () => demonder(t.hue));
      get('clubbo' + i, () => clubbo(t.hue));
    });
    get('boss', kingGlob);
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
