import { query, withTransaction } from '../database/pool.js';
import { snapshotContent } from '../domain/content-snapshot.js';
import { parseRecommenderTaxonomy } from '../domain/recommender-taxonomy.js';
import { validateWisTaxonomy } from '../domain/wis-taxonomy.js';

export class TaxonomyRequestError extends Error {
  constructor(public status: number, message: string) { super(message); }
}
type Row = {
  taxonomy_id: string; version: string; state: 'draft' | 'published' | 'retired'; content: unknown;
  hash_format: string | null; content_sha256: string | null;
  created_by: string; published_by: string | null;
  created_at: Date; updated_at: Date; published_at: Date | null;
};
function record(row: Row) {
  const content = parseRecommenderTaxonomy(row.content);
  const snapshot = snapshotContent(content);
  if (row.taxonomy_id !== content.id || row.version !== content.version || row.state !== 'draft' && !content.nodes.length ||
      row.state !== 'draft' && (row.hash_format !== snapshot.format || row.content_sha256 !== snapshot.sha256)) {
    throw new Error('Conteúdo da taxonomia diverge da identidade ou hash persistidos.');
  }
  return { state: row.state, snapshot, createdBy: row.created_by, publishedBy: row.published_by,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), publishedAt: row.published_at?.toISOString() ?? null };
}

export async function saveTaxonomyDraft(raw: unknown, actor: string) {
  const content = parseRecommenderTaxonomy(raw);
  try { validateWisTaxonomy(content); } catch (error) { throw new TaxonomyRequestError(422, (error as Error).message); }
  return withTransaction(async client => {
    const saved = await client.query<Row>(`INSERT INTO recommender_taxonomy_versions (taxonomy_id, version, content, created_by)
      VALUES ($1, $2, $3::jsonb, $4)
      ON CONFLICT (taxonomy_id, version) DO UPDATE SET content = EXCLUDED.content, updated_at = NOW()
        WHERE recommender_taxonomy_versions.state = 'draft'
      RETURNING *`, [content.id, content.version, JSON.stringify(content), actor]);
    if (!saved.rows[0]) throw new TaxonomyRequestError(409, 'Versão publicada é imutável; salve as alterações com uma nova versão.');
    return record(saved.rows[0]);
  });
}

export async function loadTaxonomyVersion(id: string, version: string) {
  const result = await query<Row>('SELECT * FROM recommender_taxonomy_versions WHERE taxonomy_id = $1 AND version = $2', [id, version]);
  if (!result.rows[0]) throw new TaxonomyRequestError(404, 'Versão de taxonomia não encontrada.');
  return record(result.rows[0]);
}

export async function listTaxonomyVersions(options: { id?: string; state?: string; limit: number; offset: number }) {
  const result = await query<Row>(`SELECT * FROM recommender_taxonomy_versions
    WHERE ($1::text IS NULL OR taxonomy_id = $1) AND ($2::text IS NULL OR state = $2)
    ORDER BY taxonomy_id, version LIMIT $3 OFFSET $4`, [options.id ?? null, options.state ?? null, options.limit, options.offset]);
  return result.rows.map(row => {
    const version = record(row);
    const { content, ...hash } = version.snapshot;
    return { id: content.id, version: content.version, name: content.name, kind: content.kind, nodeCount: content.nodes.length,
      ...version, snapshot: hash };
  });
}

export async function publishTaxonomyVersion(id: string, version: string, actor: string, expectedDraftSha256?: string) {
  return withTransaction(async client => {
    const current = await client.query<Row>('SELECT * FROM recommender_taxonomy_versions WHERE taxonomy_id = $1 AND version = $2 FOR UPDATE', [id, version]);
    if (!current.rows[0]) throw new TaxonomyRequestError(404, 'Versão de taxonomia não encontrada.');
    const previous = record(current.rows[0]); // Validate stored graph and hash before any state change.
    if (!previous.snapshot.content.nodes.length) throw new TaxonomyRequestError(422, 'Add at least one node before publishing this taxonomy.');
    try { validateWisTaxonomy(previous.snapshot.content); } catch (error) { throw new TaxonomyRequestError(422, (error as Error).message); }
    if (id === 'wis' && previous.state === 'draft') {
      const conflict = await client.query(`SELECT 1 FROM wis_taxonomy_bindings b WHERE b.version=$1
        AND NOT EXISTS(SELECT 1 FROM wis_taxonomy_node_bindings n WHERE n.version=b.version)
        AND EXISTS(SELECT 1 FROM taxonomy_modules m WHERE m.taxonomy_version_id=b.taxonomy_version_id)`, [version]);
      if (conflict.rowCount) throw new TaxonomyRequestError(409, 'This WIS source evolved after the empty draft. Save and publish under a new version.');
    }
    if (previous.state === 'retired') throw new TaxonomyRequestError(409, 'Versão retirada não pode ser republicada; crie uma nova versão.');
    if (expectedDraftSha256 !== undefined && expectedDraftSha256 !== previous.snapshot.sha256) throw new TaxonomyRequestError(409, 'O rascunho foi alterado desde a revisão. Carregue e revise a versão atual antes de publicar.');
    if (previous.state === 'published') return previous;
    const result = await client.query<Row>(`UPDATE recommender_taxonomy_versions
      SET state = 'published', hash_format = $3, content_sha256 = $4, published_at = NOW(), published_by = $5, updated_at = NOW()
      WHERE taxonomy_id = $1 AND version = $2 RETURNING *`, [id, version, previous.snapshot.format, previous.snapshot.sha256, actor]);
    return record(result.rows[0]);
  });
}

export async function retireTaxonomyVersion(id: string, version: string) {
  return withTransaction(async client => {
    const current = await client.query<Row>('SELECT * FROM recommender_taxonomy_versions WHERE taxonomy_id = $1 AND version = $2 FOR UPDATE', [id, version]);
    if (!current.rows[0]) throw new TaxonomyRequestError(404, 'Versão de taxonomia não encontrada.');
    const previous = record(current.rows[0]);
    if (previous.state === 'draft') throw new TaxonomyRequestError(409, 'Somente uma versão publicada pode ser retirada.');
    if (previous.state === 'retired') return previous;
    const result = await client.query<Row>(`UPDATE recommender_taxonomy_versions SET state = 'retired', updated_at = NOW()
      WHERE taxonomy_id = $1 AND version = $2 RETURNING *`, [id, version]);
    return record(result.rows[0]);
  });
}
