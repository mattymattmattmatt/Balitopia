// Actual Canvas gameplay with a scripted player; HTML HUD/audio are omitted.
// Optional @napi-rs/canvas on NODE_PATH and ffmpeg on PATH.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const {createCanvas,Image}=require('@napi-rs/canvas');
const {root}=require('./simulation-harness');
const {pilot}=require('./simulate-raid.cjs');
process.chdir(root);
(async()=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'balitopia-crownfall-'));
  let count=0,still=false;
  try{
    const result=await pilot({maxSeconds:27,ports:{makeCanvas:()=>createCanvas(96,96),Image},onFrame:(h,frame)=>{
      const {B}=h;B.prefs().shake=0;B.prefs().minimap=0;
      if(frame%3!==0||B.G.time<6||B.G.time>23)return;
      B.render(1/20);const buffer=h.nodes.get('game').toBuffer('image/png');
      fs.writeFileSync(path.join(temp,String(count++).padStart(4,'0')+'.png'),buffer);
      if(!still&&B.G.time>14){fs.writeFileSync(path.join(root,'docs/crownfall-preview.png'),buffer);still=true;}
    }});
    execFileSync('ffmpeg',['-v','error','-y','-framerate','20','-i',path.join(temp,'%04d.png'),'-c:v','libx264',
      '-crf','37','-pix_fmt','yuv420p','-movflags','+faststart','-an',path.join(root,'docs/crownfall-gameplay.mp4')]);
    delete result.h;console.log(JSON.stringify({frames:count,seconds:count/20,simulation:result},null,2));
  }finally{fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
