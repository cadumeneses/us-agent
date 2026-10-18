import { z } from 'zod';
import { contentReferenceSchema, datasetImportSpecSchema } from './dataset-import.js';
import { recommendationInputSchema } from './recommender-definition.js';

export const datasetPublicationSchema = z.strictObject({
  schemaVersion: z.literal(1), importerVersion: z.literal('structured-import-v1'), id: z.string(), version: z.string(), definition: contentReferenceSchema,
  source: datasetImportSpecSchema.shape.source,
  import: z.strictObject({ id: z.uuid(), previewSha256: z.string(), fileSha256: z.string() }),
  mapping: datasetImportSpecSchema.shape.mapping,
  selection: z.strictObject({ excludedOrdinals: z.array(z.number().int()), includedOrdinals: z.array(z.number().int()) }),
  records: z.array(recommendationInputSchema).min(1)
});
