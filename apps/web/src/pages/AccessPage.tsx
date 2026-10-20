import { useEffect,useState } from 'react';
import { api } from '../services/api';
import { switchOrganization,type AccessContext } from '../services/organization';
import { PageTitle } from '../components/ui';

export function AccessPage() {
  const [access,setAccess]=useState<AccessContext>(),[members,setMembers]=useState<Array<{username:string;role:string;active:boolean}>>([]);
  const [audit,setAudit]=useState<Awaited<ReturnType<typeof api.audit>>>(),[offset,setOffset]=useState(0),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [username,setUsername]=useState(''),[role,setRole]=useState('viewer'),[active,setActive]=useState(true),[refresh,setRefresh]=useState(0);
  useEffect(()=>{let mounted=true;setError('');api.accessContext().then(async context=>{
    if (!mounted) return;setAccess(context);
    if (context.role==='admin') { const [people,events]=await Promise.all([api.accessMembers(),api.audit(offset)]);if(mounted){setMembers(people);setAudit(events);} }
  }).catch((failure:Error)=>{if(mounted)setError(failure.message);});return()=>{mounted=false;};},[offset,refresh]);
  async function save() {setBusy(true);setError('');try{await api.updateMember(username,role,active);setRefresh(value=>value+1);}catch(failure){setError((failure as Error).message);}finally{setBusy(false);}}
  return <section className="page configured-page"><PageTitle eyebrow="GOVERNANCE" title="Access and audit">Choose an organization and manage authorized access.</PageTitle>
    {error&&<p role="alert">{error}</p>}
    {access&&<><label>Organization<select value={access.organizationId} onChange={event=>switchOrganization(event.target.value)}>{access.organizations.map(org=><option key={org.id} value={org.id}>{org.name}</option>)}</select></label><p>Signed in as {access.actor} · {access.role}</p>
      <p>Viewers read; reviewers assess suggestions; maintainers configure and run recommenders. Administrators also manage memberships and inspect audit records.</p>
      {access.role==='admin'&&<><section className="card configured-panel"><h2>Organization members</h2><ul>{members.map(member=><li key={member.username}><button onClick={()=>{setUsername(member.username);setRole(member.role);setActive(member.active);}}>{member.username} · {member.role} · {member.active?'active':'disabled'}</button></li>)}</ul>
        <fieldset disabled={busy}><label>Existing username<input value={username} onChange={event=>setUsername(event.target.value)}/></label><label>Role<select value={role} onChange={event=>setRole(event.target.value)}>{['viewer','reviewer','maintainer','admin'].map(value=><option key={value}>{value}</option>)}</select></label>
          <label><input type="checkbox" checked={active} onChange={event=>setActive(event.target.checked)}/>Active membership</label><button disabled={!username.trim()} onClick={()=>void save()}>Save membership</button></fieldset>
      </section><section className="card configured-panel"><h2>Audit records</h2><p>Records identify the actor, operation, and before/after hashes. Content and credentials are excluded.</p>
        <pre className="configured-value">{JSON.stringify(audit,null,2)}</pre><button disabled={offset===0} onClick={()=>setOffset(value=>Math.max(0,value-100))}>Previous audit page</button><button disabled={!audit||(audit.events.length<100&&audit.access.length<100)} onClick={()=>setOffset(value=>value+100)}>Next audit page</button>
      </section></>}
    </>}
  </section>;
}
