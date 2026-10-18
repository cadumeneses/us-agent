import type { PoolClient } from 'pg';
import { query, withTransaction } from '../database/pool.js';
import { canonicalJson } from '../domain/content-snapshot.js';
import { contentReferenceSchema } from '../domain/dataset-import.js';
import { buildTestCasePublication, type TestCasePublication } from '../domain/test-case-publication.js';

export class TestCaseCatalogRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Row = { catalog_id: string; version: string; state: 'published' | 'retired'; original_file: Buffer;
  file_sha256: string; publication: TestCasePublication; hash_format: string; content_sha256: string;
  published_by: string; published_at: Date; retired_at: Date | null };

function record(row: Row) {
  const content = row.publication;
  const snapshot = buildTestCasePublication(row.original_file, content.file.name, {
    expectedFileSha256: row.file_sha256, authorization: content.authorization
  });
  if (snapshot.format !== row.hash_format || snapshot.sha256 !== row.content_sha256 ||
      canonicalJson(snapshot.content) !== canonicalJson(content) || snapshot.content.id !== row.catalog_id || snapshot.content.version !== row.version) throw new Error('Catálogo, arquivo ou hash divergem da publicação persistida.');
  return { state: row.state, snapshot, publishedBy: row.published_by, publishedAt: row.published_at.toISOString(), retiredAt: row.retired_at?.toISOString() ?? null };
}

export async function publishTestCaseCatalog(id: string, version: string, bytes: Buffer, filename: string, spec: unknown, actor: string) {
  let snapshot: ReturnType<typeof buildTestCasePublication>;
  try { snapshot = buildTestCasePublication(bytes, filename, spec); }
  catch (error) { throw new TestCaseCatalogRequestError(422, error instanceof Error ? error.message : 'Catálogo inválido.'); }
  if (snapshot.content.id !== id || snapshot.content.version !== version) throw new TestCaseCatalogRequestError(422, 'ID/versão do arquivo devem corresponder ao caminho.');
  return withTransaction(async client => {
    await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [JSON.stringify(['test-case-catalog', id, version])]);
    const current = await client.query<Row>('SELECT * FROM test_case_catalog_versions WHERE catalog_id = $1 AND version = $2 FOR UPDATE', [id, version]);
    if (current.rows[0]) {
      const previous = record(current.rows[0]);
      if (previous.state === 'published' && previous.snapshot.sha256 === snapshot.sha256) return previous;
      throw new TestCaseCatalogRequestError(409, 'Versão de catálogo imutável; publique as alterações em outra versão.');
    }
    const saved = await client.query<Row>(`INSERT INTO test_case_catalog_versions
      (catalog_id, version, original_file, file_sha256, publication, hash_format, content_sha256, published_by)
      VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8) RETURNING *`, [id, version, bytes, snapshot.content.file.sha256,
      JSON.stringify(snapshot.content), snapshot.format, snapshot.sha256, actor]);
    return record(saved.rows[0]);
  });
}

export async function loadTestCaseCatalog(id: string, version: string) {
  const result = await query<Row>('SELECT * FROM test_case_catalog_versions WHERE catalog_id = $1 AND version = $2', [id, version]);
  if (!result.rows[0]) throw new TestCaseCatalogRequestError(404, 'Versão de catálogo não encontrada.');
  return record(result.rows[0]);
}
export async function loadTestCaseCatalogOriginal(id: string, version: string) {
  const result = await query<Row>('SELECT * FROM test_case_catalog_versions WHERE catalog_id = $1 AND version = $2', [id, version]);
  if (!result.rows[0]) throw new TestCaseCatalogRequestError(404, 'Arquivo de catálogo não encontrado.');
  const original = record(result.rows[0]);
  return { bytes: result.rows[0].original_file, sha256: original.snapshot.content.file.sha256 };
}
export async function listTestCaseCatalogs(options: { id?: string; state?: string; limit: number; offset: number }) {
  const result = await query<{ catalog_id: string; version: string; state: string; item_count: number;
    source: TestCasePublication['catalog']['content']['source']; hash_format: string; content_sha256: string;
    published_by: string; published_at: Date; retired_at: Date | null }>(`SELECT catalog_id, version, state,
    jsonb_array_length(publication->'catalog'->'content'->'items') AS item_count,
    publication->'catalog'->'content'->'source' AS source, hash_format, content_sha256, published_by, published_at, retired_at
    FROM test_case_catalog_versions WHERE ($1::text IS NULL OR catalog_id = $1)
    AND ($2::text IS NULL OR state = $2) ORDER BY catalog_id, version LIMIT $3 OFFSET $4`, [options.id ?? null, options.state ?? null, options.limit, options.offset]);
  return result.rows.map(row => ({ id: row.catalog_id, version: row.version, state: row.state, itemCount: row.item_count,
    source: row.source, snapshot: { format: row.hash_format, sha256: row.content_sha256 },
    publishedBy: row.published_by, publishedAt: row.published_at.toISOString(), retiredAt: row.retired_at?.toISOString() ?? null }));
}
/** Future executions must lock availability and pin the publication envelope, not just its inner catalog. */
export async function lockPublishedTestCaseCatalog(client: PoolClient, rawReference: unknown) {
  const reference = contentReferenceSchema.parse(rawReference);
  const result = await client.query<Row>('SELECT * FROM test_case_catalog_versions WHERE catalog_id = $1 AND version = $2 FOR SHARE', [reference.id, reference.version]);
  if (!result.rows[0] || result.rows[0].state !== 'published') throw new TestCaseCatalogRequestError(422, 'Selecione um catálogo publicado disponível.');
  const saved = record(result.rows[0]);
  if (saved.snapshot.format !== reference.format || saved.snapshot.sha256 !== reference.sha256) throw new TestCaseCatalogRequestError(422, 'Hash do catálogo difere da versão selecionada.');
  return saved.snapshot;
}
export async function retireTestCaseCatalog(id: string, version: string) {
  return withTransaction(async client => {
    const current = await client.query<Row>('SELECT * FROM test_case_catalog_versions WHERE catalog_id = $1 AND version = $2 FOR UPDATE', [id, version]);
    if (!current.rows[0]) throw new TestCaseCatalogRequestError(404, 'Versão de catálogo não encontrada.');
    if (current.rows[0].state === 'retired') return record(current.rows[0]);
    const saved = await client.query<Row>("UPDATE test_case_catalog_versions SET state = 'retired', retired_at = NOW() WHERE catalog_id = $1 AND version = $2 RETURNING *", [id, version]);
    return record(saved.rows[0]);
  });
}
