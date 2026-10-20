import {z} from 'zod';
import {snapshotContent} from '../domain/content-snapshot.js';
export const effortMethods=['ramos_2019_manhattan_k1_v2','us_agent_e21_equations_demo_v1','configurable_project_knn_v1'] as const;
const code=z.string().regex(/^[a-z0-9][a-z0-9._-]{0,79}$/),hash=z.string().regex(/^[a-f0-9]{64}$/),time=z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const criterion=z.enum(['definition','taxonomy','catalog','dataset','run','replay','export']);
const event=z.discriminatedUnion('type',[
  z.strictObject({type:z.literal('start'),atMs:time}),
  z.strictObject({type:z.literal('pause'),atMs:time,reason:z.enum(['interruption','environment'])}),
  z.strictObject({type:z.literal('resume'),atMs:time}),
  z.strictObject({type:z.literal('error'),atMs:time,code}),
  z.strictObject({type:z.literal('help'),atMs:time,kind:z.enum(['procedural','conceptual','technical'])}),
  z.strictObject({type:z.literal('change'),atMs:time,scope:z.enum(['configuration','application_code'])}),
  z.strictObject({type:z.literal('checkpoint'),atMs:time,criterion,reference:z.strictObject({id:code,sha256:hash}),
    artifact:z.strictObject({file:z.string().min(1).max(240),sha256:hash})}),
  z.strictObject({type:z.literal('finish'),atMs:time,outcome:z.enum(['completed','incomplete','abandoned'])})
]);
const attempt=z.strictObject({participantCode:code,method:z.enum(effortMethods),attempt:z.number().int().positive(),order:z.number().int().positive()});
export const configurationEffortV3Schema=z.strictObject({
  schemaVersion:z.literal(3),id:code,kind:z.enum(['synthetic_rehearsal','observed_sessions']),protocolSha256:hash,
  methodology:z.strictObject({status:z.enum(['pending','approved_for_pilot','approved_for_collection']),reviewEvidence:z.string().max(2000)}),
  plannedAttempts:z.array(attempt.extend({status:z.enum(['planned','not_started','recorded']),reason:z.string().max(2000)})).max(3000),
  sessions:z.array(attempt.extend({id:code,materials:z.strictObject({namespace:z.string().regex(/^[a-z][a-z0-9_-]{0,23}$/),sha256:hash}),
    environment:z.strictObject({softwareRevision:z.string().regex(/^[a-f0-9]{40}$/),softwareSnapshotSha256:hash,
      interfaceLanguage:z.literal('en'),experience:z.enum(['novice','experienced','not_recorded']),organizationId:code}),
    capture:z.enum(['authored_fixture','observer_relative_clock']),events:z.array(event).min(2).max(10000)
  })).max(1000)
});
export type ConfigurationEffortV3Input=z.infer<typeof configurationEffortV3Schema>;
export function effortRequired(method:typeof effortMethods[number]) {
  const required:string[]=['definition','dataset','run','replay','export'];
  if(method!=='configurable_project_knn_v1')required.push('taxonomy');
  if(method==='us_agent_e21_equations_demo_v1')required.push('catalog');
  return required;
}
export function analyzeConfigurationEffortV3(raw:unknown){
  const input=configurationEffortV3Schema.parse(raw);
  const identity=(row:z.infer<typeof attempt>)=>JSON.stringify([row.participantCode,row.method,row.attempt,row.order]);
  const planned=new Map(input.plannedAttempts.map(row=>[identity(row),row]));
  if(planned.size!==input.plannedAttempts.length)throw Error('Duplicate planned attempt.');
  if(new Set(input.sessions.map(row=>row.id)).size!==input.sessions.length||new Set(input.sessions.map(row=>row.materials.namespace)).size!==input.sessions.length)throw Error('Sessions and task namespaces must be unique.');
  if(new Set(input.plannedAttempts.map(row=>`${row.participantCode}:${row.order}`)).size!==planned.size)throw Error('Participant order must be unique.');
  if(new Set(input.plannedAttempts.map(row=>`${row.participantCode}:${row.method}:${row.attempt}`)).size!==planned.size)throw Error('Method attempts must be unique.');
  if(input.kind==='observed_sessions'&&input.sessions.length&&(input.methodology.status==='pending'||!input.methodology.reviewEvidence.trim()))throw Error('Observed collection requires an explicit methodological review record.');
  const seen=new Set<string>();
  const results=input.sessions.map(session=>{
    const key=identity(session),entry=planned.get(key);
    if(!entry||entry.status!=='recorded'||seen.has(key))throw Error('Session must match one recorded planned attempt.');seen.add(key);
    if((input.kind==='synthetic_rehearsal')!==(session.capture==='authored_fixture'))throw Error('Synthetic and observed provenance cannot be mixed.');
    let started=false,finished=false,pause:number|null=null,pausedMs=0,last=0;
    const required=effortRequired(session.method),checkpoints=new Set<string>();
    for(const item of session.events){
      if(item.atMs<last||finished)throw Error('Events must be ordered and stop at finish.');last=item.atMs;
      if(!started&&item.type!=='start')throw Error('Start must be first.');
      if(item.type==='start'){if(started||item.atMs!==0)throw Error('Exactly one start at zero is required.');started=true;}
      else if(item.type==='pause'){if(pause!==null)throw Error('Nested pause.');pause=item.atMs;}
      else if(item.type==='resume'){if(pause===null)throw Error('Resume requires a pause.');pausedMs+=item.atMs-pause;pause=null;}
      else if(item.type==='finish'){
        if(item.outcome==='completed'&&(pause!==null||required.some(value=>!checkpoints.has(value))))throw Error('Completion requires every checkpoint and an active clock.');
        if(pause!==null)pausedMs+=item.atMs-pause;finished=true;
      }else{
        if(pause!==null)throw Error('Observation during pause.');
        if(item.type==='checkpoint'){if(!required.includes(item.criterion)||checkpoints.has(item.criterion))throw Error('Unexpected or duplicate checkpoint.');checkpoints.add(item.criterion);}
      }
    }
    const end=session.events.at(-1)!;if(!finished||end.type!=='finish')throw Error('Explicit finish is required.');
    return {sessionId:session.id,participantCode:session.participantCode,method:session.method,attempt:session.attempt,order:session.order,
      outcome:end.outcome,elapsedMs:end.atMs,pausedMs,activeMs:end.atMs-pausedMs,
      errors:session.events.filter(row=>row.type==='error').length,help:session.events.filter(row=>row.type==='help').length,
      configurationChanges:session.events.filter(row=>row.type==='change'&&row.scope==='configuration').length,
      applicationCodeChanges:session.events.filter(row=>row.type==='change'&&row.scope==='application_code').length,
      missingCheckpoints:required.filter(value=>!checkpoints.has(value)),materials:session.materials,environment:session.environment};
  });
  for(const [key,entry]of planned)if(entry.status==='recorded'&&!seen.has(key))throw Error('Recorded attempt has no session.');
  const median=(values:number[])=>{if(!values.length)return null;const sorted=[...values].sort((a,b)=>a-b),mid=Math.floor(sorted.length/2);return sorted.length%2?sorted[mid]:(sorted[mid-1]+sorted[mid])/2;};
  return snapshotContent({version:'configuration-effort-v3',kind:input.kind,inputSha256:snapshotContent(input).sha256,
    empiricalClaim:false,independentSessions:false,methodologicalApproval:'declared_review_record_not_independently_authenticated',
    artifactVerification:'requires_cli_file_and_snapshot_verification',results,
    summary:effortMethods.map(method=>{const attempts=input.plannedAttempts.filter(row=>row.method===method),rows=results.filter(row=>row.method===method),completed=rows.filter(row=>row.outcome==='completed');return{
      method,plannedAttempts:attempts.length,notStarted:attempts.filter(row=>row.status==='not_started').length,pending:attempts.filter(row=>row.status==='planned').length,
      observedSessions:rows.length,participantCodes:new Set(rows.map(row=>row.participantCode)).size,completed:completed.length,
      incomplete:rows.filter(row=>row.outcome==='incomplete').length,abandoned:rows.filter(row=>row.outcome==='abandoned').length,
      completionRatioStarted:rows.length?completed.length/rows.length:null,medianActiveMsCompleted:median(completed.map(row=>row.activeMs)),
      medianElapsedMsCompleted:median(completed.map(row=>row.elapsedMs)),errors:rows.reduce((total,row)=>total+row.errors,0),help:rows.reduce((total,row)=>total+row.help,0)
    };})});
}
