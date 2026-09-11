// Web Audio scheduling/graph host for tests. This is not a browser audio device.
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const {root}=require('./simulation-harness');
class Param {
  constructor(ctx,value=0){this.ctx=ctx;this.initial=value;this._value=value;this.events=[];}
  get value(){return this._value;}
  set value(v){this._value=v;this.events.push({kind:'set',value:v,time:this.ctx.currentTime});}
  setValueAtTime(v,t){this._value=v;this.events.push({kind:'set',value:v,time:t});}
  exponentialRampToValueAtTime(v,t){this._value=v;this.events.push({kind:'exp',value:v,time:t});}
  setTargetAtTime(v,t,tau){this._value=v;this.events.push({kind:'target',value:v,time:t,tau});}
  cancelScheduledValues(t){this.events=this.events.filter(e=>e.time<t);}
}
class Node {
  constructor(ctx,kind){this.ctx=ctx;this.kind=kind;this.outputs=[];this.disconnected=false;}
  connect(n){this.outputs.push(n);return n;}
  disconnect(){this.outputs=[];this.disconnected=true;}
}
class AudioContextHost {
  constructor(){this.currentTime=0;this.sampleRate=48000;this.state='running';this.destination=new Node(this,'destination');this.sources=[];this.gains=[];this.buffers=0;this.started=[];this.nodes=[];}
  createGain(){const n=new Node(this,'gain');n.gain=new Param(this,1);this.gains.push(n);return n;}
  createBuffer(ch,length,rate){this.buffers++;const data=Array.from({length:ch},()=>new Float32Array(length));return {length,numberOfChannels:ch,sampleRate:rate,duration:length/rate,getChannelData:i=>data[i]};}
  createBufferSource(){
    const n=new Node(this,'source');n.playbackRate=new Param(this,1);n.stopAt=Infinity;n.startAt=Infinity;n.ended=false;
    n.start=(time=this.currentTime,offset=0)=>{
      n.startAt=time;n.offset=offset;n.route=[];let cur=n.outputs[0];
      for(let i=0;cur&&i<20;i++){n.route.push(cur);cur=cur.outputs[0];}
      // Capture the initial route for the reproducible offline audition.
      n.mixGain=n.route.filter(x=>x.kind==='gain').reduce((g,x)=>g*x.gain.value,1);
      n.stereoPan=n.route.find(x=>x.kind==='panner')?.pan.value||0;
      this.started.push(n);
    };
    n.stop=(time=this.currentTime)=>{n.stopAt=time;};
    this.sources.push(n);return n;
  }
  createOscillator(){const n=this.createBufferSource();n.kind='oscillator';n.frequency=new Param(this,440);return n;}
  createBiquadFilter(){const n=new Node(this,'filter');n.frequency=new Param(this,350);return n;}
  createStereoPanner(){const n=new Node(this,'panner');n.pan=new Param(this,0);return n;}
  createWaveShaper(){const n=new Node(this,'shaper');this.nodes.push(n);return n;}
  createDynamicsCompressor(){const n=new Node(this,'compressor');for(const k of ['threshold','knee','ratio','attack','release'])n[k]=new Param(this);this.nodes.push(n);return n;}
  async decodeAudioData(){const b=this.createBuffer(1,4800,48000);for(let i=0;i<b.length;i++)b.getChannelData(0)[i]=Math.sin(i*.2)*.2;return b;}
  async resume(){this.state='running';}
  async suspend(){this.state='suspended';}
  advance(seconds){
    this.currentTime+=seconds;
    for(const n of this.sources){
      const natural=n.buffer?n.startAt+Math.max(0,n.buffer.duration-(n.offset||0))/(n.playbackRate.value||1):Infinity;
      if(!n.ended && Math.min(n.stopAt,natural)<=this.currentTime){n.ended=true;if(n.onended)n.onended();}
    }
  }
}
function audioHarness({manifest=[],fetcher,mono=false}={}) {
  let ctx, nextTimer=0;const timers=new Map(), media=[],requests=[];
  const noop=()=>{};
  class Audio {
    constructor(src=''){this.src=src;this.volume=1;this.muted=false;this.paused=true;this.ended=false;this.dataset={};media.push(this);}
    play(){this.paused=false;return Promise.resolve();} pause(){this.paused=true;}load(){}removeAttribute(){}addEventListener(){}
  }
  const sandbox={console,Float32Array,Math,Map,Set,Array,Promise,Audio,
    performance:{now:()=>ctx?ctx.currentTime*1000:0},
    document:{hidden:false,createElement:()=>({canPlayType:()=>''}),addEventListener:noop},
    setTimeout:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,at:(ctx?ctx.currentTime*1000:0)+ms});return id;},
    clearTimeout:id=>timers.delete(id),
    setInterval:(fn,ms)=>{const id=++nextTimer;timers.set(id,{fn,at:(ctx?ctx.currentTime*1000:0)+ms,interval:ms});return id;},
    clearInterval:id=>timers.delete(id),
    fetch:async(url,options)=>{
      requests.push(url);
      if(fetcher)return fetcher(url,options);
      return {ok:true,json:async()=>manifest,arrayBuffer:async()=>new ArrayBuffer(8)};
    },
    AudioContext:function(){ctx=new AudioContextHost();if(mono)ctx.createStereoPanner=null;return ctx;}};
  sandbox.window=sandbox;vm.createContext(sandbox);
  for(const file of ['js/combat-audio.js','js/audio.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),sandbox,{filename:file});
  const Sound=vm.runInContext('Sound',sandbox);
  function advance(seconds){
    const target=ctx.currentTime+seconds;
    for(;;){const next=[...timers.entries()].filter(([,v])=>v.at<=target*1000).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;
      ctx.advance(Math.max(0,next[1].at/1000-ctx.currentTime));
      if(next[1].interval)next[1].at+=next[1].interval;else timers.delete(next[0]);
      next[1].fn();}
    ctx.advance(Math.max(0,target-ctx.currentTime));
  }
  return {Sound,get ctx(){return ctx;},media,requests,advance,sandbox,settle:()=>new Promise(resolve=>setImmediate(resolve)),timers};
}
module.exports={AudioContextHost,audioHarness};
