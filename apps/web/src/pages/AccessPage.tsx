import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Plus } from 'lucide-react';
import { api } from '../services/api';
import { switchOrganization, type AccessContext } from '../services/organization';
import { PageTitle } from '../components/ui';

const roles: Record<string, string> = { viewer: 'Read projects, stories and recommendations.', reviewer: 'Read and review classifications and suggestions.', maintainer: 'Configure catalogs and run recommenders.', admin: 'Manage memberships, configuration and audit records.' };
type Member = { username: string; role: string; active: boolean };
export function AccessPage() {
  const [access, setAccess] = useState<AccessContext>(), [members, setMembers] = useState<Member[]>([]);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof api.audit>>>(), [offset, setOffset] = useState(0);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Member>(), [tab, setTab] = useState('members'), [refresh, setRefresh] = useState(0);
  const [editingExisting, setEditingExisting] = useState(false);
  const running = useRef(false);
  useEffect(() => {
    let mounted = true; setError(''); setLoading(true);
    api.accessContext().then(async context => {
      if (!mounted) return; setAccess(context);
      if (context.role === 'admin') {
        const [people, events] = await Promise.all([api.accessMembers(), api.audit(offset)]);
        if (mounted) { setMembers(people); setAudit(events); }
      }
    }).catch((failure: Error) => { if (mounted) setError(failure.message); }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [offset, refresh]);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!editing || running.current) return; running.current = true; setBusy(true); setError('');
    try { await api.updateMember(editing.username.trim(), editing.role, editing.active); setNotice(`Membership saved for ${editing.username.trim()}.`); setEditing(undefined); setRefresh(value => value + 1); }
    catch (failure) { setError((failure as Error).message); } finally { running.current = false; setBusy(false); }
  }
  return <section className="page access-page">
    <PageTitle eyebrow="ADMINISTRATION" title="Access and audit">Manage organization access and inspect recorded activity.</PageTitle>
    {notice && <p role="status" className="inline-success">{notice}</p>}
    {error && <div role="alert" className="inline-error"><p>{error}</p>{!editing && <button onClick={() => setRefresh(value => value + 1)}>Retry loading access</button>}</div>}
    {loading && <p role="status">Loading organization access…</p>}
    {access && <>
      <div className="card catalog-toolbar"><label>Organization<select disabled={busy || !!editing} value={access.organizationId} onChange={event => switchOrganization(event.target.value)}>{access.organizations.map(org => <option key={org.id} value={org.id}>{org.name}</option>)}</select></label><p>Signed in as <strong>{access.actor}</strong> · {access.role}</p></div>
      <details className="role-guide"><summary>What can each role do?</summary><dl>{Object.entries(roles).map(([name, description]) => <div key={name}><dt>{name}</dt><dd>{description}</dd></div>)}</dl></details>
      {access.role === 'admin' ? <>
        {!editing && <div className="section-navigation" role="group" aria-label="Access sections"><button aria-pressed={tab === 'members'} onClick={() => setTab('members')}>Members</button><button aria-pressed={tab === 'audit'} onClick={() => setTab('audit')}>Audit records</button></div>}
        {editing ? <section className="card form-workspace"><button className="back-link" disabled={busy} onClick={() => { setEditing(undefined); setError(''); }}><ArrowLeft size={17} aria-hidden="true"/>Cancel and return to members</button><h2>{members.some(row => row.username === editing.username) ? 'Edit membership' : 'Grant organization access'}</h2><p>Choose an existing application user and the permissions they need in this organization.</p><form onSubmit={event => void save(event)}><fieldset disabled={busy} className="configured-form-body"><label>Existing username<input autoFocus required pattern="[a-z][a-z0-9._-]{0,63}" maxLength={64} value={editing.username} readOnly={editingExisting} onChange={event => setEditing({ ...editing, username: event.target.value })}/></label><label>Role<select value={editing.role} onChange={event => setEditing({ ...editing, role: event.target.value })}>{Object.keys(roles).map(value => <option key={value}>{value}</option>)}</select><small>{roles[editing.role]}</small></label><label className="checkbox-label"><input type="checkbox" checked={editing.active} onChange={event => setEditing({ ...editing, active: event.target.checked })}/>Active membership</label><div className="form-actions"><button type="button" onClick={() => { setEditing(undefined); setError(''); }}>Cancel</button><button className="primary" disabled={!editing.username.trim()}>{busy ? 'Saving…' : 'Save membership'}</button></div></fieldset></form></section>
        : tab === 'members' ? <section className="card catalog-domain"><div className="workspace-heading"><div><h2>Organization members</h2><p>{members.length} members · Changes apply to this organization.</p></div><button className="primary" onClick={() => { setEditingExisting(false); setEditing({ username: '', role: 'viewer', active: true }); setNotice(''); setError(''); }}><Plus size={17} aria-hidden="true"/>Grant access</button></div><div className="table-scroll members-table"><table><caption className="sr-only">Organization memberships</caption><thead><tr><th scope="col">Username</th><th scope="col">Role</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead><tbody>{members.map(member => <tr key={member.username}><th scope="row">{member.username}</th><td data-label="Role">{member.role}</td><td data-label="Status"><span className={`badge ${member.active ? 'success' : ''}`}>{member.active ? 'Active' : 'Disabled'}</span></td><td data-label="Action"><button aria-label={`Edit access for ${member.username}`} onClick={() => { setEditingExisting(true); setEditing({ ...member }); setNotice(''); setError(''); }}>Edit access</button></td></tr>)}</tbody></table></div>{!loading && !members.length && <p className="empty">No members in this organization.</p>}</section>
        : <section className="card catalog-domain"><div className="workspace-heading"><div><h2>Audit records</h2><p>Review who changed a resource, the action and when it happened.</p></div></div><AuditTable title="Project and catalog activity" rows={audit?.events ?? []}/><AuditTable title="Access changes" rows={audit?.access ?? []}/><div className="pagination"><button disabled={loading || offset === 0} onClick={() => setOffset(value => Math.max(0, value - 100))}>Previous audit page</button><span>Page {offset / 100 + 1}</span><button disabled={loading || !audit || (audit.events.length < 100 && audit.access.length < 100)} onClick={() => setOffset(value => value + 100)}>Next audit page</button></div></section>}
      </> : <p className="context-note">Your role allows {roles[access.role]?.toLowerCase()} Contact an administrator to change organization memberships or view audit records.</p>}
    </>}
  </section>;
}

function AuditTable({ title, rows }: { title: string; rows: Array<Record<string, unknown>> }) {
  return <section className="audit-section"><h3>{title}</h3>{rows.length ? <div className="table-scroll"><table><caption className="sr-only">{title}</caption><thead><tr><th scope="col">When</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Resource</th><th scope="col">Details</th></tr></thead><tbody>{rows.map((row, index) => <tr key={String(row.id ?? index)}><td>{row.created_at ? new Date(String(row.created_at)).toLocaleString() : '—'}</td><td>{String(row.actor ?? '—')}</td><td>{String(row.operation ?? row.action ?? '—')}</td><td>{String(row.table_name ?? row.subject ?? '—')}</td><td><details><summary>View record</summary><pre className="configured-value">{JSON.stringify(row, null, 2)}</pre></details></td></tr>)}</tbody></table></div> : <p className="empty">No recorded activity on this page.</p>}</section>;
}
