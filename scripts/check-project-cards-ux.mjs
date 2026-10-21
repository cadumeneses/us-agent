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

const schema = 'project_cards_ux_' + randomUUID().replaceAll('-', '');
assert.match(schema, /^project_cards_ux_[a-f0-9]{32}$/);
const local = 'postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent';
const client = new pg.Client({ connectionString: local, connectionTimeoutMillis: 3000 });
const artifacts = resolve('docs/evidencias/project-cards-2026-10-21');
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

  async function request(path, method = 'GET', body) {
    const response = await fetch(origin + path, { method, ...(body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {}) });
    const value = await response.json(); assert.ok(response.ok, JSON.stringify({ path, status: response.status, value })); return value;
  }
  const names = ['Test', 'fg', 'Customer portal for regional teams with a descriptive project name'];
  for (const name of names) await request('/api/projects', 'POST', { name });
  const { rows: [project] } = await client.query("SELECT id FROM projects WHERE name='fg'");
  const { rows: [sprint] } = await client.query("INSERT INTO project_sprints(project_id,name) VALUES($1,'Cycle 1') RETURNING id", [project.id]);
  for (let index = 0; index < 24; index++) {
    const { rows: [story] } = await client.query('INSERT INTO stories(project_id,sprint_id,external_id,content) VALUES($1,$2,$3,$4) RETURNING id', [project.id, sprint.id, 'story-' + index, 'As a user, I want to retrieve a record for the local UI fixture.']);
    const { rows: [classification] } = await client.query("INSERT INTO classifications(story_id,review_status) VALUES($1,'reviewed') RETURNING id", [story.id]);
    await client.query("INSERT INTO classification_labels(classification_id,module,operation) VALUES($1,'Registry','Retrieve data')", [classification.id]);
  }
  await request('/api/project-stories', 'POST', { project: names[2], sprint: 'Cycle 1', text: 'As a user, I want to prepare a project story for this UI fixture.', requestId: randomUUID() });
  const expected = await request('/api/project-story-counts');
  await navigate('/projects');
  await until("document.querySelectorAll('.project-card-stats dd').length===9 && [...document.querySelectorAll('.project-card-stats dd')].every(e=>e.textContent!=='—')", 'project counters');
  for (const width of [1440, 1024, 768, 375]) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: false });
    await delay(350); await until("innerWidth>700 || document.querySelector('.sidebar').getBoundingClientRect().right<=1", 'mobile navigation fully closed');
    const metrics = await evaluate("({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('.project-overview')].map(card=>{const r=card.getBoundingClientRect(),heading=card.querySelector('.project-card-heading').getBoundingClientRect(),stats=card.querySelector('dl').getBoundingClientRect(),footer=card.querySelector('.project-card-footer').getBoundingClientRect();return {name:card.querySelector('h2').textContent,width:r.width,height:r.height,footerHeight:footer.height,labels:[...card.querySelectorAll('dt')].map(e=>e.textContent),values:[...card.querySelectorAll('dd')].map(e=>Number(e.textContent)),overlap:heading.bottom>stats.top||stats.bottom>footer.top,nestedControls:card.querySelectorAll('a,button').length,labelledBy:card.getAttribute('aria-labelledby')}})})");
    assert.ok(metrics.scrollWidth <= width + 1, 'Horizontal overflow at ' + width);
    assert.equal(metrics.cards.length, 3);
    for (const card of metrics.cards) {
      const count = expected.find(row => row.project === card.name);
      assert.deepEqual(card.labels, ['Stories', 'To classify', 'Cycles']);
      assert.deepEqual(card.values, [count.stories, count.unclassified, count.cycles]);
      assert.equal(card.overlap, false, card.name + ' overlaps');
      assert.equal(card.nestedControls, 0); assert.ok(card.labelledBy);
      assert.ok(card.footerHeight >= 44);
    }
    checks.push(metrics);
    await evaluate('window.scrollTo(0,0)');
    const screenshot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(resolve(artifacts, 'projects-' + width + '.png'), Buffer.from(screenshot.data, 'base64'));
  }
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
  await evaluate("document.querySelector('.project-overview').focus()");
  assert.ok(await evaluate("parseFloat(getComputedStyle(document.activeElement).outlineWidth)>=3"), 'Keyboard focus must remain visible');
  const destination = await evaluate("new URL(document.activeElement.href).pathname");
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until('location.pathname===' + JSON.stringify(destination) + " && document.querySelector('.research-profile')", 'Open project with Enter');
  await until("window.pendingFetches===0 && document.querySelector('.research-profile select')", 'destination project finishes loading');
  assert.deepEqual(errors, []);
  const verified = ['separate title metrics and action', 'three real project totals including zeros', 'no overlap at four widths', 'long project names remain available', 'one native link per card', 'visible keyboard focus', 'Enter opens the project', 'touch-sized footer', 'no horizontal overflow'];
  await writeFile(resolve(artifacts, 'browser-checks.json'), JSON.stringify({ recordedAt: new Date().toISOString(), syntheticLocalFixtures: true, skill: 'UI UX Pro Max', checks, verified, runtimeErrors: errors }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, viewports: checks.length, flows: verified.length, artifacts }));
} finally {
  socket?.close(); browser?.kill();
  if (server) { server.closeAllConnections(); await new Promise(resolveCall => server.close(resolveCall)); }
  if (pool) await pool.end();
  if (created) await client.query('DROP SCHEMA "' + schema + '" CASCADE');
  await client.end();
}
