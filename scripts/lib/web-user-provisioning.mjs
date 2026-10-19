import assert from 'node:assert/strict';
import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
const derive = promisify(scrypt);

export const rosterPath = new URL('../../config/deployment/web-users.json', import.meta.url);
export async function prepareWebUsers(password, usernames) {
  assert.ok(typeof password === 'string' && password.length >= 8 && password.length <= 1024, 'Use a password between 8 and 1024 characters.');
  assert.ok(usernames.length > 0 && new Set(usernames).size === usernames.length);
  for (const username of usernames) assert.match(username, /^[a-z][a-z0-9._-]{0,63}$/);
  return { schemaVersion: 1, users: await Promise.all(usernames.map(async username => {
    const salt = randomBytes(16).toString('hex');
    return { username, passwordHash: `scrypt:${salt}:${(await derive(password, salt, 64)).toString('hex')}` };
  })) };
}
export async function loadWebUsers(path) {
  const roster = JSON.parse(await readFile(rosterPath, 'utf8'));
  const input = JSON.parse(await readFile(path, 'utf8'));
  assert.equal(input.schemaVersion, 1); assert.ok(Array.isArray(input.users));
  assert.deepEqual(Object.keys(input).sort(), ['schemaVersion', 'users']);
  assert.deepEqual(input.users.map(row => row.username).sort(), [...roster.usernames].sort(), 'Provisioning must match the reviewed username roster exactly.');
  for (const user of input.users) {
    assert.deepEqual(Object.keys(user).sort(), ['passwordHash', 'username']);
    assert.match(user.passwordHash, /^scrypt:[a-f0-9]{32}:[a-f0-9]{128}$/);
  }
  return input.users;
}
export async function provisionWebUsers(client, users, apply = false) {
  await client.query(apply ? 'BEGIN' : 'BEGIN READ ONLY');
  try {
    if (apply) {
      await client.query("SET LOCAL lock_timeout = '10s'");
      const lock = await client.query("SELECT pg_try_advisory_xact_lock(hashtext('us_agent_web_user_provisioning')) AS acquired");
      assert.ok(lock.rows[0].acquired, 'Another provisioning runner is active.');
    }
    const registry = await client.query("SELECT to_regclass('web_users') IS NOT NULL AS present");
    assert.ok(registry.rows[0].present, 'Apply migration 026 before provisioning users.');
    const existing = (await client.query('SELECT username, active FROM web_users WHERE username = ANY($1::text[]) ORDER BY username', [users.map(row => row.username)])).rows;
    const result = [];
    for (const user of users) {
      if (existing.some(row => row.username === user.username)) {
        result.push({ username: user.username, status: 'existing_unchanged' }); continue;
      }
      if (!apply) { result.push({ username: user.username, status: 'would_create' }); continue; }
      const inserted = await client.query('INSERT INTO web_users (username, password_hash) VALUES ($1, $2) ON CONFLICT (username) DO NOTHING RETURNING username', [user.username, user.passwordHash]);
      result.push({ username: user.username, status: inserted.rowCount ? 'created' : 'existing_unchanged' });
    }
    await client.query('COMMIT');
    return result;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
}
