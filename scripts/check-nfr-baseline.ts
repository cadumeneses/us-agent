import { readFile } from 'node:fs/promises';
import { checkNfrBaseline } from '../apps/api/src/evaluation/nfr-baseline.js';

const root = new URL('../research/baselines/rnf-v2/', import.meta.url);
const [reference, manifest] = await Promise.all([
  readFile(new URL('reference.json', root), 'utf8'),
  readFile(new URL('manifest.json', root), 'utf8')
]);
for (const result of checkNfrBaseline(reference, manifest)) {
  console.log(`OK ${result.id}: ${result.status}; vizinho=${result.neighbor ?? 'nenhum'}`);
}
console.log('Referência RNF v2 íntegra: 8 cenários; sem banco de dados, LLM ou atualização dos snapshots.');
