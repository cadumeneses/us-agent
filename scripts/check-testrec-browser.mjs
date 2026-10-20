// Real Edge + built web + HTTP API + disposable LOCAL PostgreSQL schema. No external providers.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';

const schema = `testrec_browser_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^testrec_browser_[a-f0-9]{32}$/);
process.env.DATABASE_URL = `postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
process.env.DATABASE_POOL_MAX = '5';
for (const key of ['DATABASE_SSL', 'VERCEL', 'INGEST_API_KEY']) delete process.env[key];
const { pool } = await import('../apps/api/dist/database/pool.js');
const { createApp } = await import('../apps/api/dist/app.js');
const { snapshotContent } = await import('../apps/api/dist/domain/content-snapshot.js');
const template = JSON.parse(await readFile(new URL('../config/recommenders/testrec-equations.draft.json', import.meta.url), 'utf8'));
const source = JSON.parse(await readFile(new URL('../research/examples/testrec-e21/equations-synthetic.json', import.meta.url), 'utf8'));
const artifacts = resolve('tmp', schema), profile = resolve(artifacts, 'edge-profile');
await mkdir(artifacts, { recursive: true });
let server, browser, socket, created = false;
const pending = new Map(); let serial = 0; const browserErrors = [];
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
async function click(text, scope = '.page') {
  await until(`(()=>{const scope=document.querySelector(${JSON.stringify(scope)});return scope&&[...scope.querySelectorAll('button')].some(x=>x.textContent.trim()===${JSON.stringify(text)}&&!x.matches(':disabled'));})()`, `enabled button: ${text}`);
  return evaluate(`window.uiClick(${JSON.stringify(text)}, ${JSON.stringify(scope)})`);
}
async function edit(label, value, scope = '.page') {
  // Section headings render before asynchronous review/catalog requests finish.
  // Wait for the actual enabled control and (for a select) the requested option.
  await until(`(()=>{const scope=document.querySelector(${JSON.stringify(scope)});if(!scope)return false;const el=window.uiLabel(${JSON.stringify(label)},scope)?.querySelector('input,select,textarea');return el&&!el.matches(':disabled')&&(!(el instanceof HTMLSelectElement)||[...el.options].some(x=>x.value===${JSON.stringify(value)}));})()`, `ready field: ${label}`);
  return evaluate(`window.uiEdit(${JSON.stringify(label)}, ${JSON.stringify(value)}, ${JSON.stringify(scope)})`);
}
const text = value => until(`document.body.innerText.includes(${JSON.stringify(value)})`, value);
try {
  await pool.query(`CREATE SCHEMA ${schema}`); created = true;
  assert.equal((await pool.query('SELECT current_schema() AS name')).rows[0].name, schema);
  for (const file of (await readdir(new URL('../database/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) await pool.query(await readFile(new URL(`../database/migrations/${file}`, import.meta.url), 'utf8'));
  const apiApp = createApp(), app = express(), web = resolve('apps/web/dist');
  app.use(express.static(web));
  app.use((req, res, next) => req.path.startsWith('/api/') ? apiApp(req, res, next) : res.sendFile(resolve(web, 'index.html')));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolveCall => server.once('listening', resolveCall));
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
    if (response.id && pending.has(response.id)) { const call = pending.get(response.id); pending.delete(response.id); response.error ? call.reject(new Error(JSON.stringify(response.error))) : call.resolve(response.result); }
    if (response.method === 'Runtime.exceptionThrown') browserErrors.push(response.params.exceptionDetails);
  });
  await new Promise((resolveCall, reject) => { socket.addEventListener('open', resolveCall, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  // Fonts use the local CSS fallback; no external HTTPS requests are made by the page.
  await cdp('Network.setBlockedURLs', { urls: ['https://*'] });
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: `
    window.uiLabel=(name,scope)=>[...scope.querySelectorAll('label')].find(x=>[...x.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()===name);
    window.uiClick=async(text,selector='.page')=>{const scope=document.querySelector(selector);const el=[...scope.querySelectorAll('button')].find(x=>x.textContent.trim()===text);if(!el||el.matches(':disabled'))throw Error('Unavailable button: '+text);el.scrollIntoView({block:'center'});el.click();await new Promise(r=>setTimeout(r,30));};
    window.uiEdit=async(name,value,selector='.page')=>{const label=window.uiLabel(name,document.querySelector(selector));if(!label)throw Error('Missing field: '+name);const el=label.querySelector('input,select,textarea');el.closest('details')?.setAttribute('open','');el.scrollIntoView({block:'center'});const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,value);el.dispatchEvent(new Event(el instanceof HTMLSelectElement?'change':'input',{bubbles:true}));await new Promise(r=>setTimeout(r,30));};
  ` });
  async function upload(selector, filename) {
    const document = await cdp('DOM.getDocument'); const node = await cdp('DOM.querySelector', { nodeId: document.root.nodeId, selector });
    assert.ok(node.nodeId, selector); await cdp('DOM.setFileInputFiles', { nodeId: node.nodeId, files: [filename] }); await delay(70);
  }
  const catalogSource = JSON.parse(await readFile(new URL('../research/examples/testrec-e21/synthetic-catalog.json', import.meta.url), 'utf8'));
  const catalogFile = resolve(artifacts, 'synthetic-catalog.json');
  const catalogBytes = Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from(JSON.stringify(catalogSource, null, 2).replaceAll('\n', '\r\n'))]);
  await writeFile(catalogFile, catalogBytes);
  await cdp('Page.navigate', { url: `${origin}/recommender-setup` }); await text('Configure and import datasets');
  await click('Test catalogs');
  await upload('[aria-label="Test catalog editor"] input[type=file]', catalogFile);
  await click('Review catalog file'); await text('Reviewed file SHA-256');
  await edit('Catalog use declaration', 'US-Agent synthetic browser fixture; not original author cases');
  await click('Publish reviewed catalog'); await text('Catalog published with its original file');
  const storedCatalog = (await pool.query('SELECT original_file, content_sha256 FROM test_case_catalog_versions')).rows[0];
  assert.deepEqual(storedCatalog.original_file, catalogBytes);
  // Independent acceptance-criteria taxonomy, with IDs preserved in the imported data.
  await click('Taxonomies'); await click('New taxonomy'); const taxScope = '[aria-label="Taxonomy editor"]';
  for (const [label, value] of [['ID', 'browser-criteria'], ['Version', '1'], ['Name', 'Acceptance criteria demo'], ['Taxonomy source', 'Synthetic browser fixture'], ['Node ID', 'required'], ['Node name', 'Required fields']]) await edit(label, value, taxScope);
  await click('Add node');
  await evaluate(`{const fields=[...document.querySelectorAll('${taxScope} fieldset.configured-subeditor')];fields.at(-1).id='second-node';}`);
  await edit('Node ID', 'unique', '#second-node'); await edit('Node name', 'Unique values', '#second-node');
  await click('Save taxonomy draft'); await text('Draft saved. Review the nodes'); await click('Publish reviewed taxonomy'); await text('Taxonomy published with immutable content');
  await cdp('Page.navigate', { url: `${origin}/recommender-setup` }); await text('Configure and import datasets');
  await click('Definitions'); await click('New test-case demonstration'); const defScope = '[aria-label="Definition editor"]';
  await edit('ID', 'browser-tests', defScope); await edit('Version', '1', defScope);
  await evaluate(`{const field=[...document.querySelectorAll('${defScope} details.configured-subeditor')].find(x=>x.querySelector('summary')?.textContent.includes('acceptance_criteria'));field.open=true;field.id='criteria-attribute';}`);
  await edit('Type', 'taxonomy_node', '#criteria-attribute'); await edit('Published taxonomy', JSON.stringify(['browser-criteria', '1']), '#criteria-attribute');
  await click('Save definition draft'); await text('Draft saved. Review the configuration'); await click('Publish reviewed definition'); await text('Definition published with immutable dependencies');
  const catalogKey = JSON.stringify([catalogSource.id, catalogSource.version]);
  const importFile = resolve(artifacts, 'synthetic-profiles.json'); await writeFile(importFile, JSON.stringify(source.dataset.records));
  await click('Import dataset'); await edit('Import definition', JSON.stringify(['browser-tests', '1'])); await click('Load dataset schema');
  await edit('Catalog and version', catalogKey);
  for (const [label, value] of [['Dataset ID', 'browser-test-base'], ['Dataset version', '1'], ['Source description', 'Synthetic browser profiles'], ['Use declaration', 'synthetic'], ['Authorization reference', 'Authored profiles; not original thesis data']]) await edit(label, value);
  await click('Use US-Agent record mapping');
  await upload('[aria-label="Dataset import"] input[type=file]', importFile);
  await click('Generate import preview'); await text('Catalog preserved in preview'); await text('1 invalid');
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent==='Publish reviewed dataset').disabled`), true);
  await evaluate(`document.querySelector('[aria-label="Exclude record 5"]').click()`);
  await click('Publish reviewed dataset'); await text('Dataset published. The version and selection were preserved');
  await click('Go to runs'); await text('Run with a published dataset');
  await edit('Definition and version', JSON.stringify(['browser-tests', '1'])); await text('Test answers are withheld');
  await edit('Dataset and version', JSON.stringify(['browser-test-base', '1']));
  assert.equal(await evaluate(`document.querySelector('button[type=submit]').disabled`), true);
  await edit('Catalog and version', catalogKey); await edit('Input identifier', source.target.id); await edit('Input source', source.target.provenance.source);
  assert.equal(await evaluate(`[...document.querySelectorAll('label')].some(x=>x.textContent.includes('Module/operation pair for this run'))`), false);
  await evaluate(`(async()=>{const values=${JSON.stringify(source.target.values)},attributes=${JSON.stringify(template.attributes)};
    for(const a of attributes.filter(x=>x.role!=='output')){const section=[...document.querySelectorAll('.configured-attribute')].find(x=>x.querySelector('legend')?.textContent===a.name||window.uiLabel(a.name,x));section.id='browser-field';
      if(a.cardinality==='many'){for(const [index,item] of values[a.id].entries()){await window.uiClick('Add '+a.name,'#browser-field');const row=section.querySelectorAll('.configured-list-item')[index];row.id='browser-row';await window.uiEdit(a.name+' '+(index+1),String(item),'#browser-row');row.removeAttribute('id');}}
      else await window.uiEdit(a.name,String(values[a.id]),'#browser-field');section.removeAttribute('id');}
  })()`);
  await click('Run recommendation'); await text('Test suggestions found'); await text('Q01/Q02 remain open');
  await text(catalogSource.items[0].gherkin); await text('0.9166666666666666');
  const runId = await evaluate(`new URL(location.href).searchParams.get('runId')`);
  const stored = (await pool.query('SELECT content, content_sha256 FROM recommender_runs WHERE id=$1', [runId])).rows[0];
  assert.equal(snapshotContent(stored.content).sha256, stored.content_sha256);
  assert.equal(stored.content.schemaVersion, 2); assert.equal(stored.content.catalog.sha256, storedCatalog.content_sha256);
  assert.equal(stored.content.definition.content.taxonomies.length, 1);
  assert.deepEqual(stored.content.result.content.neighbors.map(row => row.recordId), source.expected.neighborIds);
  assert.deepEqual(stored.content.request.content.input.values, source.target.values);
  assert.equal('selection' in stored.content.request.content, false);
  for (const item of stored.content.result.content.items) { assert.equal(item.score, source.expected.scores[item.testCaseId]); assert.deepEqual(item.artifact, catalogSource.items.find(row => row.id === item.testCaseId)); }
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM recommender_run_targets')).rows[0].n, 0);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM recommender_item_decisions')).rows[0].n, 0);
  // Capture the complete evidence download and verify it is exactly the preserved run.
  await evaluate(`window.uiSavedBlob=null;URL.createObjectURL=blob=>{window.uiSavedBlob=blob;return 'blob:synthetic-download';};HTMLAnchorElement.prototype.click=function(){};`);
  await click('Download JSON evidence');
  assert.deepEqual(await evaluate(`(async()=>JSON.parse(await window.uiSavedBlob.text()).snapshot.content)()`), stored.content);
  // Human assessment and copies are separate from the raw ranking and original artifacts.
  await click('Confirm preserved input as test destination'); await text('Confirmed destination');
  await evaluate(`document.querySelector('[aria-label="Assess test demo-create"]').id='accepted-test';document.querySelector('[aria-label="Assess test demo-required"]').id='rejected-test';`);
  await edit('Assessment notes', 'Relevant synthetic test for this preserved input', '#accepted-test');
  await click('Accept test', '#accepted-test'); await text('Accepted for the preserved input');
  await click('Reject test', '#rejected-test'); await text('Rejected. No adapted copy is created');
  await click('Copy or adapt accepted test', '#accepted-test');
  await edit('Copy title', 'Adapted synthetic target check', '#accepted-test'); await edit('Copy reason', 'Manual adaptation for the preserved input', '#accepted-test');
  await click('Save immutable copy revision', '#accepted-test'); await text('Copy revision 1');
  await click('New copy revision', '#accepted-test');
  await edit('Copy Gherkin', catalogSource.items[0].gherkin + '\nE verifico o alvo sintético', '#accepted-test'); await edit('Copy reason', 'Second explicit Gherkin revision', '#accepted-test');
  await click('Save immutable copy revision', '#accepted-test'); await text('Copy revision 2');
  const savedCopies = (await pool.query('SELECT content, content_sha256 FROM test_case_adapted_copies ORDER BY revision')).rows;
  assert.equal(savedCopies.length, 2); assert.equal(savedCopies[1].content.previous.sha256, savedCopies[0].content_sha256);
  assert.deepEqual(savedCopies[1].content.originalItem.content.artifact, catalogSource.items[0]);
  assert.equal((await pool.query('SELECT content_sha256 FROM recommender_runs WHERE id=$1', [runId])).rows[0].content_sha256, stored.content_sha256);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM test_case_item_decisions')).rows[0].n, 2);
  await click('Download this assessment page', '#accepted-test');
  const assessmentExport = await evaluate(`(async()=>JSON.parse(await window.uiSavedBlob.text()))()`);
  assert.equal(assessmentExport.assessment.copies.length, 2); assert.deepEqual(assessmentExport.run.snapshot.content, stored.content);
  // Retire through the API, reload the UI and replay without active dependencies.
  for (const [resource, id] of [['test-case-catalogs', catalogSource.id], ['recommender-datasets', 'browser-test-base'], ['recommender-definitions', 'browser-tests']]) {
    const response = await fetch(`${origin}/api/internal/${resource}/${id}/versions/1/retire`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); assert.equal(response.status, 200);
  }
  await cdp('Page.reload'); await text('Test suggestions found'); await click('Verify replay'); await text('Replay verified');
  await text('Copy revision 2'); await text('Accepted for the preserved input'); await text('Rejected. No adapted copy is created');
  const observations = {};
  for (const [name, width, height, mobile] of [['desktop', 1440, 1100, false], ['mobile', 390, 1000, true]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await evaluate(`document.querySelector('[aria-label="Run result"]').scrollIntoView({block:'start'});window.scrollBy(0,-82)`); await delay(100);
    observations[name] = await evaluate(`({width:innerWidth,documentWidth:document.documentElement.scrollWidth,unlabelledControls:[...document.querySelectorAll('input,select,textarea')].filter(x=>x.getClientRects().length&&!x.matches(':disabled')&&!x.labels?.length&&!x.getAttribute('aria-label')).length})`);
    assert.equal(observations[name].width, width); assert.ok(observations[name].documentWidth <= width, name + ': horizontal overflow'); assert.equal(observations[name].unlabelledControls, 0);
    const capture = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(resolve(artifacts, `${name}.png`), Buffer.from(capture.data, 'base64'));
    await evaluate(`document.querySelector('.test-case-item details').open=true;document.querySelector('.test-case-item').scrollIntoView({block:'start'});window.scrollBy(0,-82)`); await delay(100);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, name + ': expanded artifact overflow');
    const artifactCapture = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(resolve(artifacts, `${name}-artifact.png`), Buffer.from(artifactCapture.data, 'base64'));
    await evaluate(`document.querySelector('[aria-label="Test assessment"]').scrollIntoView({block:'start'});window.scrollBy(0,-82)`); await delay(100);
    assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true, name + ': assessment overflow');
    const assessmentCapture = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(resolve(artifacts, `${name}-assessment.png`), Buffer.from(assessmentCapture.data, 'base64'));
  }
  assert.deepEqual(browserErrors, []);
  const summary = { schemaVersion: 1, browser: await cdp('Browser.getVersion'), runId, rawRunSha256: stored.content_sha256,
    observations, verified: ['catalog-review-publication-original-bytes', 'independent-criteria-taxonomy', 'test-definition-template', 'catalog-bound-import', 'explicit-exclusion',
      'explicit-dataset-catalog', 'target-output-withheld', 'three-neighbors-contributions-artifacts', 'no-rnf-assessment', 'evidence-download', 'input-destination-accept-reject',
      'adapted-copy-revisions-original-preserved', 'assessment-evidence-download', 'retired-history-assessment-replay'],
    scope: 'Synthetic E21 Manhattan equation demonstration; not original Euclidean reproduction or empirical accuracy.' };
  await writeFile(resolve(artifacts, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`Test-case browser workflow verified. Evidence: ${artifacts}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await cdp('Browser.close').catch(() => {}); socket.close(); }
  for (const call of pending.values()) call.reject(new Error('Browser closed')); pending.clear();
  if (browser && browser.exitCode === null) browser.kill();
  if (server) { server.closeAllConnections(); await new Promise(resolveCall => server.close(resolveCall)); }
  if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
}
