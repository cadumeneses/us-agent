// Read-only inventory of the existing records used by the reviewer walkthrough.
import assert from 'node:assert/strict';
import pg from 'pg';
import {migrationConnection,loadMigrationRelease,migrationStatus} from './lib/deployment-migrations.mjs';
const {connectionString,target}=migrationConnection(process.env);
assert.equal(target,'ep-rapid-mouse-avz844uw.c-11.us-east-1.aws.neon.tech:5432/neondb');
const db=new pg.Client({connectionString,connectionTimeoutMillis:10000});
try{
 await db.connect();await db.query('BEGIN READ ONLY');
 const status=await migrationStatus(db,await loadMigrationRelease());
 const projects=(await db.query('SELECT id::text,name FROM projects WHERE name=ANY($1::text[]) ORDER BY name',[['P01','P02','P03','P09','Projeto Emanuel','Information Resources Web Project']])).rows;
 const records=(await db.query('SELECT c.id::text,c.story_id::text,c.run_id,c.taxonomy_version,s.external_id,s.content,p.name FROM classifications c JOIN stories s ON s.id=c.story_id JOIN projects p ON p.id=s.project_id WHERE c.id=ANY($1::bigint[]) ORDER BY c.id',[[86,91,269]])).rows;
 const tables=(await db.query("SELECT table_name,array_agg(column_name ORDER BY ordinal_position) AS columns FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('projects','stories','classifications','classification_runs','classification_labels','story_tasks','story_functional_requirements','story_non_functional_requirements','story_details','project_research_profiles','story_research_inputs','project_sprints','story_sprints','story_preparations','recommender_definitions','recommender_datasets','recommender_taxonomies','test_case_catalogs') GROUP BY table_name ORDER BY table_name")).rows;
 const organizations=(await db.query("SELECT id,name FROM organizations WHERE id='icse2027-review'")).rows;
 const accountExists=Boolean((await db.query("SELECT 1 FROM web_users WHERE username='icse2027.reviewer'")).rowCount);
 const administratorExists=Boolean((await db.query("SELECT 1 FROM web_users WHERE username='carlos' AND active")).rowCount);
 console.log(JSON.stringify({target,status,projects,records,tables,organizations,accountExists,administratorExists},null,2));
 await db.query('ROLLBACK');
}catch(e){console.error('Reviewer inventory failed:',e.code??e.message);process.exitCode=1;}finally{await db.end();}
