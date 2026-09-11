const test = require('node:test');
const assert = require('node:assert/strict');
const Gore = require('../../js/gore');
const { harness } = require('./simulation-harness');

function host() {
  const canvases = [], calls = [];
  const noop = () => {};
  const makeCanvas = () => {
    const c = { width: 1, height: 1 };
    c.ctx = new Proxy({ drawImage: (...args) => calls.push({ canvas: c, args }) }, {
      get: (o, key) => key in o ? o[key] : noop,
    });
    c.getContext = () => c.ctx; canvases.push(c); return c;
  };
  const gore = Gore.create({ makeCanvas, world: 5200 });
  gore.configure({ level: 'full', bits: 240, tiles: 48, burst: 96 }); gore.reset(73);
  return { gore, canvases, calls, clearCalls: () => { calls.length = 0; } };
}

test('a death throws fragments, which settle into persistent ground stains', () => {
  const { gore, calls, clearCalls } = host();
  gore.burst(900, 900, 25, 18, { blast: true, fromX: 800, fromY: 900 });
  assert.equal(gore.stats().active, 30);
  assert(gore.fragments().every(p => p.vx > 0), 'blast pushes fragments away from its origin');
  for (let i = 0; i < 240; i++) gore.update(1/60);
  assert.equal(gore.stats().active, 0); assert.equal(gore.stats().pending, 0);
  assert(gore.stats().painted > 24, 'landed fragments also leave a stain');
  const count = gore.stats().tiles;
  for (let i = 0; i < 1800; i++) gore.update(1/60);
  assert.equal(gore.stats().tiles, count, 'blood persists beyond the particle lifetime');
  clearCalls(); gore.drawGround({ drawImage: (...args) => calls.push(args) }, 0, 0, 2048, 2048);
  assert.equal(calls.length, count, 'one blit per occupied visible tile');
});

test('stains straddling a tile corner are painted on all four tiles', () => {
  const { gore } = host();
  gore.configure({ level: 'full', motion: false, tiles: 48 });
  gore.burst(512, 512, 24, 18);
  gore.update(1/60);
  assert.equal(gore.stats().tiles, 4);
});

test('thousands of deaths cannot exceed particle, queue, texture or per-update paint budgets', () => {
  const { gore } = host();
  gore.configure({ level: 'full', bits: 120, tiles: 24, burst: 48 });
  for (let batch = 0; batch < 30; batch++) {
    for (let i = 0; i < 300; i++) gore.burst(100 + ((i * 193 + batch * 317) % 4900),
      100 + ((i * 257 + batch * 811) % 4900), 30, 25, { blast: true });
    const before = gore.stats().painted;
    gore.update(1/60);
    const s = gore.stats();
    assert(s.active <= 120); assert(s.pending <= 256); assert(s.tiles <= 24);
    assert(s.painted - before <= 24);
    assert(s.textureBytes <= 24 * 128 * 128 * 4 + 512 * 256 * 4);
    assert(gore.fragments().every(p => Number.isFinite(p.x + p.y + p.z)));
  }
  assert(gore.stats().evicted > 0, 'old distant tiles are reused');
});

test('quality changes trim existing gore immediately, and Off clears all remains', () => {
  const { gore } = host();
  for (let i = 0; i < 8; i++) { gore.burst(i * 580, i * 580, 35, 20, { boss: true, blast: true }); gore.update(1/60); }
  gore.configure({ level: 'light', bits: 12, tiles: 4, burst: 8 });
  assert(gore.stats().active <= 12); assert(gore.stats().tiles <= 4);
  gore.configure({ level: 'off' }); gore.burst(100, 100, 30, 20);
  gore.update(1/60);
  assert.equal(gore.stats().active + gore.stats().pending + gore.stats().tiles, 0);
  gore.configure({ level: 'full', motion: false }); gore.burst(500, 500, 25, 18);
  gore.update(1/60);
  assert.equal(gore.stats().active, 0); assert(gore.stats().tiles > 0);
  gore.reset(21);
  assert.equal(gore.stats().pending + gore.stats().tiles + gore.stats().active, 0);
});

test('gore settings cannot change explosion damage, kill credit or XP drops', () => {
  function run(level) {
    const { B } = harness(); B.prefs().gore = level; B.newGame(0, 0);
    B.G.mods.crit = 0;
    for (let i = 0; i < 80; i++) B.spawnEnemy('minyar', 0, 2450 + i * 4, 2650);
    B.buildHash(); B.explodeAt(2600, 2600, 400, 100000, 0);
    return { kills: B.G.kills, damage: B.heroState()[0].dmg,
      xp: Array.from(B.gems()).filter(g => g.alive).map(g => [g.x, g.y, g.val]) };
  }
  const full = run('full');
  assert.equal(full.kills, 80);
  assert.deepEqual(run('off'), full); assert.deepEqual(run('light'), full);
});

test('repeated mass explosions keep all damage while cosmetics stay bounded on every preset', () => {
  for (const quality of ['high', 'balanced', 'battery', 'perf']) {
    const { B } = harness(); B.newGame(0, 0); B.applyQuality(quality);
    B.G.mods.crit = 0; B.G.xpNext = 1e9;
    for (const c of B.cages()) c.broken = true;
    const cap = B.getQL();
    for (let round = 0; round < 8; round++) {
      for (const e of B.enemies) e.alive = false;
      for (let n = 0; n < 120; n++) B.spawnEnemy('minyar', 0, 2470 + (n % 24) * 10, 2610 + (n % 5) * 9);
      B.buildHash(); B.explodeAt(2600, 2600, 600, 100000, 0);
      for (let n = 0; n < 100; n++) B.explodeAt(2600, 2600, 600, 100000, 0);
      assert.equal(B.G.kills, 120 * (round + 1), 'every enemy dies even with a full effects pool');
      assert(B.effects().length <= cap.effects);
      assert(B.gore.stats().active <= cap.gibs);
      assert(B.gore.stats().bursts <= cap.gibs);
      assert(B.gore.stats().pending <= 256);
      assert.equal(B.G.hitStop, 0, 'mass kills do not freeze combat');
      B.player().iv = 5; B.update(1/60); B.render(1/60);
    }
    assert.equal(cap.light, 0); assert.equal(cap.trails, 0);
  }
});

test('tide pushes, wind drift and closing-arena rules are removed, and combat has no popup coaching', () => {
  for (const route of ['sea', 'sky']) {
    const { B, read, nodes, boot, advance } = harness(); boot();
    B.setRunSetup('endless', route, 'tide'); B.newGame(0, 3);
    const { x, y } = B.player(); B.player().iv = 999;
    for (let n = 0; n < 400; n++) B.update(0.05);
    advance(3000);
    assert.equal(B.player().x, x); assert.equal(B.player().y, y);
    assert.equal(B.G.windX, undefined); assert.equal(B.G.tidePush, undefined);
    assert.equal(B.G.diff.rule, 'elites');
    assert.equal(read("MUTATORS.some(m => m.id === 'ebbtide')"), false);
    assert.equal(nodes.has('banner'), false); assert.equal(nodes.has('coach'), false);
    assert.equal(B.G.timeScale, 1);
    nodes.get('btn-roster').click();
    assert(nodes.get('combat-log').textContent.length > 0, 'notices are available in Pause');
  }
});

test('gore and flash settings work through the real settings controls and persist', () => {
  const { B, nodes, boot } = harness(); boot(); B.newGame(0, 0);
  B.gore.burst(2600,2600,25,20); B.gore.update(1/60);
  nodes.get('set-gore').dispatch('change', { target: { value: 'off' } });
  assert.equal(B.prefs().gore, 'off'); assert.equal(B.loadSave().prefs.gore, 'off');
  assert.equal(B.gore.stats().active + B.gore.stats().tiles + B.gore.stats().pending, 0);
  B.prefs().flash = 0; B.heroState()[0].charge = 1; B.powershot();
  assert.equal(B.G.flash, 0); assert.equal(B.G.hitStop, 0);
  assert.equal(B.G.timeScale, 1, 'powershots do not force slow motion');
});

test('retry clears blood, airborne chunks and deferred stamps from the previous run', () => {
  const { B } = harness(); B.newGame(0, 0);
  for (let i = 0; i < 12; i++) B.gore.burst(2600+i*4,2600,25,20,{blast:true});
  B.gore.update(1/60); assert(B.gore.stats().tiles > 0);
  B.newGame(0, 0);
  assert.equal(B.gore.stats().active + B.gore.stats().tiles + B.gore.stats().pending, 0);
});

test('a splitting elite cannot corrupt its death rewards or children when its pooled slot is reused', () => {
  const { B, read } = harness(); B.newGame(0,0); B.G.mods.crit = 0;
  const e = B.spawnEnemy('minyar',3,2700,2700,true);
  e.affix = read("ELITE_AFFIXES.find(a => a.id === 'splitting')");
  B.damageEnemy(e,100000,{src:0,blast:true});
  const children = B.enemies.filter(e => e.alive);
  assert.equal(B.G.kills,1); assert.equal(B.G.eliteKills,1); assert.equal(children.length,4);
  assert(children.every(c => c.tier === 2));
  assert(children.every(c => Math.abs(Math.hypot(c.x-2700,c.y-2700)-44)<0.001));
  assert(B.gore.stats().active > 0);
});

test('later deaths still disintegrate with a full flying-fragment budget', () => {
  const { gore } = host();
  gore.configure({ level: 'full', bits: 120, burst: 12 });
  const source = { width: 96, height: 96 };
  gore.prepareBody('minyar0', source);
  for (let i=0;i<120;i++) gore.burst(500+i*5,500,25,18,{blast:true,body:'minyar0'});
  assert.equal(gore.stats().active,12, 'flying bits respect the per-update budget');
  assert.equal(gore.stats().bursts,120, 'every admitted death has its own breakup animation');
  const draws=[];
  gore.drawAir({ drawImage: (...args) => draws.push(args), fillRect() {} }, () => true);
  assert.equal(draws.filter(a => a[3] === 64 && a[4] === 64).length,120, 'one cached blit per disintegrating body');
  gore.burst(1800,1800,25,18,{body:'minyar0'});
  const fresh=[];
  gore.drawAir({ drawImage: (...args) => fresh.push(args), fillRect() {} }, (x,y) => x===1800);
  assert.equal(fresh.length,1, 'the newest kill remains visible when both pools are full');
  assert.equal(gore.stats().bursts,120);
  assert(gore.fragments().some(p => p.body), 'flying chunks retain the real enemy art');
});

test('body sprite caches are bounded and reset/Off/reduced motion clear all death animations', () => {
  const { gore } = host();
  for (let i=0;i<90;i++) gore.prepareBody('body'+i,{width:96,height:96});
  assert.equal(gore.stats().bodies,19);
  assert(gore.stats().textureBytes <= 19*(192*144+512*64)*4+512*256*4);
  for (const mode of ['reset','off','motion']) {
    gore.configure({level:'full'}); gore.burst(100,100,25,18,{body:'body0'});
    assert.equal(gore.stats().bursts,1);
    if (mode==='reset') gore.reset(3);
    if (mode==='off') gore.configure({level:'off'});
    if (mode==='motion') gore.configure({level:'full',motion:false});
    assert.equal(gore.stats().active+gore.stats().bursts,0);
  }
});

test('legacy damage-number preferences cannot reintroduce combat text', () => {
  const saved = JSON.stringify({v:3,prefs:{dmgnum:'all',gore:'full'}});
  const { B, context, nodes, boot } = harness({balitopia:saved}); boot(); B.newGame(0,0);
  B.G.mods.crit=1; B.G.xpNext=1e9;
  for (const c of B.cages()) c.broken=true;
  const p=B.player(); p.iv=0; B.G.wardUp=1;
  B.hurtPlayer(10); B.heroState()[0].charge=0.25; B.tryPowershot();
  for (let i=0;i<20;i++) B.damageEnemy(B.spawnEnemy('minyar',0,p.x+150+i*2,p.y),1000,{src:0});
  const texts=[]; context.fillText=(text) => texts.push(String(text)); context.strokeText=context.fillText;
  for (let i=0;i<20;i++) { B.update(1/60); B.render(1/60); }
  assert.deepEqual(texts,[], 'kills, crits, ward and denied charge draw no world text');
  assert.equal(nodes.has('set-dmgnum'),false);
  assert.equal(nodes.has('banner'),false); assert.equal(nodes.has('coach'),false);
  assert.equal(B.G.kills,20); assert(B.G.combo>0);
});
