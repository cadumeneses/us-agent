// Unified WIS integration and migration rehearsal. Fixed LOCAL database; no .env.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadMigrationRelease,applyMigrationRelease} from './lib/deployment-migrations.mjs';
import {snapshotContent} from '../apps/api/dist/domain/content-snapshot.js';
import {parseRecommenderTaxonomy} from '../apps/api/dist/domain/recommender-taxonomy.js';
const schema='unified_wis_check_'+randomUUID().replaceAll('-','');
const local='postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent';
const client=new pg.Client({connectionString:local,connectionTimeoutMillis:3000});
let created=false,pool,server;
await client.connect();
try {
  await client.query(`CREATE SCHEMA "${schema}"`);created=true;await client.query(`SET search_path TO "${schema}"`);
  const release=await loadMigrationRelease();await applyMigrationRelease(client,release.slice(0,-1));
  await client.query("INSERT INTO taxonomy_versions(version,is_active) VALUES ('Empty WIS',true),('Inactive WIS',false)");
  await client.query(`INSERT INTO taxonomy_domains(taxonomy_version_id,name,description,position)
    SELECT id,'Historical domain','Keep this metadata',0 FROM taxonomy_versions WHERE version='Inactive WIS'`);
  await client.query(`INSERT INTO taxonomy_modules(taxonomy_version_id,domain_id,name,description,position)
    SELECT taxonomy_version_id,id,'Módulo Unicode','Quotes " and newline',0 FROM taxonomy_domains WHERE name='Historical domain'`);
  await client.query(`INSERT INTO taxonomy_operations(module_id,name,description,position,is_active)
    SELECT id,'Operação 🧪','Original description with Unicode',0,false FROM taxonomy_modules WHERE name='Módulo Unicode'`);
  await client.query('UPDATE taxonomy_modules SET description=$1 WHERE name=$2',['Quotes " and backslash \\; newline\n tab\t separator\u2028','Módulo Unicode']);
  const before=(await client.query('SELECT id::text,name,description,position FROM taxonomy_modules ORDER BY id')).rows;
  const operationCount=(await client.query('SELECT count(*)::int AS n FROM taxonomy_operations')).rows[0].n;
  const collision={schemaVersion:1,id:'wis',version:'1.0.0',name:'Existing user draft',kind:'tree',selection:'leaf',source:'Collision fixture',nodes:[]};
  await client.query("INSERT INTO recommender_taxonomy_versions(taxonomy_id,version,content,created_by) VALUES ('wis','1.0.0',$1,'collision-fixture')",[collision]);
  await assert.rejects(applyMigrationRelease(client,release),/Migration failed: 032/);
  assert.equal((await client.query("SELECT to_regclass('wis_taxonomy_bindings') AS relation")).rows[0].relation,null);
  assert.deepEqual((await client.query("SELECT content FROM recommender_taxonomy_versions WHERE taxonomy_id='wis' AND version='1.0.0'")).rows[0].content,collision);
  assert.equal((await client.query("SELECT count(*)::int AS n FROM recommender_taxonomy_versions WHERE taxonomy_id='wis-legacy' AND state<>'draft'")).rows[0].n,0);
  await client.query("DELETE FROM recommender_taxonomy_versions WHERE taxonomy_id='wis' AND version='1.0.0'");
  await applyMigrationRelease(client,release);
  assert.deepEqual((await client.query('SELECT id::text,name,description,position FROM taxonomy_modules ORDER BY id')).rows,before);
  assert.equal((await client.query('SELECT count(*)::int AS n FROM taxonomy_operations')).rows[0].n,operationCount);
  const imported=(await client.query("SELECT * FROM recommender_taxonomy_versions WHERE taxonomy_id='wis' ORDER BY version")).rows;
  assert.equal(imported.length,3);
  for(const row of imported){
    const content=parseRecommenderTaxonomy(row.content);
    if(row.state!=='draft')assert.equal(snapshotContent(content).sha256,row.content_sha256);
    const roots=new Set(content.nodes.filter(n=>n.parentId===null).map(n=>n.id));
    assert.ok(content.nodes.every(n=>n.parentId===null||roots.has(n.parentId)));
    assert.ok(content.nodes.every(n=>!n.id.startsWith('wis-domain-')));
  }
  assert.equal(imported.find(row=>row.content.nodes.length===0).state,'draft');
  assert.equal(imported.find(row=>row.content.nodes.some(n=>n.name==='Operação 🧪')).state,'retired');
  assert.equal((await client.query("SELECT count(*)::int AS n FROM recommender_taxonomy_versions WHERE taxonomy_id='wis-legacy' AND state<>'retired'")).rows[0].n,0);
  process.env.DATABASE_URL=local+'?options='+encodeURIComponent('-c search_path='+schema);process.env.NODE_ENV='test';process.env.API_ACCESS_MODE='local';
  for(const key of ['VERCEL','INGEST_API_KEY','DATABASE_SSL','ORGANIZATION_ACCESS_MODE'])delete process.env[key];
  ({pool}=await import('../apps/api/dist/database/pool.js'));
  const {createApp}=await import('../apps/api/dist/app.js');server=createApp().listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  async function call(path,method='GET',body,status=200){const r=await fetch(origin+path,{method,...(body===undefined?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;}
  const base=await call('/api/internal/recommender-taxonomies/wis/versions/1.0.0');
  assert.equal(base.state,'published');
  const empty=imported.find(row=>row.content.nodes.length===0);
  await client.query("UPDATE taxonomy_versions SET is_active=false WHERE version='Empty WIS'");
  const filled={...empty.content,nodes:[{id:'empty-module',name:'New module',description:'',parentId:null,selectable:false},
    {id:'empty-operation',name:'New operation',description:'',parentId:'empty-module',selectable:true}]};
  const filledSaved=await call(`/api/internal/recommender-taxonomies/wis/versions/${empty.version}`,'PUT',filled);
  await call(`/api/internal/recommender-taxonomies/wis/versions/${empty.version}/publish`,'POST',{expectedDraftSha256:filledSaved.snapshot.sha256});
  assert.deepEqual((await call('/api/taxonomy?version='+encodeURIComponent(empty.version))).modules['New module'],['New operation']);
  assert.equal((await client.query("SELECT is_active FROM taxonomy_versions WHERE version='Empty WIS'")).rows[0].is_active,true);
  const draft={...base.snapshot.content,version:'2.0.0',nodes:[...base.snapshot.content.nodes,
    {id:'reports',name:'Reports',description:'Reporting module',parentId:null,selectable:false},
    {id:'export-report',name:'Export a report',description:'Export a report document',parentId:'reports',selectable:true}]};
  const saved=await call('/api/internal/recommender-taxonomies/wis/versions/2.0.0','PUT',draft);
  assert.equal(saved.state,'draft');
  const published=await call('/api/internal/recommender-taxonomies/wis/versions/2.0.0/publish','POST',{expectedDraftSha256:saved.snapshot.sha256});
  assert.equal(published.state,'published');
  const classification=await call('/api/taxonomy?version=2.0.0');assert.deepEqual(classification.modules.Reports,['Export a report']);
  assert.equal((await call('/api/taxonomy?version=1.0.0')).modules.Reports,undefined);
  await call('/api/internal/recommender-taxonomies/wis/versions/2.0.0','PUT',draft,409);
  const invalid={...draft,version:'3.0.0',nodes:[...draft.nodes,{id:'third-level',name:'Wrong depth',description:'',parentId:'export-report',selectable:true}]};
  await call('/api/internal/recommender-taxonomies/wis/versions/3.0.0','PUT',invalid,422);
  await call('/api/taxonomy/operations','POST',{version:'2.0.0',domain:'General',module:'Reports',operation:'Archive report',description:'Archive an existing report'},201);
  const latest=(await client.query(`SELECT t.* FROM wis_taxonomy_bindings b JOIN recommender_taxonomy_versions t ON t.taxonomy_id='wis' AND t.version=b.version
    JOIN taxonomy_versions v ON v.id=b.taxonomy_version_id WHERE v.version='2.0.0' ORDER BY b.bound_at DESC LIMIT 1`)).rows[0];
  assert.notEqual(latest.version,'2.0.0');assert.equal(latest.state,'published');
  assert.equal(snapshotContent(latest.content).sha256,latest.content_sha256);
  assert.ok(latest.content.nodes.some(n=>n.name==='Archive report'));
  assert.equal((await call('/api/internal/recommender-taxonomies/wis/versions/2.0.0')).snapshot.sha256,published.snapshot.sha256);
  assert.ok((await call('/api/taxonomy?version='+encodeURIComponent(latest.version))).modules.Reports.includes('Archive report'));
  await call('/api/internal/recommender-taxonomies/wis/versions/2.0.0/retire','POST',{});
  assert.equal((await client.query("SELECT is_active FROM taxonomy_versions WHERE version='2.0.0'")).rows[0].is_active,true);
  await call(`/api/internal/recommender-taxonomies/wis/versions/${latest.version}/retire`,'POST',{});
  assert.equal((await client.query("SELECT is_active FROM taxonomy_versions WHERE version='2.0.0'")).rows[0].is_active,false);
  const other={schemaVersion:1,id:'other-tree',version:'1',name:'Another taxonomy',kind:'tree',selection:'any',source:'Local fixture',nodes:[
    {id:'one',name:'One',description:'',parentId:null},{id:'two',name:'Two',description:'',parentId:'one'},{id:'three',name:'Three',description:'',parentId:'two'}]};
  const otherSaved=await call('/api/internal/recommender-taxonomies/other-tree/versions/1','PUT',other);
  await call('/api/internal/recommender-taxonomies/other-tree/versions/1/publish','POST',{expectedDraftSha256:otherSaved.snapshot.sha256});
  const repeated=[];await applyMigrationRelease(client,release,name=>repeated.push(name));assert.deepEqual(repeated,[]);
  console.log(JSON.stringify({ok:true,localOnly:true,sharedCatalog:true,twoLevels:true,publishUpdatesClassification:true,stableIdsAndHashes:true,historyPreserved:true,legacyWritesVersioned:true,retirement:true,migrationIdempotent:true,collisionRollback:true}));
}finally{
  if(server)await new Promise(r=>server.close(r));if(pool)await pool.end();
  if(created)await client.query(`DROP SCHEMA "${schema}" CASCADE`);await client.end();
}
