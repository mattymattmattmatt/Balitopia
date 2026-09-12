const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const FrameBudget = require('../../js/frame-budget');
const { harness, root } = require('./simulation-harness');

test('a 2 FPS stall reaches performance quality within one real second, including cold start', () => {
  const budget = FrameBudget.create();
  assert.equal(budget.observe(.5,60,'balanced'),null);
  assert.equal(budget.observe(.5,60,'balanced'),'perf');
  assert.equal(budget.fps(),2);
});

test('quality respects 30/45/60 FPS targets, recovers slowly and resets pause history', () => {
  for (const target of [30,45,60]) {
    const budget = FrameBudget.create();
    for (let i=0;i<target*25;i++) assert.equal(budget.observe(1/target,target,'balanced'),null);
  }
  const budget = FrameBudget.create(); let next;
  for (let i=0;i<19*60;i++) assert.equal(budget.observe(1/60,60,'perf'),null);
  for (let i=0;i<120;i++) next = budget.observe(1/60,60,'perf') || next;
  assert.equal(next,'battery');
  budget.reset(); assert.equal(budget.fps(),0);
  for (let i=0;i<19*60;i++) assert.equal(budget.observe(1/60,60,'perf'),null);
});

test('actual frame loop obeys each cap on 120 Hz screens without slowing normal simulation', () => {
  for (const cap of [30,45,60]) {
    const { B } = harness(); B.newGame(0,0); B.G.xpNext=1e9; B.player().iv=99;
    B.prefs().fpsCap=cap; B.prefs().quality='auto'; B.prof(true);
    for(let frame=0;frame<=240;frame++) B.frame(frame*1000/120);
    assert(Math.abs(B.profData().__frames-cap*2)<=2,JSON.stringify(B.profData()));
    assert(Math.abs(B.G.time-2)<.05,`simulation time ${B.G.time} at ${cap} FPS`);
    assert.equal(B.frameInfo().quality,'balanced');
  }
});

test('real frame loop measures a stall before simulation clamping and honours manual quality', () => {
  for (const preference of ['auto','high']) {
    const {B}=harness(); B.newGame(0,0); B.prefs().quality=preference;
    B.applyQuality(preference==='auto'?'balanced':'high'); B.player().iv=99;
    B.frame(0); B.frame(500); B.frame(1000);
    assert.equal(B.frameInfo().quality,preference==='auto'?'perf':'high');
    assert(B.frameInfo().fps<3); assert(B.G.time<.2,'physics still avoids giant time steps');
    assert.equal(B.prefs().quality,preference,'runtime adaptation does not rewrite the saved preference');
    B.newGame(0,0); assert.equal(B.frameInfo().fps,0);
  }
});

test('a missed frame cannot stretch a short impact pause into several frozen frames', () => {
  const {B}=harness(); B.newGame(0,0); B.player().iv=99; B.frame(0);
  const time=B.G.time; B.hitStop(.06); B.frame(500);
  assert.equal(B.G.hitStop,0); assert(B.G.time>time);
});

function canvasPorts() {
  const gradient={addColorStop(){}}, canvases=[];
  const context=()=>new Proxy({ createLinearGradient:()=>gradient, createRadialGradient:()=>gradient,
    measureText:()=>({width:10}), getImageData:()=>({data:new Uint8ClampedArray(4)}) },
    {get:(o,k)=>k in o?o[k]:()=>{}});
  return {canvases, Image:class {set src(value){this.onerror?.();}},
    makeCanvas(){const ctx=context(),c={width:96,height:96,getContext:()=>ctx};canvases.push(c);return c;}};
}

test('a saturated horde checks one neighbourhood column per enemy and still separates neighbours', () => {
  const h=harness(),{B}=h; B.newGame(0,0); B.player().iv=99;
  for(let i=0;i<300;i++) B.spawnEnemy('minyar',0,2500+i%20,2500+Math.floor(i/20));
  B.buildHash();
  h.read('globalThis.mapReads=0; const originalMapGet=Map.prototype.get; Map.prototype.get=function(key){mapReads++;return originalMapGet.call(this,key);};');
  B.updateEnemies(0); assert.equal(h.read('mapReads'),900);
  const a=B.enemies[0],b=B.enemies[1],before=Math.hypot(a.x-b.x,a.y-b.y);
  for(let i=0;i<6;i++){B.G.frameN++;B.buildHash();B.updateEnemies(0);}
  assert(Math.hypot(a.x-b.x,a.y-b.y)>before,'the staggered pass continues to spread an overlapping crowd');
});
function spriteHost() {
  const ports=canvasPorts();
  const sprites=vm.runInNewContext(fs.readFileSync(path.join(root,'js/sprites.js'),'utf8')+'\nSprites;',
    {document:{createElement:ports.makeCanvas},Image:ports.Image});
  return {sprites,...ports};
}

test('ten thousand continuously changing rainbow hues reuse twelve textures', () => {
  const {sprites}=spriteHost();
  for(let i=0;i<10000;i++) sprites.proj('orb',`hsl(${i*.137%360},95%,68%)`,7);
  assert.equal(sprites.stats().dynamicCreated,12);
  assert.equal(sprites.stats().dynamicEntries,12);
  assert.equal(sprites.proj('orb','hsl(-1,95%,68%)',7),sprites.proj('orb','hsl(359,95%,68%)',7));
});

test('dynamic texture eviction bounds retained pixels without evicting permanent art', () => {
  const {sprites,canvases}=spriteHost(), art={width:12,height:12};
  sprites.get('sentinel',()=>art);
  for(let i=0;i<2000;i++) {
    sprites.proj('orb','#'+i.toString(16).padStart(6,'0'),8+i%40);
    const stats=sprites.stats(); assert(stats.dynamicEntries<=stats.entryLimit); assert(stats.dynamicBytes<=stats.byteLimit);
  }
  assert(sprites.stats().dynamicEvicted>0);
  assert.equal(canvases.reduce((n,c)=>n+c.width*c.height*4,0),sprites.stats().dynamicBytes);
  assert.equal(sprites.get('sentinel'),art);
});

test('real rainbow rendering stays bounded through a long run and retries; sweep relic renders', async () => {
  const ports=canvasPorts(), h=harness({},ports); await h.ready;
  const {B}=h, hero=h.read("HEROES.findIndex(x=>x.id==='skyjumper')");
  B.newGame(hero,0); B.heroState()[hero].tier=4;
  for(let i=0;i<1200;i++){B.G.time=i*.01673;B.render(1/60);}
  const before=h.read('Sprites.stats().dynamicCreated');
  B.newGame(hero,0); B.heroState()[hero].tier=4;
  for(let i=0;i<600;i++){B.G.time=90+i*.01729;B.render(1/60);}
  assert.equal(h.read('Sprites.stats().dynamicCreated'),before);
  const relic=B.addRelic(h.read("RELICS.find(x=>x.w.type==='sweep').id"));
  relic.L=300;relic.beams=2;relic.ang=0;
  assert.doesNotThrow(()=>B.render(1/60),'disabled lighting must not leave undefined calls in the beam renderer');
});
