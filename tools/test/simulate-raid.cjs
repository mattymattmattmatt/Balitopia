// Scripted player using real movement, attacks, damage, upgrades and objectives.
// A balance smoke test, not a human enjoyment or device-performance measurement.
const {harness}=require('./simulation-harness');
function pilot({hero=0,mode='expedition',maxSeconds=540,onFrame=()=>{},ports={}}={}){
  const h=harness({},ports);
  function run(){
    if(!ports.makeCanvas)h.boot();
    const {B,nodes,advance}=h;B.setRunSetup(mode,'land','storm');B.newGame(hero,0);
    const beats=[];let previous=-1,frames=0;
    for(;frames<maxSeconds*60&&!B.G.over;frames++){
      advance(1000/60);
      if(!B.G.running){
        if(!nodes.get('screen-crown').classList.contains('hidden')){
          const cards=nodes.get('crown-choices').children;
          const priority=['Chain Reaction','Double Detonation','Soul Harvest','Crown Armour','Redline','Demolition Dash'];
          const selected=priority.map(name=>Array.from(cards).find(c=>c.innerHTML.includes(name))).find(Boolean);selected?.click();
        }else if(!nodes.get('screen-levelup').classList.contains('hidden')&&!B.G.draftBusy){
          const cards=Array.from(nodes.get('upgrade-row').children);
          const priority=['Second Wind','Vitality','Island Blessing','Coconut Mine','Wide Wrath','Battle Haste','Guardian Power','War Chorus'];
          const selected=priority.map(name=>cards.find(c=>c.innerHTML.includes(name))).find(Boolean)||cards[0];selected?.click();
        }else if(!nodes.get('screen-chest').classList.contains('hidden'))nodes.get('btn-chest-close').click();
        continue;
      }
      const p=B.player(),raid=B.G.crown,e=raid.engines[raid.stage],target=B.G.boss||e||p;
      const dx=target.x-p.x,dy=target.y-p.y,d=Math.hypot(dx,dy)||1;
      let mx=dx/d,my=dy/d;
      const radius=B.G.boss?210:130;
      if(d<radius+70){const inward=(d-radius)/90;mx=dx/d*inward-dy/d;my=dy/d*inward+dx/d;}
      let nearby=0,closest=Infinity;
      for(const mob of B.enemies)if(mob.alive){
        const ex=p.x-mob.x,ey=p.y-mob.y,dist=Math.hypot(ex,ey)||1;
        if(dist<330)nearby++;closest=Math.min(closest,dist-mob.r);
        if(dist<180){const weight=(180-dist)/85;mx+=ex/dist*weight;my+=ey/dist*weight;}
      }
      const length=Math.hypot(mx,my)||1;B.joys.move.active=true;B.joys.move.dx=mx/length;B.joys.move.dy=my/length;
      B.buildHash();
      if(nearby>=4||(B.G.boss&&d<320))B.tryPowershot();
      if(closest<50)B.tryDash();
      B.update(1/60);
      if(raid.stage!==previous){previous=raid.stage;beats.push({stage:previous,time:+B.G.time.toFixed(1),hp:Math.round(p.hp),level:B.G.level,kills:B.G.kills});}
      onFrame(h,frames);
    }
    return {hero,mode,won:B.G.victory,over:B.G.over,time:+B.G.time.toFixed(1),level:B.G.level,kills:B.G.kills,
      engines:B.G.crown.cleared,boons:B.G.crown.boons,rampages:B.G.crown.rampages,powershots:B.G.session.powershots,
      hp:Math.round(B.player().hp),cause:B.G.lastHurtBy,frames,beats,h};
  }
  return ports.makeCanvas?h.ready.then(run):run();
}
if(require.main===module){
  const result=pilot({hero:Number(process.argv[2])||0});delete result.h;console.log(JSON.stringify(result,null,2));
}
module.exports={pilot};
