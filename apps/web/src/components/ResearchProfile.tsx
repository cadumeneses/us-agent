import { useEffect, useState } from 'react';
import { api } from '../services/api';
import type { ProjectResearchProfile, ResearchTechnologies } from '../types/models';

export const emptyTechnologies = (): ResearchTechnologies => ({ languages: [], frameworks: [], apis: [], dataPersistence: [] });
const technologyLabels: Record<keyof ResearchTechnologies, string> = {
  languages: 'Linguagens de programação', frameworks: 'Frameworks', apis: 'APIs', dataPersistence: 'Persistência de dados'
};

export function TagField({ label, values, onChange }: { label: string; values: string[]; onChange: (values: string[]) => void }) {
  const [text, setText] = useState(values.join('; '));
  useEffect(() => { setText(values.join('; ')); }, [values]);
  return <label>{label}<input value={text} maxLength={12100} placeholder="Separe os valores por ponto e vírgula" onChange={event => setText(event.target.value)} onBlur={() => onChange([...new Set(text.split(';').map(value => value.trim()).filter(Boolean))])}/></label>;
}

export function TechnologyFields({ value, onChange }: { value: ResearchTechnologies; onChange: (value: ResearchTechnologies) => void }) {
  return <>{(Object.keys(technologyLabels) as Array<keyof ResearchTechnologies>).map(key => <TagField key={key} label={technologyLabels[key]} values={value[key]} onChange={tags => onChange({ ...value, [key]: tags })}/>)}</>;
}

export function ResearchProfile({ project }: { project: string }) {
  const [profile, setProfile] = useState<ProjectResearchProfile>();
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setProfile(undefined); setError(''); setSaved(false);
    api.projectResearchProfile(project).then(value => { if (active) setProfile(value); }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [project]);
  function update(value: ProjectResearchProfile) { setProfile(value); setSaved(false); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true); setError(''); setSaved(false);
    try { setProfile(await api.saveProjectResearchProfile(project, profile)); setSaved(true); }
    catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }
  return <details className="card research-profile"><summary>Perfil do projeto · {project}</summary>
    <p>Contexto compartilhado pelas US: plataforma, domínio de aplicação, objetivo, arquitetura e tecnologias.</p>
    {error && <p role="alert" className="inline-error">{error}</p>}
    {!profile ? <p>{error ? 'Não foi possível carregar o perfil.' : 'Carregando perfil…'}</p> : <form onSubmit={save}><fieldset disabled={saving}>
      <TagField label="Plataformas" values={profile.platforms} onChange={platforms => update({ ...profile, platforms })}/>
      <TagField label="Domínios de aplicação" values={profile.applicationDomains} onChange={applicationDomains => update({ ...profile, applicationDomains })}/>
      <label>Objetivo<select value={profile.objective} onChange={event => update({ ...profile, objective: event.target.value as ProjectResearchProfile['objective'] })}><option value="">Não informado</option><option value="product">Produto</option><option value="prototype">Protótipo</option></select></label>
      <TagField label="Arquiteturas de software" values={profile.architectures} onChange={architectures => update({ ...profile, architectures })}/>
      <TechnologyFields value={profile.technologies} onChange={technologies => update({ ...profile, technologies })}/>
      <button className="primary" type="submit">{saving ? 'Salvando…' : 'Salvar perfil'}</button>
      {saved && <span role="status">Perfil salvo.</span>}
    </fieldset></form>}
  </details>;
}
