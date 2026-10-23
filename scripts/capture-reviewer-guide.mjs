// Actual browser login and workflow check against the deployed application.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const origin=process.env.GUIDE_CHECK_ORIGIN??'https://us-agent-api.vercel.app',folder='tmp/icse2027-reviewer';
const guideOnly=process.argv.includes('--guide-only');
const profile=resolve(folder,'browser-'+randomUUID());
const imageFolder=resolve('apps/web/public/reviewer-guide');
await mkdir(profile,{recursive:true});await mkdir(imageFolder,{recursive:true});
let browser,socket,serial=0;const pending=new Map(),checks=[];
function cdp(method,params={}){const id=++serial;return new Promise((resolveCall,reject)=>{
 const timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout: '+method));},45000);
 pending.set(id,{resolve:value=>{clearTimeout(timer);resolveCall(value);},reject:error=>{clearTimeout(timer);reject(error);}});
 socket.send(JSON.stringify({id,method,params}));
});}
async function evaluate(expression){const r=await cdp('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description??r.exceptionDetails.text);return r.result.value;}
async function until(expression,label){for(let n=0;n<240;n++){if(await evaluate(`Boolean(${expression})`))return;await delay(250);}throw Error('Timed out: '+label);}
async function navigate(path,ready){await cdp('Page.navigate',{url:origin+path});await until(ready,path);await delay(250);}
async function edit(selector,value){await evaluate(`{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing field');const proto=e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event('input',{bubbles:true}));}`);await delay(120);}
async function click(text){await evaluate(`{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!e||e.disabled)throw Error('Unavailable button '+${JSON.stringify(text)});e.click();}`);}
async function expand(text){await evaluate(`{const e=[...document.querySelectorAll('summary')].find(e=>e.textContent.includes(${JSON.stringify(text)}));if(!e)throw Error('Missing section '+${JSON.stringify(text)});e.parentElement.open=true;}`);}
async function scroll(text,selector='h2,h3,h4,summary,label'){await evaluate(`{const e=[...document.querySelectorAll(${JSON.stringify(selector)})].find(e=>e.textContent.trim().startsWith(${JSON.stringify(text)}));if(!e)throw Error('Missing scroll target');e.scrollIntoView({block:'start'});window.scrollBy(0,-95);}`);await delay(200);}
async function screenshot(path){const r=await cdp('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(path,Buffer.from(r.data,'base64'));}
try{
 browser=spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--remote-debugging-port=0',`--user-data-dir=${profile}`,'about:blank'],{windowsHide:true,stdio:'ignore'});
 let port;for(let n=0;n<100;n++){try{port=Number((await readFile(resolve(profile,'DevToolsActivePort'),'utf8')).split('\n')[0]);if(port)break;}catch{}await delay(100);}assert.ok(port,'Browser did not start');
 const tab=await(await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();socket=new WebSocket(tab.webSocketDebuggerUrl);
 socket.addEventListener('message',event=>{const r=JSON.parse(String(event.data));if(r.id&&pending.has(r.id)){const p=pending.get(r.id);pending.delete(r.id);r.error?p.reject(Error(JSON.stringify(r.error))):p.resolve(r.result);}});
 await new Promise((r,j)=>{socket.addEventListener('open',r,{once:true});socket.addEventListener('error',j,{once:true});});await cdp('Page.enable');await cdp('Runtime.enable');
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 await navigate('/guide',"document.querySelector('h1')?.textContent==='Reviewer Guide'");
 assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);checks.push('Public guide opens without login at desktop width');
 await screenshot(resolve(folder,'guide-desktop.png'));
 await cdp('Emulation.setDeviceMetricsOverride',{width:390,height:844,deviceScaleFactor:1,mobile:true});
 await delay(200);assert.equal(await evaluate('document.documentElement.scrollWidth<=innerWidth'),true);checks.push('Public guide fits mobile width');
 await screenshot(resolve(folder,'guide-mobile.png'));
 if(guideOnly){
   await evaluate("document.querySelectorAll('img').forEach(i=>i.loading='eager')");
   await until('[...document.images].every(i=>i.complete&&i.naturalWidth>0)','guide screenshots loaded');
   const content=await evaluate("({sections:[...document.querySelectorAll('article>section')].map(s=>s.id),images:document.images.length,anchors:[...document.querySelectorAll('a[href^=\"#\"]')].every(a=>document.getElementById(a.hash.slice(1)))})");
   assert.equal(content.anchors,true);
   for(const id of ['projects','stories','classification','human-review','history-dashboard','taxonomies','configuration','access-control'])assert.ok(content.sections.includes(id),'Missing application area: '+id);
   const downloads=await evaluate("Promise.all([...document.querySelectorAll('a[download]')].map(async a=>{const r=await fetch(a.href);return {path:new URL(a.href).pathname,status:r.status,bytes:(await r.arrayBuffer()).byteLength};}))");
   assert.ok(downloads.every(d=>d.status===200&&d.bytes>0));
   console.log(JSON.stringify({origin,publicGuide:true,responsive:true,imagesLoaded:true,...content,downloads}));
 }else{
 const credentials=JSON.parse(await readFile(folder+'/credentials.json','utf8'));
 const state=JSON.parse(await readFile(folder+'/state.json','utf8'));
 await cdp('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
 const quick='/configured-recommendations?definitionId=project-risk-recommender&definitionVersion=2&datasetId=project-risk-recommender-base&datasetVersion=2&project=Information%20Resources%20Web%20Project';
 await navigate(quick,"document.querySelector('#private-username')");
 await evaluate("sessionStorage.setItem('us-agent-organization','default')");
 await edit('#private-username',credentials.username);await edit('#private-password',credentials.password);
 await click('Sign in');
 await until("document.querySelector('.page h1') && document.body.innerText.includes('Team distribution') && [...document.querySelectorAll('input')].some(e=>e.value==='Web')",'prepared risk form after real login');
 const workspace=await evaluate("document.querySelector('.environment')?.textContent");assert.ok(workspace.includes('ICSE 2027 Reviewer Workspace'));
 assert.equal(await evaluate("!!document.querySelector('a[href=\"/access\"]')"),false);checks.push('Reviewer signs in through form and retained deep link; user-management navigation absent');
 await scroll('Team distribution','label');await screenshot(resolve(imageFolder,'risk-profile.png'));
 await navigate('/configured-recommendations?runId='+state.runs.distributed.id,"document.body.innerText.includes('Compared projects and feature contributions')");
 await expand('Compared projects and feature contributions');await scroll('Recommendations','h3');await screenshot(resolve(imageFolder,'risk-result.png'));
 await navigate('/recommendations?recommender=nfr&project=Projeto%20Emanuel&classificationId=269&source=published',"[...document.querySelectorAll('button')].some(e=>e.textContent==='Run recommendation'&&!e.disabled)");
 await until("[...document.querySelectorAll('select')].some(s=>s.value==='0')",'preselected classification pair');
 await click('Run recommendation');await until("document.body.innerText.includes('Selected neighbor') && document.body.innerText.includes('Assess suggestions') && !document.body.innerText.includes('Loading assessments')",'NFR source and assessment');
 await scroll('Selected neighbor','h4');await screenshot(resolve(imageFolder,'nfr-source.png'));
 await click('Confirm reviewed destination');await until("document.body.innerText.includes('Confirmed destination')",'confirmed destination');
 await evaluate(`{const item=[...document.querySelectorAll('.nfr-item')].find(e=>e.textContent.includes('Security / access_control'));if(!item)throw Error('Missing access control');item.querySelector('button.primary').click();}`);
 await until("document.body.innerText.includes('Adapt accepted NFR')",'accepted NFR');await expand('Adapt accepted NFR');
 const sentence='The system must allow coordinators to view and consolidate grades only for students and classes they are authorized to access.';
 const reason='Adapt the access-control requirement to the coordinator role and the grade-consolidation workflow in Projeto Emanuel; preserve the original requirement as a separate artifact.';
 await evaluate(`{const panel=[...document.querySelectorAll('details')].find(e=>e.querySelector('summary')?.textContent==='Adapt accepted NFR');panel.id='reviewer-adaptation';}`);
 await edit('#reviewer-adaptation textarea',sentence);await edit('#reviewer-adaptation label:nth-of-type(2) textarea',reason);
 await click('Save NFR adaptation');await until("document.querySelector('[aria-label=\"NFR adaptation history\"]')?.textContent.includes('Revision 1')",'saved NFR adaptation');
 await expand('Adapt accepted NFR');await scroll('Adapt accepted NFR','summary');await screenshot(resolve(imageFolder,'nfr-adaptation.png'));
 await click('Verify replay');await until("document.body.innerText.includes('Replay verified:')",'verified replay');checks.push('Prepared NFR form → real run → source → accept → adapt → verified replay');
 const runId=await evaluate("document.querySelector('.configured-result .configured-actions') && [...document.querySelectorAll('button')].some(e=>e.textContent==='Download evidence with assessments')");assert.equal(runId,true);
 await click('Sign out');await until("document.querySelector('#private-username')",'sign out');checks.push('Sign out completes');
 await writeFile(folder+'/browser-check.json',JSON.stringify({checkedAt:new Date().toISOString(),origin,realReviewerLogin:true,checks,screenshots:['risk-profile.png','risk-result.png','nfr-source.png','nfr-adaptation.png']},null,2)+'\n');console.log(JSON.stringify({passed:true,checks,screenshots:4}));
 }
}catch(error){try{await screenshot(resolve(folder,'browser-failure.png'));console.error(await evaluate('document.body.innerText.slice(-2200)'));}catch{}throw error;}
finally{try{if(socket?.readyState===1)await cdp('Browser.close');}catch{}socket?.close();browser?.kill();}
