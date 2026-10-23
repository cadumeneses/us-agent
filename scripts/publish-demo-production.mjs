// Explicitly authorized demo preparation. Adds only demo publications/project and run evidence.
import assert from 'node:assert/strict';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { randomUUID, createHash } from 'node:crypto';
const root='tmp/demo-production-preparation', out='docs/demo-4min30';
const plan=JSON.parse(await readFile(root+'/plan.json','utf8'));
const validation=JSON.parse(await readFile(out+'/validacao-local.json','utf8'));
assert.equal(plan.origin,'https://us-agent-api.vercel.app');assert.equal(plan.organizationId,'default');
assert.equal(validation.repeatabilityVerified,true);assert.equal(validation.onlyChangedAttribute,'team_distribution');
assert.ok(plan.definitions.every(row=>['project-risk-recommender','nfr-recommender'].includes(row.definition.id)));
assert.equal(plan.demoProject,'Information Resources Web Project');
assert.equal(plan.renameProjectFrom,'[DEMO] Roteiro 4m30');
assert.equal(plan.stateFilename,'english-publication-state.json');
if(!process.argv.includes('--apply')){console.log(JSON.stringify({mode:'preview',project:plan.demoProject,definitions:plan.definitions.map(row=>({id:row.definition.id,version:row.definition.version,records:row.records.length})),originalStoriesWillBeEdited:false,originalProfilesWillBeEdited:false}));process.exit(0);}
assert.ok(process.env.INGEST_API_KEY?.trim().length>=32,'Load current production credential.');
const headers={Authorization:`Bearer ${process.env.INGEST_API_KEY.trim()}`,'X-Organization-Id':'default'};
const canonical=value=>JSON.stringify(value,(_key,v)=>v&&typeof v==='object'&&!Array.isArray(v)?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b))):v);
const digest=value=>createHash('sha256').update(canonical(value)).digest('hex');
let state;
try{state=JSON.parse(await readFile(root+'/'+plan.stateFilename,'utf8'));}catch(error){if(error.code!=='ENOENT')throw error;state={startedAt:new Date().toISOString(),projectCreated:false,publications:{},runs:{},requestIds:{}};}
async function checkpoint(){await writeFile(root+'/'+plan.stateFilename,JSON.stringify(state,null,2)+'\n');}
async function request(path,method='GET',body){
  const form=body instanceof FormData;
  const r=await fetch(plan.origin+path,{method,redirect:'error',signal:AbortSignal.timeout(30000),headers:{...headers,...(body&&!form?{'Content-Type':'application/json'}:{})},...(body?{body:form?body:JSON.stringify(body)}:{})});
  const value=await r.json();
  if(!r.ok)throw Error(`${method} ${path}: ${r.status} ${JSON.stringify(value)}`);
  return value;
}
const reference=(id,version,snapshot)=>({id,version,format:snapshot.format,sha256:snapshot.sha256});
const inventory=JSON.parse(await readFile(root+'/projects.json','utf8'));
state.originalStoryDigest??=digest(inventory.stories);
for(const item of plan.definitions){
  const d=item.definition,key=d.id+'@'+d.version,path='/api/internal/recommender-definitions/'+encodeURIComponent(d.id)+'/versions/'+encodeURIComponent(d.version);
  if(!state.publications[key]){
    const versions=await request('/api/internal/recommender-definitions?id='+encodeURIComponent(d.id)+'&limit=100');
    assert.ok(!versions.some(v=>v.version===d.version),'Demo publication already exists outside this preparation; refusing to overwrite.');
    const draft=await request(path,'PUT',d);
    const published=await request(path+'/publish','POST',{expectedDraftSha256:draft.draftSha256});
    state.publications[key]={definition:published};await checkpoint();
  }
  const saved=state.publications[key];
  if(!saved.dataset){
    const def=reference(d.id,d.version,saved.definition.snapshot);
    if(!saved.preview){
      const spec={schemaVersion:1,id:d.id+'-base',version:d.version,definition:def,format:'json',source:item.source,mapping:{recordId:['id'],attributes:Object.fromEntries(d.attributes.map(a=>[a.id,{path:['values',a.id],encoding:'value'}]))}};
      const form=new FormData();form.set('spec',JSON.stringify(spec));form.set('file',new Blob([await readFile(out+'/dados/'+item.filename)],{type:'application/json'}),item.filename);
      saved.preview=await request('/api/internal/recommender-datasets/imports/preview','POST',form);await checkpoint();
    }
    const report=saved.preview.snapshot.content.report;
    assert.equal(report.fatal.length,0);assert.equal(report.invalid,0);assert.equal(report.duplicate,0);assert.equal(report.valid,item.records.length);
    saved.dataset=await request('/api/internal/recommender-datasets/'+encodeURIComponent(d.id+'-base')+'/versions/'+encodeURIComponent(d.version)+'/publish','POST',{importId:saved.preview.id,previewSha256:saved.preview.snapshot.sha256,excludedOrdinals:[]});await checkpoint();
  }
}
if(!state.projectCreated){
  const pg=await import('pg');
  const connectionString=process.env.MIGRATION_DATABASE_URL;
  const dbUrl=new URL(connectionString);
  assert.equal(dbUrl.hostname,'ep-rapid-mouse-avz844uw.c-11.us-east-1.aws.neon.tech');
  assert.equal(dbUrl.pathname,'/neondb');
  const client=new pg.default.Client({connectionString,connectionTimeoutMillis:10000});
  await client.connect();
  try{
    await client.query('BEGIN');
    const registry=await client.query("SELECT schema_name FROM public.organizations WHERE id='default' AND active");
    assert.equal(registry.rows[0]?.schema_name,'public');
    await client.query("SELECT set_config('search_path','public',true),set_config('app.organization_id','default',true),set_config('app.actor','internal-api',true)");
    const found=await client.query('SELECT id::text,name FROM projects WHERE name=ANY($1::text[]) FOR UPDATE',[[plan.renameProjectFrom,plan.demoProject]]);
    assert.equal(found.rowCount,1,'Expected exactly the prepared project or its already-renamed identity.');
    const project=found.rows[0];
    assert.equal(Number((await client.query('SELECT count(*) AS n FROM stories WHERE project_id=$1',[project.id])).rows[0].n),0,'Only the prepared, story-free project may be renamed.');
    const profile=(await client.query('SELECT content FROM project_research_profiles WHERE project_id=$1',[project.id])).rows[0];
    assert.equal(digest(profile.content),digest(plan.profile),'Prepared project profile changed; refusing rename.');
    if(project.name===plan.renameProjectFrom){
      const changed=await client.query('UPDATE projects SET name=$1 WHERE id=$2 AND name=$3 RETURNING id::text',[plan.demoProject,project.id,plan.renameProjectFrom]);
      assert.equal(changed.rowCount,1);
    }
    await client.query('COMMIT');
    state.projectId=project.id;state.projectCreated=true;await checkpoint();
  }catch(error){await client.query('ROLLBACK');throw error;}finally{await client.end();}
}
for(const version of ['1','2']){
  const published=state.publications['project-risk-recommender@'+version].definition;
  const def=reference(published.definition.id,version,published.snapshot);
  const current=await request('/api/internal/project-recommender-profile/load','POST',{project:plan.demoProject,definition:def});
  const values=version==='1'?plan.inputs.baseline.values:plan.inputs.distributed.values;
  if(current.revision===0)await request('/api/internal/project-recommender-profile','PUT',{project:plan.demoProject,definition:def,revision:0,values});
}
for(const [name,input,publicationKey] of [
  ['baseline',plan.inputs.baseline,'project-risk-recommender@1'],
  ['distributed',plan.inputs.distributed,'project-risk-recommender@2'],
  ['colocated',plan.inputs.colocated,'project-risk-recommender@2'],
  ['nfr-rehearsal',plan.inputs.nfr,'nfr-recommender@1'],
  ['nfr-live',plan.inputs.nfr,'nfr-recommender@1']
]){
  if(state.runs[name])continue;
  const p=state.publications[publicationKey],d=p.definition.definition,ds=p.dataset.snapshot.content;
  state.requestIds[name]??=randomUUID();await checkpoint();
  const payload={id:state.requestIds[name],definition:reference(d.id,d.version,p.definition.snapshot),dataset:reference(ds.id,ds.version,p.dataset.snapshot),input,...(name.startsWith('nfr')?{selection:{labelIndex:0}}:{})};
  state.runs[name]=await request('/api/internal/recommendation-runs','POST',payload);assert.equal(state.runs[name].snapshot.content.result.content.status,'completed');await checkpoint();
}
assert.equal(state.runs.distributed.snapshot.content.result.content.neighbors[0].recordId,'P09');
assert.equal(state.runs.colocated.snapshot.content.result.content.neighbors[0].recordId,'P01');
const rehearsal=state.runs['nfr-rehearsal'];
const reviewPath='/api/internal/recommendation-runs/'+rehearsal.id;
state.rehearsalTarget??=await request(reviewPath+'/target','POST',{runSha256:rehearsal.snapshot.sha256,target:{kind:'input'}});await checkpoint();
const item=rehearsal.snapshot.content.result.content.items.find(i=>i.attribute==='access_control');assert.ok(item);
state.requestIds.decision??=randomUUID();state.requestIds.copy??=randomUUID();await checkpoint();
state.rehearsalDecision??=await request(reviewPath+'/decisions','POST',{id:state.requestIds.decision,runSha256:rehearsal.snapshot.sha256,targetSha256:state.rehearsalTarget.snapshot.sha256,itemKey:item.key,decision:'accepted',notes:'Access-control requirement accepted for the preserved input only.'});await checkpoint();
state.rehearsalCopy??=await request(reviewPath+'/copies','POST',{id:state.requestIds.copy,runSha256:rehearsal.snapshot.sha256,targetSha256:state.rehearsalTarget.snapshot.sha256,decisionId:state.rehearsalDecision.id,itemKey:item.key,previousCopy:null,...plan.adaptation});await checkpoint();
const replays={};
await mkdir(out+'/evidencias',{recursive:true});
for(const [name,run] of Object.entries(state.runs)){
  const stored=await request('/api/internal/recommendation-runs/'+run.id);
  assert.equal(stored.snapshot.sha256,run.snapshot.sha256);
  replays[name]=await request('/api/internal/recommendation-runs/'+run.id+'/replay','POST',{});
  assert.equal(replays[name].verified,true);
  await writeFile(out+'/evidencias/'+name+'.json',JSON.stringify(stored,null,2)+'\n');
}
const review=await request(reviewPath+'/review');assert.equal(review.copies.length,1);
await writeFile(out+'/evidencias/rnf-com-adaptacao.json',JSON.stringify({run:rehearsal,review},null,2)+'\n');
const liveReview=await request('/api/internal/recommendation-runs/'+state.runs['nfr-live'].id+'/review');
assert.equal(liveReview.target,null);assert.equal(liveReview.decisions.length,0);assert.equal(liveReview.copies.length,0);
const afterStories=await request('/api/stories?limit=10000');assert.equal(digest(afterStories),state.originalStoryDigest,'Existing story/classification list changed.');
for(const entry of inventory.profiles)assert.equal(digest(await request('/api/project-research-profile?project='+encodeURIComponent(entry.project))),digest(entry.profile),'Original project profile changed: '+entry.project);
const previous=JSON.parse(await readFile(root+'/publication-state.json','utf8'));
state.retiredPrevious=[];
for(const p of Object.values(previous.publications)){
  const def=p.definition.definition,ds=p.dataset.snapshot.content;
  assert.ok(def.id.startsWith('demo-video-')&&ds.id.startsWith('demo-video-'));
  await request('/api/internal/recommender-datasets/'+ds.id+'/versions/'+encodeURIComponent(ds.version)+'/retire','POST',{});
  await request('/api/internal/recommender-definitions/'+def.id+'/versions/'+encodeURIComponent(def.version)+'/retire','POST',{});
  state.retiredPrevious.push({id:def.id,version:def.version});
}
for(const run of Object.values(previous.runs)){
  assert.equal((await request('/api/internal/recommendation-runs/'+run.id)).snapshot.sha256,run.snapshot.sha256);
  assert.equal((await request('/api/internal/recommendation-runs/'+run.id+'/replay','POST',{})).verified,true);
}
await checkpoint();
const report={completedAt:new Date().toISOString(),origin:plan.origin,organizationId:plan.organizationId,sourceProjectsPreserved:true,sourceStoryListPreserved:true,
  project:plan.demoProject,renamedFrom:plan.renameProjectFrom,retiredPrevious:state.retiredPrevious,previousRunHashesAndReplaysPreserved:true,publications:Object.values(state.publications).map(p=>({name:p.definition.definition.name,definition:reference(p.definition.definition.id,p.definition.definition.version,p.definition.snapshot),dataset:reference(p.dataset.snapshot.content.id,p.dataset.snapshot.content.version,p.dataset.snapshot),recordCount:p.dataset.snapshot.content.records.length})),
  runs:Object.fromEntries(Object.entries(state.runs).map(([name,r])=>[name,{id:r.id,sha256:r.snapshot.sha256,url:plan.origin+'/configured-recommendations?runId='+r.id,result:r.snapshot.content.result.content,replay:replays[name]}])),
  adaptation:{runId:rehearsal.id,copyId:state.rehearsalCopy.id,revision:state.rehearsalCopy.snapshot.content.revision,...plan.adaptation},
  nfrLiveReadyWithoutDecisions:true,authenticationActor:'internal-api',limitations:plan.limitations};
await writeFile(out+'/publicado-em-producao.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({completed:true,project:report.project,publications:report.publications.map(p=>({id:p.definition.id,version:p.definition.version,records:p.recordCount})),runs:Object.fromEntries(Object.entries(report.runs).map(([name,r])=>[name,{url:r.url,replay:r.replay.verified}])),originalProjectsPreserved:true,originalStoriesPreserved:true}));
