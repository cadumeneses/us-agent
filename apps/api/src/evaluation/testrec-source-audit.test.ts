import assert from 'node:assert/strict';
import test from 'node:test';
import { auditE26Sources } from './testrec-source-audit.js';

const fixture = () => ({
  'acceptance_criteria_data.csv': 'ID;Descrição\n1;Critério\n',
  'categorized_user_stories.csv': 'Projeto;ID_US;Módulo;Operação;Plataforma\nP;#1;Cadastro;criar;Web\nP;1;Outro;criar;Web\nP;2;Cadastro;;\n',
  'test_cases_for_user_stories.csv': 'Projeto;ID_US;ID;ID_TC;ID_STD_TC   \nP; 1 ;a;Título;t1\nP;9;b;Outro;t2\nmalformed\n',
  'user_stories_test_cases.csv': 'Projeto;ID_US;ID_TC;CA;RNFs;ID_STD_AC\nP;#1;t1;"Texto\nmultilinha";n1;1\n'
});
test('source audit preserves malformed row locations, multiline CSV and conservative composite identities', () => {
  const sources = fixture(), before = JSON.stringify(sources), report = auditE26Sources(sources).content;
  assert.equal(JSON.stringify(sources), before);
  const tests = report.files.find(row => row.name === 'test_cases_for_user_stories.csv')!;
  assert.equal(tests.rows, 3); assert.equal(tests.validRows, 2);
  assert.equal(tests.malformedRows[0].ordinal, 3); assert.equal(tests.malformedRows[0].line, 4);
  assert.ok(tests.headers.includes('ID_STD_TC   '));
  assert.equal(report.profile.uniqueStoryKeys, 2);
  assert.equal(report.profile.conflictingStories, 1); assert.equal(report.profile.incompleteStories, 1);
  const join = report.joins.find(row => row.file === tests.name)!;
  assert.equal(join.matchingCategorizedStoryKeys, 1); assert.equal(join.absentFromCategorized, 1);
  assert.equal(report.files.find(row => row.name === 'user_stories_test_cases.csv')!.rows, 1);
  assert.equal(report.readiness.readyForScientificExecution, false);
  assert.equal(report.profile.gherkinColumnPresent, false);
});
test('malformed headers fail explicitly and missing values do not become populated profile fields', () => {
  const sources = fixture(); sources['categorized_user_stories.csv'] = 'Projeto;ID_US;Módulo;Operação;Plataforma\nP;1;;;;extra\n';
  const report = auditE26Sources(sources).content;
  assert.equal(report.profile.uniqueStoryKeys, 0);
  assert.equal(report.files.find(row => row.name === 'categorized_user_stories.csv')!.malformedRows.length, 1);
  sources['categorized_user_stories.csv'] = 'Projeto;ID_US;Módulo;Operação;Plataforma; Projeto\n';
  assert.throws(() => auditE26Sources(sources), /merge distinct columns/);
  sources['categorized_user_stories.csv'] = 'Projeto;ID_US\nP;1\n';
  assert.throws(() => auditE26Sources(sources), /Missing columns/);
});

test('fatal CSV syntax keeps unknown counts and joins null instead of silently repairing or dropping data', () => {
  const sources = fixture(); sources['test_cases_for_user_stories.csv'] += 'P;1;c;Unescaped "quote";t3\n';
  const report = auditE26Sources(sources).content, file = report.files.find(row => row.name === 'test_cases_for_user_stories.csv')!;
  assert.ok(file.formatError); assert.equal(file.formatError.line, 5);
  assert.equal(file.rows, null); assert.equal(file.uniqueStoryKeys, null);
  assert.ok(file.comparisonHeaders.includes('ID_STD_TC'));
  assert.equal(report.joins.find(row => row.file === file.name)!.matchingCategorizedStoryKeys, null);
  assert.equal(report.catalog.nonemptyStandardTestIds, null);
});
