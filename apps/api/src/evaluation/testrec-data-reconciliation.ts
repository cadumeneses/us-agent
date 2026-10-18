import { createHash } from 'node:crypto';
import { snapshotContent } from '../domain/content-snapshot.js';
import { parseImportCsv } from '../domain/import-formats.js';

export const E26_RECONCILIATION_VERSION = 'e26-conservative-data-reconciliation-v1';
type Role = 'profiles' | 'associations' | 'criteriaLinks';
type Row = { ordinal: number; physicalLine: number; raw: Record<string, string>; fields: Record<string, string> };
type Identity = { project: string; storyId: string };
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const compare = (a: string, b: string) => a < b ? -1 : a > b ? 1 : 0;
const identity = (row: Row): Identity => ({ project: row.fields.Projeto.trim(), storyId: row.fields.ID_US.trim().replace(/^#/, '').trim() });
const key = (value: Identity) => JSON.stringify([value.project, value.storyId]);
const group = <T>(rows: T[], select: (row: T) => string) => {
  const result = new Map<string, T[]>();
  for (const row of rows) { const id = select(row); result.set(id, [...(result.get(id) ?? []), row]); }
  return result;
};
const required: Record<Role, string[]> = {
  profiles: ['Módulo', 'Operação', 'Tarefa', 'ID (mapeamento)', 'Projeto', 'ID_US', 'DESC_US', 'Plataforma', 'ID_Task', 'DESC_Task', 'Tipo', 'Mapeado? (SIM ou NAO)', 'Origem'],
  associations: ['Projeto', 'ID_US', 'ID', 'ID_TC', 'ID_STD_TC'],
  criteriaLinks: ['Projeto', 'ID_US', 'ID_TC', 'CA', 'RNFs', 'ID_STD_AC']
};

function parse(role: Role, bytes: Uint8Array) {
  const text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  const parsed = parseImportCsv(text.replace(/^\uFEFF/, ''), ';'), names = parsed.fields.map(field => field.trim());
  if (names.length !== required[role].length || required[role].some((field, index) => names[index] !== field) || parsed.rows.some(row => row.error)) throw new Error(`Unreviewed schema or malformed ${role} rows.`);
  const rows: Row[] = parsed.rows.map(row => ({ ordinal: row.ordinal, physicalLine: row.line!, raw: row.value as Record<string, string>,
    fields: Object.fromEntries(parsed.fields.map((field, i) => [names[i], (row.value as Record<string, string>)[field]])) }));
  if (rows.some(row => !identity(row).project || !identity(row).storyId)) throw new Error(`Missing ${role} identity requires source review.`);
  return { headers: parsed.fields, rows, sourceSha256: sha(bytes) };
}

/** Exact observed joins only. Neither title similarity nor shared numeric strings authorize ID inference or scientific eligibility. */
export function reconcileE26Data(input: Record<Role, Uint8Array>) {
  const sources = { profiles: parse('profiles', input.profiles), associations: parse('associations', input.associations), criteriaLinks: parse('criteriaLinks', input.criteriaLinks) };
  const profiles = sources.profiles.rows, associations = sources.associations.rows, links = sources.criteriaLinks.rows;
  const profileGroups = group(profiles, row => key(identity(row))), associationGroups = group(associations, row => key(identity(row))), linkGroups = group(links, row => key(identity(row)));
  const recordIds = associations.map(row => row.fields.ID);
  if (recordIds.some(id => !id.trim()) || new Set(recordIds).size !== recordIds.length) throw new Error('Ambiguous association record IDs.');
  const location = (role: Role, row: Row) => ({ role, ordinal: row.ordinal, physicalLine: row.physicalLine,
    rawProject: row.fields.Projeto, rawStoryId: row.fields.ID_US });
  const reference = (row: Row) => ({ ...location('associations', row), sourceRecordId: row.fields.ID,
    title: row.fields.ID_TC, rawStandardTestId: row.fields.ID_STD_TC });
  const profileReference = (row: Row) => ({ ...location('profiles', row), module: row.fields['Módulo'], operation: row.fields['Operação'],
    platform: row.fields.Plataforma, rawMappingFlag: row.fields['Mapeado? (SIM ou NAO)'] });
  const allKeys = [...new Set([...profileGroups.keys(), ...associationGroups.keys(), ...linkGroups.keys()])].sort(compare);
  const stories = allKeys.map(id => {
    const p = profileGroups.get(id) ?? [], a = associationGroups.get(id) ?? [], l = linkGroups.get(id) ?? [];
    const rawIdentity = identity((p[0] ?? a[0] ?? l[0])!);
    return { identity: rawIdentity, profileEvidence: p.map(profileReference), associationEvidence: a.map(reference),
      criteriaEvidence: l.map(row => ({ ...location('criteriaLinks', row), rawTestReference: row.fields.ID_TC,
        rawCriterionDescription: row.fields.CA, rawProjectNfrReference: row.fields.RNFs, rawStandardCriterionId: row.fields.ID_STD_AC })),
      presence: { profiles: p.length ? 'observed' : 'not_observed', associations: a.length ? 'observed' : 'not_observed', criteriaLinks: l.length ? 'observed' : 'not_observed' },
      associationCompleteness: 'unconfirmed_even_when_rows_are_observed',
      applicationDomain: { state: 'not_provided', value: null }, completeTestArtifacts: { state: 'not_provided', value: null },
      scientificEligibility: 'not_established' };
  });
  const unmatched = stories.filter(story => story.associationEvidence.length && !story.profileEvidence.length).map(story => {
    const suffixCandidates = profiles.filter(row => {
      const candidate = identity(row);
      return candidate.project === story.identity.project && candidate.storyId.startsWith(story.identity.storyId + '-');
    });
    const differentProjectCandidates = profiles.filter(row => {
      const candidate = identity(row);
      return candidate.storyId === story.identity.storyId && candidate.project !== story.identity.project;
    });
    return { identity: story.identity, associationEvidence: story.associationEvidence, criteriaEvidence: story.criteriaEvidence,
      suffixCandidates: suffixCandidates.map(profileReference), differentProjectCandidates: differentProjectCandidates.map(profileReference),
      decision: 'unresolved_no_profile_created_or_alias_applied' };
  });
  const withStandardId = associations.filter(row => row.fields.ID_STD_TC.trim()), byTitle = group(withStandardId, row => row.fields.ID_TC);
  const missingStandardIds = associations.filter(row => !row.fields.ID_STD_TC.trim()).map(row => {
    const candidates = byTitle.get(row.fields.ID_TC) ?? [];
    const sameProject = candidates.filter(candidate => identity(candidate).project === identity(row).project);
    const sameStory = sameProject.filter(candidate => key(identity(candidate)) === key(identity(row)));
    return { ...reference(row), titleCandidates: candidates.map(reference),
      sameProjectCandidateCount: sameProject.length, sameStoryCandidateCount: sameStory.length,
      decision: 'unresolved_no_ID_imputation' };
  });
  const conflictingTitleIds = [...byTitle.entries()].filter(([, rows]) => new Set(rows.map(row => row.fields.ID_STD_TC.trim())).size > 1)
    .sort(([a], [b]) => compare(a, b)).map(([title, rows]) => ({ title, observedIds: [...new Set(rows.map(row => row.fields.ID_STD_TC.trim()))].sort(compare),
      observations: rows.map(reference), decision: 'title_does_not_establish_standard_test_identity' }));
  const flagState = (row: Row) => {
    const flag = row.fields['Mapeado? (SIM ou NAO)'].trim();
    return flag === 'Sim' ? 'source_says_yes' : flag === 'Nao' ? 'source_says_no' : flag === '' ? 'not_provided' : 'unrecognized_literal';
  };
  const flags = (rows: Row[]) => Object.fromEntries(['source_says_yes', 'source_says_no', 'not_provided', 'unrecognized_literal'].map(state => [state, rows.filter(row => flagState(row) === state).length]));
  const joinedProfiles = profiles.filter(row => associationGroups.has(key(identity(row))));
  // These names belong to different source columns. Comparing their strings is diagnostic, never an equivalence rule.
  const literalTestReferences = links.map(row => ({ ...location('criteriaLinks', row), rawTestReference: row.fields.ID_TC,
    associationRecordMatches: (associationGroups.get(key(identity(row))) ?? []).filter(candidate => candidate.fields.ID_TC === row.fields.ID_TC).map(reference) }));
  const unmatchedCriteria = stories.filter(story => story.criteriaEvidence.length && !story.profileEvidence.length);
  return snapshotContent({ schemaVersion: 1, version: E26_RECONCILIATION_VERSION, scope: 'observed_relations_and_unresolved_evidence_only',
    scientificReproduction: false, readyForScientificExecution: false, operationalImport: false,
    sourceFiles: Object.fromEntries(Object.entries(sources).map(([role, source]) => [role, { sha256: source.sourceSha256, headers: source.headers, rows: source.rows.length }])),
    rules: { storyIdentity: 'trim_project_and_story_remove_one_leading_hash_preserve_case_and_suffixes', titleMatch: 'exact_literal_only_candidate_not_identity',
      namespaces: { sourceRecordId: 'associations.ID', standardTestId: 'associations.ID_STD_TC', standardCriterionId: 'criteriaLinks.ID_STD_AC',
        criterionTestReference: 'criteriaLinks.ID_TC_unresolved_bridge_to_associations.ID_TC' },
      flags: 'preserve_yes_no_missing_separately_at_source_row_granularity_not_story_eligibility',
      absentRelations: 'not_observed_does_not_mean_known_empty', projectNfrParsing: 'raw_reference_not_split_or_propagated' },
    summary: { profileStories: profileGroups.size, associationStories: associationGroups.size, criteriaStories: linkGroups.size,
      unionStories: stories.length, associationStoriesWithObservedProfile: stories.filter(s => s.associationEvidence.length && s.profileEvidence.length).length,
      associationStoriesWithoutObservedProfile: unmatched.length, missingStandardIdRows: missingStandardIds.length,
      missingIdsWithAnyLiteralTitleCandidate: missingStandardIds.filter(row => row.titleCandidates.length).length,
      missingIdsWithSameProjectTitleCandidate: missingStandardIds.filter(row => row.sameProjectCandidateCount).length,
      missingIdsWithSameStoryTitleCandidate: missingStandardIds.filter(row => row.sameStoryCandidateCount).length,
      titleGroupsWithDifferentStandardIds: conflictingTitleIds.length,
      criterionRowsWithSameStoryAndLiteralTestReference: literalTestReferences.filter(row => row.associationRecordMatches.length).length,
      criteriaStoriesWithoutObservedProfile: unmatchedCriteria.length, profileMappingFlags: flags(profiles), joinedProfileMappingFlags: flags(joinedProfiles),
      createdProfiles: 0, filledStandardIds: 0, appliedAliases: 0, inferredEmptyAssociations: 0, excludedRows: 0 },
    stories, unmatchedAssociationProfiles: unmatched, missingStandardIds, conflictingTitleIds,
    unmatchedCriteriaProfiles: unmatchedCriteria.map(story => ({ identity: story.identity, evidence: story.criteriaEvidence })),
    criterionTestReferenceEvidence: literalTestReferences,
    limits: ['cross_version_association_input_is_candidate_B02g_not_an_original_author_dataset',
      'matching_source_keys_do_not_confirm_complete_or_correct_profiles', 'same_titles_or_numeric_IDs_do_not_prove_same_artifact_or_namespace',
      'suffix_and_cross_project_candidates_are_not_aliases', 'missing_domain_and_complete_test_catalog_block_scientific_execution',
      'no_original_folds_method_code_or_Euclidean_transformation_obtained', 'no_empirical_quality_or_participant_effort_claimed'] });
}
