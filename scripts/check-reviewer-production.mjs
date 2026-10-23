// Exercise the hosted demonstration with the reviewer password, never an administrator/API key.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
const folder='tmp/icse2027-reviewer',origin='https://us-agent-api.vercel.app';
const credentials=JSON.parse(await readFile(folder+'/credentials.json','utf8'));
const state=JSON.parse(await readFile(folder+'/state.json','utf8'));
const original=JSON.parse(await readFile('docs/demo-4min30/publicado-em-producao.json','utf8'));
const organization='icse2027-review';let cookie;
const checks=[];
async function call(path,method='GET',body,expected=200,org=organization){
 const r=await fetch(origin+path,{method,redirect:'error',signal:AbortSignal.timeout(45000),headers:{Origin:origin,...(cookie?{Cookie:cookie}:{}),...(org?{'X-Organization-Id':org}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const value=await r.json();assert.equal(r.status,expected,`${method} ${path}: ${JSON.stringify(value)}`);
 checks.push({method,path,status:r.status});return value;
}
try{
 const anonymous=await fetch(origin+'/guide');assert.equal(anonymous.status,200);assert.match(await anonymous.text(),/Reviewer Guide/);
 await call('/api/projects','GET',undefined,401);
 const login=await fetch(origin+'/api/auth/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(credentials)});
 assert.equal(login.status,200,'Reviewer sign in failed');
 cookie=login.headers.get('set-cookie')?.split(';')[0];assert.ok(cookie);assert.match(login.headers.get('set-cookie'),/HttpOnly/i);
 const access=await call('/api/access/context');assert.equal(access.role,'maintainer');assert.equal(access.actor,credentials.username);
 assert.deepEqual(access.organizations.map(o=>o.id),[organization]);
 await call('/api/access/members','GET',undefined,403);
 await call('/api/access/audit','GET',undefined,403);
 await call('/api/access/members/'+credentials.username,'PUT',{role:'admin',active:true},403);
 await call('/api/projects','GET',undefined,403,'default');
 const context=await call('/api/context');assert.equal(context.user.displayName,'ICSE Reviewer');
 const projects=await call('/api/projects');assert.deepEqual([...projects].sort(),['Information Resources Web Project','P01','P02','P03','P09','Projeto Emanuel'].sort());
 const stories=await call('/api/stories');assert.ok(stories.length>=3);
 for(const id of ['86','91','269'])assert.ok(stories.some(story=>story.id===id),'An original walkthrough classification is missing.');
 for(const run of Object.values(state.runs)){
  const loaded=await call('/api/internal/recommendation-runs/'+run.id);assert.equal(loaded.snapshot.sha256,run.snapshot.sha256);
  assert.equal((await call('/api/internal/recommendation-runs/'+run.id+'/replay','POST',{})).verified,true);
 }
 const foreign=original.runs['nfr-live'].id;
 await call('/api/internal/recommendation-runs/'+foreign,'GET',undefined,404);
 await call('/api/internal/recommendation-runs/'+foreign+'/replay','POST',{},404);
 await call('/api/internal/recommendation-runs/'+foreign+'/review','GET',undefined,404);
 const request=structuredClone(state.runs.nfr.snapshot.content.request.content);
 const input=await call('/api/classifications/269/published-recommender-input','POST',request.definition);
 const run=await call('/api/internal/recommendation-runs','POST',{...request,id:randomUUID(),input},201);
 const result=run.snapshot.content.result.content;
 assert.equal(result.neighbor.classificationId,'86');assert.equal(result.items.length,6);
 const item=result.items.find(item=>item.type==='Security'&&item.attribute==='access_control');assert.ok(item);
 const path='/api/internal/recommendation-runs/'+run.id;
 const target=await call(path+'/target','POST',{runSha256:run.snapshot.sha256,target:{kind:'input'}});
 const decision=await call(path+'/decisions','POST',{id:randomUUID(),runSha256:run.snapshot.sha256,targetSha256:target.snapshot.sha256,itemKey:item.key,decision:'accepted',notes:'Reviewer Guide verification: adapt the source NFR to grade consolidation.'});
 const sentence='The system must allow coordinators to view and consolidate grades only for students and classes they are authorized to access.';
 const reason='Adapt the access-control requirement to the coordinator role and the grade-consolidation workflow in Projeto Emanuel; preserve the original requirement as a separate artifact.';
 const copy=await call(path+'/copies','POST',{id:randomUUID(),runSha256:run.snapshot.sha256,targetSha256:target.snapshot.sha256,decisionId:decision.id,itemKey:item.key,previousCopy:null,sentence,reason},201);
 assert.equal(copy.snapshot.content.artifact.sentence,sentence);
 const review=await call(path+'/review');assert.equal(review.decisions.length,1);assert.equal(review.copies.length,1);
 assert.equal((await call(path)).snapshot.sha256,run.snapshot.sha256);
 assert.equal((await call(path+'/replay','POST',{})).verified,true);
 const report={checkedAt:new Date().toISOString(),origin,organization,username:credentials.username,publicGuide:true,realPasswordLogin:true,otherWorkspacesBlocked:true,accountEnumerationBlocked:true,foreignRunsBlocked:true,projectCount:projects.length,storyCount:stories.length,nfrSuggestions:result.items.length,acceptedAndAdapted:true,replayVerified:true,originalRunPreserved:true,demonstrationRun:{id:run.id,url:origin+'/configured-recommendations?runId='+run.id},checks};
 await writeFile(folder+'/production-check.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,checks:checks.length},null,2));
}finally{
 if(cookie)await call('/api/auth/session','DELETE',undefined,200,null);
}
