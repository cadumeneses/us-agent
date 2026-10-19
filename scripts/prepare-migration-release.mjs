import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { sqlHash, releasePath } from './lib/deployment-migrations.mjs';

// Review tracked migration names only. Untracked SQL is never silently deployed.
const additions = process.argv.slice(2);
if (additions.some(path => !/^database\/migrations\/\d{3}_[a-z0-9_]+\.sql$/.test(path))) throw Error('Explicit additions must be migration paths.');
const paths = [...new Set([...execFileSync('git', ['ls-files', '-z', '--', 'database/migrations/*.sql'], { encoding: 'utf8' }).split('\0').filter(Boolean), ...additions])].sort();
const migrations = await Promise.all(paths.map(async path => ({ name: path.split('/').at(-1), sha256: sqlHash(await readFile(path, 'utf8')) })));
await writeFile(releasePath, JSON.stringify({ schemaVersion: 1, hashFormat: 'sha256_utf8_lf', migrations }, null, 2) + '\n');
console.log(JSON.stringify({ migrations: migrations.length, release: 'database/migrations.release.json' }));
