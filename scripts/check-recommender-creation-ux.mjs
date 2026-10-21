// Real browser + compiled web/API + disposable LOCAL schema. Never reads production configuration.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import express from 'express';
import pg from 'pg';
import { loadMigrationRelease, applyMigrationRelease } from './lib/deployment-migrations.mjs';

const schema = 'creation_ux_' + randomUUID().replaceAll('-', '');
assert.match(schema, /^creation_ux_[a-f0-9]{32}$/);
const local = 'postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent';
const client = new pg.Client({ connectionString: local, connectionTimeoutMillis: 3000 });
const artifacts = resolve('docs/evidencias/recommender-creation-2026-10-21');
const profile = resolve('tmp', schema, 'edge-profile');
let server, pool, browser, socket, origin, created = false, serial = 0;
const pending = new Map(), errors = [], checks = [];
function cdp(method, params = {}) {
  const id = ++serial;
  return new Promise((resolveCall, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP timeout ' + method)); }, 15000);
    pending.set(id, { resolve: value => { clearTimeout(timer); resolveCall(value); }, reject: error => { clearTimeout(timer); reject(error); } });
    socket.send(JSON.stringify({ id, method, params }));
  });
}
async function evaluate(expression) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw Error(JSON.stringify(result.exceptionDetails));
  return result.result.value;
}
async function until(expression, label) {
  for (let attempt = 0; attempt < 150; attempt++) { if (await evaluate(`Boolean(${expression})`)) return; await delay(100); }
  throw Error('Browser wait: ' + label + '\n' + await evaluate('document.body.innerText'));
}
async function click(text) {
  await evaluate(`{const b=[...document.querySelectorAll('.page button')].find(e=>e.textContent.trim()===${JSON.stringify(text)});if(!b||b.matches(':disabled'))throw Error('Unavailable button: '+${JSON.stringify(text)});b.click();}`);
  await delay(80);
}
async function edit(label, value, scope = '.page') {
  await evaluate(`{const scope=document.querySelector(${JSON.stringify(scope)});const l=[...scope.querySelectorAll('label')].find(e=>[...e.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()===${JSON.stringify(label)});if(!l)throw Error('Missing '+${JSON.stringify(label)});const e=l.querySelector('input,select,textarea');const p=e instanceof HTMLSelectElement?HTMLSelectElement.prototype:e instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(p,'value').set.call(e,${JSON.stringify(value)});e.dispatchEvent(new Event(e instanceof HTMLSelectElement?'change':'input',{bubbles:true}));}`);
  await delay(60);
}
async function navigate(path) {
  await cdp('Page.navigate', { url: origin + path });
  await until("document.querySelector('.page h1') && window.pendingFetches===0", path);
  await delay(150);
}
async function audit(name, width, height = 1000) {
  await cdp('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  // Let the existing sidebar's responsive transition settle before inspecting the screen.
  await delay(350);
  await until("innerWidth>700 || document.querySelector('.sidebar').getBoundingClientRect().right<=1", 'mobile navigation fully closed');
  const layout = await evaluate(`({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,step:document.querySelector('.creation-kicker')?.textContent,unlabelled:[...document.querySelectorAll('.creation-form input,.creation-form select,.creation-form textarea')].filter(e=>!e.labels?.length&&!e.getAttribute('aria-label')).length,smallControls:[...document.querySelectorAll('.creation-form button,.creation-progress button')].filter(e=>e.getBoundingClientRect().width>0&&(e.getBoundingClientRect().height<44||e.getBoundingClientRect().width<44)).map(e=>e.textContent.trim())})`);
  assert.ok(layout.scrollWidth <= width + 1, `${name} overflows at ${width}: ${layout.scrollWidth}`);
  assert.equal(layout.unlabelled, 0, name + ' has unlabelled fields');
  assert.deepEqual(layout.smallControls, [], name + ' has small controls');
  checks.push({ name, height, ...layout });
  if (width === 1440 || width === 375) {
    await evaluate('window.scrollTo(0,0)');
    const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(resolve(artifacts, `${name}-${width}${height === 1000 ? '' : '-landscape'}.png`), Buffer.from(shot.data, 'base64'));
  }
}
async function captureStep(name) { for (const width of [1440, 1024, 768, 375]) await audit(name, width); }

await mkdir(artifacts, { recursive: true }); await mkdir(profile, { recursive: true }); await client.connect();
try {
  await client.query(`CREATE SCHEMA "${schema}"`); created = true;
  await client.query(`SET search_path TO "${schema}"`);
  await applyMigrationRelease(client, await loadMigrationRelease());
  process.env.DATABASE_URL = local + '?options=' + encodeURIComponent('-c search_path=' + schema);
  process.env.NODE_ENV = 'test'; process.env.API_ACCESS_MODE = 'local'; process.env.ORGANIZATION_ACCESS_MODE = 'local';
  for (const key of ['VERCEL', 'INGEST_API_KEY', 'DATABASE_SSL']) delete process.env[key];
  ({ pool } = await import('../apps/api/dist/database/pool.js'));
  const { createApp } = await import('../apps/api/dist/app.js');
  const api = createApp(), app = express();
  app.use((req, res, next) => req.path.startsWith('/api/') ? api(req, res, next) : next());
  app.use(express.static(resolve('apps/web/dist'))); app.use((_req, res) => res.sendFile(resolve('apps/web/dist/index.html')));
  server = app.listen(0, '127.0.0.1'); await new Promise(resolveCall => server.once('listening', resolveCall));
  origin = `http://127.0.0.1:${server.address().port}`;
  browser = spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let port;
  for (let attempt = 0; attempt < 100; attempt++) { try { port = Number((await readFile(resolve(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]); if (port) break; } catch {} await delay(100); }
  assert.ok(port, 'Browser did not start');
  const page = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json();
  socket = new WebSocket(page.webSocketDebuggerUrl);
  socket.addEventListener('message', event => { const response = JSON.parse(String(event.data)); if (response.id && pending.has(response.id)) { const call = pending.get(response.id); pending.delete(response.id); response.error ? call.reject(Error(JSON.stringify(response.error))) : call.resolve(response.result); } if (response.method === 'Runtime.exceptionThrown') errors.push(response.params.exceptionDetails); });
  await new Promise((resolveCall, reject) => { socket.addEventListener('open', resolveCall, { once: true }); socket.addEventListener('error', reject, { once: true }); });
  await cdp('Page.enable'); await cdp('Runtime.enable'); await cdp('Network.enable');
  await cdp('Network.setBlockedURLs', { urls: ['https://*'] });
  await cdp('Page.addScriptToEvaluateOnNewDocument', { source: "window.pendingFetches=0;const originalFetch=window.fetch;window.fetch=async(...args)=>{window.pendingFetches++;try{return await originalFetch(...args);}finally{window.pendingFetches--;}};" });
  await navigate('/recommenders/new');
  assert.equal(await evaluate("document.querySelector('.section-navigation a.active')?.textContent"), 'New recommender');
  assert.equal(await evaluate("document.querySelector('form').innerText.includes('Representation')"), false);
  await captureStep('name');
  await click('Continue');
  assert.equal(await evaluate("document.activeElement?.getAttribute('role')"), 'alert');
  assert.equal(await evaluate("document.querySelector('#recommender-name').getAttribute('aria-invalid')"), 'true');
  await edit('Recommender name', 'Architecture recommender'); await click('Continue');
  await edit('Input name', 'Technology'); await edit('Fill from an existing project', 'technologies.languages');
  await click('Add comparison input');
  await edit('Input name', 'Project scope', '[aria-label="Comparison input 2"]');
  await edit('Answer format', 'enum', '[aria-label="Comparison input 2"]');
  await edit('Allowed answers', 'Small\nLarge', '[aria-label="Comparison input 2"]');
  await edit('How many values?', 'single', '[aria-label="Comparison input 2"]');
  await captureStep('inputs'); await click('Continue');
  await edit('Recommendation name', 'Architectures'); await captureStep('recommendations');
  await click('Back'); assert.equal(await evaluate("document.getElementById('name-0').value"), 'Technology');
  await click('Continue'); assert.equal(await evaluate("document.getElementById('name-1').value"), 'Architectures');
  await click('Continue'); await edit('Number of neighbors (k)', '3'); await edit('Weight for Project scope', '2');
  await captureStep('matching'); await click('Continue'); await captureStep('review');
  await cdp('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await audit('review-reduced-motion', 812, 375);
  assert.ok(await evaluate("parseFloat(getComputedStyle(document.querySelector('.creation-footer button')).transitionDuration)<=0.0001"));
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
  assert.equal((await client.query('SELECT count(*)::int AS n FROM recommender_definition_versions')).rows[0].n, 0);
  await click('Create recommender');
  await until("document.body.innerText.includes('Architecture recommender is created') && window.pendingFetches===0", 'creation completes');
  const { rows: [publication] } = await client.query('SELECT definition_id, version, state, content FROM recommender_definition_versions');
  assert.equal(publication.state, 'published'); assert.equal(publication.content.method.parameters.weights.feature_1, 2);
  assert.equal(publication.content.method.parameters.profile_sources.characteristics, 'technologies.languages');
  await audit('created', 1440); await audit('created', 375);
  await evaluate("[...document.querySelectorAll('.page a')].find(e=>e.textContent.trim()==='Add reference data').click()");
  await until("document.querySelector('[aria-label=\"Dataset import\"] .configured-reference') && window.pendingFetches===0", 'definition transferred to data setup');
  assert.equal(await evaluate("[...document.querySelectorAll('.page label')].find(e=>e.firstChild?.textContent==='Import definition').querySelector('select').value"), JSON.stringify([publication.definition_id, publication.version]));
  await navigate('/recommendations');
  await until("document.querySelector('[aria-label=\"Your published recommenders\"]')?.innerText.includes('Architecture recommender')", 'new instance appears in main list');
  await audit('main-list', 1440); await audit('main-list', 375);
  assert.deepEqual(errors, [], 'Browser runtime errors');
  const summary = { recordedAt: new Date().toISOString(), syntheticLocalFixtures: true, skill: 'UI UX Pro Max', browser: await cdp('Browser.getVersion'), checks, verified: ['dedicated navigation tab', 'five progressive steps', 'advanced IDs collapsed', 'linked inline errors and summary focus', 'back preserves answers', 'no writes before review', 'KNN publication through real API and PostgreSQL', 'published definition handed to dataset setup', 'instance in main list', 'responsive layouts', '44px controls', 'reduced motion'], runtimeErrors: errors };
  await writeFile(resolve(artifacts, 'browser-checks.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, layoutChecks: checks.length, flows: summary.verified.length, artifacts }));
} finally {
  socket?.close(); browser?.kill();
  if (server) { server.closeAllConnections(); await new Promise(resolveCall => server.close(resolveCall)); }
  if (pool) await pool.end();
  if (created) await client.query(`DROP SCHEMA "${schema}" CASCADE`);
  await client.end();
}
