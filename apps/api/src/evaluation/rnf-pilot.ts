import { createHash } from 'node:crypto';
import { z } from 'zod';
import { snapshotContent } from '../domain/content-snapshot.js';
import { parseRecommenderDefinition } from '../domain/recommender-definition.js';
import { buildImportPreview } from '../domain/dataset-import.js';
import { legacyNfrInput, RNF_ADAPTER_VERSION } from '../services/configured-nfr.js';
import { NFR_METHOD, type NfrProfile, type NfrResult } from '../services/nfr-engine.js';
import { checkNfrBaseline } from './nfr-baseline.js';
import { RNF_EVALUATION_VERSION, rnfEvaluationBundleSchema } from './rnf-evaluation.js';

const annotationSchema = z.strictObject({ schemaVersion: z.literal(1), kind: z.literal('synthetic_annotation'), source: z.string().min(1),
  cases: z.array(z.strictObject({ id: z.string(), candidateId: z.string(), invalidInput: z.boolean(),
    relevant: z.array(z.strictObject({ type: z.string(), attribute: z.string(), sentence: z.string() })) })) });

// Stable UUIDs identify offline artifacts, not stored database publications.
function fixtureUuid(value: string) {
  const hex = createHash('sha256').update(value).digest('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

export function buildRnfPilot(definitionText: string, referenceText: string, manifestText: string, annotationText: string) {
  checkNfrBaseline(referenceText, manifestText);
  const reference = JSON.parse(referenceText) as { profiles: Record<string, NfrProfile>; cases: Array<{
    id: string; targetId: string; historyIds: string[]; labelIndex: number; expected: NfrResult;
  }> };
  const annotations = annotationSchema.parse(JSON.parse(annotationText));
  const draft = parseRecommenderDefinition(JSON.parse(definitionText));
  const definition = { schemaVersion: 1 as const, definition: { ...draft, state: 'published' as const }, taxonomies: [],
    implementation: { methodId: NFR_METHOD, adapterVersion: RNF_ADAPTER_VERSION } };
  const ds = snapshotContent(definition);
  const defRef = { id: draft.id, version: draft.version, format: ds.format, sha256: ds.sha256 };
  function scenario(id: string, targetId: string, historyIds: string[], labelIndex: number, holdout: boolean, invalidInput: boolean) {
    const input = legacyNfrInput(draft, reference.profiles[targetId], targetId, 'Synthetic technical pilot');
    const records = historyIds.map(id => legacyNfrInput(draft, reference.profiles[id], id, 'Frozen reconstructed demonstration'));
    if (holdout) {
      // Ground truth is held separately; the production executor sees only an empty target output.
      input.id = id; input.values[draft.method.bindings.nfrs] = [];
      input.values[draft.method.bindings.text] = `Distinct synthetic target for ${id}.`;
    }
    const spec = { schemaVersion: 1 as const, id: `pilot-${id}`, version: '1', format: 'json' as const, definition: defRef,
      source: { description: 'Synthetic offline pilot; not an original author dataset', authorization: { basis: 'synthetic' as const, reference: 'research/pilots/rnf-v1/annotations.json and reconstructed RNF baseline' } },
      mapping: { recordId: ['id'], attributes: Object.fromEntries(draft.attributes.map(attribute => [attribute.id, { path: ['values', attribute.id], encoding: 'value' as const }])) } };
    const bytes = Buffer.from(JSON.stringify(records), 'utf8');
    const preview = snapshotContent(buildImportPreview(spec, bytes, 'synthetic.json', definition));
    if (preview.content.report.fatal.length || preview.content.report.valid !== records.length) throw new Error(`Prévia inválida no piloto: ${id}`);
    const dataset = { schemaVersion: 1 as const, importerVersion: 'structured-import-v1' as const, id: spec.id, version: spec.version, definition: defRef,
      source: spec.source, import: { id: fixtureUuid(`import:${id}`), previewSha256: preview.sha256, fileSha256: preview.content.file.sha256 },
      mapping: spec.mapping, selection: { excludedOrdinals: [], includedOrdinals: preview.content.report.rows.map(row => row.ordinal) },
      records: preview.content.report.rows.map(row => row.input!) };
    const base = snapshotContent(dataset);
    const request = { id: fixtureUuid(`request:${id}`), definition: defRef,
      dataset: { id: dataset.id, version: dataset.version, format: base.format, sha256: base.sha256 }, input, selection: { labelIndex } };
    if (invalidInput) input.values[draft.method.bindings.platforms] = 'invalid array value';
    return { id, request, definition, dataset, expectedTechnicalFailure: invalidInput };
  }
  const compatibility = reference.cases.map(item => ({ ...scenario(item.id, item.targetId, item.historyIds, item.labelIndex, false, false),
    purpose: 'compatibility' as const, compatibility: { resultSha256: snapshotContent(item.expected).sha256, source: 'Frozen local engine oracle, captured before extraction; not relevance judgments' }, relevance: null }));
  const relevance = annotations.cases.map(item => ({ ...scenario(item.id, 'fa', [item.candidateId], 0, true, item.invalidInput),
    purpose: 'synthetic_relevance' as const, compatibility: null,
    relevance: { kind: annotations.kind, source: annotations.source, items: item.relevant } }));
  return rnfEvaluationBundleSchema.parse({ schemaVersion: 1, id: 'rnf-synthetic-pilot-v1', kind: 'synthetic_technical_pilot',
    protocol: { version: RNF_EVALUATION_VERSION, method: NFR_METHOD, repetitions: 2, partition: 'explicit_cases_record_holdout_for_relevance',
      matching: 'normalized_nfr_key', undefinedRatio: 'null', failurePolicy: 'empty_prediction_with_failure_status', classification: 'reference_labels_no_llm', tuning: 'none', configurationStudy: 'not_performed' },
    source: { description: 'Compatibility regression plus separately authored synthetic relevance fixtures; not empirical reproduction', authorization: 'synthetic',
      referenceSha256: createHash('sha256').update(referenceText.replace(/\r\n/g, '\n')).digest('hex'),
      annotationSha256: snapshotContent(annotations).sha256 }, cases: [...compatibility, ...relevance] });
}
