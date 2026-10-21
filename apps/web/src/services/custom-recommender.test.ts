import { expect, test } from 'vitest';
import { customDatasetExample, customDefinitionIssues, newCustomAttribute, newCustomRecommender } from './custom-recommender';
import { validateConfigurableDefinition, executeConfigurableRecommendation, CONFIGURABLE_KNN_ADAPTER } from '../../../api/src/services/configurable-knn';
import { snapshotContent } from '../../../api/src/domain/content-snapshot';
import { buildImportPreview, selectImportRecords } from '../../../api/src/domain/dataset-import';
import type { DefinitionPublication } from '../types/configurable-recommendations';

test('custom fields, weights, outputs and k drive the real KNN executor after structured import', () => {
  const definition = newCustomRecommender();
  Object.assign(definition, { id: 'architecture', name: 'Architecture recommender' });
  definition.attributes.push({ ...newCustomAttribute('feature', 'scope'), valueType: { type: 'enum', values: ['small', 'large'] }, cardinality: 'single' }, newCustomAttribute('output', 'practices'));
  definition.method.parameters.weights = { characteristics: 1, scope: 4 };
  definition.method.parameters.k = 1;
  expect(customDefinitionIssues(definition)).toEqual([]);
  validateConfigurableDefinition(definition);
  const publication: DefinitionPublication = { schemaVersion: 1, definition: { ...definition, state: 'published' }, taxonomies: [], implementation: { methodId: definition.method.id, adapterVersion: CONFIGURABLE_KNN_ADAPTER } };
  const snapshot = snapshotContent(publication);
  const reference = { id: definition.id, version: definition.version, format: snapshot.format, sha256: snapshot.sha256 };
  const records = [
    { id: 'a', values: { characteristics: ['Web'], scope: 'large', recommendations: ['Microservices'], practices: ['Service contracts'] } },
    { id: 'b', values: { characteristics: ['Mobile'], scope: 'small', recommendations: ['Modular monolith'], practices: ['Module boundaries'] } }
  ];
  const spec = { schemaVersion: 1, id: 'architecture-data', version: '1', definition: reference, format: 'json', source: { description: 'Synthetic test', authorization: { basis: 'synthetic', reference: 'Test fixture' } }, mapping: { recordId: ['id'], attributes: Object.fromEntries(definition.attributes.map(attribute => [attribute.id, { path: ['values', attribute.id], encoding: 'value' }])) } };
  const preview = buildImportPreview(spec, Buffer.from(JSON.stringify(records)), 'example.json', publication);
  expect(preview.report.valid).toBe(2);
  const selected = selectImportRecords(preview, []);
  const dataset = { schemaVersion: 1, importerVersion: 'structured-import-v1', id: spec.id, version: spec.version, definition: reference, source: spec.source,
    import: { id: crypto.randomUUID(), previewSha256: snapshotContent(preview).sha256, fileSha256: preview.file.sha256 }, mapping: spec.mapping, selection: { includedOrdinals: selected.includedOrdinals, excludedOrdinals: [] }, records: selected.records };
  const datasetSnapshot = snapshotContent(dataset);
  const input = { id: 'query', values: { characteristics: ['Web'], scope: 'small', recommendations: [], practices: [] }, provenance: { source: 'Manual test' } };
  const request = { id: crypto.randomUUID(), definition: reference, dataset: { id: dataset.id, version: dataset.version, format: datasetSnapshot.format, sha256: datasetSnapshot.sha256 }, input };
  const run = executeConfigurableRecommendation(request, publication, dataset);
  expect(run.result.content.neighbors.map(row => row.recordId)).toEqual(['b']);
  expect(run.result.content.items.map(item => item.text).sort()).toEqual(['Modular monolith', 'Module boundaries']);
  expect(run.result.sha256).toBe(executeConfigurableRecommendation(request, publication, dataset).result.sha256);
});

test('example datasets preserve published taxonomy IDs and generate independent output lists', () => {
  const taxonomy = { schemaVersion: 1 as const, id: 'domains', version: '1', name: 'Domains', kind: 'tree' as const, selection: 'leaf' as const, source: 'Test', nodes: [
    { id: 'root', name: 'Domains', description: '', parentId: null },
    { id: 'finance', name: 'Finance', description: '', parentId: 'root' },
    { id: 'health', name: 'Health', description: '', parentId: 'root' }
  ] };
  const taxonomySnapshot = snapshotContent(taxonomy);
  const definition = newCustomRecommender();
  definition.attributes[0].valueType = { type: 'taxonomy_node', taxonomy: { id: taxonomy.id, version: taxonomy.version, format: taxonomySnapshot.format, sha256: taxonomySnapshot.sha256 } };
  definition.attributes.push(newCustomAttribute('output', 'practices'));
  const publication: DefinitionPublication = { schemaVersion: 1, definition, taxonomies: [{ state: 'published', snapshot: taxonomySnapshot }], implementation: { methodId: definition.method.id, adapterVersion: CONFIGURABLE_KNN_ADAPTER } };
  const records = customDatasetExample(publication);
  expect(records.map(row => row.values.characteristics)).toEqual([['finance'], ['health']]);
  expect(records[0].values.practices).not.toEqual(records[0].values.recommendations);
});

test('invalid identifiers, missing outputs, taxonomy references and numerical settings block creation', () => {
  const definition = newCustomRecommender();
  definition.attributes = [{ ...definition.attributes[0], valueType: { type: 'taxonomy_node', taxonomy: { id: '', version: '', format: 'us-agent-json-v1', sha256: '' } } }];
  definition.method.parameters.k = 1.5;
  definition.method.parameters.weights = { characteristics: 0 };
  const issues = customDefinitionIssues(definition).join(' ');
  expect(issues).toContain('recommender name'); expect(issues).toContain('recommendation output');
  expect(issues).toContain('published taxonomy'); expect(issues).toContain('weight greater than 0'); expect(issues).toContain('whole number');
});
