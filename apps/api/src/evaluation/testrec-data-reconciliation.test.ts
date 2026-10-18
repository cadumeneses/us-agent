import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { reconcileE26Data } from './testrec-data-reconciliation.js';
const root = new URL('../../../../', import.meta.url);
const read = (file: string) => readFileSync(new URL(file, root));
const base = 'research/sources/testrec-e26/zenodo-16133793/';
const input = () => ({ profiles: read(base + 'categorized_user_stories.csv'), associations: read('docs/evidencias/b02g/test-cases.reviewed-candidate.csv'), criteriaLinks: read(base + 'user_stories_test_cases.csv') });

test('reconciles observed public keys without treating matched profiles or a parseable candidate as scientifically complete', () => {
  const sources = input(), before = Object.values(sources).map(bytes => Buffer.from(bytes));
  const result = reconcileE26Data(sources);
  assert.deepEqual(result, reconcileE26Data(sources));
  assert.deepEqual(Object.values(sources), before);
  assert.equal(result.content.summary.profileStories, 304);
  assert.equal(result.content.summary.associationStories, 249);
  assert.equal(result.content.summary.associationStoriesWithObservedProfile, 215);
  assert.equal(result.content.summary.associationStoriesWithoutObservedProfile, 34);
  assert.equal(result.content.summary.criteriaStoriesWithoutObservedProfile, 2);
  assert.ok(result.content.stories.every(story => story.scientificEligibility === 'not_established'));
  assert.equal(result.content.readyForScientificExecution, false);
  assert.equal(result.content.summary.createdProfiles, 0);
  assert.equal(result.content.summary.appliedAliases, 0);
});

test('missing IDs stay unresolved even with identical titles elsewhere, and title conflicts remain visible', () => {
  const data = reconcileE26Data(input()).content;
  assert.equal(data.summary.missingStandardIdRows, 76);
  assert.equal(data.summary.missingIdsWithAnyLiteralTitleCandidate, 18);
  assert.equal(data.summary.missingIdsWithSameProjectTitleCandidate, 0);
  assert.equal(data.summary.missingIdsWithSameStoryTitleCandidate, 0);
  assert.equal(data.summary.titleGroupsWithDifferentStandardIds, 7);
  assert.equal(data.summary.filledStandardIds, 0);
  assert.ok(data.missingStandardIds.every(row => row.rawStandardTestId.trim() === ''));
  const conflict = data.conflictingTitleIds.find(row => row.title === 'Validar Regras do Formulário de Criação de Perfil')!;
  assert.deepEqual(conflict.observedIds, ['4', '43']);
  assert.equal(conflict.observations[0].rawStoryId, conflict.observations[1].rawStoryId);
});

test('mapping flags distinguish source yes/no from absence and keep source-row co-occurrence', () => {
  const data = reconcileE26Data(input()).content;
  assert.deepEqual(data.summary.profileMappingFlags, { source_says_yes: 111, source_says_no: 247, not_provided: 210, unrecognized_literal: 0 });
  assert.deepEqual(data.summary.joinedProfileMappingFlags, { source_says_yes: 46, source_says_no: 6, not_provided: 176, unrecognized_literal: 0 });
  const mixed = data.stories.find(row => row.identity.project === 'SPGEC' && row.identity.storyId === '16759')!;
  assert.equal(mixed.profileEvidence.length, 3);
  assert.deepEqual(mixed.profileEvidence.map(row => [row.module, row.operation]), [['Cadastro', 'Atualizar_dados'], ['Cadastro', 'Atualizar_dados'], ['X', 'X']]);
  assert.equal(mixed.scientificEligibility, 'not_established');
});

test('suffixes and cross-project candidates remain separate and missing relations never turn into known empty outputs', () => {
  const data = reconcileE26Data(input()).content;
  const suffix = data.unmatchedAssociationProfiles.find(row => row.identity.project === 'Event Driven System for Business Services Integration' && row.identity.storyId === '253')!;
  assert.deepEqual(suffix.suffixCandidates.map(row => row.rawStoryId), ['#253-1', '#253-2', '#253-3', '#253-4']);
  assert.equal(suffix.decision, 'unresolved_no_profile_created_or_alias_applied');
  const alias = data.unmatchedCriteriaProfiles.find(row => row.identity.project === 'ARTools')!;
  assert.equal(alias.identity.storyId, '11971');
  const withoutOutput = data.stories.find(row => row.presence.associations === 'not_observed')!;
  assert.equal(withoutOutput.associationCompleteness, 'unconfirmed_even_when_rows_are_observed');
  assert.equal(data.summary.inferredEmptyAssociations, 0);
});

test('the unresolved criterion/test bridge does not conflate standard IDs or parse raw project NFR references', () => {
  const data = reconcileE26Data(input()).content;
  assert.equal(data.summary.criterionRowsWithSameStoryAndLiteralTestReference, 0);
  assert.notEqual(data.rules.namespaces.standardTestId, data.rules.namespaces.standardCriterionId);
  const story = data.stories.find(row => row.identity.project === 'RCP' && row.identity.storyId === '2379')!;
  assert.equal(story.criteriaEvidence[0].rawTestReference, '#2523');
  assert.equal(story.criteriaEvidence[0].rawProjectNfrReference, '1.2');
  assert.equal(story.associationEvidence.length, 5);
  assert.ok(story.associationEvidence.every(row => row.title !== '#2523'));
});

test('malformed sources, new columns and duplicate association record IDs are rejected before reconciliation', () => {
  const source = input();
  assert.throws(() => reconcileE26Data({ ...source, associations: read(base + 'test_cases_for_user_stories.csv') }), /Aspas|Unreviewed/);
  const text = source.associations.toString('utf8'), firstRow = text.split('\n')[1];
  assert.throws(() => reconcileE26Data({ ...source, associations: Buffer.from(text + firstRow + '\n') }), /Ambiguous association/);
  assert.throws(() => reconcileE26Data({ ...source, criteriaLinks: Buffer.from('Projeto;ID_US;OTHER\nP;S;v\n') }), /Unreviewed schema/);
  assert.throws(() => reconcileE26Data({ ...source, profiles: Buffer.from([0xff]) }), /encoded data|encoding|UTF-8/);
});
