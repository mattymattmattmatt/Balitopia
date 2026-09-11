// Optional visual QA, using @napi-rs/canvas from the caller's environment.
// Runs the real game renderer and real PNG sprite pipeline with fake DOM/audio.
// Usage: NODE_PATH=/path/to/node_modules node tools/test/render-gore.cjs
const fs = require('node:fs');
const path = require('node:path');
const { createCanvas, Image } = require('@napi-rs/canvas');
const { harness, root } = require('./simulation-harness');
process.chdir(root);
(async () => {
  const h = harness({}, { makeCanvas: () => createCanvas(96,96), Image });
  await h.ready;
  const { B } = h;
  B.newGame(0, 0); B.G.mods.crit = 0; B.G.xpNext = 1e9;
  B.prefs().shake = 0; B.prefs().minimap = 0;
  for (const c of B.cages()) c.broken = true;
  const p = B.player(); p.iv = 999;
  const points = [[-390,-100],[-160,-140],[140,-140],[390,-60],[-330,170],[-60,155],[220,160]];
  for (let group=0;group<points.length;group++) {
    const [dx,dy] = points[group];
    for (let j=0;j<5;j++) B.spawnEnemy(['minyar','demonder','clubbo'][group%3],1,
      p.x+dx+Math.cos(j*1.256)*48,p.y+dy+Math.sin(j*1.256)*35);
  }
  B.render(0);
  fs.writeFileSync(path.join(root,'docs/gore-before.png'), h.nodes.get('game').toBuffer('image/png'));
  B.buildHash();
  for (let frame=0;frame<72;frame++) {
    if (frame%5===0 && frame/5<points.length) {
      const [dx,dy]=points[frame/5]; B.explodeAt(p.x+dx,p.y+dy,145,100000,0);
    }
    // Advance the actual game (including particles, effects, camera and spawns).
    B.update(1/60); B.render(1/60);
    if (frame===27) fs.writeFileSync(path.join(root,'docs/gore-preview.png'), h.nodes.get('game').toBuffer('image/png'));
  }
  fs.writeFileSync(path.join(root,'docs/gore-aftermath.png'), h.nodes.get('game').toBuffer('image/png'));
  console.log(JSON.stringify({ kills:B.G.kills, gore:B.gore.stats(), viewport:B.viewInfo(), canvas:[h.nodes.get('game').width,h.nodes.get('game').height] }));
})().catch(e => { console.error(e); process.exitCode=1; });
