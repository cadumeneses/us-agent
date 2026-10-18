import { createHash } from 'node:crypto';
import { z } from 'zod';
import { canonicalJson, snapshotContent } from './content-snapshot.js';
import { datasetImportSpecSchema } from './dataset-import.js';
import { IMPORT_MAX_BYTES, parseImportJson } from './import-formats.js';
import { snapshotTestCaseCatalog } from './test-case-catalog.js';

export const TEST_CASE_IMPORTER_VERSION = 'test-case-json-v1';
export const testCasePublishSpecSchema = z.strictObject({
  expectedFileSha256: z.string().regex(/^[a-f0-9]{64}$/),
  authorization: datasetImportSpecSchema.shape.source.shape.authorization
});

/** Engineering publication envelope; the original file is stored separately, byte for byte. */
export function buildTestCasePublication(bytes: Buffer, filename: string, rawSpec: unknown) {
  canonicalJson(rawSpec);
  const spec = testCasePublishSpecSchema.parse(rawSpec);
  if (!bytes.length || bytes.length > IMPORT_MAX_BYTES) throw new Error(`Arquivo deve conter de 1 a ${IMPORT_MAX_BYTES} bytes.`);
  if (!filename.length || filename.length > 240 || /[\\/\x00-\x1f]/.test(filename)) throw new Error('Nome de arquivo inválido.');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (sha256 !== spec.expectedFileSha256) throw new Error('Hash do arquivo difere do conteúdo revisado para publicação.');
  let text: string;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); }
  catch { throw new Error('Arquivo deve usar UTF-8 válido.'); }
  const catalog = snapshotTestCaseCatalog(parseImportJson(text));
  if ((catalog.content.source.kind === 'synthetic') !== (spec.authorization.basis === 'synthetic')) throw new Error('Origem sintética e declaração de uso devem ser consistentes.');
  return snapshotContent({ schemaVersion: 1, importerVersion: TEST_CASE_IMPORTER_VERSION,
    id: catalog.content.id, version: catalog.content.version, catalog,
    file: { name: filename, byteLength: bytes.length, sha256, encoding: 'utf-8',
      bom: bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf }, authorization: spec.authorization });
}
export type TestCasePublication = ReturnType<typeof buildTestCasePublication>['content'];
