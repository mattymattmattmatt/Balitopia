// Offline audition of the actual CombatAudio buffers and Sound event scheduling.
// FFmpeg approximates the shared compressor; this is not a browser/device recording.
// Requires Node and ffmpeg on PATH. No packages or external services.
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {execFileSync}=require('node:child_process');
const {audioHarness}=require('./audio-harness');
const {root}=require('./simulation-harness');

const rate=48000, seconds=10.2, frames=Math.round(seconds*60);
const h=audioHarness();h.Sound.ensure();h.Sound.listener(0,0,1400);
function burst(n,power=false,r=250){
  for(let i=0;i<n;i++){
    const x=((i*73)%480)-240,y=((i*131)%160)-80;
    h.Sound.sfx.explosion(x,y,r);h.Sound.sfx.splatter(x,y,n>3);
  }
  if(power)h.Sound.sfx.powershot(0,0,400);
}
function land(n=30){for(let i=0;i<n;i++)h.Sound.sfx.goreLand(((i*47)%500)-250,40,1+i%3);}
for(let frame=0;frame<frames;frame++){
  if(frame===15)h.Sound.sfx.explosion(0,0,100);
  if([87,114,141].includes(frame))h.Sound.sfx.splatter(frame===87?-150:frame===114?150:0,0,frame===141);
  if([100,127,160].includes(frame))land(3);
  if(frame===192)burst(120,true);
  if([238,246,257].includes(frame))land();
  if(frame>=324 && frame<=420 && frame%6===0)burst(30,frame%30===0);
  if(frame>=360 && frame<=444 && frame%8===0)land();
  if(frame===486)burst(180,true);
  if([530,539,551,565].includes(frame))land();
  h.Sound.tick();h.advance(1/60);
}

const mixed=new Float32Array(Math.ceil(seconds*rate)*2);
for(const source of h.ctx.started){
  if(!source.buffer)throw Error('Preview must contain original combat buffers only');
  const pcm=source.buffer.getChannelData(0),speed=source.playbackRate.value;
  const start=Math.round(source.startAt*rate), end=Math.min(mixed.length/2,Math.ceil(Math.min(source.stopAt,source.startAt+source.buffer.duration/speed)*rate));
  const pan=(source.stereoPan+1)*Math.PI/4;
  // Render at the compressor input; master gain is applied afterwards.
  const gain=source.mixGain/.85, left=Math.cos(pan)*gain,right=Math.sin(pan)*gain;
  const release=source.route[0].gain.events.find(e=>e.kind==='target' && e.value===0);
  for(let i=start;i<end;i++){
    const time=i/rate,at=(time-source.startAt)*source.buffer.sampleRate*speed;
    if(at<0)continue;
    const j=Math.floor(at),f=at-j;
    const fade=release && time>=release.time?Math.exp(-(time-release.time)/release.tau):1;
    const sample=((pcm[j]||0)*(1-f)+(pcm[j+1]||0)*f)*fade;
    mixed[i*2]+=sample*left;mixed[i*2+1]+=sample*right;
  }
}

const temp=fs.mkdtempSync(path.join(os.tmpdir(),'balitopia-impact-'));
const out=path.join(root,'docs/impact-audio-preview.mp3');
try{
  const raw=path.join(temp,'mix.f32'),compressed=path.join(temp,'compressed.f32'),finished=path.join(temp,'finished.f32');
  fs.writeFileSync(raw,Buffer.from(mixed.buffer));
  execFileSync('ffmpeg',['-v','error','-y','-f','f32le','-ar',String(rate),'-ac','2','-i',raw,
    '-af','acompressor=threshold=0.316228:ratio=4:attack=3:release=160:knee=2.5119:makeup=1:detection=peak:link=maximum',
    '-f','f32le',compressed]);
  const bytes=fs.readFileSync(compressed),data=new Float32Array(bytes.buffer,bytes.byteOffset,bytes.length/4);
  let peak=0,energy=0;
  for(let i=0;i<data.length;i++){
    const x=data[i]*.85,a=Math.min(1,Math.abs(x));
    data[i]=Math.sign(x)*(a<=.8?a:.8+.16*Math.tanh((a-.8)/.16));
    peak=Math.max(peak,Math.abs(data[i]));energy+=data[i]*data[i];
  }
  fs.writeFileSync(finished,bytes);fs.mkdirSync(path.dirname(out),{recursive:true});
  execFileSync('ffmpeg',['-v','error','-y','-f','f32le','-ar',String(rate),'-ac','2','-i',finished,
    '-c:a','libmp3lame','-b:a','160k','-metadata','title=Balitopia — Impact Audio, Build 5',out]);
  console.log(JSON.stringify({out,seconds,voices:h.ctx.started.length,mixer:h.Sound.audioStats().combat,
    pcmPeakDb:20*Math.log10(peak),pcmRmsDb:10*Math.log10(energy/data.length),bytes:fs.statSync(out).size},null,2));
}finally{fs.rmSync(temp,{recursive:true,force:true});}
