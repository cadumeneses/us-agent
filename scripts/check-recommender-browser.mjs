// Real Edge + built web + HTTP API + disposable LOCAL PostgreSQL schema. No external providers.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';

const schema = `browser_check_${randomUUID().replaceAll('-', '')}`;
assert.match(schema, /^browser_check_[a-f0-9]{32}$/);
process.env.DATABASE_URL = `postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent?options=${encodeURIComponent(`-c search_path=${schema}`)}`;
process.env.DATABASE_POOL_MAX = '5';
for (const key of ['DATABASE_SSL', 'VERCEL', 'INGEST_API_KEY']) delete process.env[key];
const { pool } = await import('../apps/api/dist/database/pool.js');
const { createApp } = await import('../apps/api/dist/app.js');
const { legacyNfrInput } = await import('../apps/api/dist/services/configured-nfr.js');
const { snapshotContent } = await import('../apps/api/dist/domain/content-snapshot.js');
const template = JSON.parse(await readFile(new URL('../config/recommenders/rnf-v2.draft.json', import.meta.url), 'utf8'));
const baseline = JSON.parse(await readFile(new URL('../research/baselines/rnf-v2/reference.json', import.meta.url), 'utf8'));
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
  for (const file of (await readdir(new URL('../database/migrations/', import.meta.url))).filter(file => file.endsWith('.sql')).sort()) await pool.query(await readFile(new URL(`../database/migrations/${file}`, import.meta.url), 'utf8'));
  const { rows: [project] } = await pool.query('INSERT INTO projects (name) VALUES ($1) RETURNING id', [baseline.profiles.fa.project]);
  const { rows: [sprint] } = await pool.query("INSERT INTO project_sprints (project_id, name) VALUES ($1, 'Backlog') RETURNING id", [project.id]);
  const { rows: [story] } = await pool.query("INSERT INTO stories (project_id, sprint_id, external_id, content) VALUES ($1,$2,'UI-1',$3) RETURNING id", [project.id, sprint.id, baseline.profiles.fa.text]);
  const { rows: [classification] } = await pool.query("INSERT INTO classifications (story_id, review_status) VALUES ($1,'reviewed') RETURNING id::text", [story.id]);
  await pool.query("INSERT INTO classification_labels (classification_id, module, operation) VALUES ($1,'Registry','Retrieve data')", [classification.id]);
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
  await cdp('Page.navigate', { url: `${origin}/recommender-setup` }); await text('Configure and import datasets');
  await click('Independent taxonomies'); await click('New taxonomy'); const taxScope = '[aria-label="Taxonomy editor"]';
  for (const [label, value] of [['ID', 'browser-context'], ['Version', '1'], ['Name', 'Context do piloto'], ['Taxonomy source', 'Synthetic browser verification'], ['Node ID', 'demo'], ['Node name', 'Demonstração']]) await edit(label, value, taxScope);
  await click('Save taxonomy draft'); await text('Draft saved. Review the nodes'); await click('Publish reviewed taxonomy'); await text('Taxonomy published with immutable content');
  await click('Definitions'); await click('New NFR from template'); const defScope = '[aria-label="Definition editor"]';
  await edit('ID', 'browser-rnf', defScope); await edit('Version', '1', defScope); await click('Add attribute');
  await evaluate(`{const el=[...document.querySelectorAll('${defScope} details')].find(x=>x.querySelector('summary')?.textContent.startsWith('Attribute 19'));el.id='browser-new-attribute';el.open=true;}`);
  for (const [label, value] of [['Attribute ID', 'pilot_context'], ['Attribute name', 'Context publicado'], ['Type', 'taxonomy_node'], ['Published taxonomy', JSON.stringify(['browser-context', '1'])]]) await edit(label, value, '#browser-new-attribute');
  await click('Save definition draft'); await text('Draft saved. Review the configuration'); await click('Publish reviewed definition'); await text('Definition published with immutable dependencies');
  const draft = { ...structuredClone(template), id: 'browser-rnf', version: '1' };
  const input = legacyNfrInput(draft, baseline.profiles.fa, 'browser-input', 'Manual input'); input.values.pilot_context = 'demo';
  const history = legacyNfrInput(draft, baseline.profiles.f4, 'f4', 'browser fixture'); history.values.pilot_context = 'demo';
  history.values.nfrs.push({ type: 'Security', attribute: 'access_control', sentence: 'Second synthetic browser suggestion.' });
  const importFile = resolve(artifacts, 'synthetic-base.json'); await writeFile(importFile, JSON.stringify([history]));
  await click('Import dataset'); await edit('Import definition', JSON.stringify(['browser-rnf', '1'])); await click('Load dataset schema'); await text('Import definition');
  for (const [label, value] of [['Dataset ID', 'browser-base'], ['Dataset version', '1'], ['Source description', 'Synthetic browser validation'], ['Use declaration', 'synthetic'], ['Authorization reference', 'Reconstructed demonstration; not an original author dataset']]) await edit(label, value);
  await click('Use US-Agent record mapping');
  const document = await cdp('DOM.getDocument'); const fileNode = await cdp('DOM.querySelector', { nodeId: document.root.nodeId, selector: 'input[type=file]' });
  await cdp('DOM.setFileInputFiles', { nodeId: fileNode.nodeId, files: [importFile] }); await delay(100); await click('Generate import preview'); await text('Preserved preview');
  await click('Publish reviewed dataset'); await text('Dataset published. The version and selection were preserved'); await click('Go to runs');
  await text('Run with a published dataset'); await edit('Definition and version', JSON.stringify(['browser-rnf', '1'])); await text('3. Input and execution');
  await edit('Dataset and version', JSON.stringify(['browser-base', '1'])); await edit('Input identifier', input.id);
  // Drive each generated input through the real form controls.
  await evaluate(`(async()=>{const values=${JSON.stringify(input.values)},attributes=${JSON.stringify(template.attributes)};
    for(const a of attributes){const section=[...document.querySelectorAll('.configured-attribute')].find(x=>x.querySelector('legend')?.textContent===a.name||window.uiLabel(a.name,x));section.id='browser-field';
      if(a.cardinality==='many'){for(const [index,item] of values[a.id].entries()){await window.uiClick('Add '+a.name,'#browser-field');const row=section.querySelectorAll('.configured-list-item')[index];row.id='browser-row';if(a.valueType.type==='record'){for(const [key,value] of Object.entries(item))await window.uiEdit(key,String(value),'#browser-row');}else await window.uiEdit(a.name+' '+(index+1),String(item),'#browser-row');row.removeAttribute('id');}}
      else await window.uiEdit(a.name,String(values[a.id]),'#browser-field');section.removeAttribute('id');}
    const label=[...document.querySelectorAll('label')].find(x=>x.textContent.includes('Enter Context publicado'));label.querySelector('input').click();await new Promise(r=>setTimeout(r,30));await window.uiEdit('Context publicado','demo');
  })()`);
  await edit('Module/operation pair for this run', '0'); await click('Run recommendation'); await text('Assess suggestions');
  await edit('Link suggestions to', 'classification'); await edit('Destination story', classification.id); await click('Review destination story');
  await text('Reason for linking'); await edit('Reason for linking to this story', 'Synthetic input manually matched to this operational story.'); await click('Confirm reviewed destination'); await text('Confirmed destination');
  await evaluate(`document.querySelectorAll('.nfr-item')[0].id='browser-first-item';document.querySelectorAll('.nfr-item')[1].id='browser-second-item'`);
  await click('Accept and link', '#browser-first-item'); await text('The link to the story was confirmed'); await click('Reject', '#browser-second-item'); await text('Rejected. This decision created no link');
  const runId = await evaluate(`new URL(location.href).searchParams.get('runId')`);
  const stored = (await pool.query('SELECT content, content_sha256 FROM recommender_runs WHERE id=$1', [runId])).rows[0];
  assert.equal(snapshotContent(stored.content).sha256, stored.content_sha256);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM story_non_functional_requirements')).rows[0].n, 1);
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM recommender_item_decisions')).rows[0].n, 2);
  await cdp('Page.reload'); await text('Accepted. The link'); await text('Rejected. This decision created no link'); await click('Verify replay'); await text('Replay verified');
  const observations = {};
  for (const [name, width, height, mobile] of [['desktop', 1440, 1100, false], ['mobile', 390, 1000, true]]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await evaluate(`document.querySelector('[aria-label="Suggestion assessment"]').scrollIntoView({block:'start'});window.scrollBy(0,-82)`); await delay(100);
    observations[name] = await evaluate(`({width:innerWidth,documentWidth:document.documentElement.scrollWidth,unlabelledControls:[...document.querySelectorAll('input,select,textarea')].filter(x=>x.getClientRects().length&&!x.matches(':disabled')&&!x.labels?.length&&!x.getAttribute('aria-label')).length})`);
    assert.equal(observations[name].width, width, `${name}: viewport must use the actual device width`);
    assert.ok(observations[name].documentWidth <= observations[name].width, `${name}: horizontal overflow`);
    assert.equal(observations[name].unlabelledControls, 0);
    const capture = await cdp('Page.captureScreenshot', { format: 'png' }); await writeFile(resolve(artifacts, `${name}.png`), Buffer.from(capture.data, 'base64'));
  }
  // Rebase regression: preserve the upstream project-first flow alongside configurable recommenders.
  await cdp('Page.navigate', { url: `${origin}/` }); await text('My Projects');
  await until(`location.pathname === '/projects'`, 'root redirects to projects');
  await click('Add project'); await edit('Project name', 'Rebase browser project'); await click('Create project');
  await text('No stories yet.');
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM projects WHERE name=$1', ['Rebase browser project'])).rows[0].n, 1);
  await cdp('Page.navigate', { url: `${origin}/recommendations?classificationId=${classification.id}` });
  await text('Check the story context'); await text('Enter the project platform.');
  assert.equal(await evaluate('document.documentElement.lang'), 'en');
  await evaluate(`[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='How it works').click()`);
  await text('US-Agent adaptations');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  const legacyCapture = await cdp('Page.captureScreenshot', { format: 'png' });
  await writeFile(resolve(artifacts, 'legacy-nfr-english.png'), Buffer.from(legacyCapture.data, 'base64'));
  assert.deepEqual(browserErrors, []);
  const summary = { schemaVersion: 1, browser: await cdp('Browser.getVersion'), runId, rawRunSha256: stored.content_sha256, observations,
    verified: ['taxonomy-publication', 'definition-context', 'import-preview-publication', 'dynamic-input', 'explicit-destination', 'accept-reject', 'persisted-history', 'replay',
      'project-first-routing', 'create-empty-project', 'english-presentation', 'scientific-disclaimer'], scope: 'Synthetic local browser verification; not an empirical article reproduction.' };
  await writeFile(resolve(artifacts, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(`Browser workflow verified. Evidence: ${artifacts}`);
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await cdp('Browser.close').catch(() => {}); socket.close(); }
  for (const call of pending.values()) call.reject(new Error('Browser closed')); pending.clear();
  if (browser && browser.exitCode === null) browser.kill();
  if (server) { server.closeAllConnections(); await new Promise(resolveCall => server.close(resolveCall)); }
  if (created) await pool.query(`DROP SCHEMA ${schema} CASCADE`);
  await pool.end();
}
