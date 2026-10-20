// Automated technical traversal of the frozen B18c manuals. Not a participant session.
// All publications use UI controls; database access verifies evidence in a disposable local schema.
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';

assert.equal(process.argv.length, 2, 'Usage: npm run check:configuration-tasks-browser');
const pack = resolve('docs/evidencias/b18c');
const json = async path => JSON.parse(await readFile(path, 'utf8'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const inventory = await json(resolve(pack, 'manifest.json'));
for (const [name, expected] of Object.entries(inventory.artifacts)) {
  assert.ok(!name.split('/').includes('..') && !name.startsWith('/'));
  assert.equal(sha(await readFile(resolve(pack, name))), expected, `Frozen task material: ${name}`);
}
const oracle = await json(resolve(pack, 'facilitator/answer-key.json'));
const schema = `configuration_browser_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^configuration_browser_[a-f0-9]{32}$/);
process.env.DATABASE_URL = `postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
process.env.DATABASE_POOL_MAX = '5';
for (const key of ['DATABASE_SSL', 'VERCEL', 'INGEST_API_KEY']) delete process.env[key];
const { pool } = await import('../apps/api/dist/database/pool.js');
const { createApp } = await import('../apps/api/dist/app.js');
const { snapshotContent } = await import('../apps/api/dist/domain/content-snapshot.js');
const artifacts = resolve('tmp', schema), profile = resolve(artifacts, 'edge-profile');
await mkdir(artifacts, { recursive: true });
let server, browser, socket, created = false, serial = 0;
const pending = new Map(), browserErrors = [], runs = {};
function cdp(method, params = {}) {
  const id = ++serial;
  return new Promise((resolveCall, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`CDP timeout: ${method}`)); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolveCall(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const response = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
  return response.result.value;
}
async function until(expression, description) {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) { if (await evaluate(expression)) return; await delay(70); }
  throw new Error(`Browser wait failed: ${description}\n${await evaluate('document.body.innerText')}`);
}
async function click(label, scope = '.page') {
  await until(`(()=>{const s=document.querySelector(${JSON.stringify(scope)});return s&&[...s.querySelectorAll('button')].some(x=>x.textContent.trim()===${JSON.stringify(label)}&&!x.matches(':disabled'));})()`, `button: ${label}`);
  await evaluate(`window.uiClick(${JSON.stringify(label)},${JSON.stringify(scope)})`);
}
async function edit(label, value, scope = '.page') {
  await until(`(()=>{const s=document.querySelector(${JSON.stringify(scope)});const el=s&&window.uiLabel(${JSON.stringify(label)},s)?.querySelector('input,select,textarea');return el&&!el.matches(':disabled')&&(!(el instanceof HTMLSelectElement)||[...el.options].some(x=>x.value===${JSON.stringify(value)}));})()`, `field: ${label}`);
  await evaluate(`window.uiEdit(${JSON.stringify(label)},${JSON.stringify(value)},${JSON.stringify(scope)})`);
}
const text = value => until(`document.body.innerText.includes(${JSON.stringify(value)})`, value);
async function upload(selector, filename) {
  const document = await cdp('DOM.getDocument');
  const node = await cdp('DOM.querySelector', { nodeId: document.root.nodeId, selector });
  assert.ok(node.nodeId, selector);
  await cdp('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [filename] }); await delay(70);
}
try {
  await pool.query(`CREATE SCHEMA ${schema}`); created = true;
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  for (const name of (await readdir('database/migrations')).filter(name => name.endsWith('.sql')).sort()) await pool.query(await readFile(resolve('database/migrations', name), 'utf8'));
  const api = createApp(), app = express(), web = resolve('apps/web/dist');
  app.use(express.static(web));
  app.use((req, res, next) => req.path.startsWith('/api/') ? api(req, res, next) : res.sendFile(resolve(web, 'index.html')));
  server = app.listen(0, '127.0.0.1'); await new Promise(done => server.once('listening', done));
  const origin = `http://127.0.0.1:${server.address().port}`;
  browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-component-update',
    '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'
  ], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { port = Number((await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break; } catch {}
    await delay(100);
  }
  assert.ok(port, 'Edge DevTools did not start.');
  const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(page.webSocketDebuggerUrl);
  socket.addEventListener('message', event => {
    const response = JSON.parse(String(event.data));
    if (pending.has(response.id)) { const call = pending.get(response.id); pending.delete(response.id); response.error ? call.reject(new Error(JSON.stringify(response.error))) : call.resolve(response.result); }
    if (response.method === 'Runtime.exceptionThrown') browserErrors.push(response.params.exceptionDetails);
  });
  await new Promise((done, reject) => { socket.addEventListener('open', done, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  await cdp('Network.setBlockedURLs', { urls: ['https://*'] });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.uiLabel=(name,scope)=>[...scope.querySelectorAll('label')].find(x=>[...x.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()===name);
    window.uiClick=async(text,selector='.page')=>{const el=[...document.querySelector(selector).querySelectorAll('button')].find(x=>x.textContent.trim()===text);if(!el||el.matches(':disabled'))throw Error('Unavailable button: '+text);el.scrollIntoView({block:'center'});el.click();await new Promise(r=>setTimeout(r,30));};
    window.uiEdit=async(name,value,selector='.page')=>{const el=window.uiLabel(name,document.querySelector(selector))?.querySelector('input,select,textarea');if(!el)throw Error('Missing field: '+name);el.closest('details')?.setAttribute('open','');el.scrollIntoView({block:'center'});const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));await new Promise(r=>setTimeout(r,30));};
  ` });

  for (const task of ['rnf', 'tests']) {
    const settings = await json(resolve(pack, `participant/${task}/settings.json`));
    const target = await json(resolve(pack, `participant/${task}/target.json`));
    const records = await json(resolve(pack, `participant/${task}/dataset.json`));
    await cdp('Page.navigate', { url: `${origin}/recommender-setup` }); await text('Configure and import datasets');
    assert.equal(await evaluate('document.documentElement.lang'), 'en');
    if (task === 'tests') {
      await click('Test catalogs');
      await upload('[aria-label="Test catalog editor"] input[type=file]', resolve(pack, 'participant/tests/catalog.json'));
      await click('Review catalog file'); await text('Reviewed file SHA-256');
      await edit('Catalog use declaration', settings.source.authorization.reference);
      await click('Publish reviewed catalog'); await text('Catalog published with its original file');
    }
    await click('Taxonomies'); await click('New taxonomy');
    const scope = '[aria-label="Taxonomy editor"]', taxonomy = settings.taxonomy;
    for (const [label, value] of [['ID', taxonomy.id], ['Version', taxonomy.version], ['Name', taxonomy.name], ['Taxonomy source', taxonomy.source], ['Structure', taxonomy.kind], ['Selectable nodes', taxonomy.selection]]) await edit(label, value, scope);
    for (const [index, node] of taxonomy.nodes.entries()) {
      if (index) await click('Add node');
      await evaluate(`document.querySelectorAll('${scope} fieldset.configured-subeditor')[${index}].id='task-node'`);
      for (const [label, value] of [['Node ID', node.id], ['Node name', node.name], ['Node description', node.description], ['Parent ID (empty for root)', node.parentId ?? '']]) await edit(label, value, '#task-node');
      await evaluate(`document.querySelector('#task-node').removeAttribute('id')`);
    }
    await click('Save taxonomy draft'); await text('Draft saved. Review the nodes'); await click('Publish reviewed taxonomy'); await text('Taxonomy published with immutable content');
    await cdp('Page.navigate', { url: `${origin}/recommender-setup` }); await text('Configure and import datasets');
    await click('Definitions'); await click(task === 'rnf' ? 'New NFR from template' : 'New test-case demonstration');
    const defScope = '[aria-label="Definition editor"]';
    await edit('ID', settings.definitionId, defScope); await edit('Version', settings.version, defScope);
    if (task === 'rnf') {
      await click('Add attribute');
      await evaluate(`{const field=[...document.querySelectorAll('${defScope} details.configured-subeditor')].at(-1);field.open=true;field.id='task-attribute';}`);
      const a = settings.additionalAttribute;
      for (const [label, value] of [['Attribute ID', a.id], ['Attribute name', a.name], ['Type', a.valueType.type], ['Escopo', a.scope], ['Cardinalidade', a.cardinality], ['Obrigatoriedade', String(a.required)], ['Papel', a.role], ['Representation', a.representation]]) await edit(label, value, '#task-attribute');
    } else {
      await evaluate(`{const field=[...document.querySelectorAll('${defScope} details.configured-subeditor')].find(x=>x.querySelector('summary')?.textContent.includes(${JSON.stringify(settings.attributeId)}));field.open=true;field.id='task-attribute';}`);
      await edit('Type', settings.attributeType, '#task-attribute');
    }
    await edit('Published taxonomy', JSON.stringify([taxonomy.id, taxonomy.version]), '#task-attribute');
    await click('Save definition draft'); await text('Draft saved. Review the configuration'); await click('Publish reviewed definition'); await text('Definition published with immutable dependencies');
    await click('Import dataset'); await edit('Import definition', JSON.stringify([settings.definitionId, settings.version])); await click('Load dataset schema');
    if (task === 'tests') await edit('Catalog and version', JSON.stringify([settings.catalogId, '1']));
    for (const [label, value] of [['Dataset ID', settings.datasetId], ['Dataset version', settings.version], ['Source description', settings.source.description], ['Use declaration', settings.source.authorization.basis], ['Authorization reference', settings.source.authorization.reference]]) await edit(label, value);
    await click('Use US-Agent record mapping');
    await upload('[aria-label="Dataset import"] input[type=file]', resolve(pack, `participant/${task}/dataset.json`));
    await click('Generate import preview'); await text(task === 'tests' ? 'Catalog preserved in preview' : 'Preserved preview');
    await click('Publish reviewed dataset'); await text('Dataset published. The version and selection were preserved'); await click('Go to runs'); await text('Run with a published dataset');
    await edit('Definition and version', JSON.stringify([settings.definitionId, settings.version]));
    await edit('Dataset and version', JSON.stringify([settings.datasetId, settings.version]));
    if (task === 'tests') await edit('Catalog and version', JSON.stringify([settings.catalogId, '1']));
    await edit('Input identifier', target.id); await edit('Input source', target.provenance.source);
    await evaluate(`(async()=>{const values=${JSON.stringify(target.values)},attributes=${JSON.stringify(oracle[task].definition.attributes)};
      for(const a of attributes.filter(x=>x.role!=='output')){const section=[...document.querySelectorAll('.configured-attribute')].find(x=>x.querySelector('legend')?.textContent===a.name||window.uiLabel(a.name,x));if(!section)throw Error('Missing attribute '+a.id);section.id='task-field';
        if(a.cardinality==='many'){for(const [index,item] of values[a.id].entries()){await window.uiClick('Add '+a.name,'#task-field');const row=section.querySelectorAll('.configured-list-item')[index];row.id='task-row';if(a.valueType.type==='record'){for(const [key,value] of Object.entries(item))await window.uiEdit(key,String(value),'#task-row');}else await window.uiEdit(a.name+' '+(index+1),String(item),'#task-row');row.removeAttribute('id');}}
        else await window.uiEdit(a.name,String(values[a.id]),'#task-field');section.removeAttribute('id');}
    })()`);
    if (task === 'rnf') await edit('Module/operation pair for this run', String(settings.labelIndex));
    await click('Run recommendation'); await text(task === 'rnf' ? 'Assess suggestions' : 'Test suggestions found');
    const runId = await evaluate(`new URL(location.href).searchParams.get('runId')`);
    const stored = (await pool.query('SELECT content, content_sha256 FROM recommender_runs WHERE id=$1', [runId])).rows[0];
    assert.ok(stored, 'Run persisted');
    assert.equal(snapshotContent(stored.content).sha256, stored.content_sha256);
    assert.deepEqual(stored.content.definition, oracle[task].definitionSnapshot, `${task}: exact configured definition`);
    assert.deepEqual(stored.content.result, oracle[task].result, `${task}: exact offline result`);
    const dataset = stored.content.dataset.content;
    assert.deepEqual(dataset.records.map(({ id, values }) => ({ id, values })), records.map(({ id, values }) => ({ id, values })), `${task}: original record IDs, values and order`);
    assert.equal(dataset.import.fileSha256, sha(await readFile(resolve(pack, `participant/${task}/dataset.json`))));
    assert.deepEqual(dataset.source, settings.source, `${task}: declared dataset provenance`);
    for (const record of dataset.records) assert.deepEqual(record.provenance, { source: `import:${dataset.import.fileSha256}`, sourceRecordId: record.id });
    assert.deepEqual(stored.content.request.content.input, target, `${task}: exact target with answers withheld`);
    assert.deepEqual(stored.content.dataset.content.selection.excludedOrdinals, []);
    assert.equal(stored.content.dataset.content.records.length, oracle[task].expectedValidRows);
    await cdp('Page.reload'); await text('Run history');
    await until(`!!document.querySelector(${JSON.stringify(`[aria-label="Open run ${runId}"]`)})`, 'run listed in history');
    await click('Verify replay'); await text('Replay verified');
    await evaluate(`window.uiSavedBlob=null;URL.createObjectURL=blob=>{window.uiSavedBlob=blob;return 'blob:technical-download';};HTMLAnchorElement.prototype.click=function(){};`);
    await click('Download JSON evidence');
    const download = await evaluate(`(async()=>JSON.parse(await window.uiSavedBlob.text()))()`);
    assert.deepEqual(download.snapshot, snapshotContent(stored.content));
    await writeFile(resolve(artifacts, `${task}-run.json`), JSON.stringify(download, null, 2) + '\n');
    const capture = await cdp('Page.captureScreenshot', { format: 'png' });
    await writeFile(resolve(artifacts, `${task}.png`), Buffer.from(capture.data, 'base64'));
    runs[task] = { id: runId, sha256: stored.content_sha256, definitionSha256: stored.content.definition.sha256, datasetSha256: stored.content.dataset.sha256, resultSha256: stored.content.result.sha256, records: records.length, replayVerified: true, exportMatched: true };
  }
  for (const table of ['projects', 'classifications', 'recommender_run_targets', 'recommender_item_decisions', 'test_case_item_decisions', 'test_case_adapted_copies']) assert.equal((await pool.query(`SELECT count(*)::int AS n FROM ${table}`)).rows[0].n, 0, `No unrelated task activity: ${table}`);
  assert.deepEqual(browserErrors, []);
  const sources = {};
  for (const name of ['scripts/check-configuration-tasks-browser.mjs', 'docs/evidencias/b18c/manifest.json', 'apps/web/src/components/RecommenderEditors.tsx', 'apps/web/src/pages/RecommenderSetupPage.tsx', 'apps/web/src/pages/ConfiguredRecommendationsPage.tsx']) sources[name] = sha(await readFile(name));
  const summary = { schemaVersion: 1, kind: 'automated_browser_verification', participantStudyPerformed: false, empiricalClaim: false,
    softwareRevision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), interfaceLanguage: 'en', browser: await cdp('Browser.getVersion'),
    namespace: oracle.namespace, runs, sources, browserExceptions: browserErrors.length,
    verified: ['manual-settings-through-controls', 'exact-published-definitions', 'one-and-four-records-no-exclusion', 'target-values-and-provenance', 'exact-offline-results', 'history-reload', 'replay', 'complete-evidence-download', 'no-operational-story-or-assessment'],
    limits: ['automated_technical_check_not_a_human_attempt', 'not_a_scientific_article_reproduction', 'no_configuration_effort_measurement', 'final_protocol_and_instrument_binding_still_pending'] };
  await writeFile(resolve(artifacts, 'summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(`Configuration task browser workflows verified. Evidence: ${artifacts}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await cdp('Browser.close').catch(() => {}); socket.close(); }
  for (const call of pending.values()) call.reject(new Error('Browser closed')); pending.clear();
  if (browser && browser.exitCode === null) browser.kill();
  if (server) { server.closeAllConnections(); await new Promise(done => server.close(done)); }
  if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
}
