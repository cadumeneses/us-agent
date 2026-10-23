import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import express from 'express';
const root=resolve('apps/web/public'),html=await readFile(resolve(root,'guide.html'),'utf8');
const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
assert.equal(new Set(ids).size,ids.length,'Guide contains duplicate IDs.');
for(const m of html.matchAll(/href="#([^"]+)"/g))assert.ok(ids.includes(m[1]),'Missing guide anchor: '+m[1]);
for(const id of ['overview','quick-start','projects','stories','classification','human-review','history-dashboard','taxonomies','test-cases','configuration','access-control'])assert.ok(ids.includes(id));
const files=new Set([...html.matchAll(/(?:src|href)="(\/reviewer-guide\/[^"?#]+)"/g)].map(m=>m[1]));
for(const file of files)await access(resolve(root,'.'+file));
assert.match(html,/<code id="reviewer-username"[^>]*>icse2027\.reviewer<\/code>/,'Display the prepared reviewer username.');
const password=html.match(/<code id="reviewer-password"[^>]*>([^<]+)<\/code>/)?.[1];
assert.ok(password&&password.length>=20,'Display the shared demonstration password.');
if(process.argv.includes('--static-only')){
 console.log(JSON.stringify({staticChecks:true,publicAssets:files.size,publicReviewerCredentials:true}));
 process.exit(0);
}
const app=express();app.get('/guide',(_req,res)=>res.sendFile(resolve(root,'guide.html')));app.use(express.static(root));
const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
try{
 const origin='http://127.0.0.1:'+server.address().port;
 const processCheck=spawn(process.execPath,['scripts/capture-reviewer-guide.mjs','--guide-only'],{env:{...process.env,GUIDE_CHECK_ORIGIN:origin},windowsHide:true,stdio:'inherit'});
 const code=await new Promise((r,j)=>{processCheck.once('exit',r);processCheck.once('error',j);});assert.equal(code,0,'Guide browser check failed');
 console.log(JSON.stringify({staticChecks:true,publicAssets:files.size,publicReviewerCredentials:true}));
}finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
