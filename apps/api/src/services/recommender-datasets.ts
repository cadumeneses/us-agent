import { createHash, randomUUID } from 'node:crypto';
import type { PoolClient } from 'pg';
import { z } from 'zod';
import { query, withTransaction } from '../database/pool.js';
import { canonicalJson, snapshotContent } from '../domain/content-snapshot.js';
import { snapshotDefinitionPublication } from '../domain/definition-publication.js';
import { buildImportPreview, contentReferenceSchema } from '../domain/dataset-import.js';
import { buildTestCaseImportPreview, methodImportSpecSchema, methodImportPreviewSchema, methodDatasetSchema, selectMethodImportRecords, type MethodImportPreview } from '../domain/test-case-dataset.js';
import { snapshotTestCasePublication } from '../domain/test-case-publication-integrity.js';
import { lockPublishedTestCaseCatalog } from './test-case-catalogs.js';
import { E21_EQUATIONS_DEMO } from './testrec-equations.js';

export class DatasetRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type ImportRow = { id: string; definition_id: string; definition_version: string; original_file: Buffer; file_sha256: string;
  preview: unknown; hash_format: string; preview_sha256: string; created_by: string; created_at: Date };
type DatasetRow = { dataset_id: string; version: string; state: 'published' | 'retired'; import_id: string;
  definition_id: string; definition_version: string; publication: unknown; hash_format: string; content_sha256: string;
  published_by: string; published_at: Date; retired_at: Date | null };

export async function lockPublishedDefinition(client: PoolClient, reference: z.infer<typeof contentReferenceSchema>) {
  const result = await client.query<{ state: string; publication: unknown; hash_format: string; content_sha256: string }>(
    'SELECT state, publication, hash_format, content_sha256 FROM recommender_definition_versions WHERE definition_id = $1 AND version = $2 FOR SHARE', [reference.id, reference.version]);
  const row = result.rows[0];
  if (!row || row.state !== 'published') throw new DatasetRequestError(422, 'Selecione uma definição publicada disponível.');
  const snapshot = snapshotDefinitionPublication(row.publication);
  if (row.hash_format !== snapshot.format || row.content_sha256 !== snapshot.sha256) throw new Error('Integridade da definição persistida inválida.');
  if (reference.format !== snapshot.format || reference.sha256 !== snapshot.sha256) throw new DatasetRequestError(422, 'Hash da definição difere da publicação selecionada.');
  const dependencies = [...snapshot.content.taxonomies].sort((a, b) => {
    const left = JSON.stringify([a.snapshot.content.id, a.snapshot.content.version]), right = JSON.stringify([b.snapshot.content.id, b.snapshot.content.version]);
    return left < right ? -1 : left > right ? 1 : 0;
  });
  for (const dependency of dependencies) {
    const content = dependency.snapshot.content;
    const result = await client.query<{ state: string; hash_format: string; content_sha256: string }>(
      'SELECT state, hash_format, content_sha256 FROM recommender_taxonomy_versions WHERE taxonomy_id = $1 AND version = $2 FOR SHARE', [content.id, content.version]);
    const current = result.rows[0];
    if (!current || current.state !== 'published' || current.hash_format !== dependency.snapshot.format || current.content_sha256 !== dependency.snapshot.sha256) {
      throw new DatasetRequestError(422, `Dependência indisponível: ${content.id}@${content.version}.`);
    }
  }
  return snapshot;
}

function importRecord(row: ImportRow) {
  const preview = methodImportPreviewSchema.parse(row.preview);
  const snapshot = snapshotContent(preview);
  const definition = snapshotDefinitionPublication(preview.definition.content);
  if (preview.schemaVersion === 2) {
    const catalog = snapshotTestCasePublication(preview.catalog.content);
    if (catalog.format !== preview.catalog.format || catalog.sha256 !== preview.catalog.sha256 ||
        catalog.content.id !== preview.spec.catalog.id || catalog.content.version !== preview.spec.catalog.version ||
        catalog.format !== preview.spec.catalog.format || catalog.sha256 !== preview.spec.catalog.sha256) throw new Error('Catalog differs from the preserved import dependency.');
  }
  if (row.hash_format !== snapshot.format || row.preview_sha256 !== snapshot.sha256 ||
      createHash('sha256').update(row.original_file).digest('hex') !== row.file_sha256 || row.file_sha256 !== preview.file.sha256 ||
      preview.file.byteLength !== row.original_file.length || definition.sha256 !== preview.definition.sha256 ||
      definition.sha256 !== preview.spec.definition.sha256 || preview.spec.definition.id !== row.definition_id || preview.spec.definition.version !== row.definition_version) {
    throw new Error('Prévia, arquivo ou definição divergem da evidência persistida.');
  }
  return { id: row.id, snapshot, createdBy: row.created_by, createdAt: row.created_at.toISOString() };
}

export async function createDatasetPreview(rawSpec: unknown, file: Buffer, filename: string, actor: string) {
  const spec = methodImportSpecSchema.parse(rawSpec);
  if (!file.length || file.length > 5_000_000) throw new DatasetRequestError(413, 'Arquivo deve conter de 1 a 5.000.000 bytes.');
  return withTransaction(async client => {
    const definition = await lockPublishedDefinition(client, spec.definition);
    let preview: MethodImportPreview;
    try {
      if (spec.schemaVersion === 2) {
        const catalog = await lockPublishedTestCaseCatalog(client, spec.catalog);
        preview = buildTestCaseImportPreview(spec, file, filename, definition.content, catalog.content);
      } else {
        if (definition.content.definition.method.id === E21_EQUATIONS_DEMO) throw new Error('The E21 demonstration requires a version 2 import with an explicit catalog.');
        preview = buildImportPreview(spec, file, filename, definition.content);
      }
    }
    catch (error) { throw new DatasetRequestError(422, error instanceof Error ? error.message : 'Mapeamento inválido.'); }
    const snapshot = snapshotContent(preview);
    const saved = await client.query<ImportRow>(`INSERT INTO recommender_dataset_imports
      (id, definition_id, definition_version, original_file, file_sha256, preview, hash_format, preview_sha256, created_by)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9) RETURNING *`,
      [randomUUID(), spec.definition.id, spec.definition.version, file, preview.file.sha256, JSON.stringify(preview), snapshot.format, snapshot.sha256, actor]);
    return importRecord(saved.rows[0]);
  });
}

export async function loadDatasetImport(id: string) {
  const result = await query<ImportRow>('SELECT * FROM recommender_dataset_imports WHERE id = $1', [id]);
  if (!result.rows[0]) throw new DatasetRequestError(404, 'Prévia de importação não encontrada.');
  return importRecord(result.rows[0]);
}

export async function loadDatasetOriginal(id: string) {
  const result = await query<ImportRow>('SELECT * FROM recommender_dataset_imports WHERE id = $1', [id]);
  if (!result.rows[0]) throw new DatasetRequestError(404, 'Arquivo não encontrado.');
  const record = importRecord(result.rows[0]);
  return { bytes: result.rows[0].original_file, format: record.snapshot.content.spec.format, sha256: record.snapshot.content.file.sha256 };
}

function datasetRecord(row: DatasetRow) {
  const content = methodDatasetSchema.parse(row.publication);
  const snapshot = snapshotContent(content);
  if (snapshot.format !== row.hash_format || snapshot.sha256 !== row.content_sha256 || content.id !== row.dataset_id || content.version !== row.version ||
      content.import.id !== row.import_id || content.definition.id !== row.definition_id || content.definition.version !== row.definition_version) throw new Error('Dataset diverge da publicação persistida.');
  return { state: row.state, snapshot, publishedBy: row.published_by, publishedAt: row.published_at.toISOString(), retiredAt: row.retired_at?.toISOString() ?? null };
}
export async function loadDatasetVersion(id: string, version: string) {
  const result = await query<DatasetRow>('SELECT * FROM recommender_dataset_versions WHERE dataset_id = $1 AND version = $2', [id, version]);
  if (!result.rows[0]) throw new DatasetRequestError(404, 'Versão de base não encontrada.');
  return datasetRecord(result.rows[0]);
}
export async function lockPublishedDataset(client: PoolClient, reference: z.infer<typeof contentReferenceSchema>) {
  const result = await client.query<DatasetRow>('SELECT * FROM recommender_dataset_versions WHERE dataset_id = $1 AND version = $2 FOR SHARE', [reference.id, reference.version]);
  if (!result.rows[0] || result.rows[0].state !== 'published') throw new DatasetRequestError(422, 'Selecione uma versão de base publicada disponível.');
  const record = datasetRecord(result.rows[0]);
  if (record.snapshot.format !== reference.format || record.snapshot.sha256 !== reference.sha256) throw new DatasetRequestError(422, 'Hash da base difere da versão selecionada.');
  return record.snapshot;
}
export async function listDatasetVersions(options: { id?: string; state?: string; limit: number; offset: number }) {
  const result = await query<DatasetRow>(`SELECT * FROM recommender_dataset_versions WHERE ($1::text IS NULL OR dataset_id = $1)
    AND ($2::text IS NULL OR state = $2) ORDER BY dataset_id, version LIMIT $3 OFFSET $4`, [options.id ?? null, options.state ?? null, options.limit, options.offset]);
  return result.rows.map(row => {
    const record = datasetRecord(row), content = record.snapshot.content;
    return { id: content.id, version: content.version, state: record.state, definition: content.definition, recordCount: content.records.length,
      ...(content.schemaVersion === 2 ? { catalog: content.catalog } : {}),
      snapshot: { format: record.snapshot.format, sha256: record.snapshot.sha256 }, publishedBy: record.publishedBy, publishedAt: record.publishedAt, retiredAt: record.retiredAt };
  });
}

export async function publishDatasetVersion(id: string, version: string, importId: string, previewSha256: string, excluded: number[], actor: string) {
  return withTransaction(async client => {
    // Serialize absent as well as existing version rows. The composite string is hashed by PostgreSQL.
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify(['dataset-version', id, version])]);
    const current = await client.query<DatasetRow>('SELECT * FROM recommender_dataset_versions WHERE dataset_id = $1 AND version = $2 FOR UPDATE', [id, version]);
    if (current.rows[0]) {
      const existing = datasetRecord(current.rows[0]);
      if (existing.state === 'published' && existing.snapshot.content.import.id === importId && existing.snapshot.content.import.previewSha256 === previewSha256 &&
          canonicalJson(existing.snapshot.content.selection.excludedOrdinals) === canonicalJson([...excluded].sort((a, b) => a - b))) return existing;
      throw new DatasetRequestError(409, 'Versão de base imutável; publique as alterações em outra versão.');
    }
    const imported = await client.query<ImportRow>('SELECT * FROM recommender_dataset_imports WHERE id = $1 FOR SHARE', [importId]);
    if (!imported.rows[0]) throw new DatasetRequestError(404, 'Prévia não encontrada.');
    const importedRecord = importRecord(imported.rows[0]);
    const preview = importedRecord.snapshot.content;
    if (preview.spec.id !== id || preview.spec.version !== version || importedRecord.snapshot.sha256 !== previewSha256) throw new DatasetRequestError(422, 'A prévia selecionada não corresponde à base, versão ou hash informado.');
    await lockPublishedDefinition(client, preview.spec.definition);
    if (preview.schemaVersion === 2) await lockPublishedTestCaseCatalog(client, preview.spec.catalog);
    let selection: ReturnType<typeof selectMethodImportRecords>;
    try { selection = selectMethodImportRecords(preview, excluded); }
    catch (error) { throw new DatasetRequestError(422, error instanceof Error ? error.message : 'Seleção inválida.'); }
    const { records, ...selected } = selection;
    const snapshot = snapshotContent({ schemaVersion: preview.schemaVersion, importerVersion: preview.importerVersion, id, version, definition: preview.spec.definition,
      ...(preview.schemaVersion === 2 ? { catalog: preview.spec.catalog } : {}),
      source: preview.spec.source, import: { id: importId, previewSha256, fileSha256: preview.file.sha256 }, mapping: preview.spec.mapping, selection: selected, records });
    const saved = await client.query<DatasetRow>(`INSERT INTO recommender_dataset_versions
      (dataset_id, version, import_id, definition_id, definition_version, publication, hash_format, content_sha256, published_by)
      VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9) RETURNING *`, [id, version, importId, preview.spec.definition.id, preview.spec.definition.version,
      JSON.stringify(snapshot.content), snapshot.format, snapshot.sha256, actor]);
    return datasetRecord(saved.rows[0]);
  });
}

export async function retireDatasetVersion(id: string, version: string) {
  return withTransaction(async client => {
    const current = await client.query<DatasetRow>('SELECT * FROM recommender_dataset_versions WHERE dataset_id = $1 AND version = $2 FOR UPDATE', [id, version]);
    if (!current.rows[0]) throw new DatasetRequestError(404, 'Versão de base não encontrada.');
    if (current.rows[0].state === 'retired') return datasetRecord(current.rows[0]);
    const saved = await client.query<DatasetRow>("UPDATE recommender_dataset_versions SET state = 'retired', retired_at = NOW() WHERE dataset_id = $1 AND version = $2 RETURNING *", [id, version]);
    return datasetRecord(saved.rows[0]);
  });
}
