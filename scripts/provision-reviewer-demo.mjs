// Adds an isolated reviewer organization. Reads existing business data; never copies accounts or sessions.
import assert from 'node:assert/strict';
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import pg from 'pg';
import {migrationConnection,loadMigrationRelease} from './lib/deployment-migrations.mjs';
import {provisionOrganization} from './lib/organization-provisioning.mjs';
import {prepareWebUsers,provisionWebUsers} from './lib/web-user-provisioning.mjs';

const organizationId='icse2027-review', username='icse2027.reviewer', name='ICSE 2027 Reviewer Workspace';
const origin='https://us-agent-api.vercel.app', folder='tmp/icse2027-reviewer';
const projectNames=['Information Resources Web Project','P01','P02','P03','P09','Projeto Emanuel'];
const classificationIds=[86,91,269];
const quote=value=>{assert.match(value,/^[a-z_][a-z0-9_]{0,62}$/);return '"'+value+'"';};
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const {connectionString,target}=migrationConnection(process.env);
const args=process.argv.slice(2), apply=args[0]==='--apply';
assert.ok(apply || args[0]==='--dry-run','Use --dry-run or --apply --expect-target HOST:PORT/DATABASE.');
if(apply)assert.deepEqual(args.slice(1),['--expect-target',target]);else assert.equal(args.length,1);
assert.equal(target,'ep-rapid-mouse-avz844uw.c-11.us-east-1.aws.neon.tech:5432/neondb');
assert.ok(process.env.INGEST_API_KEY?.trim().length>=32,'Load the server-side production credential.');
const db=new pg.Client({connectionString,connectionTimeoutMillis:10000});
await mkdir(folder,{recursive:true});
let state;
try{state=JSON.parse(await readFile(folder+'/state.json','utf8'));}catch(e){if(e.code!=='ENOENT')throw e;state={organizationId,username,projectsCopied:false,publications:{},runs:{}};}
assert.equal(state.organizationId,organizationId);assert.equal(state.username,username);
async function checkpoint(){await writeFile(folder+'/state.json',JSON.stringify(state,null,2)+'\n');}
async function request(path,method='GET',body){
 const form=body instanceof FormData;
 const r=await fetch(origin+path,{method,redirect:'error',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${process.env.INGEST_API_KEY.trim()}`,'X-Organization-Id':organizationId,...(body&&!form?{'Content-Type':'application/json'}:{})},...(body?{body:form?body:JSON.stringify(body)}:{})});
 const value=await r.json();assert.ok(r.ok,`${method} ${path}: ${r.status} ${JSON.stringify(value)}`);return value;
}
const ref=(id,version,snapshot)=>({id,version,format:snapshot.format,sha256:snapshot.sha256});
try{
 await db.connect();
 const existing=(await db.query('SELECT schema_name FROM public.organizations WHERE id=$1',[organizationId])).rows[0];
 const sourceRecords=(await db.query('SELECT c.id::text,c.story_id::text,s.content,p.name FROM public.classifications c JOIN public.stories s ON s.id=c.story_id JOIN public.projects p ON p.id=s.project_id WHERE c.id=ANY($1::bigint[]) ORDER BY c.id',[classificationIds])).rows;
 assert.equal(sourceRecords.length,3);assert.equal(sourceRecords[2].name,'Projeto Emanuel');
 if(!apply){console.log(JSON.stringify({target,readOnly:true,organizationId,name,username,role:'maintainer',accountAdministration:false,existingOrganization:Boolean(existing),projects:projectNames,classifications:sourceRecords,copyCredentials:false,copyOtherMemberships:false},null,2));await db.end();process.exit(0);}
 if(!existing){
   const organization=await provisionOrganization(db,await loadMigrationRelease(),{id:organizationId,name,adminUsername:'carlos'});
   state.schema=organization.schema;await checkpoint();
 }else{assert.equal(existing.schema_name,state.schema,'Existing organization was not created by this preparation.');}
 assert.match(state.schema,/^org_[a-f0-9]{32}$/);
 const schema=quote(state.schema);
 if(!state.projectsCopied){
   await db.query('BEGIN');
   try{
     await db.query(`SET LOCAL search_path TO ${schema},pg_catalog`);
     await db.query("SELECT set_config('app.organization_id',$1,true),set_config('app.actor','reviewer-demo-provisioning',true)",[organizationId]);
     assert.equal(Number((await db.query('SELECT count(*) AS n FROM projects')).rows[0].n),0,'Only a new, empty organization may be populated.');
     assert.equal(Number((await db.query('SELECT count(*) AS n FROM app_users')).rows[0].n),1);
     await db.query("UPDATE app_users SET display_name='ICSE Reviewer',initials='IR',role='Reviewer'");
     await db.query("UPDATE application_settings SET environment_name=$1,default_execution_mode_key='preview' WHERE singleton",[name]);
     const copied=[];
     async function copy(table,where,params=[]){
       const columns=(await db.query(`SELECT column_name,is_identity FROM information_schema.columns WHERE table_schema=$1 AND table_name=$2 AND column_name IN (SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name=$2) ORDER BY ordinal_position`,[state.schema,table])).rows;
       assert.ok(columns.length);const names=columns.map(c=>quote(c.column_name)).join(',');
       const identity=columns.some(c=>c.is_identity==='YES')?' OVERRIDING SYSTEM VALUE':'';
       const result=await db.query(`INSERT INTO ${schema}.${quote(table)} (${names})${identity} SELECT ${names} FROM public.${quote(table)} WHERE ${where}`,params);
       copied.push({table,rows:result.rowCount});
       for(const c of columns.filter(c=>c.is_identity==='YES'))await db.query(`SELECT setval(pg_get_serial_sequence($1,$2),GREATEST(COALESCE((SELECT max(${quote(c.column_name)}) FROM ${schema}.${quote(table)}),0),1),COALESCE((SELECT max(${quote(c.column_name)}) FROM ${schema}.${quote(table)}),0)>0)`,[state.schema+'.'+table,c.column_name]);
     }
     const projectWhere='name=ANY($1::text[])';
     const selectedProjectIds='SELECT id FROM public.projects WHERE name=ANY($1::text[])';
     const selectedStoryIds='SELECT story_id FROM public.classifications WHERE id=ANY($1::bigint[])';
     const selectedVoteIds='SELECT id FROM public.provider_votes WHERE classification_id=ANY($1::bigint[])';
     await copy('projects',projectWhere,[projectNames]);
     await copy('project_sprints',`project_id IN (${selectedProjectIds})`,[projectNames]);
     await copy('project_research_profiles',`project_id IN (${selectedProjectIds})`,[projectNames]);
     await copy('classification_runs','id IN (SELECT run_id FROM public.classifications WHERE id=ANY($1::bigint[]))',[classificationIds]);
     await copy('stories',`id IN (${selectedStoryIds})`,[classificationIds]);
     await copy('classifications','id=ANY($1::bigint[])',[classificationIds]);
     for(const table of ['classification_labels','story_tasks','story_functional_requirements','story_non_functional_requirements','classification_provenance','provider_votes','classification_attempts'])await copy(table,'classification_id=ANY($1::bigint[])',[classificationIds]);
     for(const table of ['provider_vote_labels','provider_vote_evidence','provider_vote_issues','provider_vote_questions'])await copy(table,`vote_id IN (${selectedVoteIds})`,[classificationIds]);
     await copy('story_preparations',`story_id IN (${selectedStoryIds})`,[classificationIds]);
     await db.query('COMMIT');
     state.projectsCopied=true;state.copied=copied;state.sourceRecords=sourceRecords;await checkpoint();
   }catch(e){await db.query('ROLLBACK');throw e;}
 }
 // Fresh tenant migrations include legacy Portuguese mode labels; align this reviewer UI with its English guide.
 await db.query(`UPDATE ${schema}.execution_modes SET name=CASE key WHEN 'preview' THEN 'Local preview' ELSE 'Model committee' END,
   description=CASE key WHEN 'preview' THEN 'Rule-based classification without external model calls.' ELSE 'Classification using the configured model providers.' END
   WHERE key IN ('preview','committee')`);
 const plan=JSON.parse(await readFile('tmp/demo-production-preparation/plan.json','utf8'));
 assert.ok(plan.definitions.every(row=>['project-risk-recommender','nfr-recommender'].includes(row.definition.id)));
 for(const item of plan.definitions){
   const definition={...structuredClone(item.definition),state:'draft'}, key=definition.id+'@'+definition.version;
   const path='/api/internal/recommender-definitions/'+definition.id+'/versions/'+definition.version;
   state.publications[key]??={};const p=state.publications[key];
   if(!p.definition){const saved=await request(path,'PUT',definition);p.definition=await request(path+'/publish','POST',{expectedDraftSha256:saved.draftSha256});await checkpoint();}
   if(!p.dataset){
     if(!p.preview){
       const spec={schemaVersion:1,id:definition.id+'-base',version:definition.version,definition:ref(definition.id,definition.version,p.definition.snapshot),format:'json',source:item.source,mapping:{recordId:['id'],attributes:Object.fromEntries(definition.attributes.map(a=>[a.id,{path:['values',a.id],encoding:'value'}]))}};
       const form=new FormData();form.set('spec',JSON.stringify(spec));form.set('file',new Blob([JSON.stringify(item.records)],{type:'application/json'}),item.filename);
       p.preview=await request('/api/internal/recommender-datasets/imports/preview','POST',form);await checkpoint();
     }
     const report=p.preview.snapshot.content.report;assert.equal(report.fatal.length,0);assert.equal(report.invalid,0);assert.equal(report.valid,item.records.length);
     p.dataset=await request('/api/internal/recommender-datasets/'+definition.id+'-base/versions/'+definition.version+'/publish','POST',{importId:p.preview.id,previewSha256:p.preview.snapshot.sha256,excludedOrdinals:[]});await checkpoint();
   }
 }
 for(const version of ['1','2']){
   const p=state.publications['project-risk-recommender@'+version];const definition=ref(p.definition.definition.id,version,p.definition.snapshot);
   const profile=await request('/api/internal/project-recommender-profile/load','POST',{project:plan.demoProject,definition});
   if(profile.revision===0)await request('/api/internal/project-recommender-profile','PUT',{project:plan.demoProject,definition,revision:0,values:(version==='1'?plan.inputs.baseline:plan.inputs.distributed).values});
 }
 for(const [key,input,publication] of [['distributed',plan.inputs.distributed,'project-risk-recommender@2'],['colocated',plan.inputs.colocated,'project-risk-recommender@2'],['nfr',plan.inputs.nfr,'nfr-recommender@1']]){
   if(!state.runs[key]){const p=state.publications[publication];state.runs[key]=await request('/api/internal/recommendation-runs','POST',{id:randomUUID(),definition:ref(p.definition.definition.id,p.definition.definition.version,p.definition.snapshot),dataset:ref(p.dataset.snapshot.content.id,p.dataset.snapshot.content.version,p.dataset.snapshot),input,...(key==='nfr'?{selection:{labelIndex:0}}:{})});await checkpoint();}
   assert.equal((await request('/api/internal/recommendation-runs/'+state.runs[key].id+'/replay','POST',{})).verified,true);
 }
 assert.equal(state.runs.distributed.snapshot.content.result.content.neighbors[0].recordId,'P09');
 assert.equal(state.runs.colocated.snapshot.content.result.content.neighbors[0].recordId,'P01');
 assert.equal(state.runs.nfr.snapshot.content.result.content.items.length,6);
 // Grant the browser account only after all data and publications are ready.
 const credentialPath=folder+'/credentials.json';let credentials;
 try{credentials=JSON.parse(await readFile(credentialPath,'utf8'));}catch(e){if(e.code!=='ENOENT')throw e;credentials={username,password:'ICSE-'+randomBytes(18).toString('base64url')};await writeFile(credentialPath,JSON.stringify(credentials,null,2)+'\n',{flag:'wx',mode:0o600});}
 assert.equal(credentials.username,username);
 const prepared=await prepareWebUsers(credentials.password,[username]);await provisionWebUsers(db,prepared.users,true);
 await db.query('BEGIN');
 try{
   const otherMemberships=await db.query('SELECT organization_id,role FROM public.organization_memberships WHERE username=$1',[username]);
   assert.ok(otherMemberships.rows.every(row=>row.organization_id===organizationId),'Reviewer has an unexpected membership; refusing to alter it.');
   await db.query("INSERT INTO public.organization_memberships(organization_id,username,role,active) VALUES ($1,$2,'maintainer',true) ON CONFLICT(organization_id,username) DO NOTHING",[organizationId,username]);
   assert.equal((await db.query('SELECT role FROM public.organization_memberships WHERE organization_id=$1 AND username=$2 AND active',[organizationId,username])).rows[0]?.role,'maintainer');
   await db.query("INSERT INTO public.organization_access_audit(organization_id,actor,subject,action,details) VALUES ($1,'reviewer-demo-provisioning',$2,'reviewer_account_ready',$3::jsonb)",[organizationId,username,JSON.stringify({role:'maintainer',separateWorkspace:true,sourceRecordIds:classificationIds})]);
   await db.query('COMMIT');
 }catch(e){await db.query('ROLLBACK');throw e;}
 const copiedSource=(await db.query('SELECT c.id::text,c.story_id::text,s.content,p.name FROM public.classifications c JOIN public.stories s ON s.id=c.story_id JOIN public.projects p ON p.id=s.project_id WHERE c.id=ANY($1::bigint[]) ORDER BY c.id',[classificationIds])).rows;
 assert.equal(digest(copiedSource),digest(sourceRecords),'Original source records changed during preparation.');
 const report={preparedAt:new Date().toISOString(),origin,organizationId,name,username,role:'maintainer',credentialFile:credentialPath,copyOtherAccounts:false,sourceDataUnchanged:true,copied:state.copied,runs:Object.fromEntries(Object.entries(state.runs).map(([key,run])=>[key,{id:run.id,url:origin+'/configured-recommendations?runId='+run.id,verified:true}]))};
 await writeFile(folder+'/report.json',JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}catch(e){console.error('Reviewer preparation failed:',e.message);console.error(e.stack?.split('\n').slice(1,3).join('\n'));process.exitCode=1;}finally{await db.end();}
