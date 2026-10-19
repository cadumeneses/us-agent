import { z } from 'zod';
import { snapshotContent } from '../domain/content-snapshot.js';
import { analyzeConfigurationEffort, configurationEffortSchema } from './configuration-effort.js';

export const CONFIGURATION_EFFORT_V2 = 'configuration-effort-v2';
const hash = z.string().regex(/^[a-f0-9]{64}$/);
export const configurationEffortV2Schema = z.strictObject({
  ...configurationEffortSchema.shape,
  schemaVersion: z.literal(2),
  protocol: z.strictObject({ version: z.literal(CONFIGURATION_EFFORT_V2), sha256: hash }),
  sessions: z.array(configurationEffortSchema.shape.sessions.element.extend({
    taskBatch: z.strictObject({ namespace: z.string().regex(/^[a-z][a-z0-9_-]{0,23}$/), sha256: hash })
  })).min(1).max(1000)
});

/** File integrity and task regeneration are checked by the v2 CLI before analysis. */
export function analyzeConfigurationEffortV2(raw: unknown) {
  const input = configurationEffortV2Schema.parse(raw);
  if (new Set(input.sessions.map(row => row.taskBatch.namespace)).size !== input.sessions.length) {
    throw new Error('Each attempt requires a distinct task namespace.');
  }
  const legacy = analyzeConfigurationEffort({ ...input, schemaVersion: 1,
    protocol: { ...input.protocol, version: 'configuration-effort-v1' },
    sessions: input.sessions.map(({ taskBatch, ...session }) => session) });
  return snapshotContent({ ...legacy.content, version: CONFIGURATION_EFFORT_V2,
    inputSha256: snapshotContent(input).sha256, protocol: input.protocol,
    taskMaterialVerification: 'bytes_and_regenerated_task_pack_checked_by_cli',
    results: legacy.content.results.map((row, index) => ({ ...row, taskBatch: input.sessions[index].taskBatch })) });
}
