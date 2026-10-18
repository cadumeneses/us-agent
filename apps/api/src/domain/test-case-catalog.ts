import { z } from 'zod';
import { canonicalJson, snapshotContent } from './content-snapshot.js';
import { definitionIdentitySchema } from './recommender-definition.js';

const id = z.string().min(1).max(160).refine(value => value.trim() === value, 'ID não pode ter espaços externos.');
export const testCaseCatalogSchema = z.strictObject({
  schemaVersion: z.literal(1), ...definitionIdentitySchema.shape,
  source: z.strictObject({ kind: z.enum(['synthetic', 'source_example']), reference: z.string().min(1).max(2000) }),
  items: z.array(z.strictObject({ id, title: z.string().min(1).max(1000), gherkin: z.string().min(1).max(20000),
    purpose: z.string().max(4000).optional(), executionMode: z.enum(['manual', 'automated', 'unspecified']).optional(),
    metadata: z.record(z.string(), z.json()).optional() })).max(10000)
}).superRefine((catalog, context) => {
  const seen = new Set<string>();
  catalog.items.forEach((item, index) => {
    if (seen.has(item.id)) context.addIssue({ code: 'custom', path: ['items', index, 'id'], message: 'ID de caso de teste duplicado.' });
    seen.add(item.id);
  });
});

/** Local data contract: not a database publication or a claim about the original TestRec schema. */
export function snapshotTestCaseCatalog(raw: unknown) {
  canonicalJson(raw);
  return snapshotContent(testCaseCatalogSchema.parse(raw));
}
