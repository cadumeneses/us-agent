import { withTransaction } from '../database/pool.js';
import { snapshotContent } from '../domain/content-snapshot.js';
import { snapshotDefinitionPublication } from '../domain/definition-publication.js';
import { definitionTaxonomyReferences, parseRecommenderDefinition } from '../domain/recommender-definition.js';
import { parseRecommenderTaxonomy, resolveTaxonomies, type TaxonomyDependency } from '../domain/recommender-taxonomy.js';
import { validateConfigurableDefinition, CONFIGURABLE_KNN_ADAPTER } from './configurable-knn.js';
import { DefinitionRequestError } from './recommender-definitions.js';
const validateImplementedDefinition = (raw: unknown, taxonomies?: readonly unknown[]) => ({ ...validateConfigurableDefinition(raw, taxonomies), adapterVersion: CONFIGURABLE_KNN_ADAPTER });

type Row = {
  definition_id: string; version: string; state: 'draft' | 'published' | 'retired'; content: unknown;
  publication: unknown | null; hash_format: string | null; content_sha256: string | null;
  created_by: string; published_by: string | null; created_at: Date; updated_at: Date; published_at: Date | null;
};
function record(row: Row) {
  const definition = parseRecommenderDefinition(row.content);
  if (definition.id !== row.definition_id || definition.version !== row.version) throw new Error('Identidade da definição diverge do registro.');
  const snapshot = row.state === 'draft' ? null : snapshotDefinitionPublication(row.publication);
  if (row.state === 'draft' ? definition.state !== 'draft' :
      !snapshot || row.hash_format !== snapshot.format || row.content_sha256 !== snapshot.sha256 ||
      snapshotContent(snapshot.content.definition).sha256 !== snapshotContent(definition).sha256) {
    throw new Error('Definição diverge do pacote ou hash persistidos.');
  }
  return { state: row.state, definition, snapshot, draftSha256: snapshotContent({ ...definition, state: 'draft' }).sha256, createdBy: row.created_by, publishedBy: row.published_by,
    createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(), publishedAt: row.published_at?.toISOString() ?? null };
}

export async function publishConfigurableDefinition(id: string, version: string, actor: string, expectedDraftSha256?: string) {
  return withTransaction(async client => {
    const current = await client.query<Row>('SELECT * FROM recommender_definition_versions WHERE definition_id = $1 AND version = $2 FOR UPDATE', [id, version]);
    if (!current.rows[0]) throw new DefinitionRequestError(404, 'Configuration version not found.');
    const previous = record(current.rows[0]);
    if (previous.state === 'retired') throw new DefinitionRequestError(409, 'A retired configuration cannot be republished. Create a new version.');
    if (expectedDraftSha256 !== undefined && expectedDraftSha256 !== previous.draftSha256) throw new DefinitionRequestError(409, 'The draft changed after review. Reload and review it before publishing.');
    if (previous.state === 'published') return previous;
    try { validateImplementedDefinition(previous.definition); }
    catch (error) { throw new DefinitionRequestError(422, `Invalid method configuration: ${error instanceof Error ? error.message : 'review the calculation settings'}`); }
    const references = definitionTaxonomyReferences(previous.definition);
    const unique = [...new Map(references.map(reference => [JSON.stringify([reference.id, reference.version]), reference])).values()]
      .sort((left, right) => left.id < right.id ? -1 : left.id > right.id ? 1 : left.version < right.version ? -1 : left.version > right.version ? 1 : 0);
    const dependencies: TaxonomyDependency[] = [];
    // FOR SHARE (not KEY SHARE) blocks retirement and draft changes until this publication commits.
    // A fixed lock order avoids deadlocks across definitions sharing multiple catalogs.
    for (const reference of unique) {
      const result = await client.query<{ state: string; content: unknown; hash_format: string | null; content_sha256: string | null }>(
        'SELECT state, content, hash_format, content_sha256 FROM recommender_taxonomy_versions WHERE taxonomy_id = $1 AND version = $2 FOR SHARE', [reference.id, reference.version]);
      const row = result.rows[0];
      if (!row || row.state !== 'published') throw new DefinitionRequestError(422, `Published taxonomy unavailable: ${reference.id}@${reference.version}.`);
      const snapshot = snapshotContent(parseRecommenderTaxonomy(row.content));
      if (row.hash_format !== snapshot.format || row.content_sha256 !== snapshot.sha256) throw new Error('Hash da taxonomia diverge do conteúdo persistido.');
      dependencies.push({ state: 'published', snapshot });
    }
    let selected: TaxonomyDependency[];
    try { selected = resolveTaxonomies(references, dependencies); }
    catch (error) { throw new DefinitionRequestError(422, error instanceof Error ? error.message : 'Dependências inválidas.'); }
    try { validateImplementedDefinition(previous.definition, selected); }
    catch (error) { throw new DefinitionRequestError(422, error instanceof Error ? error.message : 'Mapeamento inválido.'); }
    const definition = { ...previous.definition, state: 'published' as const };
    const snapshot = snapshotDefinitionPublication({ schemaVersion: 1, definition, taxonomies: selected,
      implementation: { methodId: definition.method.id, adapterVersion: validateImplementedDefinition(definition, selected).adapterVersion } });
    await client.query('DELETE FROM recommender_definition_taxonomies WHERE definition_id = $1 AND definition_version = $2', [id, version]);
    for (const dependency of selected) {
      const { content, format, sha256 } = dependency.snapshot;
      await client.query(`INSERT INTO recommender_definition_taxonomies
        (definition_id, definition_version, taxonomy_id, taxonomy_version, hash_format, content_sha256)
        VALUES ($1, $2, $3, $4, $5, $6)`, [id, version, content.id, content.version, format, sha256]);
    }
    const saved = await client.query<Row>(`UPDATE recommender_definition_versions SET state = 'published', content = $3::jsonb,
      publication = $4::jsonb, hash_format = $5, content_sha256 = $6, published_by = $7, published_at = NOW(), updated_at = NOW()
      WHERE definition_id = $1 AND version = $2 RETURNING *`, [id, version, JSON.stringify(definition), JSON.stringify(snapshot.content), snapshot.format, snapshot.sha256, actor]);
    return record(saved.rows[0]);
  });
}
