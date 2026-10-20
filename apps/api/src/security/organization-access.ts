import { Router, type RequestHandler } from 'express';
import { z } from 'zod';
import { pool, query } from '../database/pool.js';
import { browserUsername } from './browser-identity.js';
import { requestScope, type AccessRole } from './request-context.js';

const enabled = () => Boolean(process.env.VERCEL) || process.env.NODE_ENV === 'production' || process.env.ORGANIZATION_ACCESS_MODE === 'enforced';
const code = z.string().regex(/^[a-z][a-z0-9_-]{0,63}$/);
type Membership = { id: string; name: string; schema_name: string; role: AccessRole };
export function roleAllows(role: AccessRole, method: string, path: string) {
  if (['GET','HEAD','OPTIONS'].includes(method)) return true;
  if (role === 'admin' || role === 'maintainer') return true;
  return role === 'reviewer' && (
    method === 'PATCH' && /^\/classifications\/[1-9][0-9]*\/review$/.test(path) ||
    method === 'POST' && /^\/internal\/(recommendation-runs|test-case-reviews)\/[a-f0-9-]+\/(target|decisions|copies)$/.test(path) ||
    method === 'POST' && /^\/nfr-runs\/[a-f0-9-]+\/decisions$/.test(path));
}
export const organizationAccess: RequestHandler = async (req,res,next) => {
  const username = browserUsername(req), actor = username ?? (process.env.INGEST_API_KEY ? 'internal-api' : 'local-development');
  if (!enabled()) return requestScope.run({actor,organizationId:'default',role:'admin'},next);
  const requested = req.header('x-organization-id');
  if (requested !== undefined && !code.safeParse(requested).success) { res.status(400).json({error:'Invalid organization.'}); return; }
  try {
    // Global registry intentionally uses the unscoped pool. Never resolve membership in a tenant schema.
    const { rows } = await pool.query<Membership>(`SELECT o.id,o.name,o.schema_name,COALESCE(m.role,'admin') AS role
      FROM organizations o LEFT JOIN organization_memberships m ON m.organization_id=o.id AND m.username=$1 AND m.active
      WHERE o.active AND ($1::text IS NULL OR m.username IS NOT NULL) AND ($2::text IS NULL OR o.id=$2)
      ORDER BY (o.id='default') DESC,o.id LIMIT 1`,[username ?? null,requested ?? null]);
    const membership = rows[0];
    if (!membership) { res.status(403).json({error:'No access to this organization.'}); return; }
    if (!roleAllows(membership.role,req.method,req.path)) { res.status(403).json({error:'Your role cannot perform this action.'}); return; }
    requestScope.run({actor,organizationId:membership.id,schema:membership.schema_name,role:membership.role},next);
  } catch { res.status(503).json({error:'Organization access unavailable. Apply migration 031 and verify membership.'}); }
};

export const organizationAccessRouter = Router();
organizationAccessRouter.get('/context',async (req,res) => {
  const scope = requestScope.getStore()!;
  if (!enabled()) { res.json({organizationId:'default',role:scope.role,actor:scope.actor,organizations:[{id:'default',name:'Current workspace',role:scope.role}]});return; }
  const username = browserUsername(req);
  const {rows} = await pool.query(`SELECT o.id,o.name,COALESCE(m.role,'admin') AS role FROM organizations o
    LEFT JOIN organization_memberships m ON m.organization_id=o.id AND m.username=$1 AND m.active
    WHERE o.active AND ($1::text IS NULL OR m.username IS NOT NULL) ORDER BY o.id`,[username ?? null]);
  res.json({organizationId:scope.organizationId,role:scope.role,actor:scope.actor,organizations:rows});
});
organizationAccessRouter.use((_req,res,next) => {
  if (requestScope.getStore()?.role !== 'admin') { res.status(403).json({error:'Administrator access required.'});return; } next();
});
organizationAccessRouter.get('/members',async (_req,res) => {
  res.json((await pool.query('SELECT username,role,active,updated_at FROM organization_memberships WHERE organization_id=$1 ORDER BY username',[requestScope.getStore()!.organizationId])).rows);
});
organizationAccessRouter.put('/members/:username',async (req,res) => {
  const username = z.string().regex(/^[a-z][a-z0-9._-]{0,63}$/).safeParse(req.params.username);
  const body = z.strictObject({role:z.enum(['viewer','reviewer','maintainer','admin']),active:z.boolean()}).safeParse(req.body);
  if (!username.success || !body.success) {res.status(422).json({error:'Invalid membership.'});return;}
  const scope = requestScope.getStore()!, client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT 1 FROM organizations WHERE id=$1 FOR UPDATE',[scope.organizationId]);
    if (!(await client.query('SELECT 1 FROM web_users WHERE username=$1 AND active',[username.data])).rowCount) {await client.query('ROLLBACK');res.status(404).json({error:'Active user not found.'});return;}
    const before = (await client.query('SELECT role,active FROM organization_memberships WHERE organization_id=$1 AND username=$2',[scope.organizationId,username.data])).rows[0];
    const admins = Number((await client.query("SELECT count(*) FROM organization_memberships WHERE organization_id=$1 AND active AND role='admin'",[scope.organizationId])).rows[0].count);
    if (before?.active && before.role==='admin' && admins<=1 && (!body.data.active || body.data.role!=='admin')) {await client.query('ROLLBACK');res.status(409).json({error:'Keep at least one active administrator.'});return;}
    await client.query(`INSERT INTO organization_memberships(organization_id,username,role,active) VALUES ($1,$2,$3,$4)
      ON CONFLICT(organization_id,username) DO UPDATE SET role=EXCLUDED.role,active=EXCLUDED.active,updated_at=NOW()`,[scope.organizationId,username.data,body.data.role,body.data.active]);
    await client.query(`INSERT INTO organization_access_audit(organization_id,actor,subject,action,details) VALUES ($1,$2,$3,'membership', $4::jsonb)`,[scope.organizationId,scope.actor,username.data,JSON.stringify({before:before ?? null,after:body.data})]);
    await client.query('COMMIT');res.json({username:username.data,...body.data});
  } catch {await client.query('ROLLBACK');res.status(503).json({error:'Membership could not be updated.'});}
  finally {client.release();}
});
organizationAccessRouter.get('/audit',async (req,res) => {
  const offset = z.coerce.number().int().min(0).max(1000000).safeParse(req.query.offset ?? 0);
  if (!offset.success) {res.status(422).json({error:'Invalid pagination.'});return;}
  const events = (await query('SELECT * FROM domain_audit_events ORDER BY id DESC LIMIT 100 OFFSET $1',[offset.data])).rows;
  const access = (await pool.query('SELECT * FROM organization_access_audit WHERE organization_id=$1 ORDER BY id DESC LIMIT 100 OFFSET $2',[requestScope.getStore()!.organizationId,offset.data])).rows;
  res.json({events,access,offset:offset.data,limit:100});
});
