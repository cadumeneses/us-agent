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

const schema = 'profile_controls_ux_' + randomUUID().replaceAll('-', '');
assert.match(schema, /^profile_controls_ux_[a-f0-9]{32}$/);
const local = 'postgresql://us_agent:us_agent_local@127.0.0.1:5432/us_agent';
const client = new pg.Client({ connectionString: local, connectionTimeoutMillis: 3000 });
const artifacts = resolve('docs/evidencias/profile-controls-2026-10-21');
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
    const value = await response.json();
    assert.ok(response.ok, JSON.stringify({ path, status: response.status, value })); return value;
  }
  const taxonomy = await request('/api/taxonomy');
  const active = taxonomy.taxonomies.find(row => row.active && row.operations > 0);
  assert.ok(active, 'An active taxonomy is required for the profile fixture');
  const projectName = 'Profile UI review';
  await request('/api/projects', 'POST', { name: projectName });
  const profilePath = '/api/project-research-profile?project=' + encodeURIComponent(projectName);
  const fixture = { taxonomyVersion: active.version, platforms: ['Web'], applicationDomains: ['Information resources'], objective: '',
    architectures: ['Model-view-controller'], technologies: { languages: ['Java', 'Python', 'JavaScript'], frameworks: ['Angular', 'Express', 'Node'], apis: ['Cytoscape', 'Mongoose', 'Request-promise', 'D3js'], dataPersistence: ['MongoDB'] } };
  await request(profilePath, 'PUT', fixture);
  await navigate('/projects/' + encodeURIComponent(projectName));
  await evaluate("document.querySelector('.research-profile summary').click()");
  await until("document.querySelector('.research-profile .tag-chip') && window.pendingFetches===0", 'profile values');
  async function editTag(label, value) {
    await evaluate("{const field=[...document.querySelectorAll('.research-profile .tag-field')].find(e=>e.querySelector('label').textContent===" + JSON.stringify(label) + ");const input=field.querySelector('input');input.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(input," + JSON.stringify(value) + ");input.dispatchEvent(new Event('input',{bubbles:true}));}");
    await delay(80);
  }
  async function auditProfile(width) {
    await cdp('Emulation.setDeviceMetricsOverride', { width, height: 1100, deviceScaleFactor: 1, mobile: false });
    await delay(350);
    await until("innerWidth>700 || document.querySelector('.sidebar').getBoundingClientRect().right<=1", 'mobile sidebar closes');
    const metrics = await evaluate("(()=>{const root=document.querySelector('.research-profile'),save=root.querySelector('button[type=submit]'),rect=save.getBoundingClientRect();return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,save:{width:rect.width,height:rect.height},buttons:[...root.querySelectorAll('.tag-input-wrap button')].map(b=>{const r=b.getBoundingClientRect(),icon=b.querySelector('svg').getBoundingClientRect();return {label:b.getAttribute('aria-label'),width:r.width,height:r.height,iconWidth:icon.width,iconHeight:icon.height}}),tagFont:getComputedStyle(root.querySelector('.tag-chip')).fontSize}})()");
    assert.ok(metrics.scrollWidth <= width + 1, 'Profile overflows at ' + width);
    assert.ok(metrics.save.height >= 44 && metrics.save.height <= 56, 'Save profile height');
    assert.ok(metrics.save.width >= 128 && metrics.save.width < 240, 'Save profile should remain compact');
    for (const button of metrics.buttons) {
      assert.ok(button.label); assert.ok(button.width >= 44 && button.height >= 44, button.label + ' touch target');
      assert.ok(button.iconWidth >= 16 && button.iconHeight >= 16, button.label + ' icon must remain visible');
    }
    assert.ok(parseFloat(metrics.tagFont) >= 14);
    assert.ok(await evaluate("[...document.querySelectorAll('.research-profile .tag-entry')].every(e=>{const input=e.querySelector('input').getBoundingClientRect(),button=e.querySelector('button').getBoundingClientRect();return Math.abs(input.top-button.top)<1})"), 'Add should stay on the same line as its input');
    checks.push(metrics);
    await evaluate("window.scrollTo({top:document.querySelector('.research-profile').getBoundingClientRect().top+scrollY-82,behavior:'instant'})");
    const shot = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(resolve(artifacts, 'profile-' + width + '.png'), Buffer.from(shot.data, 'base64'));
    if (width === 375) {
      await evaluate("document.querySelector('.research-profile-actions').scrollIntoView({block:'end',behavior:'instant'})");
      const bottom = await cdp('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
      await writeFile(resolve(artifacts, 'profile-actions-375.png'), Buffer.from(bottom.data, 'base64'));
    }
  }
  for (const width of [1440, 1024, 768, 375]) await auditProfile(width);
  await cdp('Emulation.setDeviceMetricsOverride', { width: 1440, height: 1100, deviceScaleFactor: 1, mobile: false });
  await editTag('Platforms', 'Desktop');
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Add tag to Platforms\"]').disabled"), false);
  await evaluate("document.querySelector('[aria-label=\"Add tag to Platforms\"]').click()");
  await until("document.querySelector('[aria-label=\"Remove Desktop from Platforms\"]')", 'add a suggested tag');
  await evaluate("document.querySelector('[aria-label=\"Remove Desktop from Platforms\"]').click()");
  await until("!document.querySelector('[aria-label=\"Remove Desktop from Platforms\"]')", 'remove a suggested tag');
  await editTag('Platforms', 'Kiosk');
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Enter', code: 'Enter', windowsVirtualKeyCode: 13 });
  await until("document.querySelector('[aria-label=\"Remove Kiosk from Platforms\"]')", 'add a custom tag by keyboard');
  await editTag('Platforms', 'kiosk');
  assert.equal(await evaluate("document.querySelector('[aria-label=\"Add tag to Platforms\"]').disabled"), true, 'Duplicate tags stay disabled');
  await evaluate("document.querySelector('[aria-label=\"Remove Kiosk from Platforms\"]').focus()");
  await cdp('Input.dispatchKeyEvent', { type: 'keyDown', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await cdp('Input.dispatchKeyEvent', { type: 'keyUp', key: ' ', code: 'Space', windowsVirtualKeyCode: 32 });
  await until("!document.querySelector('[aria-label=\"Remove Kiosk from Platforms\"]')", 'remove a tag by keyboard');
  await click('Save profile'); await until("document.body.innerText.includes('Profile saved.') && window.pendingFetches===0", 'save profile');
  assert.deepEqual(await request(profilePath), fixture);
  assert.deepEqual(errors, []);
  const verified = ['visible remove and add icons', '44px tag buttons', 'input and Add stay grouped', 'compact save action outside the field grid', 'readable wrapping tags', 'suggested tag added with Add', 'custom tag added with Enter', 'tag removed with Space', 'case-insensitive duplicate prevention', 'profile saved through real API', 'no horizontal overflow'];
  await writeFile(resolve(artifacts, 'browser-checks.json'), JSON.stringify({ recordedAt: new Date().toISOString(), syntheticLocalFixtures: true, skill: 'UI UX Pro Max', checks, verified, runtimeErrors: errors }, null, 2) + '\n');
  console.log(JSON.stringify({ ok: true, viewports: checks.length, flows: verified.length, artifacts }));
} finally {
  socket?.close(); browser?.kill();
  if (server) { server.closeAllConnections(); await new Promise(resolveCall => server.close(resolveCall)); }
  if (pool) await pool.end();
  if (created) await client.query('DROP SCHEMA "' + schema + '" CASCADE');
  await client.end();
}
