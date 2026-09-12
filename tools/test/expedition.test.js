const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const E = require('../../js/expedition');
const { harness, root } = require('./simulation-harness');

test('contract rewards are capped and paid once, even when several complete together', () => {
  const run = E.create('expedition', 'land', 'tide');
  const stats = { rescues: 99, kills: 500, powershots: 4 };
  assert.equal(E.complete(run, stats).length, 3);
  assert.equal(run.bonus, 90);
  assert.equal(E.complete(run, stats).length, 0);
  assert.equal(run.bonus, 90);
  assert.equal(E.grade(run, true), 'S');
});
test('daily runs ignore blessings, mode selection and expedition currency', () => {
  const run = E.create('blitz', 'sea', 'storm', true);
  assert.equal(run.mode, 'endless'); assert.equal(run.blessing, null);
  E.complete(run, { rescues: 4, kills: 300, powershots: 10 });
  assert.equal(run.bonus, 0);
});
test('all eight evolutions need level IV plus their specific recipe key', () => {
  for (const recipe of E.evolutions) {
    assert.equal(E.evolution(recipe.relic, 3, { [recipe.upgrade]: 1 }), null);
    assert.equal(E.evolution(recipe.relic, 4, {}), null);
    assert.equal(E.evolution(recipe.relic, 4, { [recipe.upgrade]: 1 }).name, recipe.name);
  }
});
test('expedition migration preserves legacy unlocks, perks, records and wallet', () => {
  const save = { v: 3, shells: 513, unlocked: ['bo', 'chomper'], perks: { hp: 4 }, records: [{ score: 8000 }] };
  const before = JSON.stringify(save);
  E.migrate(save);
  const { expeditions, ...rest } = save;
  assert.equal(JSON.stringify(rest), before);
  assert.equal(expeditions.clears, 0);
});
test('the actual game loads an old save and writes the new version without losing progress', () => {
  const old = { v: 3, shells: 321, unlocked: ['bo', 'yelp'], mastery: { bo: 2 }, records: [{ score: 101 }], deep: {} };
  const h = harness({ balitopia: JSON.stringify(old) });
  const save = h.B.loadSave(); h.B.flushSave();
  assert.equal(save.v, 5); assert.equal(save.shells, 321);
  assert.deepEqual(Array.from(save.unlocked), ['bo', 'yelp']);
  assert.equal(save.mastery.bo, 2); assert.equal(save.records[0].score, 101);
  assert.equal(JSON.parse(h.storage.get('balitopia')).v, 5);
});
test('run setup actually changes boss timing, biome, health and experience', () => {
  const { B } = harness();
  B.setRunSetup('blitz', 'sea', 'tide'); B.newGame(0, 0);
  assert.equal(B.G.nextBossAt, 180); assert.equal(B.G.region, 'region-sea');
  assert.equal(B.maxHP(), 115); assert.equal(B.G.mods.xpGain, 1.65);
  B.setRunSetup('expedition', 'sky', 'storm'); B.newGame(0, 0);
  assert.equal(B.maxHP(), 90); assert.equal(B.G.nextBossAt, 360);
  assert.equal(B.G.mods.dmg, 1.15); assert.equal(B.G.mods.chargeMul, 1.2);
});
test('cage rescue is idempotent and the third rescue creates a bounded rally', () => {
  const { B } = harness(); B.newGame(0, 0); B.G.soul = 0;
  const cages = B.cages(); B.breakCage(cages[0]); B.breakCage(cages[0]);
  assert.equal(B.allies().length, 1); assert.equal(B.G.session.rescues, 1); assert.equal(B.G.soul, 1);
  assert.equal(B.heroState()[cages[0].heroIdx].charge, 1);
  B.breakCage(cages[1]); B.breakCage(cages[2]);
  assert.equal(B.G.session.rally, 8); assert.equal(B.G.soul, 3);
  B.updateExpedition(9); assert.equal(B.G.session.rally, 0);
  assert.equal(B.G.session.bonus, 30);
  B.updateExpedition(1); assert.equal(B.G.session.bonus, 30);
});
test('every relic evolution applies once with either acquisition order', () => {
  for (const recipe of E.evolutions) for (const keyFirst of [true, false]) {
    const { B, read } = harness(); B.newGame(0, 0);
    const upgrade = read(`UPGRADES.find(u => u.id === '${recipe.upgrade}')`);
    if (keyFirst) B.applyUpgrade(upgrade);
    for (let n = 0; n < 4; n++) B.addRelic(recipe.relic);
    if (!keyFirst) B.applyUpgrade(upgrade);
    B.checkRelicEvolutions(); B.checkRelicEvolutions();
    assert.equal(B.relics()[0].evolved.name, recipe.name);
    assert.equal(B.G.session.evolved.length, 1);
    B.updateRelics(0.016);
    if (recipe.relic === 'sunbeam') assert.equal(B.relics()[0].beams, 3);
    if (recipe.relic === 'blossom') assert.equal(B.relics()[0].cnt, 6);
  }
});
test('the first full draft contains a relic and a starter signature', () => {
  const { B, nodes } = harness(); B.newGame(0, 0); B.showLevelUp();
  const cards = nodes.get('upgrade-row').children;
  assert.equal(cards.length, 3);
  assert(cards.some(c => c.classList.contains('relic')));
  assert(cards.some(c => c.classList.contains('signature')));
  assert(cards.every(c => c.attributes.role === 'button' && c.tabIndex === 0));
});
test('home, setup controls and play are wired to the real game state', () => {
  const { B, nodes, boot } = harness(); boot();
  nodes.get('btn-menu-start').click();
  assert.equal(nodes.get('screen-select').classList.contains('hidden'), false);
  nodes.get('run-mode').value = 'blitz'; nodes.get('run-mode').dispatch('change');
  nodes.get('run-route').value = 'sea'; nodes.get('run-route').dispatch('change');
  nodes.get('btn-start').click();
  assert.equal(B.G.session.mode, 'blitz'); assert.equal(B.G.region, 'region-sea');
  assert.equal(nodes.get('screen-select').classList.contains('hidden'), true);
  assert.equal(nodes.get('hud').classList.contains('hidden'), false);
});
test('rapid double selection and stale previous-run callbacks cannot give extra upgrades', () => {
  const { B, nodes, advance } = harness(); B.newGame(0, 0); B.G.pendingLv = 1; B.showLevelUp();
  const cards = nodes.get('upgrade-row').children.slice(); cards[0].click(); cards[1].click();
  assert.equal(B.relics().length, 1); assert.equal(B.G.draftBusy, true);
  assert.equal(nodes.get('btn-lu-reroll').disabled, true);
  B.newGame(0, 0); advance(250);
  assert.equal(B.G.pendingLv, 0); assert.equal(B.relics().length, 0); assert.equal(B.G.running, true);
});
test('chests cannot grant delayed rewards to a different run', () => {
  const { B, advance } = harness(); B.newGame(0, 0); B.showChest(3); B.newGame(0, 0);
  advance(1000); assert.equal(B.relics().length, 0); assert.equal(Object.keys(B.G.upTaken).length, 0);
});
test('finite modes bank a victory and rewards once; endless keeps going', () => {
  for (const mode of ['expedition', 'blitz', 'endless']) {
    const { B } = harness(); B.setRunSetup(mode, 'land', 'tide'); B.newGame(0, 0);
    B.spawnBoss(); B.killBoss(B.G.boss);
    assert.equal(B.G.bossKills, 1);
    assert.equal(B.G.over, mode !== 'endless');
    if (mode !== 'endless') {
      assert(B.G.victory); assert(B.G.session.extracted);
      const shells = B.loadSave().shells; B.endGame(); assert.equal(B.loadSave().shells, shells);
      assert.equal(B.loadSave().expeditions.clears, 1);
    } else { assert.equal(B.G.round, 2); assert.equal(B.chests().length, 1); }
  }
});
test('victory recap, same-loadout retry, loss and change-Guardian complete through real menu handlers', () => {
  const { B, nodes, boot, advance } = harness(); boot();
  B.setRunSetup('blitz', 'sky', 'grove'); B.newGame(0, 1);
  B.G.time = 183; B.G.kills = 120;
  B.G.session.rescues = 3; B.G.session.powershots = 3;
  B.updateExpedition(0); B.spawnBoss(); B.killBoss(B.G.boss);
  advance(1150);
  assert.equal(nodes.get('screen-over').classList.contains('hidden'), false);
  assert.match(nodes.get('expedition-recap').innerHTML, /Island liberated/);
  assert.match(nodes.get('expedition-recap').innerHTML, /grade">S/);
  const shells = B.loadSave().shells;
  nodes.get('btn-retry').click();
  assert.equal(B.G.running, true); assert.equal(B.G.over, false);
  assert.equal(B.G.session.mode, 'blitz'); assert.equal(B.G.session.route, 'sky');
  assert.equal(B.G.session.blessing, 'grove'); assert.equal(B.G.diff.id, 1);
  assert.equal(B.loadSave().shells, shells);
  assert.equal(nodes.get('screen-over').classList.contains('hidden'), true);
  assert.equal(nodes.get('hud').classList.contains('hidden'), false);
  advance(1500); assert.equal(B.G.running, true);
  B.endGame(); advance(1150);
  assert.equal(nodes.get('screen-over').classList.contains('hidden'), false);
  nodes.get('btn-change-guardian').click();
  assert.equal(nodes.get('screen-select').classList.contains('hidden'), false);
  assert.equal(nodes.get('screen-over').classList.contains('hidden'), true);
});
test('all 24 Guardians survive a deterministic simulation smoke test without invalid numbers', () => {
  for (let hero = 0; hero < 24; hero++) {
    const { B } = harness(); B.newGame(hero, 0);
    for (let i = 0; i < 8; i++) B.spawnEnemy('minyar', 0, B.player().x + 80 + i * 10, B.player().y);
    for (let n = 0; n < 480; n++) { B.player().iv = 10; B.update(1/60); if (n % 30 === 0) B.render(1/60); }
    assert(Number.isFinite(B.player().hp)); assert(Number.isFinite(B.G.time));
    assert(B.enemies.every(e => !e.alive || (Number.isFinite(e.hp) && Number.isFinite(e.x))));
  }
});
test('scripted surges and late waves obey the performance preset enemy budget', () => {
  const { B } = harness(); B.newGame(0, 0); B.applyQuality('perf');
  for (let i = 0; i < 250; i++) B.spawnEnemy('minyar', 0, 2900, 2900);
  B.fireBeat('surge'); B.spawnElite();
  assert.equal(B.enemies.filter(e => e.alive).length, 150);
  B.G.time = 240;
  for (let n = 0; n < 120; n++) { B.player().iv = 10; B.update(1/60); }
  assert(B.enemies.filter(e => e.alive).length <= 150);
});
test('HTML hooks, offline shell and production asset references are present', () => {
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  assert.equal(ids.length, new Set(ids).size, 'no duplicate element IDs');
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    const ref = match[1]; if (/^(data:|https?:)/.test(ref)) continue;
    assert(fs.existsSync(path.join(root, ref.split(/[?#]/)[0])), `missing ${ref}`);
  }
  const sw = fs.readFileSync(path.join(root,'sw.js'),'utf8');
  for (const asset of ['js/expedition.js','css/studio.css']) assert(sw.includes(asset));
  assert(sw.includes("k.startsWith('balitopia-')"), 'cache cleanup stays inside this game');
});
