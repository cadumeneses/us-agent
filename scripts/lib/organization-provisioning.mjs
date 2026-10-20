import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { applyMigrationRelease } from './deployment-migrations.mjs';

export async function provisionOrganization(client, migrations, {id,name,adminUsername}) {
  assert.match(id,/^[a-z][a-z0-9_-]{0,63}$/);assert.ok(id!=='default');
  assert.ok(typeof name==='string'&&name.trim().length>0&&name.length<=160);
  assert.match(adminUsername,/^[a-z][a-z0-9._-]{0,63}$/);
  const base=(await client.query('SELECT current_schema() AS name')).rows[0].name;
  assert.match(base,/^[a-z_][a-z0-9_]{0,62}$/);
  assert.equal((await client.query('SELECT 1 FROM organizations WHERE id=$1',[id])).rowCount,0,'Organization already exists.');
  assert.equal((await client.query('SELECT 1 FROM web_users WHERE username=$1 AND active',[adminUsername])).rowCount,1,'Select an existing active administrator.');
  const schema='org_'+randomUUID().replaceAll('-','');
  await client.query(`CREATE SCHEMA "${schema}"`);
  let registered=false;
  try {
    await client.query(`SET search_path TO "${schema}"`);
    await applyMigrationRelease(client,migrations);
    await client.query(`SET search_path TO "${base}"`);
    await client.query('BEGIN');
    await client.query('INSERT INTO organizations(id,name,schema_name) VALUES ($1,$2,$3)',[id,name.trim(),schema]);
    await client.query("INSERT INTO organization_memberships(organization_id,username,role) VALUES ($1,$2,'admin')",[id,adminUsername]);
    await client.query("INSERT INTO organization_access_audit(organization_id,actor,subject,action,details) VALUES ($1,'deployment-cli',$2,'organization_created',$3::jsonb)",[id,adminUsername,JSON.stringify({schema,name:name.trim()})]);
    await client.query('COMMIT');registered=true;
    return {id,name:name.trim(),schema,adminUsername};
  } finally {
    if (!registered) await client.query('ROLLBACK');
    await client.query(`SET search_path TO "${base}"`);
    // This schema was generated and created by this call; existing schemas are never dropped.
    if (!registered) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
  }
}
