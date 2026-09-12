const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const AppUpdates = require('../../js/update');
const {root} = require('./simulation-harness');
function workerHost() {
  const events={}, stores=new Map(), requests=[];
  const base='https://example.test/Balitopia/sw.js';
  const key=r=>new URL(typeof r==='string'?r:r.url,base).href;
  let offline=false, missing=false, skipped=0, claimed=0, updates=0, build='6-crownfall';
  const response=text=>new Response(text,{status:200});
  const net=async req=>{ requests.push(req); if(offline) throw Error('offline'); if(missing && req.url.includes('gore.js')) return new Response('',{status:404}); return response('fresh:'+key(req)+`<meta name="balitopia-build" content="${build}">`); };
  const caches={
    async open(name) {
      if(!stores.has(name)) stores.set(name,new Map()); const entries=stores.get(name);
      return {
        async match(req) { const r=entries.get(key(req)); return r?.clone(); },
        async put(req,res) { entries.set(key(req),res); },
        async keys() { return [...entries.keys()].map(url=>new Request(url)); },
        async delete(req) { return entries.delete(key(req)); },
        async addAll(reqs) { const fetched=await Promise.all(reqs.map(net)); if(fetched.some(r=>!r.ok)) throw Error('incomplete shell'); reqs.forEach((r,i)=>entries.set(key(r),fetched[i])); },
      };
    },
    async keys(){return [...stores.keys()];}, async delete(name){return stores.delete(name);},
  };
  const sandbox={URL,Request,Response,caches,fetch:net,self:{location:new URL(base),
    registration:{update:async()=>updates++},addEventListener:(name,fn)=>events[name]=fn,skipWaiting:async()=>skipped++,clients:{claim:async()=>claimed++}}};
  vm.runInNewContext(fs.readFileSync(path.join(root,'sw.js'),'utf8'),sandbox);
  const dispatch=(name,extra={})=>{let result;events[name]({...extra,waitUntil:p=>result=p});return result;};
  async function fetchEvent(url,mode='cors') {
    const request = new Request(new URL(url,base));
    // Node cannot construct mode=navigate; browsers assign this to navigations.
    Object.defineProperty(request,'mode',{value:mode}); let result, work=[];
    events.fetch({request,respondWith:p=>result=p,waitUntil:p=>work.push(p)});
    const res=await result; await Promise.all(work); return res;
  }
  return {caches,stores,requests,dispatch,fetchEvent,offline:v=>offline=v,missing:v=>missing=v,build:v=>build=v,counts:()=>({skipped,claimed,updates})};
}

test('offline worker installs the complete versioned shell while bypassing stale HTTP caches',async()=>{
  const h=workerHost(); await h.dispatch('install');
  assert.equal(h.counts().skipped,1); assert(h.requests.every(r=>r.cache==='reload'));
  const html=fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert(html.includes('<meta name="balitopia-build" content="6-crownfall">'));
  for(const [,asset] of html.matchAll(/(?:src|href)="((?:js|css)\/[^\"]+)"/g))
    assert(h.requests.some(r=>r.url.endsWith('/'+asset)),asset+' is precached under its exact version');
  await h.caches.open('balitopia-shell-v3-gore'); await h.caches.open('unrelated-app');
  await h.dispatch('activate');
  assert(!h.stores.has('balitopia-shell-v3-gore')); assert(h.stores.has('unrelated-app')); assert.equal(h.counts().claimed,1);
});

test('a partial shell cannot replace the currently working offline build',async()=>{
  const h=workerHost(); h.missing(true);
  await assert.rejects(h.dispatch('install'),/incomplete/);
  assert.equal(h.counts().skipped,0);
});

test('navigation refreshes online and falls back offline, and never returns HTML for a missing script',async()=>{
  const h=workerHost(); await h.dispatch('install');
  const shell=await h.caches.open('balitopia-shell-v6-crownfall');
  await shell.put('./index.html',new Response('old entry'));
  const online=await h.fetchEvent('./','navigate'); assert.match(await online.text(),/^fresh:/);
  assert.equal(h.requests.at(-1).cache,'no-store');
  h.offline(true);
  const offline=await h.fetchEvent('./','navigate'); assert.match(await offline.text(),/^fresh:/);
  const js=await h.fetchEvent('./js/gore.js?v=6-crownfall'); assert.match(await js.text(),/gore.js/);
  await assert.rejects(h.fetchEvent('./js/missing.js'),/offline/);
});

test('worker activation waits for a safe menu, saves first, and reloads only once',async()=>{
  const events={}, order=[]; let safe=false, tick, registerOptions, updates=0;
  const listen=(name,fn)=>events[name]=fn;
  const host={navigator:{serviceWorker:{controller:{},addEventListener:listen,removeEventListener(){},
    register:async(_url,options)=>{registerOptions=options; return {update:async()=>updates++};}}},
    location:{protocol:'https:',reload:()=>order.push('reload')},
    document:{readyState:'complete',hidden:false,addEventListener:listen,removeEventListener(){}},
    addEventListener:listen,removeEventListener(){},setInterval:fn=>{tick=fn;return 1;},clearInterval(){}};
  const dispose=AppUpdates.start({host,canReload:()=>safe,beforeReload:()=>order.push('save')});
  await Promise.resolve();await Promise.resolve();
  assert.equal(registerOptions.updateViaCache,'none');assert.equal(updates,1);
  events.controllerchange(); tick(); assert.deepEqual(order,[], 'active or paused runs survive activation');
  safe=true;host.document.hidden=true;tick();assert.deepEqual(order,[], 'hidden tabs wait');
  host.document.hidden=false; events.visibilitychange();tick();events.controllerchange();
  assert.deepEqual(order,['save','reload']);dispose();
});

test('a first installation does not reload or interrupt the first run',()=>{
  let reloads=0, change, tick;
  const host={navigator:{serviceWorker:{controller:null,addEventListener:(_,fn)=>change=fn,removeEventListener(){}}},
    location:{protocol:'https:',reload:()=>reloads++},document:{readyState:'loading',hidden:false,addEventListener(){},removeEventListener(){}},
    addEventListener(){},removeEventListener(){},setInterval:fn=>{tick=fn;return 1;},clearInterval(){}};
  AppUpdates.start({host,canReload:()=>true});change();tick();assert.equal(reloads,0);
});


test('a newer HTML entry waits for its matching worker instead of mixing releases',async()=>{
  const h=workerHost(); await h.dispatch('install');
  h.build('7-next');
  const old=await h.fetchEvent('./','navigate');
  assert.match(await old.text(),/content="6-crownfall"/);
  assert.equal(h.counts().updates,1);
  h.offline(true);
  assert.match(await (await h.fetchEvent('./','navigate')).text(),/content="6-crownfall"/);
});
