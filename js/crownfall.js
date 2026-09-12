/* Crownfall: objective progression, Fury and stolen powers. Pure run rules.
 * The renderer and game own actors; this module never allocates combat effects. */
'use strict';
const Crownfall = (() => {
  const chapters = [
    { id:'kiln', name:'The Ember Kiln', short:'EMBER KILN', color:'#ffab67', warden:'demonder',
      title:'I · A village without fire',
      story:'Glob stole the village hearths to feed his crown. The first engine burns with the voices of caged Guardians. Their stolen magic still knows the way home.',
      after:'The kiln splits open. Warmth returns to the empty houses, and a stolen power answers your hand.' },
    { id:'choir', name:'The Drowned Choir', short:'DROWNED CHOIR', color:'#73dcf4', warden:'spitter',
      title:'II · The songs beneath the harbour',
      story:'A second engine grinds the harbour’s lullabies into fuel. Its keeper sings through the mouths of the horde. Silence the keeper. Give the songs back.',
      after:'The harbour bells ring for the first time since the invasion. Glob can hear them. He is afraid.' },
    { id:'spire', name:'The Hollow Spire', short:'HOLLOW SPIRE', color:'#d4a0ff', warden:'clubbo',
      title:'III · A crown held up by chains',
      story:'The last engine hangs on the roots of the mountain. All three chains lead to Glob’s throne. Break this one and the king must fight with what is left of himself.',
      after:'The last chain snaps. The crown has nowhere left to hide its hunger. Bring the king down.' },
  ];
  const boons = [
    { id:'aftershock', icon:'◉', name:'Double Detonation', tag:'BLAST BUILD', desc:'Every powershot leaves a second blast at 55% strength after 0.35s.' },
    { id:'chain', icon:'✹', name:'Chain Reaction', tag:'HORDE BUILD', desc:'Every 6 nearby kills detonates a corpse. These blasts cannot feed another chain.' },
    { id:'bulwark', icon:'⬡', name:'Crown Armour', tag:'SURVIVAL BUILD', desc:'Take 15% less damage. Every powershot restores a shield that blocks one hit.' },
    { id:'dashbomb', icon:'ϟ', name:'Demolition Dash', tag:'MOVEMENT BUILD', desc:'Leave an explosive charge when you dash. Dash recharges 40% faster.' },
    { id:'overclock', icon:'♨', name:'Redline', tag:'FURY BUILD', desc:'Earn 35% more Fury. Rampage lasts 10 seconds instead of 8.' },
    { id:'harvest', icon:'✦', name:'Soul Harvest', tag:'RECOVERY BUILD', desc:'Every 12 nearby kills heals 6% HP and pulls loose gems towards you.' },
  ];
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
  function create(mode,seed=1,daily=false) {
    if(daily||mode==='endless')return null;
    let s=(seed|0)||1;
    const rng=()=>{s^=s<<13;s^=s>>>17;s^=s<<5;return(s>>>0)/4294967296;};
    const angle=rng()*Math.PI*2;
    const quota=mode==='blitz'?[16,28,40]:[26,42,60];
    const engines=chapters.map((c,i)=>{
      const a=angle+[0,1.05,-1.05][i],r=[440,940,1050][i];
      return {id:c.id,index:i,x:2600+Math.cos(a)*r,y:2600+Math.sin(a)*r,radius:390,
        target:quota[i],kills:0,state:i===0?'active':'locked',wardenDown:false,wardenSpawned:false};
    });
    return {engines,stage:0,cleared:0,boons:[],pending:null,choiceSeed:(rng()*0xffffffff)>>>0,
      fury:0,rampage:0,rampages:0,grace:0,recovery:0,powerLock:0,chainCount:0,harvestCount:0,vacuum:0,
      blastQueue:[],burstCount:0,bossReady:false,recorded:false};
  }
  function tick(run,dt) {
    if(!run)return;
    dt=clamp(Number(dt)||0,0,60);
    const wasRampage=run.rampage>0;
    run.rampage=Math.max(0,run.rampage-dt);
    run.powerLock=Math.max(0,run.powerLock-dt);
    run.vacuum=Math.max(0,run.vacuum-dt);
    run.grace=Math.max(0,run.grace-dt);
    run.recovery=Math.max(0,run.recovery-dt);
    if(wasRampage&&!run.rampage){run.fury=0;run.recovery=4;}
    if(!run.rampage&&!run.grace)run.fury=Math.max(0,run.fury-dt*5);
    for(const b of run.blastQueue)b.delay-=dt;
  }
  function queueBlast(run,blast) {
    if(!run||run.blastQueue.length>=8)return false;
    run.blastQueue.push({...blast,delay:Math.max(0,blast.delay||0)});return true;
  }
  function takeBlasts(run) {
    const out=[];
    if(!run)return out;
    for(let i=0;i<run.blastQueue.length&&out.length<2;){
      if(run.blastQueue[i].delay<=0)out.push(run.blastQueue.splice(i,1)[0]);else i++;
    }
    return out;
  }
  function killed(run,{x,y,elite=false,engine=-1,nearby=true,chain=false,src=0,damage=50}) {
    if(!run)return {rampage:false,heal:false};
    const active=run.engines[run.stage];
    if(active&&active.state==='active') {
      if(engine===active.index)active.wardenDown=true;
      if((x-active.x)**2+(y-active.y)**2<=active.radius**2)
        active.kills=Math.min(active.target,active.kills+(elite?3:1));
    }
    let rampage=false,heal=false;
    if(nearby) {
      if(!run.rampage&&!run.recovery) {
        run.grace=2.5;
        run.fury=clamp(run.fury+(elite?18:4)*(run.boons.includes('overclock')?1.35:1),0,100);
        if(run.fury>=100){run.rampage=run.boons.includes('overclock')?10:8;run.rampages++;rampage=true;}
      }
      if(!chain&&run.boons.includes('chain')&&++run.chainCount>=6) {
        run.chainCount=0;queueBlast(run,{x,y,r:150,damage,src,delay:.06,kind:'chain'});
      }
      if(run.boons.includes('harvest')&&++run.harvestCount>=12){run.harvestCount=0;heal=true;}
    }
    return {rampage,heal};
  }
  function finishEngine(run) {
    const engine=run&&run.engines[run.stage];
    if(!engine||engine.state!=='active'||!engine.wardenDown||engine.kills<engine.target)return null;
    engine.state='broken';run.cleared++;
    const available=boons.filter(b=>!run.boons.includes(b.id));
    // The first reward offers three clear build directions. Later ones rotate
    // deterministically, without consuming the game's combat RNG.
    const offset=run.stage===0?0:(run.choiceSeed+run.stage*7)%available.length;
    const options=Array.from({length:Math.min(3,available.length)},(_,i)=>available[(offset+i)%available.length].id);
    run.pending={engine:engine.index,options};
    return engine;
  }
  function choose(run,id) {
    if(!run||!run.pending||!run.pending.options.includes(id)||run.boons.includes(id))return false;
    run.boons.push(id);run.pending=null;run.stage++;
    if(run.stage<run.engines.length)run.engines[run.stage].state='active';else run.bossReady=true;
    return true;
  }
  function objective(run) {
    if(!run)return null;
    if(run.bossReady)return {title:'BREAK THE CROWN',detail:'Defeat King Glob',progress:1};
    const e=run.engines[run.stage],c=chapters[run.stage];
    return {title:`${run.stage+1}/3 · ${c.short}`,
      detail:run.pending?'Choose a stolen power':`${e.kills}/${e.target} souls · ${e.wardenDown?'Keeper defeated':'Defeat the keeper'}`,
      progress:(e.kills/e.target*.8)+(e.wardenDown?.2:0)};
  }
  function migrate(save) {
    const s=save.crownfall;
    save.crownfall={best:clamp(Math.floor(Number(s?.best)||0),0,3),wins:Math.max(0,Math.floor(Number(s?.wins)||0)),
      boons:Array.isArray(s?.boons)?[...new Set(s.boons.filter(id=>boons.some(b=>b.id===id)))]:[]};
    return save.crownfall;
  }
  function record(save,run,won) {
    const s=migrate(save);
    if(!run||run.recorded)return s;
    run.recorded=true;s.best=Math.max(s.best,run.cleared);s.wins+=won?1:0;
    s.boons=[...new Set([...s.boons,...run.boons])];return s;
  }
  return {chapters,boons,create,tick,killed,queueBlast,takeBlasts,finishEngine,choose,objective,migrate,record};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=Crownfall;
