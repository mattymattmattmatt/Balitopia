// Reproducible CPU/Canvas stress comparison, not a browser or phone FPS test.
// NODE_PATH=/path/to/node_modules node tools/test/bench-combat.cjs --native
const { performance } = require('node:perf_hooks');
const { harness, root } = require('./simulation-harness');
const native = process.argv.includes('--native');
const frames = Number(process.argv.find(x => x.startsWith('--frames='))?.split('=')[1]) || 300;
const preset = process.argv.find(x => x.startsWith('--quality='))?.split('=')[1] || 'balanced';
const only = process.argv.find(x => x.startsWith('--case='))?.split('=')[1];
const snapshot = process.argv.find(x => x.startsWith('--snapshot='))?.slice(11);
const percentile = (xs, p) => [...xs].sort((a,b) => a-b)[Math.floor((xs.length-1)*p)];
process.chdir(root);
(async () => {
  const results = [];
  for (const name of ['rainbow', 'horde', 'mass-blasts'].filter(x => !only || x === only)) {
    let canvases = 0;
    const ports = {};
    if (native) {
      const { createCanvas, Image } = require('@napi-rs/canvas');
      ports.Image = Image;
      ports.makeCanvas = () => { canvases++; return createCanvas(96,96); };
    }
    const h = harness({}, ports); if (native) await h.ready; else h.boot();
    h.sandbox.performance.now = () => performance.now();
    const { B } = h;
    B.setRunSetup('endless','land','tide');
    B.newGame(name === 'rainbow' ? h.read("HEROES.findIndex(x => x.id === 'skyjumper')") : 0, 0);
    B.prefs().quality = preset; B.applyQuality(preset); B.prefs().shake = 0;
    B.G.xpNext = 1e9; B.player().iv = 1e9;
    if (name !== 'rainbow') for (const cage of B.cages()) B.breakCage(cage);
    for (const hs of B.heroState()) hs.tier = 4;
    const p = B.player(), cap = B.getQL().maxEnemies;
    const refill = () => {
      let n = B.enemies.filter(e => e.alive).length;
      for (; n < cap; n++) {
        const a = n * 2.39996, d = 80 + (n % 12) * 35;
        const e = B.spawnEnemy(['minyar','demonder','clubbo'][n%3], n%5,
          p.x + Math.cos(a)*d, p.y + Math.sin(a)*d);
        if (!e) break;
        if (name === 'horde') e.hp = e.maxhp = 1e7;
      }
    };
    if (name !== 'rainbow') refill();
    const flush = () => { if (native) h.nodes.get('game').getContext('2d').getImageData(0,0,1,1); };
    B.render(0); flush(); const initialCanvases = canvases;
    B.prof(true);
    const times = [], updates = [], renders = [];
    for (let frame = 0; frame < frames; frame++) {
      if (name === 'mass-blasts' && frame % 12 === 0) refill();
      const t0 = performance.now();
      if (name === 'mass-blasts' && frame % 12 === 0) {
        B.buildHash(); B.explodeAt(p.x, p.y, 620, 1e6, 0);
      }
      if (name === 'rainbow') B.G.time += 1/60; else B.update(1/60);
      const t1 = performance.now(); B.render(1/60); flush(); const t2 = performance.now();
      times.push(t2-t0); updates.push(t1-t0); renders.push(t2-t1);
      if (native && snapshot && frame === Math.min(frames-1,7))
        require('node:fs').writeFileSync(snapshot,h.nodes.get('game').toBuffer('image/png'));
    }
    results.push({ name, preset, frames, native, newCanvases: canvases-initialCanvases,
      medianMs: +percentile(times,.5).toFixed(3), p95Ms: +percentile(times,.95).toFixed(3),
      medianUpdateMs: +percentile(updates,.5).toFixed(3), medianRenderMs: +percentile(renders,.5).toFixed(3),
      kills: B.G.kills, gore: B.gore.stats(), profile: B.profData(),
      sprites: native ? h.read('Sprites.stats ? Sprites.stats() : null') : null });
  }
  console.log(JSON.stringify(results,null,2));
})().catch(e => { console.error(e); process.exitCode = 1; });
