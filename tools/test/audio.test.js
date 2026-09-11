const test=require('node:test');
const assert=require('node:assert/strict');
const CombatAudio=require('../../js/combat-audio');
const {harness}=require('./simulation-harness');
const {AudioContextHost,audioHarness}=require('./audio-harness');

test('combat bank has distinct, bounded, click-free sounds with immediate attacks',()=>{
  const bank=CombatAudio.buildBank();let count=0,bytes=0;
  for(const [kind,clips] of Object.entries(bank))for(let c=0;c<clips.length;c++){
    const d=clips[c];count++;bytes+=d.byteLength;
    assert(d.every(Number.isFinite));assert(d.every(v=>Math.abs(v)<=.701));
    assert.equal(Math.abs(d[0]),0);assert(Math.abs(d.at(-1))<.002);
    const attack=d.slice(0,720);assert(attack.reduce((n,v)=>n+v*v,0)/attack.length>.002,kind+' has an audible attack');
    assert(d.length/CombatAudio.sampleRate<=1.12);
    if(c)assert(d.some((v,i)=>Math.abs(v-clips[c-1][i])>.05),'variants differ');
  }
  assert.equal(count,24);assert(bytes<1.2e6);
  assert.strictEqual(CombatAudio.buildBank(),bank,'waveforms are baked once');
});

test('hundreds of deaths in one frame produce a blast and spatial splats, without hundreds of voices',()=>{
  const h=audioHarness();assert(h.Sound.ensure());h.Sound.listener(2600,2600,1400);
  for(let i=0;i<300;i++){h.Sound.sfx.explosion(2600,2600,240);h.Sound.sfx.splatter(2350+i*2,2600,true);}
  h.Sound.tick();const s=h.Sound.audioStats().combat;
  assert(s.voices>=2 && s.voices<=3);assert.equal(s.pending,0);
  assert(h.ctx.started.some(n=>n.buffer.duration>.9),'heavy explosion is audible');
  assert(h.ctx.started.some(n=>n.buffer.duration===.46),'wet ripping layer is audible');
  h.advance(2);h.Sound.tick();assert.equal(h.Sound.audioStats().combat.voices,0);
});

test('sustained mass kills keep voices and allocations bounded, and leave no delayed backlog',()=>{
  const h=audioHarness();h.Sound.ensure();h.Sound.listener(0,0,1400);
  const buffers=h.ctx.buffers;
  for(let frame=0;frame<360;frame++){
    for(let n=0;n<120;n++){h.Sound.sfx.explosion(n-60,0,260);h.Sound.sfx.splatter(n-60,0,true);h.Sound.sfx.goreLand(n-60,0,2);h.Sound.sfx.hit(true,n,0);}
    if(frame%12===0)h.Sound.sfx.powershot(0,0,400);
    h.Sound.tick();h.advance(1/60);
    const s=h.Sound.audioStats().combat;assert(s.voices<=24);assert(s.tails<=4);assert(s.peak<=28);assert.equal(s.pending,0);
  }
  assert.equal(h.ctx.buffers,buffers,'no AudioBuffers are allocated by combat events');
  h.advance(3);h.Sound.tick();const played=h.Sound.audioStats().combat.played;
  h.advance(5);h.Sound.tick();assert.equal(h.Sound.audioStats().combat.played,played);
  assert.equal(h.Sound.audioStats().combat.voices+h.Sound.audioStats().combat.tails,0);
});

test('a powershot steals low-priority detail voices with short fades',()=>{
  const ctx=new AudioContextHost(), mixer=CombatAudio.create({context:ctx,destination:ctx.destination});
  const b=ctx.createBuffer(1,24000,24000);
  for(const [group,n] of [['detail',8],['hit',4],['land',4],['splat',8]])for(let i=0;i<n;i++)mixer.playBuffer(b,{priority:0,group});
  assert.equal(mixer.stats().voices,24);mixer.explosion(0,0,350,true);mixer.flush();
  assert(ctx.started.some(n=>n.buffer.duration===1.12),'powershot is admitted');
  assert(mixer.stats().peak<=28);
  assert(ctx.gains.some(n=>n.gain.events.some(e=>e.kind==='target'&&e.value===0)),'stolen voices fade instead of hard cutting');
  ctx.advance(2);mixer.flush();assert.equal(mixer.stats().voices+mixer.stats().tails,0);
});

test('offscreen audio is culled and mono fallback retains all critical layers',()=>{
  const h=audioHarness({mono:true});h.Sound.ensure();h.Sound.listener(0,0,1000);
  h.Sound.sfx.explosion(5000,5000,200);h.Sound.sfx.splatter(5000,5000);h.Sound.tick();assert.equal(h.ctx.started.length,0);
  h.Sound.sfx.powershot(0,0,350);h.Sound.sfx.splatter(20,0);h.Sound.tick();assert(h.ctx.started.length>=2);
  assert(h.ctx.started.every(n=>n.route.some(x=>x.kind==='compressor')&&n.route.some(x=>x.kind==='shaper')));
});

test('recorded samples share the volume bus and mute stops active and pending effects',async()=>{
  const h=audioHarness({manifest:['button-click']});h.Sound.ensure();await h.settle();
  h.Sound.setSfxVol(.4);h.Sound.sfx.uiClick();assert(h.ctx.started.length>0);
  assert(h.ctx.started.at(-1).route.includes(h.ctx.gains[1]));assert(Math.abs(h.ctx.gains[1].gain.value-.28)<1e-9);
  h.Sound.sfx.explosion(0,0,350);h.Sound.setMuted(true);h.Sound.tick();
  assert.equal(h.Sound.audioStats().combat.voices+h.Sound.audioStats().combat.pending,0);
  assert.equal(h.ctx.gains[0].gain.value,0);
  const n=h.ctx.started.length;h.Sound.sfx.uiClick();h.Sound.sfx.powershot();h.Sound.tick();assert.equal(h.ctx.started.length,n);
  h.Sound.setMuted(false);h.Sound.setSfxVol(0);h.Sound.sfx.powershot();h.Sound.tick();assert.equal(h.ctx.started.length,n);
  h.Sound.setSfxVol(1);h.Sound.sfx.powershot();h.Sound.tick();assert(h.ctx.started.length>n);
});

test('pause and retry cancel sounds and delayed synth cues before they can replay',()=>{
  const h=audioHarness();h.Sound.ensure();h.Sound.sfx.level();h.Sound.sfx.powershot();h.Sound.tick();
  h.Sound.pauseAll();const n=h.ctx.started.length;h.advance(3);h.Sound.tick();
  assert.equal(h.ctx.started.length,n);assert.equal(h.Sound.audioStats().combat.voices,0);
  h.Sound.resumeAll();h.Sound.tick();assert.equal(h.ctx.started.length,n);
  h.Sound.sfx.level();h.Sound.resetCombat();h.advance(2);assert.equal(h.ctx.started.length,n);
  h.Sound.sfx.powershot();h.Sound.tick();assert(h.ctx.started.length>n);
});

test('a late decoded entrance cannot replay after a reset or mute',async()=>{
  let release;
  const h=audioHarness({fetcher:async url=>url.endsWith('manifest.json')?{ok:true,json:async()=>[]}:
    new Promise(resolve=>{release=()=>resolve({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)});})});
  h.Sound.ensure();h.Sound.playFile('assets/audio/enemies/late.wav',1);h.Sound.resetCombat();release();await h.settle();
  assert.equal(h.ctx.started.length,0);
});

test('Gore Off removes wet layers while keeping the blast audible',()=>{
  const h=audioHarness();h.Sound.ensure();h.Sound.setGore('off');
  h.Sound.sfx.splatter(0,0,true);h.Sound.sfx.goreLand(0,0);h.Sound.sfx.powershot();h.Sound.tick();
  assert.equal(h.ctx.started.length,1);assert.equal(h.ctx.started[0].buffer.duration,1.12);
});

test('powershots duck music immediately, suppress chatter and let music recover',()=>{
  const h=audioHarness();h.Sound.ensure();h.Sound.playMusic('music/battle.mp3');h.advance(1.2);
  const music=h.media.at(-1),full=music.volume;
  h.Sound.sfx.powershot();h.Sound.tick();
  assert(music.volume<full*.3,'music yields to the powershot attack');
  const voices=h.ctx.started.length;h.Sound.sfx.gem();h.Sound.sfx.weapon('shot');h.Sound.sfx.combo(30);
  assert.equal(h.ctx.started.length,voices,'minor cues cannot mask the attack');
  h.Sound.setMusicVol(.8);assert(music.volume<full*.3,'adjusting volume preserves the active duck');
  h.advance(1.8);assert(music.volume>full*.97,'music recovers after the impact');
  h.Sound.setSfxVol(0);h.Sound.sfx.powershot();h.Sound.tick();assert(music.volume>full*.97);
});

test('real game explosions, powershots, kills and fragment contacts all reach the new audio',()=>{
  const h=audioHarness();h.Sound.ensure();
  const {B,nodes,boot}=harness({}, {Sound:h.Sound});boot();B.newGame(0,0);B.G.mods.crit=0;B.G.xpNext=1e9;
  for(const c of B.cages())c.broken=true;
  const p=B.player();
  for(let i=0;i<60;i++)B.spawnEnemy('minyar',0,p.x+80+i*3,p.y+100);
  B.buildHash();B.explodeAt(p.x,p.y,400,100000,0);h.Sound.tick();
  assert.equal(B.G.kills,60);assert(h.ctx.started.some(n=>n.buffer?.duration>.9));assert(h.ctx.started.some(n=>n.buffer?.duration===.46));
  for(let i=0;i<100;i++){B.gore.update(1/60);h.Sound.tick();h.advance(1/60);}
  assert(h.ctx.started.some(n=>n.buffer?.duration===.19),'chunk contacts trigger landing sounds');
  B.heroState()[0].charge=1;B.powershot();h.Sound.tick();assert(h.ctx.started.some(n=>n.buffer?.duration===1.12));
  nodes.get('btn-roster').click();assert.equal(h.Sound.audioStats().combat.voices+h.Sound.audioStats().combat.pending,0,'Pause clears combat audio');
  B.newGame(0,0);assert.equal(h.Sound.audioStats().combat.voices+h.Sound.audioStats().combat.pending,0);
});

test('real audio cannot change combat damage, kills or loot through random-number consumption',()=>{
  const h=audioHarness();h.Sound.ensure();
  function run(Sound){const {B}=harness({},Sound?{Sound}:{});B.newGame(0,0);B.G.mods.crit=0;
    for(let i=0;i<50;i++)B.spawnEnemy('minyar',0,2450+i*5,2620);
    B.buildHash();B.explodeAt(2600,2600,400,100000,0);
    return {kills:B.G.kills,damage:B.heroState()[0].dmg,loot:Array.from(B.gems()).filter(g=>g.alive).map(g=>[g.x,g.y,g.val])};}
  assert.deepEqual(run(h.Sound),run());
});
