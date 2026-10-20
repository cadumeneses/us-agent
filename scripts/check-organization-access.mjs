// Full local HTTP check with real sessions and two isolated schemas. No .env or remote target.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {loadMigrationRelease,applyMigrationRelease} from './lib/deployment-migrations.mjs';
import {prepareWebUsers,provisionWebUsers} from './lib/web-user-provisioning.mjs';
import {provisionOrganization} from './lib/organization-provisioning.mjs';
const schema='access_check_'+randomUUID().replaceAll('-','');
const local='postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent';
const client=new pg.Client({connectionString:local,connectionTimeoutMillis:3000});
let server,pool,tenant;
await client.connect();
try{
  await client.query(`CREATE SCHEMA "${schema}"`);await client.query(`SET search_path TO "${schema}"`);
  const release=await loadMigrationRelease();await applyMigrationRelease(client,release);
  const password='synthetic-access-check-only';
  const users=await prepareWebUsers(password,['admin','maintainer','reviewer','viewer']);
  await provisionWebUsers(client,users.users,true);
  for(const role of ['admin','maintainer','reviewer','viewer']) await client.query('INSERT INTO organization_memberships(organization_id,username,role) VALUES ($1,$2,$2)',['default',role]);
  tenant=await provisionOrganization(client,release,{id:'isolated',name:'Isolated organization',adminUsername:'admin'});
  await client.query("INSERT INTO organization_memberships(organization_id,username,role) VALUES ('isolated','maintainer','maintainer')");
  process.env.DATABASE_URL=local+`?options=${encodeURIComponent('-c search_path='+schema)}`;
  process.env.DATABASE_POOL_MAX='3';process.env.NODE_ENV='test';process.env.ORGANIZATION_ACCESS_MODE='enforced';
  process.env.API_ACCESS_MODE='protected';process.env.INGEST_API_KEY='synthetic-access-integration-key';
  delete process.env.VERCEL;delete process.env.DATABASE_SSL;
  ({pool}=await import('../apps/api/dist/database/pool.js'));
  const {createApp}=await import('../apps/api/dist/app.js');server=createApp().listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  const origin=`http://127.0.0.1:${server.address().port}`;process.env.WEB_APP_ORIGIN=origin;
  const cookies={};
  for(const username of ['admin','maintainer','reviewer','viewer']){
    const response=await fetch(origin+'/api/auth/session',{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify({username,password})});
    assert.equal(response.status,200);cookies[username]=response.headers.get('set-cookie').split(';')[0];
  }
  async function call(username,path,method='GET',body,expected=200,organization='default'){
    const response=await fetch(origin+path,{method,headers:{Cookie:cookies[username],Origin:origin,'X-Organization-Id':organization,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;
  }
  await call('admin','/api/projects','POST',{name:'Only organization A'},201);
  await call('admin','/api/projects','POST',{name:'Only organization B'},201,'isolated');
  assert.ok((await call('admin','/api/projects')).includes('Only organization A'));
  assert.ok(!(await call('admin','/api/projects')).includes('Only organization B'));
  assert.ok(!(await call('admin','/api/projects','GET',undefined,200,'isolated')).includes('Only organization A'));
  await call('viewer','/api/projects','GET',undefined,403,'isolated');
  await call('admin','/api/projects','GET',undefined,403,'unknown');
  await call('admin','/api/projects','GET',undefined,400,'public;DROP');
  await call('viewer','/api/projects','POST',{name:'Forbidden'},403);
  await call('reviewer','/api/projects','POST',{name:'Forbidden'},403);
  await call('reviewer','/api/classifications/999999/review','PATCH',{action:'approve',module:'Registry',operation:'Retrieve data',notes:''},404);
  await call('reviewer',`/api/internal/recommendation-runs/${randomUUID()}/copies`,'POST',{},422);
  await call('viewer',`/api/internal/recommendation-runs/${randomUUID()}/copies`,'POST',{},403);
  await call('maintainer','/api/access/members','GET',undefined,403);
  await call('maintainer','/api/projects','POST',{name:'Allowed maintainer'},201);
  await call('admin','/api/access/members/maintainer','PUT',{role:'viewer',active:true});
  await call('maintainer','/api/projects','POST',{name:'Revoked immediately'},403);
  await call('admin','/api/access/members/admin','PUT',{role:'viewer',active:true},409);
  const events=await call('admin','/api/access/audit');
  assert.ok(events.events.some(event=>event.actor==='admin'&&event.table_name==='projects'&&event.operation==='INSERT'));
  assert.ok(events.access.some(event=>event.actor==='admin'&&event.subject==='maintainer'));
  assert.ok(events.events.every(event=>event.organization_id==='default'));
  await assert.rejects(client.query("DELETE FROM domain_audit_events"),/immutable/);
  // Transaction-local scope must not bleed through reused pool connections.
  const both=await Promise.all(Array.from({length:12},(_,index)=>call('admin','/api/projects','GET',undefined,200,index%2?'isolated':'default')));
  both.forEach((projects,index)=>assert.ok(!projects.includes(index%2?'Only organization A':'Only organization B')));
  await call('admin','/api/access/members/viewer','PUT',{role:'viewer',active:false});
  await call('viewer','/api/projects','GET',undefined,403);
  console.log(JSON.stringify({localOnly:true,rolesEnforced:true,organizationsIsolated:true,concurrentScopeIsolated:true,
    revocationImmediate:true,lastAdministratorProtected:true,authorRecorded:true,auditImmutable:true},null,2));
}finally{
  if(server)await new Promise(resolve=>server.close(resolve));if(pool)await pool.end();
  await client.query('ROLLBACK');await client.query('SET search_path TO public');
  if(tenant)await client.query(`DROP SCHEMA "${tenant.schema}" CASCADE`);
  await client.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);await client.end();
}
