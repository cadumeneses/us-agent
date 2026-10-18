import { z } from 'zod';
import { snapshotContent } from '../domain/content-snapshot.js';
import { aggregateE21Equation43 } from '../services/testrec-equations.js';
import { rankNeighbors } from '../services/knn.js';

const candidate = z.strictObject({ recordId: z.string().min(1), similarity: z.number().min(0).max(1), testCaseIds: z.array(z.string().min(1)) });
const fixtureSchema = z.strictObject({ schemaVersion: z.literal(1), version: z.literal('testrec-figure-associations-v1'),
  review: z.strictObject({ actor: z.literal('codex_visual_source_review'), date: z.string(), validation: z.literal('not_author_or_supervisor_validation') }),
  sources: z.record(z.string(), z.strictObject({ sha256: z.string().regex(/^[a-f0-9]{64}$/), reference: z.string().min(1) })),
  weightBasis: z.literal('displayed_two_decimal_illustrative_similarities_not_recomputed_distances'),
  cases: z.array(z.strictObject({ id: z.string().min(1), reference: z.string(), pdfPage: z.number().int().positive(), figure: z.string(),
    tiePolicy: z.enum(['source_order', 'more_associated_tests_then_source_order']), k: z.literal(3),
    candidates: z.array(candidate).min(3), selectedSourceIds: z.array(z.string()).length(3),
    reportedRanking: z.array(z.strictObject({ id: z.string().min(1), score: z.number().min(0).max(1) })) })),
  limits: z.array(z.string()) });

/** Checks transcribed edges and printed weights only; it makes no assumption about the missing Euclidean transformation. */
export function reviewTestrecFigures(raw: unknown) {
  const fixture = fixtureSchema.parse(raw);
  const cases = fixture.cases.map(example => {
    if (!fixture.sources[example.reference] || new Set(example.candidates.map(row => row.recordId)).size !== example.candidates.length ||
        new Set(example.selectedSourceIds).size !== example.k || new Set(example.reportedRanking.map(row => row.id)).size !== example.reportedRanking.length) throw new Error('Ambiguous figure reference/identities.');
    const ranking = rankNeighbors(example.candidates[0], example.candidates, example.k, {
      dimensions: () => ['source_illustrative_similarity'], eligibility: () => [], vector: row => [row.similarity],
      measure: vector => ({ distance: 1 - vector[0], similarity: vector[0] }),
      compareTies: (left, right) => (example.tiePolicy === 'source_order' ? 0 : right.testCaseIds.length - left.testCaseIds.length) ||
        example.candidates.indexOf(left) - example.candidates.indexOf(right)
    });
    const neighbors = ranking.neighbors.map(row => row.candidate);
    if ([...example.selectedSourceIds].sort().join('|') !== neighbors.map(row => row.recordId).sort().join('|')) throw new Error('Figure selection does not match transcribed similarities/ties.');
    const items = aggregateE21Equation43(neighbors);
    if (items.map(row => row.testCaseId).join('|') !== example.reportedRanking.map(row => row.id).join('|')) throw new Error('Figure item order differs from the transcribed associations.');
    return { id: example.id, reference: example.reference, pdfPage: example.pdfPage, figure: example.figure,
      neighbors, items: items.map((item, index) => ({ ...item, roundedScore: Number(item.score.toFixed(2)),
        reportedScore: example.reportedRanking[index].score, matchesAtReportedPrecision: Number(item.score.toFixed(2)) === example.reportedRanking[index].score })) };
  });
  return snapshotContent({ schemaVersion: 1, kind: 'testrec_visual_figure_arithmetic_review', fixture: snapshotContent(fixture),
    scientificReproduction: false, distanceMethodConfirmed: false, empiricalEvaluation: false, cases,
    mismatches: cases.flatMap(example => example.items.filter(item => !item.matchesAtReportedPrecision).map(item => ({ caseId: example.id, testCaseId: item.testCaseId, reported: item.reportedScore, calculatedRounded: item.roundedScore }))) });
}
