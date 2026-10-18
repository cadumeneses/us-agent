import evidence from '../../../../docs/evidencias/b16b/published-runs.json';
import { snapshotContent } from '../../../api/src/domain/content-snapshot';
import { executeTestCaseRecommendation } from '../../../api/src/services/method-execution';
import type { DatasetSummary, DefinitionRecord, DefinitionSummary } from '../types/configurable-recommendations';
import type { TestCaseCatalogRecord, TestCaseCatalogSummary, TestCaseRequest, TestCaseRun } from '../types/test-case-recommendations';

export function testCaseFixture() {
  // Real published API evidence from the previous increment, rather than an invented result shape.
  const original = structuredClone(evidence.content.runs[0]) as TestCaseRun;
  const content = original.snapshot.content, draft = { ...content.definition.content.definition, state: 'draft' as const };
  const definition: DefinitionRecord = { state: 'published', definition: content.definition.content.definition, snapshot: content.definition };
  const summary: DefinitionSummary = { id: draft.id, version: draft.version, name: draft.name, method: draft.method.id, state: 'published', attributeCount: draft.attributes.length, snapshot: content.definition };
  const datasetSummary: DatasetSummary = { id: content.dataset.content.id, version: content.dataset.content.version, state: 'published', definition: content.request.content.definition,
    recordCount: content.dataset.content.records.length, snapshot: content.dataset, catalog: content.request.content.catalog, publishedBy: 'local-development', publishedAt: original.createdAt };
  const catalog: TestCaseCatalogRecord = { state: 'published', snapshot: content.catalog, publishedBy: 'local-development', publishedAt: original.createdAt, retiredAt: null };
  const catalogSummary: TestCaseCatalogSummary = { id: content.catalog.content.id, version: content.catalog.content.version, state: 'published',
    itemCount: content.catalog.content.catalog.content.items.length, source: content.catalog.content.catalog.content.source, snapshot: content.catalog };
  const run = (body: TestCaseRequest): TestCaseRun => ({ ...original, id: body.id,
    snapshot: snapshotContent(executeTestCaseRecommendation(body, content.definition.content, content.dataset.content, content.catalog.content) as TestCaseRun['snapshot']['content']) });
  return { original, draft, definition, summary, datasetSummary, catalog, catalogSummary, request: content.request.content, run };
}
