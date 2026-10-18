import assert from 'node:assert/strict';
import { pool } from '../apps/api/src/database/pool.js';
import { nfrContext } from '../apps/api/src/services/nfr-recommendations.js';
import { recommendNfr } from '../apps/api/src/services/nfr-engine.js';

try {
  const records = await pool.query<{ id: string; external_id: string }>(`
    SELECT c.id::text, s.external_id FROM classifications c
    JOIN stories s ON s.id = c.story_id
    WHERE s.external_id IN ('ramos-2019-example-fa', 'ramos-2019-example-f4', 'ramos-2019-example-f5')
      AND c.run_id = 'ramos-2019-published-example'
  `);
  const ids = new Map(records.rows.map(row => [row.external_id.split('-').at(-1), row.id]));
  assert.equal(ids.size, 3, 'fa, f4 e f5 precisam estar no banco local');
  const [target, f4, f5] = await Promise.all(['fa', 'f4', 'f5'].map(async code => (await nfrContext(ids.get(code)!)).target));
  const result = recommendNfr(target, [f4, f5], 0);
  assert.equal(result.status, 'completed');
  assert.equal(result.dimensions.length, 9);
  assert.equal(result.neighbor?.classificationId, ids.get('f4'));
  assert.equal(result.neighbor?.similarity, 1);
  assert.equal(result.items.length, 1);
  const farther = recommendNfr(target, [f5], 0);
  assert.ok(Math.abs((farther.neighbor?.similarity ?? 0) - 1 / 3) < 1e-12);
  assert.equal(farther.items.length, 2);
  console.log('Exemplo Ramos 2019 validado no banco: f4 = 1, f5 = 1/3, RNFs associados recuperados.');
} finally {
  await pool.end();
}
