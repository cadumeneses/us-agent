import { createHash } from 'node:crypto';
import type { ClassificationProvenance } from '../domain/classification.js';
import type { ProviderVote, Taxonomy } from '../domain/models.js';

export function createClassificationProvenance(
  text: string, taxonomy: Taxonomy,
  metadata: Pick<ClassificationProvenance, 'engine' | 'policyVersion' | 'promptVersion' | 'prompt' | 'decision'>,
  votes: ProviderVote[] = []
): ClassificationProvenance {
  const { taxonomies: _catalog, ...content } = taxonomy;
  const snapshot = structuredClone(content);
  const canonical = JSON.stringify(snapshot, (_key, value: unknown) => {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0));
    }
    return value;
  });
  return structuredClone({
    schemaVersion: 1, ...metadata, input: { text },
    taxonomy: { version: taxonomy.version, sha256: createHash('sha256').update(canonical).digest('hex'), snapshot },
    execution: { arbitration: false, reruns: 0 },
    providers: votes.map(vote => ({ provider: vote.provider, requestedModel: vote.requestedModel ?? null,
      model: vote.model ?? null, status: vote.status }))
  });
}
