const test=require('node:test');
const assert=require('node:assert/strict');
const C=require('../../js/crownfall');
const {harness}=require('./simulation-harness');
function killAt(run,e,n=1,extra={}){for(let i=0;i<n;i++)C.killed(run,{x:e.x,y:e.y,...extra});}
function clearEngine(h){
  const {B}=h,e=B.G.crown.engines[B.G.crown.stage],p=B.player();p.x=e.x;p.y=e.y;B.updateCrown(0);
  const keeper=B.enemies.find(x=>x.alive&&x.crownEngine===e.index);
  assert(keeper,'objective has a real keeper');B.damageEnemy(keeper,1e8,{src:0,noCrit:true,blast:true});
  for(let i=e.kills;i<e.target;i++){const mob=B.spawnEnemy('minyar',0,e.x+40,e.y);assert(mob);B.damageEnemy(mob,1e8,{src:0,noCrit:true});}
  B.buildHash();B.updateCrown(0);return e;
}
test('raid layout is seeded and on the island; Blitz is shorter and daily/endless stay separate',()=>{
  const a=C.create('expedition',123),b=C.create('expedition',123),fast=C.create('blitz',123);
  assert.deepEqual(a,b);assert.notDeepEqual(a.engines,C.create('expedition',456).engines);
  for(let i=0;i<3;i++){const e=a.engines[i];assert(e.x>e.radius&&e.x<5200-e.radius&&e.y>e.radius&&e.y<5200-e.radius);assert(fast.engines[i].target<e.target);}
  assert.equal(C.create('endless'),null);assert.equal(C.create('expedition',1,true),null);
});
test('engine goals require local kills and the keeper; rewards cannot duplicate or skip chapters',()=>{
  const r=C.create('expedition',7),e=r.engines[0];C.killed(r,{x:0,y:0,engine:1});assert.equal(e.kills,0);assert.equal(e.wardenDown,false);
  killAt(r,e,100);assert.equal(e.kills,e.target);assert.equal(C.finishEngine(r),null);
  C.killed(r,{x:0,y:0,engine:0});assert(C.finishEngine(r));assert.equal(r.cleared,1);
  assert.equal(C.finishEngine(r),null);assert.equal(C.choose(r,'fake'),false);
  assert(C.choose(r,'aftershock'));assert.equal(C.choose(r,'aftershock'),false);assert.equal(r.stage,1);
  for(let i=1;i<3;i++){const next=r.engines[i];killAt(r,next,next.target,{engine:i});assert(C.finishEngine(r));assert(r.pending.options.every(id=>!r.boons.includes(id)));assert(C.choose(r,r.pending.options[0]));}
  assert(r.bossReady);assert.equal(r.cleared,3);assert.equal(new Set(r.boons).size,3);
});
test('Fury rewards a streak, expires, and cannot be extended indefinitely by mass kills',()=>{
  const r=C.create('expedition'),e=r.engines[0];killAt(r,e,24);assert.equal(r.fury,96);
  killAt(r,e);assert.equal(r.rampage,8);killAt(r,e,1000);assert.equal(r.rampage,8);assert.equal(r.rampages,1);
  C.tick(r,8);assert.equal(r.rampage,0);assert.equal(r.fury,0);killAt(r,e,100);assert.equal(r.fury,0);
  C.tick(r,4);killAt(r,e,10);C.tick(r,3);assert(r.fury<40);
  const red=C.create('expedition');red.boons=['overclock'];killAt(red,red.engines[0],19);assert.equal(red.rampage,10);
});
test('chain reactions have a fixed queue, process two per tick and cannot feed themselves',()=>{
  const r=C.create('expedition'),e=r.engines[0];r.boons=['chain'];killAt(r,e,60);assert.equal(r.blastQueue.length,8);
  C.tick(r,.1);assert.equal(C.takeBlasts(r).length,2);const before=r.blastQueue.length;
  killAt(r,e,1000,{chain:true});assert.equal(r.blastQueue.length,before);
  for(let i=0;i<10;i++)C.takeBlasts(r);assert.equal(r.blastQueue.length,0);
});
test('migration retains old progress and records raid discoveries only once',()=>{
  const save={v:4,shells:320,unlocked:['bo'],mastery:{bo:3}},old=JSON.stringify(save);
  C.migrate(save);const {crownfall,...rest}=save;assert.equal(JSON.stringify(rest),old);
  const r=C.create('expedition');r.cleared=2;r.boons=['aftershock','chain'];C.record(save,r,false);C.record(save,r,true);
  assert.equal(save.crownfall.best,2);assert.equal(save.crownfall.wins,0);C.record(save,null,true);assert.equal(save.crownfall.wins,0);assert.equal(save.crownfall.boons.length,2);
});
test('a raid starts with a blast and rescue; its boss never arrives from elapsed time alone',()=>{
  const {B}=harness();B.newGame(0,0);assert.equal(B.heroState()[0].charge,1);
  assert(Math.hypot(B.cages()[0].x-B.player().x,B.cages()[0].y-B.player().y)<220);
  B.G.time=1000;B.player().iv=100;B.update(0);assert.equal(B.G.boss,null);
  B.setRunSetup('endless','land','tide');B.newGame(0,0);assert.equal(B.G.crown,null);B.G.time=361;B.update(0);assert(B.G.boss);
});
test('real kills and reward buttons finish three engines, unlock the boss, save the ending and reset safely',()=>{
  const h=harness(),{B,nodes,boot,advance}=h;boot();B.newGame(0,0);B.G.mods.crit=0;let stale;
  for(let i=0;i<3;i++){
    clearEngine(h);assert.equal(B.G.crown.cleared,i+1);assert.equal(B.G.crown.stage,i);
    assert.equal(nodes.get('screen-crown').classList.contains('hidden'),false);assert.equal(B.G.running,false);
    const button=nodes.get('crown-choices').children[0];button.click();button.click();if(stale)stale.click();stale=button;
    assert.equal(B.G.crown.stage,i+1);assert.equal(B.G.crown.boons.length,i+1);assert.equal(B.G.running,true);
  }
  B.player().iv=100;B.G.xpNext=1e9;B.update(.016);assert(B.G.boss);assert(B.G.time<1);
  B.killBoss(B.G.boss);advance(1200);assert(B.G.over&&B.G.victory);assert.equal(B.loadSave().crownfall.wins,1);
  assert.match(nodes.get('expedition-recap').innerHTML,/3\/3 engines/);assert.match(nodes.get('expedition-recap').innerHTML,/harbour remembers/);
  const shells=B.loadSave().shells;B.endGame();assert.equal(B.loadSave().shells,shells);
  nodes.get('btn-retry').click();stale.click();assert.equal(B.G.crown.cleared,0);assert.equal(B.G.crown.boons.length,0);assert.equal(B.G.crown.blastQueue.length,0);
});
test('keepers respect a saturated enemy budget and pooled enemies lose their old keeper identity',()=>{
  const {B}=harness();B.newGame(0,0);B.applyQuality('perf');for(let i=0;i<150;i++)B.spawnEnemy('minyar',0,2600,2600);
  B.updateCrown(0);assert.equal(B.G.crown.engines[0].wardenSpawned,false);
  B.damageEnemy(B.enemies[0],1e8,{src:0});B.updateCrown(0);const keeper=B.enemies.find(e=>e.alive&&e.crownEngine===0);assert(keeper);
  assert.equal(B.enemies.filter(e=>e.alive).length,150);B.damageEnemy(keeper,1e8,{src:0});const replacement=B.spawnEnemy('minyar',0,2600,2600);
  assert.equal(replacement.crownEngine,-1);assert.equal(replacement.miniboss,0);
});
test('pause cannot resume beneath a power choice, and retry invalidates a pending reward',()=>{
  const h=harness(),{B,nodes,boot}=h;boot();B.newGame(0,0);clearEngine(h);
  const stale=nodes.get('crown-choices').children[0];
  nodes.get('btn-roster').click();nodes.get('btn-roster-close').click();assert.equal(B.G.running,false);
  B.newGame(0,0);stale.click();assert.equal(B.G.crown.boons.length,0);assert.equal(B.G.crown.pending,null);
  assert.equal(B.G.session.bonus,0);assert(B.G.running);
});
test('overkill cannot inflate mastery and powershots cannot immediately recharge themselves',()=>{
  const {B}=harness();B.newGame(0,0);B.G.mods.crit=0;const e=B.spawnEnemy('minyar',0,2600,2600);e.hp=25;
  B.damageEnemy(e,1e9,{src:0});assert.equal(B.heroState()[0].dmg,25);B.buildHash();assert(B.powershot());
  const charge=B.heroState()[0].charge;B.addDamage(0,10000);assert.equal(B.heroState()[0].charge,charge);assert.equal(B.powershot(),false);
});
test('stolen blast and dash powers deal delayed damage; the armour choice is applied only once',()=>{
  const h=harness(),{B,nodes}=h;B.newGame(0,0);B.G.mods.crit=0;clearEngine(h);
  nodes.get('crown-choices').children[2].click();assert.equal(B.G.mods.armor,.85);nodes.get('crown-choices').children[2].click();assert.equal(B.G.mods.armor,.85);
  B.G.crown.boons.push('aftershock','dashbomb');B.G.crown.powerLock=0;B.heroState()[0].charge=1;B.buildHash();B.powershot();assert.equal(B.G.wardUp,1);
  const p=B.player(),e=B.spawnEnemy('minyar',0,p.x+30,p.y);e.hp=1000;B.buildHash();B.updateCrown(.4);assert(e.hp<1000);
  const x=p.x,y=p.y;B.tryDash();assert(Math.abs(B.G.dashCd-3.6)<1e-8);
  const target=B.spawnEnemy('minyar',0,x,y);target.hp=1000;B.buildHash();B.updateCrown(.31);assert(target.hp<1000);
});
test('Soul Harvest heals and attracts gems, while Rampage speeds actual blast recharge',()=>{
  const {B}=harness();B.newGame(0,0);const p=B.player();p.hp=30;B.G.crown.boons=['harvest'];
  for(let i=0;i<12;i++){const e=B.spawnEnemy('minyar',0,p.x+30,p.y);B.damageEnemy(e,1e8,{src:0});}
  assert(p.hp>30);assert(B.G.crown.vacuum>0);B.heroState()[0].charge=0;B.G.crown.rampage=8;B.updateCrown(1);
  assert(B.heroState()[0].charge>=.34);assert.equal(B.G.crown.rampage,7);
});
