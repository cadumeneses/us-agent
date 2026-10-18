import { z } from 'zod';
import { canonicalJson, JSON_HASH_FORMAT, snapshotContent } from './content-snapshot.js';
import { buildImportPreview, contentReferenceSchema, datasetImportSpecSchema, importPreviewSchema, selectImportRecords } from './dataset-import.js';
import { datasetPublicationSchema } from './dataset-publication.js';
import { parseDefinitionPublication } from './definition-publication.js';
import { snapshotTestCasePublication } from './test-case-publication-integrity.js';
import { TestrecProfileError, validateTestrecProfile, validateTestrecDefinition } from '../services/testrec-method.js';

export const TESTREC_IMPORTER_VERSION = 'test-case-dataset-import-v1';
export const testCaseImportSpecSchema = z.strictObject({ ...datasetImportSpecSchema.shape, schemaVersion: z.literal(2), catalog: contentReferenceSchema })
  .superRefine((spec, context) => {
    if (spec.format === 'json' && spec.delimiter !== undefined) context.addIssue({ code: 'custom', path: ['delimiter'], message: 'CSV delimiter is not valid for JSON.' });
  });
export const methodImportSpecSchema = z.union([datasetImportSpecSchema, testCaseImportSpecSchema]);
export const testCaseImportPreviewSchema = importPreviewSchema.extend({ schemaVersion: z.literal(2), importerVersion: z.literal(TESTREC_IMPORTER_VERSION),
  spec: testCaseImportSpecSchema, catalog: z.strictObject({ format: z.literal(JSON_HASH_FORMAT), sha256: z.string(), content: z.unknown() }) });
export const methodImportPreviewSchema = z.union([importPreviewSchema, testCaseImportPreviewSchema]);
export const testCaseDatasetSchema = datasetPublicationSchema.extend({ schemaVersion: z.literal(2), importerVersion: z.literal(TESTREC_IMPORTER_VERSION), catalog: contentReferenceSchema });
export const methodDatasetSchema = z.union([datasetPublicationSchema, testCaseDatasetSchema]);
export type MethodImportPreview = z.infer<typeof methodImportPreviewSchema>;

export function buildTestCaseImportPreview(rawSpec: unknown, bytes: Buffer, filename: string, rawDefinition: unknown, rawCatalog: unknown) {
  canonicalJson(rawSpec);
  const spec = testCaseImportSpecSchema.parse(rawSpec), publication = parseDefinitionPublication(rawDefinition);
  const definition = validateTestrecDefinition(publication.definition, publication.taxonomies);
  const catalog = snapshotTestCasePublication(rawCatalog);
  if (canonicalJson(spec.catalog) !== canonicalJson({ id: catalog.content.id, version: catalog.content.version, format: catalog.format, sha256: catalog.sha256 })) throw new Error('Catalog differs from the selected publication.');
  if (spec.source.authorization.basis !== 'synthetic' || catalog.content.catalog.content.source.kind !== 'synthetic') throw new Error('The E21 equation demonstration accepts synthetic data only.');
  const { catalog: _reference, ...base } = spec;
  const preview = buildImportPreview({ ...base, schemaVersion: 1 }, bytes, filename, publication);
  const catalogIds = new Set(catalog.content.catalog.content.items.map(item => item.id));
  for (const row of preview.report.rows) if (row.input) {
    try {
      validateTestrecProfile(definition, row.input, catalogIds);
    } catch (error) {
      row.status = 'invalid'; row.input = null;
      const slot = error instanceof TestrecProfileError ? error.slot : null;
      row.issues.push({ code: slot === 'test_case_ids' ? 'test_case_association' : 'test_case_profile',
        path: slot ? [definition.method.bindings[slot]] : [], message: error instanceof Error ? error.message : 'Invalid test-case profile.' });
    }
  }
  preview.report.valid = preview.report.rows.filter(row => row.status === 'valid').length;
  preview.report.invalid = preview.report.rows.filter(row => row.status === 'invalid').length;
  preview.report.duplicate = preview.report.rows.filter(row => row.status === 'duplicate').length;
  return testCaseImportPreviewSchema.parse({ ...preview, schemaVersion: 2, importerVersion: TESTREC_IMPORTER_VERSION, spec, catalog });
}

export function selectMethodImportRecords(preview: MethodImportPreview, excluded: number[]) {
  if (preview.schemaVersion === 1) return selectImportRecords(preview, excluded);
  const { catalog: _catalog, ...spec } = preview.spec;
  const { catalog: _snapshot, ...base } = preview;
  return selectImportRecords({ ...base, schemaVersion: 1, importerVersion: 'structured-import-v1', spec: { ...spec, schemaVersion: 1 } }, excluded);
}
