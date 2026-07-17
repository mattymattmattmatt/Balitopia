// Compose a cinematic "Fall of Balitopia" story backdrop (1920x1080).
// Moody dusk: erupting volcano, King Glob looming as a dark silhouette,
// glowing bamboo cages scattered through a jungle, rising embers.
// Kept dark toward the center so the story text panel stays readable.
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
    let seed = 9;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;

    const load = src => new Promise((res, rej) => {
      const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(src)); i.src = src;
    });
    const glob = await load('/assets/art/enemy_kingglob.png');

    // ---------- sky ----------
    let g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0a0713');
    g.addColorStop(0.42, '#170a1e');
    g.addColorStop(0.72, '#3a0f22');
    g.addColorStop(1, '#5e1a1c');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    // volcano glow on the horizon (right-of-center)
    x.save(); x.globalCompositeOperation = 'lighter';
    g = x.createRadialGradient(1180, 780, 40, 1180, 780, 720);
    g.addColorStop(0, 'rgba(255,150,40,.55)');
    g.addColorStop(0.4, 'rgba(220,70,30,.28)');
    g.addColorStop(1, 'rgba(120,20,20,0)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.restore();

    // stars / ash in the upper sky
    x.save(); x.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 90; i++) {
      const sx = rnd() * W, sy = rnd() * H * 0.5;
      x.fillStyle = `rgba(255,230,200,${0.05 + rnd() * 0.28})`;
      x.beginPath(); x.arc(sx, sy, 0.6 + rnd() * 1.6, 0, 7); x.fill();
    }
    x.restore();

    // ---------- King Glob: vast dark silhouette rising behind the peak ----------
    (() => {
      const gh = 1120, gw = glob.width / glob.height * gh;
      const cx = 1230, base = 1010;
      // tint the throne-king render into a dark red-lit silhouette
      const t = document.createElement('canvas');
      t.width = glob.width; t.height = glob.height;
      const tx = t.getContext('2d');
      tx.drawImage(glob, 0, 0);
      tx.globalCompositeOperation = 'source-atop';
      const sg = tx.createLinearGradient(0, 0, 0, glob.height);
      sg.addColorStop(0, 'rgba(40,10,30,.94)');
      sg.addColorStop(1, 'rgba(15,4,12,.99)');
      tx.fillStyle = sg; tx.fillRect(0, 0, glob.width, glob.height);
      // red rim
      x.save();
      x.shadowColor = 'rgba(255,60,60,.85)'; x.shadowBlur = 90;
      x.globalAlpha = 0.9;
      x.drawImage(t, cx - gw / 2, base - gh, gw, gh);
      x.restore();
      // menacing eye glow
      x.save(); x.globalCompositeOperation = 'lighter';
      for (const [ex, ey, r] of [[cx - 78, base - gh * 0.72, 26], [cx + 46, base - gh * 0.73, 20]]) {
        g = x.createRadialGradient(ex, ey, 2, ex, ey, r);
        g.addColorStop(0, 'rgba(255,80,60,.95)'); g.addColorStop(1, 'rgba(255,40,40,0)');
        x.fillStyle = g; x.beginPath(); x.arc(ex, ey, r, 0, 7); x.fill();
      }
      x.restore();
    })();

    // ---------- volcano / mountain ridge ----------
    const ridgeY = 760;
    x.beginPath();
    x.moveTo(0, H);
    x.lineTo(0, ridgeY + 120);
    const pts = [[0, ridgeY + 120], [240, ridgeY + 40], [520, ridgeY + 90], [820, ridgeY - 10],
                 [1050, ridgeY + 20], [1180, ridgeY - 130], [1320, ridgeY + 30],
                 [1600, ridgeY - 20], [1920, ridgeY + 80]];
    pts.forEach(([px, py]) => x.lineTo(px, py));
    x.lineTo(W, H); x.closePath();
    g = x.createLinearGradient(0, ridgeY - 130, 0, H);
    g.addColorStop(0, '#120a16'); g.addColorStop(1, '#070409');
    x.fillStyle = g; x.fill();

    // lava crack out of the peak (~1180)
    x.save(); x.globalCompositeOperation = 'lighter';
    x.strokeStyle = 'rgba(255,140,40,.9)'; x.lineWidth = 5; x.lineCap = 'round';
    x.shadowColor = 'rgba(255,120,30,.9)'; x.shadowBlur = 26;
    let lx = 1180, ly = ridgeY - 130;
    x.beginPath(); x.moveTo(lx, ly);
    for (let i = 0; i < 6; i++) { lx += (rnd() - 0.5) * 60; ly += 40 + rnd() * 30; x.lineTo(lx, ly); }
    x.stroke();
    // embers rising from the crater
    for (let i = 0; i < 60; i++) {
      const ex = 1180 + (rnd() - 0.5) * 260, ey = ridgeY - 130 - rnd() * 320;
      x.fillStyle = `rgba(255,${120 + rnd() * 100 | 0},40,${0.15 + rnd() * 0.5})`;
      x.beginPath(); x.arc(ex, ey, 0.8 + rnd() * 2.4, 0, 7); x.fill();
    }
    x.restore();

    // ---------- glowing bamboo cages scattered in the jungle ----------
    function cage(px, py, s, hue) {
      x.save();
      x.translate(px, py); x.scale(s, s);
      // ground glow
      x.save(); x.globalCompositeOperation = 'lighter';
      g = x.createRadialGradient(0, 20, 4, 0, 20, 70);
      g.addColorStop(0, `hsla(${hue},80%,60%,.5)`); g.addColorStop(1, 'hsla(0,0%,0%,0)');
      x.fillStyle = g; x.beginPath(); x.ellipse(0, 30, 60, 20, 0, 0, 7); x.fill();
      x.restore();
      // captive glow
      x.save(); x.globalCompositeOperation = 'lighter';
      g = x.createRadialGradient(0, 0, 2, 0, 0, 32);
      g.addColorStop(0, `hsla(${hue},90%,72%,.9)`); g.addColorStop(1, 'hsla(0,0%,0%,0)');
      x.fillStyle = g; x.beginPath(); x.arc(0, 0, 32, 0, 7); x.fill();
      x.restore();
      // bamboo bars
      x.strokeStyle = '#0b0a08'; x.lineWidth = 5;
      x.fillStyle = 'rgba(20,16,10,.65)';
      x.beginPath(); x.rect(-26, -34, 52, 68); x.fill();
      for (let i = -2; i <= 2; i++) {
        x.strokeStyle = `hsla(35,45%,${28 + Math.abs(i) * 3}%,.95)`;
        x.lineWidth = 5;
        x.beginPath(); x.moveTo(i * 12, -36); x.lineTo(i * 12, 36); x.stroke();
      }
      x.strokeStyle = '#2a1c10'; x.lineWidth = 6;
      x.beginPath(); x.moveTo(-28, -34); x.lineTo(28, -34); x.moveTo(-28, 34); x.lineTo(28, 34); x.stroke();
      // curse knot
      x.save(); x.globalCompositeOperation = 'lighter';
      x.fillStyle = `hsla(${hue},90%,70%,.95)`;
      x.beginPath(); x.arc(0, -40, 5, 0, 7); x.fill();
      x.restore();
      x.restore();
    }
    cage(300, 690, 1.15, 275);
    cage(560, 730, 0.9, 190);
    cage(150, 760, 1.0, 48);
    cage(760, 700, 0.8, 320);
    cage(950, 745, 0.72, 150);

    // ---------- foreground palm silhouettes ----------
    function palm(px, py, s, flip) {
      x.save();
      x.translate(px, py); x.scale((flip ? -1 : 1) * s, s);
      x.strokeStyle = '#050307'; x.lineWidth = 16; x.lineCap = 'round';
      x.beginPath(); x.moveTo(0, 0); x.quadraticCurveTo(30, -160, 70, -300); x.stroke();
      x.lineWidth = 13;
      for (let i = 0; i < 6; i++) {
        const a = -0.5 - i * 0.5;
        x.beginPath(); x.moveTo(70, -300);
        x.quadraticCurveTo(70 + Math.cos(a) * 90, -300 + Math.sin(a) * 90, 70 + Math.cos(a) * 150, -300 + Math.sin(a) * 150 + 40);
        x.stroke();
      }
      x.restore();
    }
    palm(120, H + 20, 1.2, false);
    palm(1850, H + 30, 1.35, true);
    palm(1650, H + 40, 0.9, true);

    // ---------- foreground jungle band ----------
    g = x.createLinearGradient(0, H - 180, 0, H);
    g.addColorStop(0, 'rgba(4,7,5,0)'); g.addColorStop(1, 'rgba(2,5,3,.95)');
    x.fillStyle = g; x.fillRect(0, H - 180, W, 180);

    // ---------- readability: dark center + vignette ----------
    g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(3,4,10,.5)');
    g.addColorStop(0.4, 'rgba(3,4,10,.32)');
    g.addColorStop(1, 'rgba(3,4,10,.15)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    g = x.createRadialGradient(W / 2, H / 2, H * 0.3, W / 2, H / 2, H);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.6)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);

    await window.saveFile('assets/img/story_bg.jpg', c.toDataURL('image/jpeg', 0.86));
  });

  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
