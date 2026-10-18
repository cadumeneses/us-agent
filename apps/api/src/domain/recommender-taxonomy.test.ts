import assert from 'node:assert/strict';
import test from 'node:test';
import { snapshotContent } from './content-snapshot.js';
import { parseRecommenderDefinition, validateRecommendationInput } from './recommender-definition.js';
import { parseRecommenderTaxonomy, resolveTaxonomies, type RecommenderTaxonomy, type TaxonomyDependency } from './recommender-taxonomy.js';

function taxonomy(): RecommenderTaxonomy {
  return { schemaVersion: 1, id: 'technology-demo', version: '1', name: 'Tecnologias de demonstração', source: 'Synthetic example; not an author dataset',
    kind: 'tree', selection: 'leaf', nodes: [
      { id: 'language', name: 'Linguagens', description: '', parentId: null },
      { id: 'typescript', name: 'TypeScript', description: 'Exemplo', parentId: 'language' },
      { id: 'python', name: 'Python', description: '', parentId: 'language' }
    ] };
}
function publication(content = taxonomy()): TaxonomyDependency { return { state: 'published', snapshot: snapshotContent(content) }; }
function reference(dependency = publication()) {
  const { format, sha256, content } = dependency.snapshot;
  return { id: content.id, version: content.version, format, sha256 };
}
function definition(dependency = publication()) {
  return parseRecommenderDefinition({ schemaVersion: 1, id: 'independent', version: 'draft.1', name: 'Perfil sem US', state: 'draft',
    attributes: [
      { id: 'languages', name: 'Linguagens', valueType: { type: 'taxonomy_node', taxonomy: reference(dependency) }, scope: 'project', cardinality: 'many', required: true, role: 'feature', representation: 'presence' },
      { id: 'primary', name: 'Tecnologia principal', valueType: { type: 'record', fields: { node: { type: 'taxonomy_node', taxonomy: reference(dependency) }, notes: { type: 'text' } } }, scope: 'project', cardinality: 'single', required: false, role: 'context', representation: 'none' }
    ], method: { id: 'future-method', version: '1', parameters: {}, bindings: {} } });
}

test('validates lists, arbitrary hierarchy levels, multiple roots and child-before-parent ordering', () => {
  const tree = taxonomy(); tree.nodes.reverse();
  tree.nodes.push({ id: 'framework', name: 'Frameworks', description: '', parentId: null });
  assert.deepEqual(parseRecommenderTaxonomy(tree), tree);
  const list = { ...taxonomy(), kind: 'list', nodes: taxonomy().nodes.map(node => ({ ...node, parentId: null })) };
  assert.deepEqual(parseRecommenderTaxonomy(list), list);
  const deep = taxonomy();
  deep.nodes = Array.from({ length: 1500 }, (_, index) => ({ id: `node-${index}`, name: `Nó ${index}`, description: '', parentId: index === 0 ? null : `node-${index - 1}` }));
  assert.equal(parseRecommenderTaxonomy(deep).nodes.length, 1500);
});

test('rejects duplicate IDs, missing parents, self-cycles, disconnected cycles and parents in lists with node locations', () => {
  const attempts = [
    (value: RecommenderTaxonomy) => { value.nodes.push(value.nodes[0]); },
    (value: RecommenderTaxonomy) => { value.nodes[1].parentId = 'missing'; },
    (value: RecommenderTaxonomy) => { value.nodes[0].parentId = 'language'; },
    (value: RecommenderTaxonomy) => { value.nodes[1].parentId = 'python'; value.nodes[2].parentId = 'typescript'; },
    (value: RecommenderTaxonomy) => { value.kind = 'list'; }
  ];
  for (const change of attempts) {
    const value = taxonomy(); change(value);
    assert.throws(() => parseRecommenderTaxonomy(value), error => {
      assert.ok(error && typeof error === 'object' && 'issues' in error);
      assert.ok((error.issues as Array<{ path: unknown[] }>).some(issue => issue.path[0] === 'nodes'));
      return true;
    });
  }
});

test('pins taxonomy version, hash and state without silently selecting another version', () => {
  const published = publication();
  assert.equal(resolveTaxonomies([reference(published), reference(published)], [published]).length, 1);
  assert.throws(() => resolveTaxonomies([reference(published)], []), /indisponível/);
  assert.throws(() => resolveTaxonomies([reference(published)], [{ ...published, state: 'retired' }]), /indisponível/);
  assert.throws(() => resolveTaxonomies([reference(published)], [{ ...published, state: 'draft' }]));
  const newVersion = publication({ ...taxonomy(), version: '2' });
  assert.throws(() => resolveTaxonomies([reference(published)], [newVersion]), /indisponível/);
  assert.throws(() => resolveTaxonomies([{ ...reference(published), sha256: '0'.repeat(64) }], [published]), /divergente/);
  const tampered = structuredClone(published); tampered.snapshot.content.nodes[0].name = 'Changed';
  assert.throws(() => resolveTaxonomies([reference(published)], [tampered]), /Hash inválido/);
  assert.throws(() => resolveTaxonomies([reference(published)], [published, published]), /duplicada/);
});

test('validates taxonomy IDs, leaf selection, cardinality and record fields independently from display names', () => {
  const published = publication(); const config = definition(published);
  const input = { id: 'profile-1', provenance: { source: 'manual' }, values: { languages: ['typescript', 'python'], primary: { node: 'python', notes: 'Contexto' } } };
  assert.deepEqual(validateRecommendationInput(config, input, [published]), input);
  for (const value of ['TypeScript', 'language', 'missing']) {
    assert.throws(() => validateRecommendationInput(config, { ...input, values: { languages: [value] } }, [published]));
  }
  assert.throws(() => validateRecommendationInput(config, { ...input, values: { languages: 'python' } }, [published]));
  assert.throws(() => validateRecommendationInput(config, { ...input, values: { languages: [], primary: { node: 'missing', notes: '' } } }, [published]));
  assert.throws(() => validateRecommendationInput(config, input), /indisponível/);
  const all = publication({ ...taxonomy(), selection: 'any' });
  assert.doesNotThrow(() => validateRecommendationInput(definition(all), { ...input, values: { languages: ['language'] } }, [all]));
});

test('optional taxonomy attributes still require a valid published dependency and distinct attributes use their own catalogs', () => {
  const first = publication();
  const second = publication({ ...taxonomy(), id: 'acceptance-demo', nodes: [{ id: 'criterion-one', name: 'Critério sintético', description: '', parentId: null }] });
  const config = definition(first);
  config.attributes.push({ id: 'criteria', name: 'Critérios', scope: 'artifact', cardinality: 'many', required: false,
    role: 'context', representation: 'none', valueType: { type: 'taxonomy_node', taxonomy: reference(second) } });
  const input = { id: 'independent', provenance: { source: 'manual' }, values: { languages: ['python'], criteria: ['criterion-one'] } };
  assert.deepEqual(validateRecommendationInput(config, input, [first, second]), input);
  assert.throws(() => validateRecommendationInput(config, { ...input, values: { languages: ['python'] } }, [first]), /indisponível/);
  assert.throws(() => validateRecommendationInput(config, { ...input, values: { languages: ['python'], criteria: ['python'] } }, [first, second]));
});
