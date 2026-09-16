import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyProjectResearchProfile, projectResearchProfileSchema } from './research-inputs.js';

test('preserves missing project data instead of inventing product or technology defaults', () => {
  const profile = projectResearchProfileSchema.parse(emptyProjectResearchProfile());
  assert.equal(profile.objective, '');
  assert.deepEqual(profile.technologies.languages, []);
});

test('normalizes repeated tags within a field without mixing technology categories', () => {
  const profile = projectResearchProfileSchema.parse({
    ...emptyProjectResearchProfile(), objective: 'prototype', platforms: [' Web ', 'Web'],
    technologies: { languages: ['Java'], frameworks: ['Java'], apis: [], dataPersistence: [] }
  });
  assert.equal(profile.objective, 'prototype');
  assert.deepEqual(profile.platforms, ['Web']);
  assert.deepEqual(profile.technologies.languages, ['Java']);
  assert.deepEqual(profile.technologies.frameworks, ['Java']);
});

test('rejects malformed research profiles at the API boundary', () => {
  for (const override of [
    { objective: 'unknown' }, { platforms: [' '] },
    { architectures: ['a'.repeat(121)] }, { platforms: Array(101).fill('Web') },
    { technologies: { languages: 'Java' } }
  ]) assert.equal(projectResearchProfileSchema.safeParse({ ...emptyProjectResearchProfile(), ...override }).success, false);
});
