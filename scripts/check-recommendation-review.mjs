// Called by check-recommendation-runs inside its disposable LOCAL schema.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
export async function checkRecommendationReview({ pool, request, publishDefinition, publishDataset, template, reference, legacyNfrInput }) {
  const { snapshotContent } = await import('../apps/api/dist/domain/content-snapshot.js');
  const { decideRecommendationItem } = await import('../apps/api/dist/services/recommendation-review.js');
  const draft = { ...structuredClone(template), id: 'review-rnf', version: '1' };
  const definition = await publishDefinition(draft);
  const history = legacyNfrInput(draft, reference.profiles.f4, 'f4', 'synthetic review fixture');
  history.values.nfrs.push({ type: 'Security', attribute: 'access_control', sentence: 'A second synthetic suggestion for review checks.' });
  const base = await publishDataset('review-base', draft, definition, [history]);
  const ref = (record, id, version) => ({ id, version, format: record.snapshot.format, sha256: record.snapshot.sha256 });
  const input = legacyNfrInput(draft, reference.profiles.fa, '1', 'synthetic review fixture');
  const create = async () => request('recommendation-runs', '', 'POST', { id: randomUUID(), definition: ref(definition, draft.id, '1'), dataset: ref(base, 'review-base', '1'), input, selection: { labelIndex: 0 } }, 201);
  const call = (run, suffix, method = 'GET', body, expected = 200) => request('recommendation-runs', `/${run.id}${suffix}`, method, body, expected);
  const bind = (run, target = { kind: 'input' }, expected = 200) => call(run, '/target', 'POST', { runSha256: run.snapshot.sha256, target }, expected);
  const body = (run, target, index = 0, decision = 'accepted') => ({ id: randomUUID(), runSha256: run.snapshot.sha256, targetSha256: target.snapshot.sha256,
    itemKey: run.snapshot.content.result.content.items[index].key, decision, notes: 'Synthetic human evaluation.' });
  const count = async table => (await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n;
  const { rows: [project] } = await pool.query("INSERT INTO projects (name) VALUES ('Explicit operational destination') RETURNING id");
  const { rows: [sprint] } = await pool.query("INSERT INTO project_sprints (project_id, name) VALUES ($1, 'Backlog') RETURNING id", [project.id]);
  const { rows: [story] } = await pool.query("INSERT INTO stories (project_id, sprint_id, external_id, content) VALUES ($1, $2, 'US-1', 'Explicitly reviewed operational text') RETURNING id::text", [project.id, sprint.id]);
  const { rows: [classification] } = await pool.query("INSERT INTO classifications (story_id, review_status) VALUES ($1, 'reviewed') RETURNING id::text", [story.id]);
  await pool.query("INSERT INTO classification_labels (classification_id, module, operation) VALUES ($1, 'Registry', 'Retrieve data')", [classification.id]);
  const run = await create(); assert.equal(run.snapshot.content.result.content.items.length, 2);
  await call(run, '/target', 'POST', undefined, 422);
  await call(run, '/decisions', 'POST', undefined, 422);
  assert.equal(run.snapshot.content.request.content.input.values.classification_id, classification.id, 'Fixture deliberately collides with a local operational ID.');
  await call(run, '/decisions', 'POST', { ...body(run, { snapshot: { sha256: '0'.repeat(64) } }), targetSha256: '0'.repeat(64) }, 409);
  await call(run, '/target', 'POST', { runSha256: '0'.repeat(64), target: { kind: 'input' } }, 409);
  const targets = await Promise.all([bind(run), bind(run)]); assert.deepEqual(targets[0], targets[1]); const target = targets[0];
  const accepted = body(run, target);
  const acceptedResults = await Promise.all([call(run, '/decisions', 'POST', accepted), call(run, '/decisions', 'POST', accepted)]);
  assert.deepEqual(acceptedResults[0], acceptedResults[1]);
  assert.equal(acceptedResults[0].snapshot.content.association.materialization, 'input_only');
  assert.equal(await count('story_non_functional_requirements'), 0, 'Imported numeric IDs must not cause operational writes.');
  assert.equal(await count('recommender_item_links'), 1);
  assert.deepEqual(await call(run, '/decisions', 'POST', { ...accepted, id: randomUUID() }), acceptedResults[0]);
  await call(run, '/decisions', 'POST', { ...accepted, decision: 'rejected' }, 409);
  await call(run, '/decisions', 'POST', { ...accepted, notes: 'Changed observation' }, 409);
  await call(run, '/decisions', 'POST', { ...accepted, sentence: 'Replacement' }, 422);
  await call(run, '/decisions', 'POST', { ...accepted, id: randomUUID(), itemKey: '0'.repeat(64) }, 422);
  const rejected = await call(run, '/decisions', 'POST', body(run, target, 1, 'rejected'));
  assert.equal(rejected.snapshot.content.association, null); assert.equal(await count('recommender_item_links'), 1);
  const reviewed = await call(run, '/review'); assert.equal(reviewed.decisions.length, 2); assert.equal(reviewed.target.snapshot.sha256, target.snapshot.sha256);
  const adaptation = {id:randomUUID(),runSha256:run.snapshot.sha256,targetSha256:target.snapshot.sha256,
    decisionId:acceptedResults[0].id,itemKey:accepted.itemKey,previousCopy:null,sentence:'Adapted to this input without changing the original.',reason:'Explicit contextual correction.'};
  const copy=await call(run,'/copies','POST',adaptation,201);
  assert.equal(copy.snapshot.content.revision,1);
  assert.equal(copy.snapshot.content.artifact.sentence,adaptation.sentence);
  assert.equal(copy.snapshot.content.originalItem.content.sentence,run.snapshot.content.result.content.items[0].sentence);
  assert.deepEqual(await call(run,'/copies','POST',adaptation,201),copy);
  await call(run,'/copies','POST',{...adaptation,reason:'Changed retry'},409);
  await call(run,'/copies','POST',{...adaptation,id:randomUUID()},409);
  const second=await call(run,'/copies','POST',{...adaptation,id:randomUUID(),previousCopy:{id:copy.id,sha256:copy.snapshot.sha256},sentence:'Second preserved adaptation.'},201);
  assert.equal(second.snapshot.content.revision,2);
  await call(run,'/copies','POST',{...adaptation,id:randomUUID(),decisionId:rejected.id,itemKey:rejected.snapshot.content.request.content.itemKey},409);
  const historyCopies=(await call(run,'/review')).copies;
  assert.equal(historyCopies.length,2);
  assert.equal(snapshotContent(second.snapshot.content).sha256,second.snapshot.sha256);
  await assert.rejects(pool.query('UPDATE nfr_adapted_copies SET created_by=$1 WHERE id=$2',['forged',copy.id]),/immutable/);
  assert.equal(await count('story_non_functional_requirements'),0);
  for (const decision of reviewed.decisions) assert.equal(snapshotContent(decision.snapshot.content).sha256, decision.snapshot.sha256);
  assert.deepEqual(await call(run, ''), run); assert.equal((await call(run, '/replay', 'POST', {})).verified, true);
  const repeated = await create(), repeatedTarget = await bind(repeated);
  await call(repeated, '/decisions', 'POST', body(repeated, repeatedTarget)); assert.equal(await count('recommender_item_links'), 1, 'Same input/content is linked once across runs.');

  // Operational destination requires an explicit, reviewed snapshot and justification.
  const operational = await create();
  await call(operational, `/destinations/01`, 'GET', undefined, 422);
  await call(operational, `/destinations/9223372036854775808`, 'GET', undefined, 422);
  await call(operational, `/destinations/999999`, 'GET', undefined, 404);
  let preview = await call(operational, `/destinations/${classification.id}`);
  const choose = snapshot => ({ kind: 'classification', classificationId: classification.id, expectedSha256: snapshot.sha256, justification: 'Explicit manual mapping; imported IDs are not operational identities.' });
  await bind(operational, { ...choose(preview), expectedSha256: '0'.repeat(64) }, 409);
  await pool.query("UPDATE stories SET content = 'Updated operational destination' WHERE id = $1", [story.id]);
  await bind(operational, choose(preview), 409); preview = await call(operational, `/destinations/${classification.id}`);
  const operationalTarget = await bind(operational, choose(preview));
  await bind(operational, { kind: 'input' }, 409);
  const sameStory = await create(), sameTarget = await bind(sameStory, choose(preview));
  const [opDecision, sameDecision] = await Promise.all([
    call(operational, '/decisions', 'POST', body(operational, operationalTarget)),
    call(sameStory, '/decisions', 'POST', body(sameStory, sameTarget))
  ]);
  assert.deepEqual(new Set([opDecision.snapshot.content.association.materialization, sameDecision.snapshot.content.association.materialization]), new Set(['created', 'already_present']));
  assert.equal(sameDecision.snapshot.content.association.identitySha256, opDecision.snapshot.content.association.identitySha256);
  assert.equal(await count('story_non_functional_requirements'), 1);

  // A failure at the final INSERT rolls back the operational NFR and generic link too.
  const rollback = await create(), rollbackTarget = await bind(rollback, choose(preview)), rollbackRequest = body(rollback, rollbackTarget, 1);
  const linksBefore = await count('recommender_item_links');
  await pool.query(`ALTER TABLE recommender_item_decisions ADD CONSTRAINT forced_review_rollback CHECK (id <> '${rollbackRequest.id}'::uuid)`);
  await assert.rejects(decideRecommendationItem(rollback.id, rollbackRequest, 'local-check'), error => error.code === '23514');
  assert.equal((await call(rollback, '/review')).decisions.length, 0);
  assert.equal(await count('story_non_functional_requirements'), 1); assert.equal(await count('recommender_item_links'), linksBefore);
  await pool.query('ALTER TABLE recommender_item_decisions DROP CONSTRAINT forced_review_rollback');

  // Changes after confirmation block acceptance but do not erase evidence or prevent rejection.
  const stale = await create(), staleTarget = await bind(stale, choose(preview));
  await pool.query("UPDATE classifications SET review_status = 'pending_review' WHERE id = $1", [classification.id]);
  await call(stale, '/decisions', 'POST', body(stale, staleTarget, 1), 409);
  assert.equal((await call(stale, '/review')).decisions.length, 0);
  await call(stale, '/decisions', 'POST', body(stale, staleTarget, 1, 'rejected'));
  assert.equal(await count('story_non_functional_requirements'), 1);
  await pool.query("UPDATE classifications SET review_status = 'reviewed' WHERE id = $1", [classification.id]);
  const outdated = await create(), outdatedTarget = await bind(outdated, choose(preview));
  const { rows: [latest] } = await pool.query("INSERT INTO classifications (story_id, review_status) VALUES ($1, 'pending_review') RETURNING id::text", [story.id]);
  await call(outdated, '/decisions', 'POST', body(outdated, outdatedTarget, 1), 409);
  await call(outdated, `/destinations/${classification.id}`, 'GET', undefined, 409);
  await call(outdated, `/destinations/${latest.id}`, 'GET', undefined, 409);
  // Immutable review rows and original scientific snapshots remain intact.
  for (const table of ['recommender_run_targets', 'recommender_item_decisions', 'recommender_item_links']) {
    await assert.rejects(pool.query(`UPDATE ${table} SET content = content`), /immutable/);
    await assert.rejects(pool.query(`DELETE FROM ${table}`), /immutable/);
  }
  const historical = await create();
  await request('recommender-definitions', `/${draft.id}/versions/1/retire`, 'POST', {});
  const historicalTarget = await bind(historical); await call(historical, '/decisions', 'POST', body(historical, historicalTarget));
  assert.equal((await call(historical, '/replay', 'POST', {})).verified, true);
  process.env.INGEST_API_KEY = 'local-review-check-only';
  await call(run, '/review', 'GET', undefined, 401); await bind(run, { kind: 'input' }, 401);
  await call(run, '/decisions', 'POST', accepted, 401); await call(run, `/destinations/${classification.id}`, 'GET', undefined, 401);
  delete process.env.INGEST_API_KEY;
  assert.deepEqual(await call(run, ''), run); assert.equal((await call(run, '/replay', 'POST', {})).verified, true);
  console.log('Review: explicit targets, imported/local ID isolation, immutable decisions, cross-run deduplication, concurrency, stale destination rejection, atomic rollback and historical replay OK.');
}
