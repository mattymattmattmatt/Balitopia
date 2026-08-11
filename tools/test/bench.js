const { chromium } = require('playwright');
const THROTTLE = +(process.env.THROTTLE || 4);
const NAMES = ['high', 'balanced', 'battery', 'perf'];
const REPS = 3;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 900, height: 460 } });
  const errs = [];
  p.on('pageerror', e => errs.push(String(e)));
  await p.goto('http://localhost:8811/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(400);
  const cdp = await p.context().newCDPSession(p);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });

  const res = await p.evaluate(async ({ names, reps }) => {
    const B = window.__balitopia;
    const acc = {}, extra = {};
    for (let rep = 0; rep < reps; rep++) {
      for (const nm of names) {
        B.newGame(0, 0);
        await new Promise(r => setTimeout(r, 300));
        B.applyQuality(nm);
        const cages = B.cages();
        for (let i = 0; i < 18 && i < cages.length; i++) B.breakCage(cages[i]);
        const pl = B.player();
        // spawn well past every cap so the limiter is what decides the count
        const capN = B.getQL().maxEnemies || 300;
        for (let i = 0; i < capN; i++) {
          const a = Math.random() * 6.283, dd = 240 + Math.random() * 400;
          B.spawnEnemy(i % 7 === 0 ? 'demonder' : 'minyar', i % 5 === 0 ? 1 : 0,
                       pl.x + Math.cos(a) * dd, pl.y + Math.sin(a) * dd);
        }
        await new Promise(r => setTimeout(r, 600));
        const t0 = performance.now(); let f = 0;
        await new Promise(done => {
          const tick = () => { f++; if (performance.now() - t0 < 2500) requestAnimationFrame(tick); else done(); };
          requestAnimationFrame(tick);
        });
        (acc[nm] = acc[nm] || []).push(+(f / ((performance.now() - t0) / 1000)).toFixed(1));
        extra[nm] = { view: B.viewInfo(), alive: B.G.aliveEnemies };
      }
    }
    return { acc, extra };
  }, { names: NAMES, reps: REPS });

  console.log(`throttle=${THROTTLE}x  ·  ${REPS} runs  ·  300 spawned, 18 allies\n`);
  for (const nm of NAMES) {
    const v = res.acc[nm], med = [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
    const e = res.extra[nm];
    console.log(`  ${nm.padEnd(9)} median ${String(med).padStart(5)} fps  · alive ${String(e.alive).padStart(3)} · view ${e.view.w}x${e.view.h}  runs: ${v.join(', ')}`);
  }
  console.log('\npage errors:', errs.length, errs.slice(0,2).join(' | '));
  await b.close();
})();
