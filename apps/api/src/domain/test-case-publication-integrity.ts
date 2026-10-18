import { z } from 'zod';
import { canonicalJson, JSON_HASH_FORMAT, snapshotContent } from './content-snapshot.js';
import { definitionIdentitySchema } from './recommender-definition.js';
import { snapshotTestCaseCatalog } from './test-case-catalog.js';
import { TEST_CASE_IMPORTER_VERSION, testCasePublishSpecSchema } from './test-case-publication.js';

const schema = z.strictObject({ schemaVersion: z.literal(1), importerVersion: z.literal(TEST_CASE_IMPORTER_VERSION),
  ...definitionIdentitySchema.shape,
  catalog: z.strictObject({ format: z.literal(JSON_HASH_FORMAT), sha256: z.string().regex(/^[a-f0-9]{64}$/), content: z.unknown() }),
  file: z.strictObject({ name: z.string().min(1).max(240), byteLength: z.number().int().min(1).max(5_000_000),
    sha256: z.string().regex(/^[a-f0-9]{64}$/), encoding: z.literal('utf-8'), bom: z.boolean() }),
  authorization: testCasePublishSpecSchema.shape.authorization });

/** Snapshot integrity only; original bytes are checked by the catalog repository on live reads. */
export function snapshotTestCasePublication(raw: unknown) {
  canonicalJson(raw);
  const parsed = schema.parse(raw), catalog = snapshotTestCaseCatalog(parsed.catalog.content);
  if (catalog.sha256 !== parsed.catalog.sha256 || catalog.content.id !== parsed.id || catalog.content.version !== parsed.version) throw new Error('Catalog publication identity or inner hash differs.');
  if ((catalog.content.source.kind === 'synthetic') !== (parsed.authorization.basis === 'synthetic')) throw new Error('Inconsistent catalog origin and use declaration.');
  return snapshotContent({ ...parsed, catalog });
}
