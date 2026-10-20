// Disposable LOCAL rehearsal. Never reads .env or accepts a remote URL.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { loadMigrationRelease, applyMigrationRelease } from './lib/deployment-migrations.mjs';
import { verifyLegacyTaxonomyImports } from './lib/legacy-taxonomy-verification.mjs';

const schema = `legacy_taxonomy_check_${randomUUID().replaceAll('-', '')}`;
const client = new pg.Client({ connectionString: 'postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent', connectionTimeoutMillis: 3000 });
const release = (await loadMigrationRelease()).filter(row=>row.name<='029_legacy_taxonomy_staging.sql');
const migration = release.at(-1);
assert.equal(migration.name, '029_legacy_taxonomy_staging.sql');
await client.connect();
try {
  await client.query(`CREATE SCHEMA ${schema}`);
  await client.query(`SET search_path TO ${schema}`);
  await applyMigrationRelease(client, release.slice(0, -1));
  await client.query(`INSERT INTO taxonomy_versions(version,is_active) VALUES ('Catalog 1 / original',true), ('Inactive legacy',false), ('Empty original',true);
    INSERT INTO taxonomy_domains(taxonomy_version_id,name,description,position)
      SELECT id,'Domain', 'Original domain description',2 FROM taxonomy_versions WHERE version <> 'Empty original';
    INSERT INTO taxonomy_domains(taxonomy_version_id,name,description,position)
      SELECT id,'Empty domain','',1 FROM taxonomy_versions WHERE version = 'Catalog 1 / original';
    INSERT INTO taxonomy_modules(taxonomy_version_id,domain_id,name,description,position)
      SELECT taxonomy_version_id,id,'Module','Original module description',-1 FROM taxonomy_domains WHERE name='Domain';
    INSERT INTO taxonomy_modules(taxonomy_version_id,domain_id,name,description,position)
      SELECT taxonomy_version_id,id,'Empty module','',-1 FROM taxonomy_domains WHERE name='Domain';
    INSERT INTO taxonomy_operations(module_id,name,description,position,is_active)
      SELECT id,repeat('X',180),repeat('Long description ',200),3,true FROM taxonomy_modules WHERE name='Module';
    INSERT INTO taxonomy_operations(module_id,name,description,position,is_active)
      SELECT id,'Inactive operation','Preserved but unavailable',3,false FROM taxonomy_modules WHERE name='Module';`);
  const tables = ['taxonomy_versions', 'taxonomy_domains', 'taxonomy_modules', 'taxonomy_operations', 'projects', 'classifications'];
  const snapshot = async () => {
    const values = [];
    for (const table of tables) values.push((await client.query(`SELECT to_jsonb(t) AS row FROM ${table} t ORDER BY id`)).rows);
    return values;
  };
  const before = await snapshot();
  const inactiveCount = Number((await client.query('SELECT count(*) FROM taxonomy_operations WHERE NOT is_active')).rows[0].count);
  const { rows: [operation] } = await client.query('SELECT id::text, name FROM taxonomy_operations ORDER BY id LIMIT 1');
  await client.query("UPDATE taxonomy_operations SET name=' ' WHERE id=$1", [operation.id]);
  await assert.rejects(applyMigrationRelease(client, release), /029_legacy_taxonomy_staging.sql/);
  assert.equal((await client.query("SELECT to_regclass('legacy_taxonomy_imports') AS name")).rows[0].name, null);
  await client.query('UPDATE taxonomy_operations SET name=$2 WHERE id=$1', [operation.id, operation.name]);
  assert.deepEqual(await snapshot(), before);
  // Collision must abort everything, including DDL and evidence, without overwriting a draft.
  const { rows: [first] } = await client.query('SELECT id::text FROM taxonomy_versions ORDER BY id LIMIT 1');
  await client.query(`INSERT INTO recommender_taxonomy_versions(taxonomy_id,version,content,created_by)
    VALUES ('wis-legacy',$1,jsonb_build_object('schemaVersion',1,'id','wis-legacy','version',$1::text),'collision-check')`, [`wis-v-${first.id}`]);
  await assert.rejects(applyMigrationRelease(client, release), /029_legacy_taxonomy_staging.sql/);
  assert.equal((await client.query("SELECT to_regclass('legacy_taxonomy_imports') AS name")).rows[0].name, null);
  await client.query("DELETE FROM recommender_taxonomy_versions WHERE created_by='collision-check'");
  await applyMigrationRelease(client, release);
  assert.deepEqual(await snapshot(), before);
  await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const report = await verifyLegacyTaxonomyImports(client);
  await client.query('COMMIT');
  assert.equal(report.emptyVersions, 1); assert.equal(report.inactiveOperations, inactiveCount);
  const staged = (await client.query('SELECT * FROM legacy_taxonomy_imports ORDER BY legacy_version_id')).rows;
  await applyMigrationRelease(client, release);
  assert.deepEqual((await client.query('SELECT * FROM legacy_taxonomy_imports ORDER BY legacy_version_id')).rows, staged);
  await assert.rejects(client.query("UPDATE legacy_taxonomy_imports SET source_snapshot='{}'"), /immutable/);
  await client.query("UPDATE taxonomy_operations SET description='Changed after staging' WHERE name='Inactive operation'");
  await assert.rejects(verifyLegacyTaxonomyImports(client), /Source changed/);
  console.log(JSON.stringify({ localOnly: true, sourceUnchanged: true, invalidSourceRollback: true, collisionRollback: true, rerunSkipped: true, driftDetected: true, evidenceImmutable: true, ...report }, null, 2));
} finally {
  await client.query('ROLLBACK');
  await client.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await client.end();
}
