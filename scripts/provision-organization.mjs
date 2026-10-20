import assert from 'node:assert/strict';
import pg from 'pg';
import { loadMigrationRelease,migrationConnection } from './lib/deployment-migrations.mjs';
import { provisionOrganization } from './lib/organization-provisioning.mjs';

const [flag,targetFlag,expectedTarget,idFlag,id,nameFlag,name,adminFlag,adminUsername,...extra]=process.argv.slice(2);
assert.ok(flag==='--apply'&&targetFlag==='--expect-target'&&idFlag==='--id'&&nameFlag==='--name'&&adminFlag==='--admin'&&!extra.length,
  'Use --apply --expect-target HOST:PORT/DATABASE --id ORGANIZATION --name NAME --admin EXISTING_USERNAME.');
const {connectionString,target}=migrationConnection(process.env);assert.equal(expectedTarget,target);
const migrations=await loadMigrationRelease(),client=new pg.Client({connectionString,connectionTimeoutMillis:10000});
try {await client.connect();console.log(JSON.stringify({target,...await provisionOrganization(client,migrations,{id,name,adminUsername})},null,2));}
catch(error){console.error(error.code?`Organization provisioning failed (${error.code}).`:error.message);process.exitCode=1;}
finally{await client.end();}
