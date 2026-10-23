// Capture native production UI regions. No text, CSS, or recommendation values are replaced.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareArticleFigure} from './prepare-article-figure.mjs';

export async function captureArticlePanels({evaluate,navigate,until,click,edit,expand,cdp,screenshot,folder,origin}){
 const output=resolve('artifacts/article-screenshots-2026-10-23');await mkdir(resolve(output,'raw'),{recursive:true});
 const credentials=JSON.parse(await readFile(folder+'/credentials.json','utf8'));
 const state=JSON.parse(await readFile(folder+'/state.json','utf8'));
 const viewport={width:480,height:1600,deviceScaleFactor:4,mobile:false};
 await cdp('Emulation.setDeviceMetricsOverride',viewport);
 await navigate('/recommender-setup',"document.querySelector('#private-username')");
 await edit('#private-username',credentials.username);await edit('#private-password',credentials.password);await click('Sign in');
 await until("[...document.querySelectorAll('option')].some(o=>o.textContent.includes('project-risk-recommender')&&o.textContent.includes('2'))",'published configuration catalog');
 const api=async(path,method='GET')=>evaluate(`(async()=>{const r=await fetch(${JSON.stringify(path)},{method:${JSON.stringify(method)},headers:{'X-Organization-Id':'icse2027-review',...(${method==='POST'}?{'Content-Type':'application/json'}:{})},...(${method==='POST'}?{body:'{}'}:{})});if(!r.ok)throw Error('Production read failed: '+r.status);return r.json();})()`);
 const access=await api('/api/access/context');assert.equal(access.organizationId,'icse2027-review');
 const definition=await api('/api/internal/recommender-definitions/project-risk-recommender/versions/2');
 assert.equal(definition.state,'published');assert.equal(definition.definition.method.parameters.k,1);
 assert.deepEqual(definition.definition.method.parameters.weights,{domains:1,languages:1,platforms:1,team_distribution:5});
 await evaluate(`{const l=[...document.querySelectorAll('label')].find(e=>[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()==='Definition version');const e=l.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,JSON.stringify(['project-risk-recommender','2']));e.dispatchEvent(new Event('change',{bubbles:true}));}`);
 await until("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Load definition'&&!b.disabled)",'selected published definition is ready');
 await click('Load definition');await until("document.body.innerText.includes('Calculation settings') && document.body.innerText.includes('State: published')",'immutable KNN definition');
 const clips=[];let variant='compact';await mkdir(resolve(output,'compact'),{recursive:true});
 async function capture(file,expression){
   await evaluate(`{const r=(${expression});window.scrollTo(0,Math.max(0,r.y-90));}`);
   await evaluate('document.fonts.ready.then(()=>true)');
   const bounds=await evaluate(`(${expression})`);
   const clip={x:Math.floor(bounds.x),y:Math.floor(bounds.y),width:Math.ceil(bounds.width),height:Math.ceil(bounds.height),scale:1};
   assert.ok(clip.x>=0&&clip.width<1300&&clip.height>100&&clip.height<1550,JSON.stringify({file,clip}));
   const png=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:true,fromSurface:true,clip});
   const bytes=Buffer.from(png.data,'base64'),relative=variant==='compact'?'compact/'+file:file;await writeFile(resolve(output,relative),bytes);
   clips.push({file:relative,viewport:variant==='compact'?viewport:{...viewport,width:1440},clip,pixels:{width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20)},sha256:createHash('sha256').update(bytes).digest('hex')});
   await screenshot(resolve(output,'raw',variant+'-'+file));console.log('Captured '+relative+' '+clips.at(-1).pixels.width+'x'+clips.at(-1).pixels.height);
 }
 const configuration=`(()=>{const h=[...document.querySelectorAll('h3')].find(e=>e.textContent==='Calculation settings');const s=h.closest('section');const labels=[...s.querySelectorAll(':scope > label')];if(labels.length!==6)throw Error('Expected algorithm, k, and four weights');const r=s.getBoundingClientRect(),b=labels.at(-1).querySelector('input').getBoundingClientRect();return {x:r.left+scrollX,y:r.top+scrollY,width:r.width,height:b.bottom-r.top+2};})()`;
 await capture('a-knn-configuration.png',configuration);
 const id=state.runs.distributed.id,run=await api('/api/internal/recommendation-runs/'+id);
 assert.equal(run.snapshot.content.definition.sha256,definition.snapshot.sha256);
 const result=run.snapshot.content.result.content;
 assert.equal(result.neighbors[0].recordId,'P09');assert.equal(result.neighbors[0].similarity,0.9375);assert.equal(result.neighbors[0].distance,1);
 assert.equal((await api('/api/internal/recommendation-runs/'+id+'/replay','POST')).verified,true);
 await navigate('/configured-recommendations?runId='+id,"document.body.innerText.includes('Compared projects and feature contributions')");
 await expand('Compared projects and feature contributions');
 const neighbor=`(()=>{const a=document.querySelector('.configured-result article.configured-subeditor');const d=[...document.querySelectorAll('.configured-result details')].find(d=>d.querySelector('summary')?.textContent==='Compared projects and feature contributions');if(!a||!d?.open)throw Error('Missing risk or expanded contributions');const r=a.getBoundingClientRect(),q=d.getBoundingClientRect(),b=d.querySelector('section.configured-subeditor').getBoundingClientRect();return {x:Math.min(r.left,q.left)+scrollX,y:r.top+scrollY,width:Math.max(r.right,q.right)-Math.min(r.left,q.left),height:b.bottom-r.top+2};})()`;
 await capture('b-neighbor-and-contributions.png',neighbor);
 // Also provide the desktop proportions shown in the user's reference figure.
 variant='desktop';await cdp('Emulation.setDeviceMetricsOverride',{...viewport,width:1440});
 await capture('b-neighbor-and-contributions.png',neighbor);
 await navigate('/recommender-setup',"[...document.querySelectorAll('label')].some(l=>l.textContent.includes('Definition version'))");
 await until("[...document.querySelectorAll('label')].filter(l=>l.textContent.startsWith('Definition version')).some(l=>[...(l.querySelector('select')?.options??[])].some(o=>o.value===JSON.stringify(['project-risk-recommender','2'])))",'desktop definition catalog');
 await evaluate(`{const l=[...document.querySelectorAll('label')].find(e=>[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()==='Definition version');const e=l.querySelector('select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(e,JSON.stringify(['project-risk-recommender','2']));e.dispatchEvent(new Event('change',{bubbles:true}));}`);
 await until("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Load definition'&&!b.disabled)",'desktop configuration selection');
 await click('Load definition');await until("document.body.innerText.includes('Calculation settings')",'desktop calculation settings');await capture('a-knn-configuration.png',configuration);
 const manifest={capturedAt:new Date().toISOString(),origin,mode:'Real production UI, authenticated reviewer; native responsive layout and browser region capture',viewport,definition:{id:definition.definition.id,version:definition.definition.version,sha256:definition.snapshot.sha256},run:{id,sha256:run.snapshot.sha256,replayVerified:true,dataset:run.snapshot.content.request.content.dataset},expected:{neighbor:'P09',similarity:0.9375,distance:1,weights:definition.definition.method.parameters.weights},dataStatus:'Existing prepared project profiles; synthetic risk and team-distribution associations',uiContentReplaced:false,credentialsCaptured:false,clips};
 await writeFile(resolve(output,'capture-manifest.json'),JSON.stringify(manifest,null,2)+'\n');
 // Close only this browser session, using its HttpOnly cookie. No application data was edited.
 await evaluate("fetch('/api/auth/session',{method:'DELETE'}).then(r=>{if(!r.ok)throw Error('Sign out failed');return true;})");
 await prepareArticleFigure({cdp,evaluate,until,output});
 console.log(JSON.stringify({output,files:clips.map(c=>c.file),replayVerified:true,productionDataWrites:0}));
}
