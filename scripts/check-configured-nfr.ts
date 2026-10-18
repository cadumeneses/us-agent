import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { snapshotContent } from '../apps/api/src/domain/content-snapshot.js';
import { parseRecommenderDefinition } from '../apps/api/src/domain/recommender-definition.js';
import { checkNfrBaseline } from '../apps/api/src/evaluation/nfr-baseline.js';
import { legacyNfrInput, simulateConfiguredNfr } from '../apps/api/src/services/configured-nfr.js';
import type { NfrProfile, NfrResult } from '../apps/api/src/services/nfr-engine.js';

const root = new URL('../', import.meta.url);
const [definitionText, referenceText, manifestText] = await Promise.all([
  readFile(new URL('config/recommenders/rnf-v2.draft.json', root), 'utf8'),
  readFile(new URL('research/baselines/rnf-v2/reference.json', root), 'utf8'),
  readFile(new URL('research/baselines/rnf-v2/manifest.json', root), 'utf8')
]);
checkNfrBaseline(referenceText, manifestText);
const definition = parseRecommenderDefinition(JSON.parse(definitionText));
const reference = JSON.parse(referenceText) as { profiles: Record<string, NfrProfile>; cases: Array<{
  id: string; targetId: string; historyIds: string[]; labelIndex: number; expected: NfrResult;
}> };
for (const scenario of reference.cases) {
  const input = legacyNfrInput(definition, reference.profiles[scenario.targetId], scenario.targetId, 'frozen reconstructed demonstration');
  const dataset = { id: 'rnf-frozen-demo', version: '1', source: 'reconstructed_demonstration',
    records: scenario.historyIds.map(id => legacyNfrInput(definition, reference.profiles[id], id, 'frozen reconstructed demonstration')) };
  const run = simulateConfiguredNfr(definition, input, dataset, scenario.labelIndex);
  assert.deepEqual(run.result.content, scenario.expected, scenario.id);
  console.log(`OK ${scenario.id}: ${run.result.content.status}; resultado SHA-256=${run.result.sha256}`);
}
console.log(`Configuração ${definition.id}@${definition.version}: ${definition.attributes.length} atributos; SHA-256=${snapshotContent(definition).sha256}`);
console.log('8 simulações compatíveis com o RNF v2; sem publicação, banco, LLM ou modificação das referências científicas.');
