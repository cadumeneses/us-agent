import { z } from 'zod';
import { snapshotContent } from './content-snapshot.js';
import type { RecommendationContent } from '../services/recommendation-execution.js';
import type { NfrSuggestion } from '../services/nfr-engine.js';
import type { RecommendationInput } from './recommender-definition.js';

const sha256 = z.string().regex(/^[a-f0-9]{64}$/);
export const classificationIdentity = z.string().regex(/^[1-9][0-9]{0,18}$/).refine(value => BigInt(value) <= 9223372036854775807n, 'Identificador fora do intervalo.');
export const bindRecommendationTargetSchema = z.strictObject({ runSha256: sha256, target: z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('input') }),
  z.strictObject({ kind: z.literal('classification'), classificationId: classificationIdentity, expectedSha256: sha256,
    justification: z.string().trim().min(5).max(2000) })
]) });
export const recommendationDecisionSchema = z.strictObject({ id: z.uuid(), runSha256: sha256, targetSha256: sha256,
  itemKey: sha256, decision: z.enum(['accepted', 'rejected']), notes: z.string().max(2000).default('') });
export type RecommendationDecisionRequest = z.infer<typeof recommendationDecisionSchema>;

export const nfrCopyRequestSchema = z.strictObject({ id: z.uuid(), runSha256: sha256, targetSha256: sha256,
  decisionId: z.uuid(), itemKey: sha256, previousCopy: z.strictObject({ id: z.uuid(), sha256 }).nullable(),
  sentence: z.string().trim().min(1).max(20000), reason: z.string().trim().min(5).max(2000) });

export function decisionItem(content: RecommendationContent, itemKey: string): NfrSuggestion {
  const result = content.result.content;
  if (result.status !== 'completed') throw new Error('A execução não contém sugestões avaliáveis.');
  const item = result.items.find(value => value.key === itemKey);
  if (!item) throw new Error('Item não encontrado no resultado original.');
  return item;
}
export function inputAssociationScope(content: { definition: { sha256: string }; request: { content: { input: RecommendationInput } } }) {
  return snapshotContent({ definitionSha256: content.definition.sha256, input: content.request.content.input }).sha256;
}
export function associationIdentity(destination: { kind: 'input'; scopeSha256: string } | { kind: 'classification'; classificationId: string }, method: string, itemKey: string) {
  return snapshotContent({ destination, method, itemKey });
}
