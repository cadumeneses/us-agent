// Read-only production inspection. Never prints or stores credentials or business records.
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

const origin = 'https://us-agent-api.vercel.app';
const key = process.env.INGEST_API_KEY?.trim();
if (!key || key.length < 32) throw Error('Load the current server credential through --env-file.');
const output = resolve('docs/demo-4min30');
const cache = resolve('tmp/demo-production-assets');
await mkdir(output, { recursive: true });
await mkdir(cache, { recursive: true });
const request = async (path, authenticated = false) => {
  const response = await fetch(origin + path, {
    method: 'GET', redirect: 'error', signal: AbortSignal.timeout(25000),
    headers: authenticated ? { Authorization: `Bearer ${key}`, 'X-Organization-Id': 'default' } : {}
  });
  return { response, text: await response.text() };
};
const checks = [];
for (const [name, path] of [
  ['health', '/api/health'], ['organization', '/api/access/context'],
  ['definitions', '/api/internal/recommender-definitions?limit=100'],
  ['datasets', '/api/internal/recommender-datasets?limit=100'],
  ['runs', '/api/internal/recommendation-runs?limit=100'],
  ['taxonomies', '/api/internal/recommender-taxonomies?limit=100'],
  ['testCatalogs', '/api/internal/test-case-catalogs?limit=100'],
  ['members', '/api/access/members']
]) {
  const { response, text } = await request(path, true);
  const body = JSON.parse(text);
  const item = { name, path, status: response.status };
  if (response.ok && Array.isArray(body)) {
    item.countOnPage = body.length;
    item.pageLimit = 100;
    if (name === 'members') item.roles = body.reduce((counts, row) => ({ ...counts, [row.role]: (counts[row.role] || 0) + 1 }), {});
    else item.publications = body.map(row => ({ id: row.id, version: row.version, state: row.state, method: row.method }));
  } else if (response.ok && name === 'health') item.database = body.database;
  else if (response.ok && name === 'organization') {
    item.organizationId = body.organizationId;
    item.authentication = 'technical_bearer_not_a_personal_browser_session';
  }
  checks.push(item);
}
const anonymous = await request('/api/health');
const page = await request('/');
if (page.response.status !== 200) throw Error('Production page unavailable.');
const entry = page.text.match(/src="(\/assets\/[^"<>]+\.js)"/)?.[1];
if (!entry) throw Error('Production entry asset missing.');
const queue = [entry], assets = new Map();
for (let i = 0; i < queue.length && i < 80; i++) {
  const path = queue[i];
  if (assets.has(path)) continue;
  const asset = await request(path);
  if (!asset.response.ok) throw Error(`Asset unavailable: ${path}`);
  assets.set(path, asset.text);
  await writeFile(resolve(cache, path.split('/').at(-1)), asset.text);
  const pattern = /["'`](?:\.\/|\/)?((?:assets\/)?[A-Za-z0-9_.-]+\.js)["'`]/g;
  for (const match of asset.text.matchAll(pattern)) {
    const dependency = '/assets/' + match[1].replace(/^assets\//, '');
    if (!queue.includes(dependency)) queue.push(dependency);
  }
}
const code = [...assets.values()].join('\n');
const features = Object.fromEntries([
  'Non-functional requirements', 'Test cases', 'Project risks',
  'New project-risk recommender', 'Create a new definition version',
  'Add comparison feature', 'Number of neighbors (k)', 'Import dataset',
  'Use US-Agent record mapping', 'Generate import preview', 'Publish reviewed dataset',
  'Verify replay', 'Download JSON evidence', 'Adapt accepted NFR',
  'Save NFR adaptation', 'Download evidence with assessments',
  'Access and audit', 'New recommender'
].map(label => [label, code.includes(label)]));
const report = {
  checkedAt: new Date().toISOString(), origin, organizationId: 'default',
  operation: 'GET_ONLY', productionMutations: 0, anonymousHealthStatus: anonymous.response.status,
  checks, frontend: {
    entry, assets: [...assets].map(([path, source]) => ({ path, sha256: createHash('sha256').update(source).digest('hex') })),
    labelsFoundInDeployedCode: features,
    limitation: 'Deployed assets inspected; no authenticated personal-browser walkthrough or production writes performed.'
  }
};
await writeFile(resolve(output, 'producao-verificada.json'), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
