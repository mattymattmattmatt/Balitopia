const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' });
  const p = await b.newPage({ viewport: { width: 900, height: 460 } });
  const errs = [];
  p.on('pageerror', e => errs.push('pageerror: ' + e));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  await p.goto('http://localhost:8811/index.html', { waitUntil: 'networkidle' });
  await p.waitForTimeout(500);

  const out = await p.evaluate(async () => {
    const B = window.__balitopia, log = [];
    const ok = (name, cond, extra) => log.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${extra ? '  ' + extra : ''}`);

    // 1. every preset applies and resizes without throwing
    for (const q of ['high', 'balanced', 'battery', 'perf']) {
      let threw = null;
      try { B.applyQuality(q); } catch (e) { threw = String(e); }
      ok(`applyQuality(${q})`, !threw, threw || `view ${B.viewInfo().w}x${B.viewInfo().h}`);
    }

    // 2. camera widens with squad size
    B.applyQuality('balanced');
    B.newGame(0, 0);
    await new Promise(r => setTimeout(r, 400));
    const solo = B.viewInfo();
    const cages = B.cages();
    for (let i = 0; i < 23 && i < cages.length; i++) B.breakCage(cages[i]);
    await new Promise(r => setTimeout(r, 1200));
    const full = B.viewInfo();
    ok('view widens with roster', full.w > solo.w, `${solo.w}x${solo.h} -> ${full.w}x${full.h} (mul ${full.mul})`);

    // 3. music rotates on each Glob kill, biome does NOT
    const region0 = B.G.region, biome0 = B.G.biome;
    const seen = [];
    for (let i = 0; i < 4; i++) { B.G.musicRot = i; seen.push(B.battleTrack()); }
    ok('music rotates per Glob kill', new Set(seen.slice(0, 3)).size === 3, seen.join(' -> '));
    ok('rotation starts on run region', seen[0] === region0);
    ok('biome unchanged by rotation', B.G.region === region0 && B.G.biome === biome0);
    B.G.musicRot = 0;

    // 4. enemy cap holds under natural spawning
    // pin the preset: on a fast machine auto-quality climbs the ladder back
    // up mid-test and takes the cap with it
    B.prefs().quality = 'perf';
    B.applyQuality('perf');
    B.G.time = 240;                      // late-run spawn rate
    let peak = 0;
    for (let i = 0; i < 240; i++) { B.G.spawnAcc = 40; await new Promise(r => requestAnimationFrame(r)); peak = Math.max(peak, B.G.aliveEnemies || 0); }
    ok("perf cap holds", peak <= 152, `peak alive ${peak} (cap 150)`);

    // 5. unlock cascade still fires
    const save = B.loadSave();
    const before = save.unlocked.length;
    const got = B.checkUnlocks(save, { bossKills: 1, freed: 8, round: 2, diff: 1, maxTier: 2,
      kills: 300, level: 20, time: 200, bestCombo: 10, crits: 100, dashes: 60, chests: 3,
      eliteKills: 1, minibossKills: 1, possessCount: 5, healed: false, bestPowershot: 25,
      relicCount: 2, maxRelicLv: 4, codexComplete: false });
    ok('unlocks fire', got.length > 0, `+${got.length} (${before} -> ${save.unlocked.length})`);

    return log;
  });

  out.forEach(l => console.log('  ' + l));
  console.log('\nerrors:', errs.length);
  errs.slice(0, 5).forEach(e => console.log('  ', e));
  await b.close();
  process.exit(out.some(l => l.startsWith('FAIL')) || errs.length ? 1 : 0);
})();
