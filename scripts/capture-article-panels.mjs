import {captureArticlePanels as walkthrough} from './lib/article-risk-captures.mjs';
// Actual browser login and workflow check against the deployed application.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
const origin='https://us-agent-api.vercel.app',folder='tmp/icse2027-reviewer';
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

 await walkthrough({evaluate,navigate,until,click,edit,expand,scroll,screenshot,cdp,folder,imageFolder,origin});
}catch(error){try{await screenshot(resolve(folder,'browser-failure.png'));console.error(await evaluate('document.body.innerText.slice(-2200)'));}catch{}throw error;}
finally{try{if(socket?.readyState===1)await cdp('Browser.close');}catch{}socket?.close();browser?.kill();}
