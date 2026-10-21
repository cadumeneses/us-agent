// Browser review against synthetic LOCAL fixtures; never loads production credentials.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import pg from 'pg';
import { loadMigrationRelease, applyMigrationRelease } from './lib/deployment-migrations.mjs';
import { prepareWebUsers, provisionWebUsers } from './lib/web-user-provisioning.mjs';

const schema = 'workspace_ux_' + randomUUID().replaceAll('-', '');
const local = 'postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent';
const client = new pg.Client({connectionString:local,connectionTimeoutMillis:3000});
const artifacts = resolve('docs/evidencias/ui-ux-2026-10-21/unified-wis'), profile = resolve('tmp',schema,'edge-profile');
let server, pool, browser, socket, created = false, serial = 0;
const pending = new Map(), errors = [], checks = [];
function cdp(method,params={}) { const id=++serial; return new Promise((resolveCall,reject)=>{
  const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},15000);
  pending.set(id,{resolve:value=>{clearTimeout(timer);resolveCall(value);},reject:error=>{clearTimeout(timer);reject(error);}});
  socket.send(JSON.stringify({id,method,params}));
}); }
async function evaluate(expression) {const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;}
async function until(expression,label) {for(let n=0;n<150;n++){if(await evaluate(`Boolean(${expression})`))return;await delay(100);}throw Error('Browser wait: '+label+'\n'+await evaluate('document.body.innerText'));}
async function click(text) {await evaluate(`{const e=[...document.querySelectorAll('.page button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e||e.disabled)throw Error('Unavailable: '+${JSON.stringify(text)});e.focus();e.click();}`);await delay(70);}
async function navigate(path) {await cdp('Page.navigate',{url:origin+path});await until("document.querySelector('.page h1') && window.pendingFetches===0 && !document.body.innerText.includes('Loading WIS')",path);await delay(150);await until('window.pendingFetches===0',path+' requests');}
async function edit(label,value) {await evaluate(`{const l=[...document.querySelectorAll('.page label')].find(e=>[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()===${JSON.stringify(label)}||e.querySelector('span')?.textContent===${JSON.stringify(label)});if(!l)throw Error('Missing '+${JSON.stringify(label)});const e=l.querySelector('input,select,textarea');const p=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}));}`);await delay(60);}
async function screenshot(name,reset=true) {if(reset)await evaluate('window.scrollTo(0,0)');const shot=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(resolve(artifacts,name+'.png'),Buffer.from(shot.data,'base64'));}
let origin;
await mkdir(artifacts,{recursive:true});await mkdir(profile,{recursive:true});await client.connect();
try {
  await client.query(`CREATE SCHEMA "${schema}"`);created=true;await client.query(`SET search_path TO "${schema}"`);
  await applyMigrationRelease(client,await loadMigrationRelease());
  const users=await prepareWebUsers('synthetic-ux-review-only',['demo_admin','demo_reviewer']);
  await provisionWebUsers(client,users.users,true);
  await client.query("INSERT INTO organization_memberships(organization_id,username,role) VALUES ('default','demo_admin','admin'),('default','demo_reviewer','reviewer')");
  const {rows:[project]}=await client.query("INSERT INTO projects(name) VALUES ('Research workspace') RETURNING id");
  const {rows:[sprint]}=await client.query("INSERT INTO project_sprints(project_id,name) VALUES ($1,'Backlog') RETURNING id",[project.id]);
  for(const [text,status] of [['As a researcher, I want to retrieve stored user stories so that I can prepare a study.','reviewed'],['As an administrator, I want to export a report of classification decisions.','pending_review']]){
    const {rows:[story]}=await client.query('INSERT INTO stories(project_id,sprint_id,external_id,content) VALUES ($1,$2,$3,$4) RETURNING id',[project.id,sprint.id,randomUUID(),text]);
    const {rows:[classification]}=await client.query("INSERT INTO classifications(story_id,review_status,taxonomy_version,final_confidence) VALUES ($1,$2,'1.0.0',0.82) RETURNING id",[story.id,status]);
    await client.query("INSERT INTO classification_labels(classification_id,module,operation) VALUES ($1,'Registry','Retrieve data')",[classification.id]);
  }
  process.env.DATABASE_URL=local+'?options='+encodeURIComponent('-c search_path='+schema);process.env.NODE_ENV='test';process.env.API_ACCESS_MODE='local';process.env.ORGANIZATION_ACCESS_MODE='enforced';
  for(const key of ['VERCEL','INGEST_API_KEY','DATABASE_SSL'])delete process.env[key];
  ({pool}=await import('../apps/api/dist/database/pool.js'));
  const {createApp}=await import('../apps/api/dist/app.js');const app=express(),api=createApp();
  app.use('/api', (req,res,next)=>{req.url='/api'+req.url;api(req,res,next);});
  app.use(express.static(resolve('apps/web/dist')));app.use((_req,res)=>res.sendFile(resolve('apps/web/dist/index.html')));
  server=app.listen(0,'127.0.0.1');await new Promise(resolveCall=>server.once('listening',resolveCall));origin=`http://127.0.0.1:${server.address().port}`;
  browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
  let port;for(let n=0;n<100;n++){try{port=Number((await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await delay(100);}assert.ok(port,'Browser did not start');
  const page=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();socket=new WebSocket(page.webSocketDebuggerUrl);
  socket.addEventListener('message',event=>{const r=JSON.parse(String(event.data));if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}if(r.method==='Runtime.exceptionThrown')errors.push(r.params.exceptionDetails);});
  await new Promise((resolveCall,reject)=>{socket.addEventListener('open',resolveCall,{once:true});socket.addEventListener('error',reject,{once:true});});
  await cdp('Page.enable');await cdp('Runtime.enable');await cdp('Network.enable');await cdp('Network.setBlockedURLs',{urls:['https://*']});
  await cdp('Page.addScriptToEvaluateOnNewDocument',{source:"window.pendingFetches=0;const originalFetch=window.fetch;window.fetch=async(...args)=>{window.pendingFetches++;try{return await originalFetch(...args);}finally{window.pendingFetches--;}};"});
  const routes=[['taxonomies','/taxonomy'],['projects','/projects'],['project','/projects/Research%20workspace'],['classify','/classify'],['recommenders','/recommendations'],['setup','/recommender-setup'],['runs','/configured-recommendations'],['review','/review'],['dashboard','/dashboard'],['access','/access'],['history','/runs']];
  for(const width of [1440,1024,768,375]){
    await cdp('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:false});
    for(const [name,path] of routes){
      await navigate(path);
      const layout=await evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,heading:document.querySelector('.page h1')?.textContent,alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent)})`);
      assert.ok(layout.scroll<=width+1,`${name} overflows at ${width}: ${layout.scroll}`);assert.deepEqual(layout.alerts,[],name+' has an error');
      checks.push({name,width,...layout});
      if(width===1440||width===375)await screenshot(name+'-'+width);
    }
  }
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate('/taxonomy');assert.equal(await evaluate("!!document.querySelector('.page textarea')"),false);
  assert.equal(await evaluate("document.body.innerText.includes('Prepare WIS reference')"),false);
  await evaluate("{const card=[...document.querySelectorAll('.reference-card')].find(e=>e.querySelector('h3')?.textContent==='WIS');card.querySelector('button').click();}");
  await until("document.body.innerText.includes('Modules and operations')",'shared WIS editor');
  assert.equal(await evaluate("[...document.querySelectorAll('.node-list button')].some(e=>e.dataset.depth==='2')"),false);
  await evaluate("document.querySelector('.node-workspace').scrollIntoView({block:'start'});window.scrollBy(0,-85)");await screenshot('wis-tree-1440',false);
  await click('Create a new taxonomy version');await edit('Version','2.0.0');await click('Add module');
  await edit('Module name','Reports');await edit('Node description','Project reporting capabilities');await click('Save taxonomy draft');
  await until("document.body.innerText.includes('Draft saved. Review the nodes')",'shared WIS save');
  await evaluate("[...document.querySelectorAll('.node-list button')].find(e=>e.querySelector('span')?.textContent==='Reports').click()");
  await click('Add operation');await edit('Operation name','Export summaries');await edit('Node description','Export project summaries');await click('Save taxonomy draft');
  await until("document.body.innerText.includes('Draft saved. Review the nodes')",'shared WIS operation save');
  await click('Publish reviewed taxonomy');await until("document.body.innerText.includes('Taxonomy published.')",'shared WIS publication');
  const projection=await evaluate("fetch('/api/taxonomy?version=2.0.0').then(r=>r.json()).then(t=>t.modules.Reports)");assert.deepEqual(projection,['Export summaries']);
  await evaluate("document.querySelector('.node-workspace').scrollIntoView({block:'start'});window.scrollBy(0,-85)");await screenshot('wis-published-tree-1440',false);
  await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:1000,deviceScaleFactor:1,mobile:false});await delay(300);
  await evaluate("document.querySelector('.node-workspace').scrollIntoView({block:'start'});window.scrollBy(0,-85)");await screenshot('wis-published-tree-375',false);
  await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await navigate('/access');await click('Edit access');await screenshot('membership-editor-1440');await click('Cancel');await click('Audit records');await screenshot('audit-1440');
  await navigate('/projects');await click('Add project');await until("document.querySelector('[role=dialog]')",'project dialog');
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await until("!document.querySelector('[role=dialog]')",'dialog Escape');
  assert.equal(await evaluate("document.activeElement?.textContent.trim()"),'Add project');
  await cdp('Emulation.setDeviceMetricsOverride',{width:375,height:1000,deviceScaleFactor:1,mobile:false});await navigate('/taxonomy');
  await evaluate("document.querySelector('[aria-label=\"Open menu\"]').click()");await until("document.querySelector('.sidebar.open')",'mobile navigation');await screenshot('navigation-375');
  assert.equal(await evaluate("document.querySelector('main').inert"),true);
  await cdp('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape'});await until("!document.querySelector('.sidebar.open')",'navigation Escape');
  assert.equal(await evaluate("document.activeElement?.getAttribute('aria-label')"),'Open menu');
  assert.deepEqual(errors,[],'Browser runtime errors');
  await writeFile(resolve(artifacts,'browser-checks.json'),JSON.stringify({recordedAt:new Date().toISOString(),syntheticLocalFixtures:true,checks,flows:['one taxonomy catalog','shared WIS editor with two levels','ordinary WIS save and publication updates classification','membership editing separate from list','audit tables','project dialog Escape and focus return','mobile navigation Escape and inert content'],runtimeErrors:errors},null,2)+'\n');
  console.log(JSON.stringify({ok:true,screens:routes.length,viewports:4,layoutChecks:checks.length,flows:7,artifacts}));
} finally {
  socket?.close();browser?.kill();
  if(server)await new Promise(resolveCall=>server.close(resolveCall));if(pool)await pool.end();
  if(created)await client.query(`DROP SCHEMA "${schema}" CASCADE`);await client.end();
}
