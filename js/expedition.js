/* Balitopia's session rules. Pure data / logic so balance and save migration can
 * be tested without a renderer, audio device, or a browser. */
'use strict';
const Expedition = (() => {
  const modes = [
    { id: 'expedition', name: 'Expedition', length: '6 min + boss', bossAt: 360, pace: 1, xp: 1, score: 1,
      desc: 'Build your squad. Defeat King Glob. Bring everyone home.' },
    { id: 'blitz', name: 'Blitz', length: '3 min + boss', bossAt: 180, pace: 2, xp: 1.65, score: 0.8,
      desc: 'Faster upgrades and a compressed assault. Every second counts.' },
    { id: 'endless', name: 'Endless', length: 'No time limit', bossAt: 360, pace: 1, xp: 1, score: 1,
      desc: 'Alternating bosses and escalating curses. How far can you go?' },
  ];
  const routes = [
    { id: 'land', name: 'Emerald Wilds', icon: '✿', color: '#87edbf', rule: 'Jungle growth slows the horde.' },
    { id: 'sea', name: 'Sapphire Coast', icon: '≈', color: '#7cdbff', rule: 'Surging tides push fighters sideways.' },
    { id: 'sky', name: 'Sunspire Heights', icon: '◇', color: '#f8d07f', rule: 'Crosswinds bend your projectiles.' },
  ];
  const blessings = [
    { id: 'tide', name: 'Tidekeeper', icon: '≈', desc: '+25 HP · +25% pickup range',
      apply: m => { m.hpBonus += 25; m.magnet *= 1.25; } },
    { id: 'storm', name: 'Stormcaller', icon: 'ϟ', desc: '+15% damage · +20% charge speed',
      apply: m => { m.dmg *= 1.15; m.chargeMul *= 1.2; } },
    { id: 'grove', name: 'Pathfinder', icon: '✿', desc: '+15% XP · +8% movement speed',
      apply: m => { m.xpGain *= 1.15; m.spd *= 1.08; } },
  ];
  const evolutions = [
    { relic: 'totem', upgrade: 'area', name: 'Tidal Crown', desc: 'Three totems pulse 35% faster.' },
    { relic: 'mine', upgrade: 'riptide', name: 'Volcanic Bloom', desc: 'Three mines per drop, with 40% wider blasts.' },
    { relic: 'mask', upgrade: 'echo', name: 'Ancestral Choir', desc: 'Three ghosts mirror your attacks at 85% power.' },
    { relic: 'spire', upgrade: 'chorus', name: 'Reef Citadel', desc: 'Three turrets with 35% more damage.' },
    { relic: 'sunbeam', upgrade: 'haste', name: 'Solar Halo', desc: 'Three sweeping beams with 25% more reach.' },
    { relic: 'net', upgrade: 'undertow', name: 'Maelstrom', desc: 'A 50% wider pull with double damage.' },
    { relic: 'stormjar', upgrade: 'keen', name: 'Tempest Heart', desc: 'Four lightning strikes per cast.' },
    { relic: 'blossom', upgrade: 'bloom', name: 'Everblossom', desc: 'Two extra petals with 40% more damage.' },
  ];
  const contracts = [
    { id: 'rescue', name: 'Rescue party', detail: 'Free 3 caged Guardians', target: 3, reward: 30, stat: 'rescues' },
    { id: 'horde', name: 'Horde breaker', detail: 'Defeat 120 enemies', target: 120, reward: 30, stat: 'kills' },
    { id: 'power', name: 'Let it rip', detail: 'Fire 3 powershots', target: 3, reward: 30, stat: 'powershots' },
  ];
  function mode(id) { return modes.find(m => m.id === id) || modes[0]; }
  function route(id) { return routes.find(r => r.id === id) || routes[0]; }
  function blessing(id) { return blessings.find(b => b.id === id) || blessings[0]; }
  function create(modeId, routeId, blessingId, daily) {
    return { mode: daily ? 'endless' : mode(modeId).id, route: route(routeId).id,
      blessing: daily ? null : blessing(blessingId).id, daily: !!daily,
      rescues: 0, powershots: 0, rally: 0, completed: [], bonus: 0, evolved: [], extracted: false };
  }
  function progress(run, stats) {
    return contracts.map(c => ({ ...c, value: Math.min(c.target, Math.max(0, Number(stats[c.stat]) || 0)),
      done: run.completed.includes(c.id) }));
  }
  function complete(run, stats) {
    if (run.daily) return [];
    const earned = progress(run, stats).filter(c => !c.done && c.value >= c.target);
    for (const c of earned) { run.completed.push(c.id); run.bonus += c.reward; }
    return earned;
  }
  function evolution(relicId, level, upgrades) {
    if (level < 4) return null;
    return evolutions.find(e => e.relic === relicId && upgrades[e.upgrade]) || null;
  }
  function recipe(relicId) { return evolutions.find(e => e.relic === relicId); }
  function grade(run, won) {
    const medals = run.completed.length;
    return won ? (medals === 3 ? 'S' : medals >= 2 ? 'A' : 'B') : (medals >= 2 ? 'C' : 'D');
  }
  function migrate(save) {
    if (!save.expeditions || typeof save.expeditions !== 'object' || Array.isArray(save.expeditions)) save.expeditions = {};
    const s = save.expeditions;
    s.clears = Math.max(0, Number(s.clears) || 0);
    s.rescues = Math.max(0, Number(s.rescues) || 0);
    s.contracts = Math.max(0, Number(s.contracts) || 0);
    if (!s.routes || typeof s.routes !== 'object' || Array.isArray(s.routes)) s.routes = {};
    return s;
  }
  function record(save, run, won) {
    const s = migrate(save);
    if (run.daily) return s;
    s.clears += won ? 1 : 0;
    s.rescues += run.rescues;
    s.contracts += run.completed.length;
    const key = run.mode + ':' + run.route;
    const old = s.routes[key] || { clears: 0, medals: 0 };
    s.routes[key] = { clears: old.clears + (won ? 1 : 0), medals: Math.max(old.medals, won ? run.completed.length : 0) };
    return s;
  }
  return { modes, routes, blessings, evolutions, contracts, mode, route, blessing,
    create, progress, complete, evolution, recipe, grade, migrate, record };
})();
if (typeof module !== 'undefined' && module.exports) module.exports = Expedition;
