// Compose VS-style title key art from the character renders.
// Heroes left (light, neon good-guy glow) vs villains right (dark, evil glow),
// energy rift down the middle, center band kept dark for the menu.
const { chromium } = require('playwright-core');
const fs = require('fs');

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell' });
  const page = await browser.newPage();
  await page.exposeFunction('saveFile', (rel, dataUrl) => {
    fs.writeFileSync('/home/user/Balitopia/' + rel, Buffer.from(dataUrl.split(',')[1], 'base64'));
    console.log('wrote', rel);
  });
  await page.goto('http://localhost:8901/index.html');

  await page.evaluate(async () => {
    const W = 1920, H = 1080;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');

    const load = src => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src;
    });
    // flood-key light background (white/checker) from the borders
    const keyBg = img => {
      const kc = document.createElement('canvas');
      kc.width = img.width; kc.height = img.height;
      const kx = kc.getContext('2d', { willReadFrequently: true });
      kx.drawImage(img, 0, 0);
      const d = kx.getImageData(0, 0, kc.width, kc.height);
      const px = d.data, W2 = kc.width, H2 = kc.height;
      const isBg = i => px[i] > 190 && px[i + 1] > 190 && px[i + 2] > 190;
      const seen = new Uint8Array(W2 * H2); const stack = [];
      for (let i = 0; i < W2; i++) stack.push(i, (H2 - 1) * W2 + i);
      for (let j = 0; j < H2; j++) stack.push(j * W2, j * W2 + W2 - 1);
      while (stack.length) {
        const p = stack.pop(); if (seen[p]) continue; seen[p] = 1;
        const i4 = p * 4; if (!isBg(i4)) continue;
        px[i4 + 3] = 0;
        const xx = p % W2, yy = (p / W2) | 0;
        if (xx > 0) stack.push(p - 1); if (xx < W2 - 1) stack.push(p + 1);
        if (yy > 0) stack.push(p - W2); if (yy < H2 - 1) stack.push(p + W2);
      }
      kx.putImageData(d, 0, 0);
      return kc;
    };
    const hero = id => load(`/assets/art/hero_${id}.png`);
    const imgs = {};
    const heroIds = ['chomper','fygar','waterwolf','swack','bo','creeper','zappo','fixie','snapper','flick','gus','yelp','sixter','whipper','cliggy','skyjumper','fertle','stinger'];
    for (const id of heroIds) imgs[id] = await (id === 'bo' ? load('/assets/art/hero_bo.png') : hero(id));
    imgs.fixie = keyBg(imgs.fixie);   // fixie's render has a baked white/checker bg
    imgs.kingglob = await load('/assets/art/enemy_kingglob.png');
    imgs.clubbo = await load('/assets/art/enemy_clubbo.png');
    imgs.demonder = await load('/assets/art/enemy_demonder.png');
    imgs.minyar = await load('/assets/art/enemy_minyar.png');

    // ---------- background ----------
    // left: living jungle light
    let g = x.createRadialGradient(430, 520, 80, 430, 520, 1150);
    g.addColorStop(0, '#2f8a5f'); g.addColorStop(0.55, '#14503a'); g.addColorStop(1, '#07271d');
    x.fillStyle = g; x.fillRect(0, 0, W / 2 + 80, H);
    // right: corrupted dark
    g = x.createRadialGradient(1500, 520, 80, 1500, 520, 1150);
    g.addColorStop(0, '#5c1030'); g.addColorStop(0.55, '#2a0a20'); g.addColorStop(1, '#0b040e');
    x.fillStyle = g; x.fillRect(W / 2 - 80, 0, W / 2 + 80, H);
    // blend the seam region
    g = x.createLinearGradient(W / 2 - 180, 0, W / 2 + 180, 0);
    g.addColorStop(0, 'rgba(20,80,58,0)'); g.addColorStop(0.5, 'rgba(10,10,18,.85)'); g.addColorStop(1, 'rgba(42,10,32,0)');
    x.fillStyle = g; x.fillRect(W / 2 - 180, 0, 360, H);

    // light rays (left, golden)
    x.save(); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 7; i++) {
      x.save();
      x.translate(120, -60); x.rotate(0.5 + i * 0.14);
      const rg = x.createLinearGradient(0, 0, 0, 1400);
      rg.addColorStop(0, 'rgba(255,224,130,.10)'); rg.addColorStop(1, 'rgba(255,224,130,0)');
      x.fillStyle = rg; x.fillRect(-28, 0, 56, 1500);
      x.restore();
    }
    // evil rays (right, blood red)
    for (let i = 0; i < 6; i++) {
      x.save();
      x.translate(1820, -80); x.rotate(-0.5 - i * 0.15);
      const rg = x.createLinearGradient(0, 0, 0, 1400);
      rg.addColorStop(0, 'rgba(255,50,80,.09)'); rg.addColorStop(1, 'rgba(255,50,80,0)');
      x.fillStyle = rg; x.fillRect(-26, 0, 52, 1500);
      x.restore();
    }
    x.restore();

    // particles: sparkles left, embers right
    let seed = 42;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    x.save(); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 130; i++) {
      const lx = rnd() * 880, ly = rnd() * H, r = 1 + rnd() * 2.6;
      x.fillStyle = `rgba(${rnd() < 0.5 ? '160,255,220' : '255,235,150'},${0.15 + rnd() * 0.5})`;
      x.beginPath(); x.arc(lx, ly, r, 0, 7); x.fill();
    }
    for (let i = 0; i < 130; i++) {
      const rx2 = 1040 + rnd() * 880, ry = rnd() * H, r = 1 + rnd() * 2.6;
      x.fillStyle = `rgba(${rnd() < 0.5 ? '255,80,90' : '200,70,255'},${0.15 + rnd() * 0.5})`;
      x.beginPath(); x.arc(rx2, ry, r, 0, 7); x.fill();
    }
    x.restore();

    // ---------- energy rift down the middle ----------
    const rift = [];
    let ry = -40, rx = W / 2;
    while (ry < H + 40) { rift.push([rx, ry]); ry += 70 + rnd() * 60; rx = W / 2 + (rnd() - 0.5) * 90; }
    const strokeRift = (color, width, blur) => {
      x.save();
      x.strokeStyle = color; x.lineWidth = width; x.lineCap = 'round'; x.lineJoin = 'round';
      x.shadowColor = color; x.shadowBlur = blur;
      x.beginPath();
      rift.forEach(([px, py], i) => i ? x.lineTo(px, py) : x.moveTo(px, py));
      x.stroke(); x.restore();
    };
    strokeRift('rgba(120,255,220,.6)', 14, 80);
    strokeRift('rgba(255,80,160,.55)', 7, 50);
    strokeRift('rgba(255,255,255,.95)', 3.5, 30);
    // sparks off the rift
    x.save(); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 26; i++) {
      const [px, py] = rift[(rnd() * rift.length) | 0];
      x.strokeStyle = `rgba(180,255,240,${0.3 + rnd() * 0.5})`;
      x.lineWidth = 1.6;
      x.beginPath(); x.moveTo(px, py);
      x.lineTo(px + (rnd() - 0.5) * 130, py + (rnd() - 0.5) * 90);
      x.stroke();
    }
    x.restore();

    // ---------- character drawing helpers ----------
    const tintCache = document.createElement('canvas');
    function drawChar(img, cx, cy, h, { glow = '#7dffd4', blur = 34, alpha = 1, flip = false, silhouette = null } = {}) {
      const w = img.width / img.height * h;
      let src = img;
      if (silhouette) {
        tintCache.width = img.width; tintCache.height = img.height;
        const tx = tintCache.getContext('2d');
        tx.clearRect(0, 0, img.width, img.height);
        tx.drawImage(img, 0, 0);
        tx.globalCompositeOperation = 'source-atop';
        tx.fillStyle = silhouette;
        tx.fillRect(0, 0, img.width, img.height);
        src = tintCache;
      }
      x.save();
      x.translate(cx, cy);
      if (flip) x.scale(-1, 1);
      x.globalAlpha = alpha;
      x.shadowColor = glow; x.shadowBlur = blur;
      x.drawImage(src, -w / 2, -h, w, h);
      x.drawImage(src, -w / 2, -h, w, h);
      x.restore();
      // ground glow
      x.save();
      x.globalAlpha = alpha * 0.4;
      const gg = x.createRadialGradient(cx, cy, 4, cx, cy, w * 0.5);
      gg.addColorStop(0, glow); gg.addColorStop(1, 'rgba(0,0,0,0)');
      x.fillStyle = gg;
      x.beginPath(); x.ellipse(cx, cy + 6, w * 0.5, w * 0.14, 0, 0, 7); x.fill();
      x.restore();
    }

    // ---------- THE GOOD (left, facing right) ----------
    // back rank: dim spirit silhouettes
    drawChar(imgs.skyjumper, 130, 420, 190, { silhouette: 'rgba(140,235,200,.85)', alpha: .35, glow: '#7dffd4', blur: 26 });
    drawChar(imgs.fertle,    320, 400, 180, { silhouette: 'rgba(140,235,200,.85)', alpha: .35, glow: '#7dffd4', blur: 26 });
    drawChar(imgs.stinger,   520, 390, 175, { silhouette: 'rgba(140,235,200,.85)', alpha: .35, glow: '#7dffd4', blur: 26 });
    drawChar(imgs.gus,       700, 410, 190, { silhouette: 'rgba(140,235,200,.85)', alpha: .35, glow: '#7dffd4', blur: 26 });
    // mid rank
    drawChar(imgs.creeper, 180, 640, 265, { glow: '#c77dff', blur: 30, alpha: .92 });
    drawChar(imgs.zappo,   395, 615, 250, { glow: '#d9ff6e', blur: 30, alpha: .92 });
    drawChar(imgs.fixie,   590, 630, 255, { glow: '#7dd8ff', blur: 30, alpha: .92 });
    drawChar(imgs.snapper, 780, 650, 260, { glow: '#ffb27d', blur: 30, alpha: .92 });
    // bo soaring above
    drawChar(imgs.bo, 460, 330, 210, { glow: '#ffd54f', blur: 36 });
    // front rank: the champions
    drawChar(imgs.chomper,   170, 1010, 400, { glow: '#59d8ff', blur: 44 });
    drawChar(imgs.fygar,     430, 1035, 385, { glow: '#ffc84f', blur: 44 });
    drawChar(imgs.waterwolf, 660, 1020, 400, { glow: '#4fffc1', blur: 44 });
    drawChar(imgs.swack,     820, 1040, 370, { glow: '#ff7d7d', blur: 44 });

    // ---------- THE EVIL (right, flipped to face left) ----------
    // King Glob looms behind everything
    drawChar(imgs.kingglob, 1660, 760, 680, { glow: '#ff2d55', blur: 70, flip: true, alpha: .96 });
    // minyar horde silhouettes
    drawChar(imgs.minyar, 1160, 460, 170, { silhouette: 'rgba(90,20,60,.9)', alpha: .5, glow: '#ff2d75', blur: 24, flip: true });
    drawChar(imgs.minyar, 1300, 430, 185, { silhouette: 'rgba(90,20,60,.9)', alpha: .5, glow: '#ff2d75', blur: 24, flip: true });
    drawChar(imgs.minyar, 1450, 450, 175, { silhouette: 'rgba(90,20,60,.9)', alpha: .5, glow: '#ff2d75', blur: 24, flip: true });
    drawChar(imgs.minyar, 1830, 470, 190, { silhouette: 'rgba(90,20,60,.9)', alpha: .5, glow: '#ff2d75', blur: 24, flip: true });
    // demonder mid
    drawChar(imgs.demonder, 1210, 690, 300, { glow: '#c74dff', blur: 40, flip: true });
    drawChar(imgs.demonder, 1815, 700, 280, { glow: '#ff4d6a', blur: 36, flip: true, alpha: .9 });
    // clubbo front
    drawChar(imgs.clubbo, 1420, 1050, 430, { glow: '#ff6b2d', blur: 48, flip: true });
    // minyar goons front
    drawChar(imgs.minyar, 1180, 1040, 210, { glow: '#ff2d75', blur: 30, flip: true });
    drawChar(imgs.minyar, 1730, 1055, 230, { glow: '#c74dff', blur: 30, flip: true });

    // ---------- center menu band + vignette ----------
    g = x.createLinearGradient(W / 2 - 250, 0, W / 2 + 250, 0);
    g.addColorStop(0, 'rgba(4,10,14,0)'); g.addColorStop(0.5, 'rgba(3,8,12,.66)'); g.addColorStop(1, 'rgba(4,10,14,0)');
    x.fillStyle = g; x.fillRect(W / 2 - 250, 0, 500, H);
    g = x.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, H * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.55)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    await window.saveFile('assets/img/title_vs.jpg', c.toDataURL('image/jpeg', 0.86));
  });

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
