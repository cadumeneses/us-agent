import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { analyzeConfigurationEffort, configurationEffortCsv } from './configuration-effort.js';
const fixture=()=>JSON.parse(readFileSync(new URL('../../../../research/configuration-effort-v1/rehearsal.json',import.meta.url),'utf8'));

test('configuration timing separates authored evidence, pauses, assistance, code changes and repeated participant sessions',()=>{
  const input=fixture(), before=structuredClone(input), report=analyzeConfigurationEffort(input);
  assert.deepEqual(input,before); assert.deepEqual(report,analyzeConfigurationEffort(input));
  assert.equal(report.content.empiricalClaim,false); assert.equal(report.content.independentSessions,false);
  assert.equal(report.content.summary.sessions,3); assert.equal(report.content.summary.participantCodes,2);
  const rnf=report.content.results[0];
  assert.equal(rnf.elapsedMs,150000); assert.equal(rnf.pausedMs,30000); assert.equal(rnf.activeMs,120000);
  assert.deepEqual(rnf.errorsByCode,{taxonomy_reference:1}); assert.deepEqual(rnf.helpByKind,{procedural:1,conceptual:0,technical:0});
  assert.equal(rnf.checkpoints.taxonomy.elapsedAtMs,70000); assert.equal(rnf.checkpoints.taxonomy.activeAtMs,40000);
  assert.equal(report.content.results[1].applicationCodeChanges,1);
  const abandoned=report.content.results[2]; assert.equal(abandoned.outcome,'abandoned'); assert.equal(abandoned.activeMs,50000);
  assert.ok(abandoned.missingCheckpoints.includes('catalog'));
  const tests=report.content.summary.byMethod.find(row=>row.method==='us_agent_e21_equations_demo_v1')!;
  assert.equal(tests.sessions,2); assert.equal(tests.reportedCompletionRatio,0.5); assert.equal(tests.completedTimingDenominator,1);
  assert.equal(tests.medianActiveMsCompleted,210000); assert.equal(tests.completedWithApplicationCodeChanges,1);
  assert.equal(tests.completedWithoutRecordedHelpOrCodeChanges,0);
});

test('incomplete attempts remain in denominators and methods with no completions have null timing medians',()=>{
  const input=fixture(); input.sessions=[input.sessions[2]];
  input.sessions[0].events.at(-1).outcome='incomplete';
  const data=analyzeConfigurationEffort(input).content;
  assert.equal(data.summary.byMethod[0].outcomes.incomplete,1);
  assert.equal(data.summary.byMethod[0].reportedCompletionRatio,0);
  assert.equal(data.summary.byMethod[0].completedTimingDenominator,0);
  assert.equal(data.summary.byMethod[0].medianElapsedMsCompleted,null);
  assert.equal(data.summary.byMethod[0].medianActiveMsCompleted,null);
});

test('clock and state errors cannot become valid effort measurements',()=>{
  for(const mutate of [
    (p:any)=>{p.sessions[0].events[1].atMs=-1;},
    (p:any)=>{p.sessions[0].events[1].atMs=16000;},
    (p:any)=>{p.sessions[0].events[0].atMs=1;},
    (p:any)=>{p.sessions[0].events.splice(0,1);},
    (p:any)=>{p.sessions[0].events.push({type:'help',atMs:150001,kind:'technical'});},
    (p:any)=>{p.sessions[0].events.splice(4,0,{type:'pause',atMs:25000,reason:'interruption'});},
    (p:any)=>{p.sessions[0].events[3]={type:'resume',atMs:20000};},
    (p:any)=>{p.sessions[0].events[4]={type:'help',atMs:25000,kind:'technical'};},
    (p:any)=>{p.sessions[0].events.pop();},
    (p:any)=>{p.sessions[0].events.at(-1).atMs=Number.MAX_SAFE_INTEGER+1;}
  ]) {const input=fixture();mutate(input);assert.throws(()=>analyzeConfigurationEffort(input));}
});

test('completion requires every method checkpoint while declared references remain unverified',()=>{
  const input=fixture(); input.sessions[1].events=input.sessions[1].events.filter((row:any)=>row.criterion!=='catalog');
  assert.throws(()=>analyzeConfigurationEffort(input),/every declared checkpoint/);
  const duplicate=fixture(); duplicate.sessions[0].events.splice(2,0,structuredClone(duplicate.sessions[0].events[1]));
  assert.throws(()=>analyzeConfigurationEffort(duplicate),/duplicate checkpoint/);
  const unexpected=fixture(); unexpected.sessions[0].events[1].criterion='catalog';
  assert.throws(()=>analyzeConfigurationEffort(unexpected),/Unexpected/);
  const paused=fixture(); paused.sessions[0].events.splice(-1,0,{type:'pause',atMs:149000,reason:'interruption'});
  assert.throws(()=>analyzeConfigurationEffort(paused),/must be active/);
  assert.equal(analyzeConfigurationEffort(fixture()).content.artifactVerification,'references_declared_not_fetched');
});

test('duplicate identities, impossible provenance and extra personal fields are rejected',()=>{
  for(const mutate of [
    (p:any)=>{p.sessions.push(structuredClone(p.sessions[0]));},
    (p:any)=>{p.sessions[1].order=1;},
    (p:any)=>{p.sessions[1].method=p.sessions[0].method;},
    (p:any)=>{p.kind='observed_sessions';},
    (p:any)=>{p.provenance.capture='observer_relative_clock';},
    (p:any)=>{p.sessions[0].name='Not a supported field';},
    (p:any)=>{p.sessions[0].environment.softwareSnapshotSha256='missing';}
  ]){const input=fixture();mutate(input);assert.throws(()=>analyzeConfigurationEffort(input));}
  const observed=fixture();observed.kind='observed_sessions';observed.provenance.capture='observer_relative_clock';
  assert.equal(analyzeConfigurationEffort(observed).content.empiricalClaim,false);
});

test('CSV retains abandoned attempts, individual counters and missing checkpoints without inventing zero time',()=>{
  const csv=configurationEffortCsv(analyzeConfigurationEffort(fixture()));
  assert.equal(csv.split('\r\n').length,5);
  assert.match(csv,/"synthetic-b-testrec"/);
  assert.match(csv,/"abandoned","90000","40000","50000"/);
  assert.match(csv,/taxonomy\|dataset\|run\|replay\|catalog/);
});
