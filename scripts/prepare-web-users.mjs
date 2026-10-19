import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { readPassword } from './lib/password-input.mjs';
import { prepareWebUsers, rosterPath } from './lib/web-user-provisioning.mjs';

async function main() {
  const [flag, file, ...extra] = process.argv.slice(2);
  assert.ok(flag === '--output' && file && !extra.length, 'Use --output tmp/production-web-users.json.');
  const output = resolve(file);
  // Credential artifacts must remain outside versioned paths.
  assert.ok(output.startsWith(resolve('tmp') + '\\') || output.startsWith(resolve('tmp') + '/'), 'Use a path inside the ignored tmp directory.');
  const roster = JSON.parse(await readFile(rosterPath, 'utf8'));
  const input = await prepareWebUsers(await readPassword(), roster.usernames);
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(input, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ prepared: input.users.map(row => row.username), output, plaintextStored: false }));
}
main().catch(error => { console.error(error.code === 'EEXIST' ? 'Output already exists; choose a new ignored file.' : 'Could not prepare users. Check options and password length (8–1024); no password was printed.'); process.exitCode = 1; });
