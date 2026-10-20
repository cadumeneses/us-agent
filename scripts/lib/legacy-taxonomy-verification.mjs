import assert from 'node:assert/strict';
import { parseRecommenderTaxonomy, taxonomyNodeValidator } from '../../apps/api/dist/domain/recommender-taxonomy.js';
import { snapshotContent } from '../../apps/api/dist/domain/content-snapshot.js';

// Caller owns the read-only transaction and connection. Never updates source or target.
export async function verifyLegacyTaxonomyImports(client) {
  const { rows: missing } = await client.query(`SELECT v.id FROM taxonomy_versions v
    LEFT JOIN legacy_taxonomy_imports i ON i.legacy_version_id = v.id WHERE i.legacy_version_id IS NULL`);
  assert.equal(missing.length, 0, 'Legacy versions were added after staging; prepare a new import before cutover.');
  const { rows: imports } = await client.query(`SELECT i.*, t.content, t.state, t.hash_format, t.content_sha256,
    i.source_snapshot IS DISTINCT FROM jsonb_build_object(
      'version', to_jsonb(v),
      'domains', COALESCE((SELECT jsonb_agg(to_jsonb(d) || jsonb_build_object('nodeId', 'wis-domain-' || d.id) ORDER BY d.position, d.id)
        FROM taxonomy_domains d WHERE d.taxonomy_version_id = v.id), '[]'::jsonb),
      'modules', COALESCE((SELECT jsonb_agg(to_jsonb(m) || jsonb_build_object('nodeId', 'wis-module-' || m.id, 'parentNodeId', 'wis-domain-' || m.domain_id) ORDER BY m.position, m.id)
        FROM taxonomy_modules m WHERE m.taxonomy_version_id = v.id), '[]'::jsonb),
      'operations', COALESCE((SELECT jsonb_agg(to_jsonb(o) || jsonb_build_object('nodeId', 'wis-operation-' || o.id, 'parentNodeId', 'wis-module-' || o.module_id) ORDER BY o.position, o.id)
        FROM taxonomy_operations o JOIN taxonomy_modules m ON m.id = o.module_id
        WHERE m.taxonomy_version_id = v.id), '[]'::jsonb)
    ) AS source_changed
    FROM legacy_taxonomy_imports i JOIN taxonomy_versions v ON v.id = i.legacy_version_id
    LEFT JOIN recommender_taxonomy_versions t ON t.taxonomy_id = i.taxonomy_id AND t.version = i.version
    ORDER BY i.legacy_version_id`);
  const report = { versions: imports.length, drafts: 0, emptyVersions: 0, nodes: 0, inactiveOperations: 0 };
  for (const row of imports) {
    assert.equal(row.source_changed, false, `Source changed after staging (version ID ${row.legacy_version_id}).`);
    const source = row.source_snapshot;
    const originals = [...source.domains, ...source.modules, ...source.operations];
    if (!originals.length) {
      assert.equal(row.taxonomy_id, null); assert.equal(row.version, null);
      report.emptyVersions++; continue;
    }
    const tree = parseRecommenderTaxonomy(row.content);
    assert.equal(row.state, 'draft', 'Staged catalog must be reviewed before publication/cutover.');
    assert.equal(row.hash_format, null); assert.equal(row.content_sha256, null);
    assert.equal(tree.id, row.taxonomy_id); assert.equal(tree.version, row.version);
    assert.equal(tree.name, `WIS: ${source.version.version}`);
    assert.equal(tree.kind, 'tree'); assert.equal(tree.selection, 'any');
    const expected = [
      ...source.domains.map(d => ({ id: d.nodeId, name: d.name, description: d.description, parentId: null, selectable: false })),
      ...source.modules.map(m => ({ id: m.nodeId, name: m.name, description: m.description, parentId: m.parentNodeId, selectable: false })),
      ...source.operations.map(o => ({ id: o.nodeId, name: o.name, description: o.description, parentId: o.parentNodeId, selectable: o.is_active }))
    ];
    const byId = values => [...values].sort((a, b) => a.id.localeCompare(b.id));
    assert.deepEqual(byId(tree.nodes), byId(expected));
    // Check sibling ordering including ties, without depending on alphabetical names.
    for (const group of [source.domains, source.modules, source.operations]) {
      const parents = new Set(group.map(n => n.parentNodeId ?? null));
      for (const parent of parents) {
        const siblings = group.filter(n => (n.parentNodeId ?? null) === parent);
        const ids = new Set(siblings.map(n => n.nodeId));
        assert.deepEqual(tree.nodes.filter(n => ids.has(n.id)).map(n => n.id), siblings.map(n => n.nodeId));
      }
    }
    const snapshot = snapshotContent(tree);
    const validator = taxonomyNodeValidator({ id: tree.id, version: tree.version, format: snapshot.format, sha256: snapshot.sha256 }, [{ state: 'published', snapshot }]);
    for (const node of expected) assert.equal(validator.safeParse(node.id).success, node.selectable);
    report.drafts++; report.nodes += tree.nodes.length;
    report.inactiveOperations += source.operations.filter(o => !o.is_active).length;
  }
  return report;
}
