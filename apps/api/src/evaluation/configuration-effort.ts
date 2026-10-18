import { z } from 'zod';
import { canonicalJson, snapshotContent } from '../domain/content-snapshot.js';

export const CONFIGURATION_EFFORT_VERSION = 'configuration-effort-v1';
const code = z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/);
const timestamp = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const reference = z.strictObject({ id: code, version: z.string().min(1).max(80), sha256: z.string().regex(/^[a-f0-9]{64}$/) });
const criterion = z.enum(['definition', 'taxonomy', 'catalog', 'dataset', 'run', 'replay']);
const event = z.discriminatedUnion('type', [
  z.strictObject({ type: z.literal('start'), atMs: timestamp }),
  z.strictObject({ type: z.literal('pause'), atMs: timestamp, reason: z.enum(['interruption', 'environment']) }),
  z.strictObject({ type: z.literal('resume'), atMs: timestamp }),
  z.strictObject({ type: z.literal('error'), atMs: timestamp, code }),
  z.strictObject({ type: z.literal('help'), atMs: timestamp, kind: z.enum(['procedural', 'conceptual', 'technical']) }),
  z.strictObject({ type: z.literal('change'), atMs: timestamp, scope: z.enum(['configuration', 'application_code']) }),
  z.strictObject({ type: z.literal('checkpoint'), atMs: timestamp, criterion, reference }),
  z.strictObject({ type: z.literal('finish'), atMs: timestamp, outcome: z.enum(['completed', 'incomplete', 'abandoned']) })
]);
export const configurationEffortSchema = z.strictObject({
  schemaVersion: z.literal(1), id: code, kind: z.enum(['synthetic_rehearsal', 'observed_sessions']),
  protocol: z.strictObject({ version: z.literal(CONFIGURATION_EFFORT_VERSION), sha256: z.string().regex(/^[a-f0-9]{64}$/) }),
  materials: reference,
  provenance: z.strictObject({ capture: z.enum(['authored_fixture', 'observer_relative_clock']),
    independence: z.literal('not_established'), artifactVerification: z.literal('references_declared_not_fetched') }),
  sessions: z.array(z.strictObject({ id: code, participantCode: code, attempt: z.number().int().positive(), order: z.number().int().positive(),
    method: z.enum(['ramos_2019_manhattan_k1_v2', 'us_agent_e21_equations_demo_v1']),
    environment: z.strictObject({ softwareRevision: z.string().regex(/^[a-f0-9]{40}$/), interfaceLanguage: z.enum(['en', 'pt-BR']),
      workspaceState: z.enum(['clean', 'modified', 'not_recorded']), softwareSnapshotSha256: z.string().regex(/^[a-f0-9]{64}$/),
      experience: z.enum(['novice', 'experienced', 'not_recorded']), startingState: z.literal('provided_materials_new_namespace') }),
    events: z.array(event).min(2).max(10000)
  })).min(1).max(1000)
}).superRefine((value, context) => {
  if ((value.kind === 'synthetic_rehearsal') !== (value.provenance.capture === 'authored_fixture')) context.addIssue({ code: 'custom', message: 'Synthetic and observed provenance cannot be mixed.' });
});
export type ConfigurationEffortInput = z.infer<typeof configurationEffortSchema>;

/** Analyze declared observations only. This is neither automatic telemetry nor artifact verification. */
export function analyzeConfigurationEffort(raw: unknown) {
  canonicalJson(raw);
  const input = configurationEffortSchema.parse(raw);
  if (new Set(input.sessions.map(row => row.id)).size !== input.sessions.length) throw new Error('Duplicate session IDs.');
  const orders = new Set<string>(), attempts = new Set<string>();
  for (const session of input.sessions) {
    const order = `${session.participantCode}:${session.order}`, attempt = `${session.participantCode}:${session.method}:${session.attempt}`;
    if (orders.has(order) || attempts.has(attempt)) throw new Error('Participant order and method attempt must be unique.');
    orders.add(order); attempts.add(attempt);
  }
  const results = input.sessions.map(session => {
    let started = false, finished = false, pauseAt: number | null = null, pausedMs = 0, lastAt = 0;
    const checkpoints = new Map<string, { reference: z.infer<typeof reference>; elapsedAtMs: number; activeAtMs: number }>();
    const required = ['definition', 'taxonomy', 'dataset', 'run', 'replay'];
    if (session.method === 'us_agent_e21_equations_demo_v1') required.push('catalog');
    for (const item of session.events) {
      if (item.atMs < lastAt) throw new Error(`Non-monotonic clock: ${session.id}.`);
      lastAt = item.atMs;
      if (finished) throw new Error(`Event after finish: ${session.id}.`);
      if (!started && item.type !== 'start') throw new Error(`Session must start before events: ${session.id}.`);
      if (item.type === 'start') {
        if (started || item.atMs !== 0) throw new Error('Exactly one start at zero is required.');
        started = true;
      } else if (item.type === 'pause') {
        if (pauseAt !== null) throw new Error('Cannot nest pauses.');
        pauseAt = item.atMs;
      } else if (item.type === 'resume') {
        if (pauseAt === null) throw new Error('Cannot resume an active session.');
        pausedMs += item.atMs - pauseAt; pauseAt = null;
      } else if (item.type === 'finish') {
        if (item.outcome === 'completed' && pauseAt !== null) throw new Error('Completed session must be active at finish.');
        if (pauseAt !== null) pausedMs += item.atMs - pauseAt;
        if (item.outcome === 'completed' && required.some(key => !checkpoints.has(key))) throw new Error('Completion requires every declared checkpoint.');
        finished = true;
      } else {
        if (pauseAt !== null) throw new Error('Active observations cannot occur during a pause.');
        if (item.type === 'checkpoint') {
          if (!required.includes(item.criterion) || checkpoints.has(item.criterion)) throw new Error('Unexpected or duplicate checkpoint.');
          checkpoints.set(item.criterion, { reference: item.reference, elapsedAtMs: item.atMs, activeAtMs: item.atMs - pausedMs });
        }
      }
    }
    if (!finished) throw new Error('Close observations explicitly as completed, incomplete or abandoned.');
    const end = session.events.at(-1)!;
    if (end.type !== 'finish') throw new Error('Last event must finish the observation.');
    const count = (type: string) => session.events.filter(row => row.type === type).length;
    const missing = required.filter(key => !checkpoints.has(key));
    return { sessionId: session.id, participantCode: session.participantCode, method: session.method, attempt: session.attempt, order: session.order,
      environment: session.environment, outcome: end.outcome, completion: 'reported_by_observer_not_independently_verified',
      elapsedMs: end.atMs, pausedMs, activeMs: end.atMs - pausedMs,
      errors: count('error'), helpRequests: count('help'), helpByKind: Object.fromEntries(['procedural', 'conceptual', 'technical'].map(kind =>
        [kind, session.events.filter(row => row.type === 'help' && row.kind === kind).length])),
      errorsByCode: Object.fromEntries([...new Set(session.events.flatMap(row => row.type === 'error' ? [row.code] : []))].sort().map(code =>
        [code, session.events.filter(row => row.type === 'error' && row.code === code).length])),
      configurationChanges: session.events.filter(row => row.type === 'change' && row.scope === 'configuration').length,
      applicationCodeChanges: session.events.filter(row => row.type === 'change' && row.scope === 'application_code').length,
      checkpoints: Object.fromEntries(checkpoints), missingCheckpoints: missing };
  });
  const median = (values: number[]) => {
    if (!values.length) return null;
    const sorted = [...values].sort((a, b) => a - b), middle = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[middle] : sorted[middle - 1] + (sorted[middle] - sorted[middle - 1]) / 2;
  };
  const byMethod = [...new Set(results.map(row => row.method))].map(method => {
    const rows = results.filter(row => row.method === method), completed = rows.filter(row => row.outcome === 'completed');
    return { method, sessions: rows.length, participantCodes: new Set(rows.map(row => row.participantCode)).size,
      outcomes: Object.fromEntries(['completed', 'incomplete', 'abandoned'].map(status => [status, rows.filter(row => row.outcome === status).length])),
      reportedCompletionRatio: completed.length / rows.length, completedWithHelp: completed.filter(row => row.helpRequests > 0).length,
      completedWithApplicationCodeChanges: completed.filter(row => row.applicationCodeChanges > 0).length,
      completedWithoutRecordedHelpOrCodeChanges: completed.filter(row => row.helpRequests === 0 && row.applicationCodeChanges === 0).length,
      completedTimingDenominator: completed.length, medianElapsedMsCompleted: median(completed.map(row => row.elapsedMs)),
      medianActiveMsCompleted: median(completed.map(row => row.activeMs)),
      errorsAllSessions: rows.reduce((sum, row) => sum + row.errors, 0), helpRequestsAllSessions: rows.reduce((sum, row) => sum + row.helpRequests, 0) };
  });
  return snapshotContent({ version: CONFIGURATION_EFFORT_VERSION, inputSha256: snapshotContent(input).sha256, kind: input.kind,
    protocol: input.protocol, materials: input.materials,
    empiricalClaim: false, independentSessions: false, artifactVerification: input.provenance.artifactVerification,
    results, summary: { sessions: results.length, participantCodes: new Set(results.map(row => row.participantCode)).size, byMethod } });
}
export type ConfigurationEffortReport = ReturnType<typeof analyzeConfigurationEffort>;

export function configurationEffortCsv(report: ConfigurationEffortReport) {
  const columns = ['session_id', 'participant_code', 'method', 'attempt', 'order', 'outcome', 'elapsed_ms', 'paused_ms', 'active_ms', 'errors', 'help_requests', 'configuration_changes', 'application_code_changes', 'missing_checkpoints'];
  const rows = report.content.results.map(row => [row.sessionId, row.participantCode, row.method, row.attempt, row.order, row.outcome,
    row.elapsedMs, row.pausedMs, row.activeMs, row.errors, row.helpRequests, row.configurationChanges, row.applicationCodeChanges, row.missingCheckpoints.join('|')]);
  return [columns, ...rows].map(row => row.map(cell => `"${String(cell).replaceAll('"', '""')}"`).join(',')).join('\r\n') + '\r\n';
}
