/* Original, pre-baked combat sounds and a bounded Web Audio voice mixer.
 * No downloads, oscillators or sample generation on a kill's hot path. */
'use strict';
const CombatAudio = (() => {
  const RATE = 24000, MAX_VOICES = 24, MAX_TAILS = 4;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  function rng(seed) { return () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; }; }
  const rand = rng(0x51a7f00d);
  let bank;
  function buildBank() {
    if (bank) return bank;
    bank = {};
    const specs = { blast: [3,0.64], heavy: [3,0.94], power: [3,1.12], splat: [5,0.29], rip: [3,0.46], land: [4,0.19], hit: [3,0.09] };
    for (const [kind,[count,duration]] of Object.entries(specs)) {
      bank[kind] = [];
      for (let variant=0;variant<count;variant++) {
        const random=rng(0x39a512 + variant*971 + kind.charCodeAt(0)*197);
        const data=new Float32Array(Math.round(duration*RATE));
        const pitch=0.93+random()*0.14;
        let low=0, mid=0, bodyPhase=0, wetPhase=0, dc=0, previous=0;
        const explosive=['blast','heavy','power'].includes(kind);
        const massive=kind==='power', heavy=kind==='heavy'||massive;
        const bubbles=Array.from({length:kind==='rip'?13:7},(_,i)=>({
          at:i===0?0.004:0.013+i*(kind==='rip'?0.027:0.021)+random()*0.01,
          hz:260+random()*900, decay:0.008+random()*0.023, weight:0.25+random()*0.3,
        }));
        for(let i=0;i<data.length;i++) {
          const t=i/RATE, white=random()*2-1;
          low += 0.055*(white-low); mid += (explosive?0.3:0.42)*(white-mid);
          let s;
          if(explosive) {
            // Crack, chesty thump, falling sub and a textured pressure tail.
            // The upper harmonics carry the body on small phone speakers.
            const freq=(heavy?49:66)+(massive?136:105)*Math.exp(-t*32);
            bodyPhase += TAU*freq*pitch/RATE;
            const body=(Math.sin(bodyPhase)+0.36*Math.sin(bodyPhase*2)+0.23*Math.sin(bodyPhase*3));
            const thump=body*Math.exp(-t/(heavy?0.18:0.115))*0.69;
            const crack=(white-mid)*Math.exp(-t/0.017)*0.85;
            const pressure=(mid*0.54+low*1.6)*Math.exp(-t/(heavy?0.23:0.13));
            const grit=(white-low)*Math.pow(0.5+0.5*Math.sin(t*(930+variant*53)),5)*Math.exp(-t/0.10)*0.19;
            const roll=low*2.0*Math.exp(-t/(massive?0.29:0.20))*(1-Math.exp(-t*32));
            // A closely following crack makes the powershot a distinct double hit.
            const double=massive&&t>0.038?(white-mid)*Math.exp(-(t-0.038)/0.014)*0.46:0;
            s=thump+crack+pressure+grit+roll+double;
          } else if(kind==='splat'||kind==='rip') {
            // Short, irregular liquid transients over a thick tearing texture.
            const tear=Math.pow(Math.max(0,Math.sin(t*(210+variant*29))),0.6);
            const wetFreq=(220+800*Math.exp(-t*20))*pitch;
            wetPhase += TAU*wetFreq/RATE;
            s=(mid*1.1+low*1.8)*(0.38+tear*0.62)*Math.exp(-t/(kind==='rip'?0.095:0.058));
            s+=Math.sin(wetPhase)*0.19*Math.exp(-t/0.035);
            s+=(white-mid)*0.29*Math.exp(-t/0.011);
            for(const b of bubbles) {
              const u=t-b.at;
              if(u>=0 && u<b.decay*5) s+=b.weight*Math.sin(TAU*b.hz*pitch*(u-0.27*u*u/b.decay))*Math.exp(-u/b.decay)*(1-Math.exp(-u*1800));
            }
            if(kind==='rip') s+=low*Math.exp(-t/0.15)*1.2;
          } else {
            const landing=kind==='land';
            bodyPhase += TAU*(landing?105+130*Math.exp(-t*70):210+370*Math.exp(-t*95))*pitch/RATE;
            s=Math.sin(bodyPhase)*Math.exp(-t/(landing?0.038:0.014))*0.55;
            s+=(mid+low)*Math.exp(-t/(landing?0.025:0.012))*1.1;
            s+=(white-mid)*Math.exp(-t/0.005)*0.36;
            if(landing && t>0.044) s+=mid*0.5*Math.exp(-(t-0.044)/0.016);
          }
          // DC blocker, soft saturation, click-free attack and tail.
          const hp=s-previous+0.992*dc; previous=s; dc=hp;
          const envelope=Math.min(1,t/0.0015)*Math.min(1,(duration-t)/0.018);
          data[i]=Math.tanh(hp*1.25)*0.70*envelope;
        }
        bank[kind].push(data);
      }
    }
    return bank;
  }
  const TAU=Math.PI*2;
  function create({context:ctx,destination,onImpact=()=>{}}) {
    const buffers={}, rounds={}, voices=new Set(), tails=new Set();
    const pcm=buildBank();
    for(const [kind,clips] of Object.entries(pcm)) buffers[kind]=clips.map(data=>{
      const b=ctx.createBuffer(1,data.length,RATE); b.getChannelData(0).set(data); return b;
    });
    let enabled=true, gore=true, x=0,y=0,range=800, focusUntil=0, peak=0, played=0, dropped=0;
    let blast={n:0,r:0,power:false,pan:0,weight:0,gain:0};
    const pending={splat:Array.from({length:3},()=>({n:0,pan:0,gain:0,big:false})),land:Array.from({length:3},()=>({n:0,pan:0,gain:0,big:false}))};
    const last={blast:-Infinity,power:-Infinity,splat:-Infinity,land:-Infinity,hit:-Infinity};
    function cleanup(v) { v.source.disconnect(); v.gain.disconnect(); if(v.pan) v.pan.disconnect(); voices.delete(v); tails.delete(v); }
    function stopVoice(v) { try{v.source.stop();}catch(_){} cleanup(v); }
    function retire(v) {
      if(tails.size>=MAX_TAILS) stopVoice(tails.values().next().value);
      const t=ctx.currentTime;
      v.gain.gain.cancelScheduledValues(t); v.gain.gain.setTargetAtTime(0,t,0.002);
      v.source.stop(t+0.008); voices.delete(v); tails.add(v);
    }
    function prune() { for(const set of [voices,tails]) for(const v of set) if(v.end<=ctx.currentTime) cleanup(v); }
    function playBuffer(buffer,{gain=0.6,pan=0,priority=1,group='detail',rate=1,delay=0}={}) {
      if(!enabled||ctx.state!=='running'||!buffer) return false;
      prune();
      const cap=({blast:4,splat:8,land:4,hit:4,detail:8,ui:4})[group]||6;
      const groupVoices=[...voices].filter(v=>v.group===group);
      if(groupVoices.length>=cap || voices.size>=MAX_VOICES) {
        const candidates=groupVoices.length>=cap?groupVoices:[...voices];
        const victim=candidates.filter(v=>v.priority<=priority).sort((a,b)=>a.priority-b.priority||a.started-b.started)[0];
        if(!victim){dropped++;return false;} retire(victim);
      }
      const t=ctx.currentTime+clamp(delay,0,0.08), speed=clamp(rate,0.75,1.3);
      const source=ctx.createBufferSource(), g=ctx.createGain();
      const p=ctx.createStereoPanner?ctx.createStereoPanner():null;
      source.buffer=buffer; source.playbackRate.value=speed;
      g.gain.value=clamp(gain,0,1.25); source.connect(g);
      if(p){p.pan.value=clamp(pan,-0.7,0.7);g.connect(p);p.connect(destination);}else g.connect(destination);
      const v={source,gain:g,pan:p,group,priority,started:t,end:t+buffer.duration/speed+0.02};
      source.onended=()=>cleanup(v); voices.add(v); peak=Math.max(peak,voices.size+tails.size); played++;
      source.start(t); source.stop(v.end); return true;
    }
    function cue(kind,options) {
      const list=buffers[kind], index=rounds[kind]||0;
      rounds[kind]=(index+1)%list.length;
      return playBuffer(list[index],{rate:0.965+rand()*0.07,...options});
    }
    function position(px=x,py=y) {
      const dx=px-x,dy=py-y,d=Math.hypot(dx,dy);
      if(!Number.isFinite(d)||d>range*1.3) return null;
      return {pan:clamp(dx/(range*0.75),-0.7,0.7),gain:clamp(1-d/(range*1.55),0.15,1)};
    }
    function explosion(px,py,r=100,power=false) {
      if(!enabled) return;
      const at=position(px,py);if(!at)return;
      blast.n=Math.min(128,blast.n+1);blast.r=Math.max(blast.r,r);blast.power ||= power;
      blast.pan+=at.pan*at.gain;blast.weight+=at.gain;blast.gain=Math.max(blast.gain,at.gain);
    }
    function collect(kind,px,py,big=false,amount=1) {
      if(!enabled||!gore)return;
      const at=position(px,py);if(!at)return;
      const b=pending[kind][at.pan<-.22?0:at.pan>.22?2:1];
      b.n=Math.min(256,b.n+amount);b.pan=at.pan;b.gain=Math.max(b.gain,at.gain);b.big ||= big;
    }
    function hit(px,py,crit=false) {
      if(!enabled)return;
      const t=ctx.currentTime,at=position(px,py);
      if(!at||t<focusUntil||t-last.hit<(crit?.065:.09))return;
      last.hit=t;cue('hit',{gain:at.gain*(crit?.43:.24),pan:at.pan,priority:0,group:'hit'});
    }
    function clearPending() {
      blast.n=0;blast.r=0;blast.power=false;blast.pan=0;blast.weight=0;blast.gain=0;
      for(const list of Object.values(pending)) for(const b of list){b.n=0;b.pan=0;b.gain=0;b.big=false;}
    }
    function flush() {
      prune();if(!enabled){clearPending();return;}
      const t=ctx.currentTime;
      let impact=false;
      if(blast.n) {
        const power=blast.power,key=power?'power':'blast';
        if(t-last[key]>=(power?.12:.075)) {
          const kind=power?'power':blast.r>=160||blast.n>=4?'heavy':'blast';
          impact=cue(kind,{gain:blast.gain*(power?1.13:kind==='heavy'?.95:.79),pan:blast.pan/(blast.weight||1),priority:power?4:3,group:'blast',rate:1});
          if(impact) {
            last[key]=t;last.blast=t;focusUntil=t+(power?.30:.12);
            // Ordinary impact chatter yields the attack to the blast.
            for(const v of [...voices]) if(v.group==='hit'||v.group==='detail'&&v.priority===0) retire(v);
            onImpact(power?.65:.22,power?.28:.60);
          }
        }
      }
      for(const kind of ['splat','land']) {
        const list=pending[kind];
        if(t-last[kind]>=(kind==='splat'?.065:.11)) {
          const candidates=list.filter(b=>b.n).sort((a,b)=>b.n*b.gain-a.n*a.gain).slice(0,2);
          for(const b of candidates) {
            const heavy=b.big||b.n>=4;
            cue(kind==='land'?'land':heavy?'rip':'splat',{
              gain:b.gain*(kind==='land'?.24+Math.min(.16,b.n*.025):.57+Math.min(.25,Math.log2(b.n+1)*.055)),
              pan:b.pan,priority:kind==='splat'?2:0,group:kind,delay:impact&&kind==='splat'?.022:0,
            });
          }
          if(candidates.length)last[kind]=t;
        }
      }
      // Never replay a backlog after a pause, frame stall or saturated window.
      clearPending();
    }
    function stop() {
      for(const v of [...voices,...tails])stopVoice(v);
      clearPending();focusUntil=0;
      for(const key of Object.keys(last))last[key]=-Infinity;
    }
    return {playBuffer,explosion,hit,flush,stop,
      splat:(px,py,big=false)=>collect('splat',px,py,big),
      land:(px,py,energy=1)=>collect('land',px,py,false,clamp(energy,1,3)),
      listener:(px,py,width=1400)=>{x=px;y=py;range=Math.max(300,width*.65);},
      setEnabled:value=>{enabled=!!value;if(!enabled)stop();},
      setGore:value=>{gore=value!=='off';if(!gore){for(const v of [...voices])if(v.group==='splat'||v.group==='land')retire(v);for(const list of Object.values(pending))for(const b of list){b.n=0;b.pan=0;b.gain=0;b.big=false;}}},
      get focused(){return ctx.currentTime<focusUntil;},
      stats:()=>({voices:voices.size,tails:tails.size,peak,played,dropped,pending:blast.n+Object.values(pending).flat().reduce((n,b)=>n+b.n,0),buffers:Object.values(buffers).reduce((n,b)=>n+b.length,0),bytes:Object.values(pcm).flat().reduce((n,b)=>n+b.byteLength,0)})};
  }
  return {create,buildBank,sampleRate:RATE,limits:{voices:MAX_VOICES,tails:MAX_TAILS}};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=CombatAudio;
