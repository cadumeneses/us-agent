// Read-only review: renders the deployed UI locally, using production API data.
// Authentication is held by this loopback proxy, never injected into the page.
import assert from 'node:assert/strict';
import express from 'express';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const production='https://us-agent-api.vercel.app';
const folder=resolve('docs/demo-4min30');
const profile=resolve('tmp/guide-browser-'+randomUUID());
const pdfOnly=process.argv.includes('--pdf-only');
const published=JSON.parse(await readFile(resolve(folder,'publicado-em-producao.json'),'utf8'));
const headers={Authorization:`Bearer ${process.env.INGEST_API_KEY?.trim()}`,'X-Organization-Id':'default'};
assert.ok(process.env.INGEST_API_KEY?.trim().length>=32);
await mkdir(resolve(folder,'prints'),{recursive:true});await mkdir(profile,{recursive:true});
const requests=[], screenshots=[], cache=new Map(), errors=[];
const app=express();
app.use('/__guide__/prints',express.static(resolve(folder,'prints')));
app.use('/prints',express.static(resolve(folder,'prints')));
app.get('/__guide__',(_req,res)=>res.sendFile(resolve(folder,'GUIA-ILUSTRADO.html')));
app.use(express.raw({type:()=>true,limit:'1mb'}));
app.use(async(req,res)=>{
  try{
    if(req.path==='/api/auth/session'&&req.method==='GET'){
      // Explicit local preview gate: not a production login/session verification.
      return res.json({enabled:false,authenticated:true});
    }
    const readProfile=req.method==='POST'&&req.path==='/api/internal/project-recommender-profile/load';
    const replay=req.method==='POST'&&/^\/api\/internal\/recommendation-runs\/[a-f0-9-]+\/replay$/.test(req.path);
    if(!['GET','HEAD'].includes(req.method)&&!readProfile&&!replay){
      requests.push({path:req.path,method:req.method,blocked:true});
      return res.status(403).json({error:'Read-only guide preview: writes are disabled.'});
    }
    const isApi=req.path.startsWith('/api/');
    const path=isApi||req.path.startsWith('/assets/')?req.originalUrl:'/';
    const url=new URL(path,production);assert.equal(url.origin,production);
    const cacheKey=req.method+' '+url.pathname+url.search+' '+(readProfile?String(req.body):'');
    let saved=!replay?cache.get(cacheKey):undefined;
    if(!saved){
      const response=await fetch(url,{method:req.method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{...(isApi?headers:{}),...(readProfile||replay?{'Content-Type':'application/json'}:{})},...(readProfile||replay?{body:req.body?.length?req.body:Buffer.from('{}')}:{})});
      saved={status:response.status,type:response.headers.get('content-type')??'application/octet-stream',body:Buffer.from(await response.arrayBuffer())};
      if(!replay)cache.set(cacheKey,saved);
      requests.push({path:url.pathname,method:req.method,status:response.status,productionWrite:false});
    }
    res.status(saved.status).type(saved.type).send(saved.body);
  }catch(error){errors.push({path:req.path,error:error.name});res.status(502).json({error:'Could not read production data for preview.'});}
});
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
const origin=`http://127.0.0.1:${server.address().port}`;
let browser,socket,serial=0;const pending=new Map();
function cdp(method,params={}){const id=++serial;return new Promise((resolveCall,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},30000);
  pending.set(id,{resolve:value=>{clearTimeout(timer);resolveCall(value);},reject:error=>{clearTimeout(timer);reject(error);}});
  socket.send(JSON.stringify({id,method,params}));
});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.text+': '+r.exceptionDetails.exception?.description);return r.result.value;}
async function until(expression,label){for(let n=0;n<160;n++){if(await evaluate(`Boolean(${expression})`))return;await delay(125);}throw Error('Could not find '+label);}
async function navigate(path,ready){await cdp('Page.navigate',{url:origin+path});await until("document.querySelector('.page h1')",path);await until(ready,path+' ready');await delay(200);}
async function click(text){await evaluate(`{const e=[...document.querySelectorAll('.page button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e||e.disabled)throw Error('Unavailable button '+${JSON.stringify(text)});e.click();}`);}
async function edit(label,value){await evaluate(`{const l=[...document.querySelectorAll('.page label')].find(e=>[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()===${JSON.stringify(label)});if(!l)throw Error('Missing field '+${JSON.stringify(label)});const e=l.querySelector('input,select,textarea');const p=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}));}`);await delay(100);}
async function expand(text){await evaluate(`{const e=[...document.querySelectorAll('.page summary')].find(e=>e.textContent.includes(${JSON.stringify(text)}));if(!e)throw Error('Missing section '+${JSON.stringify(text)});e.parentElement.open=true;}`);await delay(100);}
async function scroll(text,selector='button,summary,h2,h3,h4,label,legend'){await evaluate(`{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim()===${JSON.stringify(text)}||e.textContent.trim().startsWith(${JSON.stringify(text)}));if(!e)throw Error('Cannot scroll to '+${JSON.stringify(text)});e.scrollIntoView({block:'start'});window.scrollBy(0,-100);}`);await delay(120);}
async function shot(name,top=false){if(top)await evaluate('window.scrollTo(0,0)');const screenshot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(folder,'prints',name+'.png'),Buffer.from(screenshot.data,'base64'));screenshots.push(name);console.log('Captured '+name);}
try{
  browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let port;for(let n=0;n<100;n++){try{port=Number((await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await delay(100);}assert.ok(port,'Browser did not start.');
  const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const r=JSON.parse(String(event.data));if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
  await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});
  await cdp('Page.enable');await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1050,deviceScaleFactor:1,mobile:false});
  if(pdfOnly){
    await cdp('Page.navigate',{url:origin+'/__guide__'});await until("document.querySelector('main') && [...document.images].every(i=>i.complete&&i.naturalWidth>0)",'guide images');
    const pdf=await cdp('Page.printToPDF',{printBackground:true,preferCSSPageSize:true,displayHeaderFooter:false});
    await writeFile(resolve(folder,'GUIA-ILUSTRADO.pdf'),Buffer.from(pdf.data,'base64'));
    console.log('PDF exported.');
  }else{
    await navigate('/recommendations',"document.body.innerText.includes('Project risks') && !document.body.innerText.includes('Loading your recommenders')");
    await shot('01-recommenders',true);
    await navigate('/recommender-setup',"[...document.querySelectorAll('select option')].some(e=>e.textContent.includes('project-risk-recommender'))");
    await edit('Definition version',JSON.stringify(['project-risk-recommender','2']));await shot('02a-definition-selection',true);await click('Load definition');
    await until("document.body.innerText.includes('State: published')",'published definition');await shot('02-definition',true);
    await expand('Team distribution');await scroll('Team distribution','summary');await shot('03-team-feature');
    const profileLink='/configured-recommendations?definitionId=project-risk-recommender&definitionVersion=2&datasetId=project-risk-recommender-base&datasetVersion=2&project='+encodeURIComponent(published.project);
    await navigate(profileLink,"document.querySelector('select') && document.body.innerText.includes('Team distribution') && !document.body.innerText.includes('Loading project profile')");
    await until("[...document.querySelectorAll('input')].some(e=>e.value==='Web')",'filled project profile');await shot('04-risk-profile',true);
    await scroll('Team distribution','label');await shot('05-team-and-recommend');
    const runPath=name=>'/configured-recommendations?runId='+published.runs[name].id;
    for(const [name,file] of [['distributed','06-distributed-p09'],['colocated','07-colocated-p01']]){
      await navigate(runPath(name),"document.body.innerText.includes('Compared projects and feature contributions')");
      await expand('Compared projects and feature contributions');await scroll('Recommendations','h3');await shot(file);
    }
    await navigate(runPath('nfr-live'),"document.body.innerText.includes('Assess suggestions') && !document.body.innerText.includes('Loading assessments')");
    await scroll('Selected neighbor','h4');await shot('08-nfr-source');
    await scroll('Assess suggestions','h3');await shot('09-confirm-destination');
    await evaluate(`{const item=[...document.querySelectorAll('.nfr-item')].find(e=>e.textContent.includes('Security / access_control'));if(!item)throw Error('Access-control suggestion not found');item.scrollIntoView({block:'start'});window.scrollBy(0,-100);}`);await shot('09a-accept-access-control');
    const live=await evaluate("fetch('/api/internal/recommendation-runs/"+published.runs['nfr-live'].id+"/review').then(r=>r.json()).then(r=>({targetConfirmed:!!r.target,decisionCount:r.decisions.length,copyCount:(r.copies??[]).length}))");
    await navigate(runPath('nfr-rehearsal'),"document.body.innerText.includes('Adapt accepted NFR') && !document.body.innerText.includes('Loading assessments')");
    await expand('Adapt accepted NFR');await scroll('Adapt accepted NFR','summary');await shot('10-adaptation-form');
    await click('Verify replay');await until("document.body.innerText.includes('Replay verified:')",'verified replay');
    await scroll('Verify replay','button');await shot('11-replay-and-export');
    const report={capturedAt:new Date().toISOString(),mode:'Local rendering of deployed production assets with read-only production data',productionOrigin:production,personalLoginTested:false,localAuthGate:'disabled for technical read-only preview',productionWrites:0,screenshots,liveRunStatus:live,requests,errors,entryAssets:[...cache].filter(([key])=>key.includes('/assets/')).map(([key,value])=>({path:key.split(' ')[1],sha256:createHash('sha256').update(value.body).digest('hex')}))};
    assert.equal(errors.length,0);assert.ok(requests.every(r=>r.productionWrite===false||r.blocked));
    await writeFile(resolve(folder,'capturas-verificadas.json'),JSON.stringify(report,null,2)+'\n');
    console.log(JSON.stringify({screenshots:screenshots.length,productionWrites:0,liveRunStatus:live}));
  }
}finally{
  try{if(socket?.readyState===1)await cdp('Browser.close');}catch{}
  socket?.close();browser?.kill();server.closeAllConnections();await new Promise(r=>server.close(r));
}
