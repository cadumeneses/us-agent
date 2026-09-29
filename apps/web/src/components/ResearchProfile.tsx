import { useEffect, useId, useRef, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import type { ProjectResearchProfile, ResearchTechnologies, Taxonomy } from '../types/models';

export const emptyTechnologies = (): ResearchTechnologies => ({ languages: [], frameworks: [], apis: [], dataPersistence: [] });
const technologyLabels: Record<keyof ResearchTechnologies, string> = {
  languages: 'Programming languages', frameworks: 'Frameworks', apis: 'APIs', dataPersistence: 'Data persistence'
};
// Initial suggestions from Ramos (2019), sections 5.2.1–5.2.2 and table 5.2.
// They are examples, not a complete or authoritative taxonomy of project tags.
const profileOptions = {
  platforms: ['Web', 'Mobile', 'Desktop', 'Embedded'],
  applicationDomains: ['Home automation', 'Banking', 'Education', 'Developer tools', 'Information retrieval', 'Healthcare'],
  architectures: ['Layered', 'Client-server', 'MVC'],
  languages: ['Java', 'JavaScript', 'Python', 'TypeScript'],
  frameworks: ['Angular', 'Django', 'Node', 'Spring Boot'],
  apis: ['Facebook', 'Firebase', 'JPA', 'Mongoose'],
  dataPersistence: ['MongoDB', 'MySQL']
} as const;

function searchText(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en-US');
}

export function TagField({ label, values, options = [], onChange }: { label: string; values: string[]; options?: readonly string[]; onChange: (values: string[]) => void }) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const query = searchText(text.trim());
  const suggestions = options.filter(option => !values.some(value => searchText(value) === searchText(option)) && (!query || searchText(option).includes(query)));
  const exactMatch = [...values, ...options].some(value => searchText(value) === query);
  const custom = text.trim() && !exactMatch ? text.trim() : '';

  function add(value: string) {
    const trimmed = value.trim();
    if (!trimmed || values.length >= 100) return;
    if (values.some(item => searchText(item) === searchText(trimmed))) { setText(''); setOpen(false); return; }
    onChange([...values, trimmed]);
    setText(''); setActive(0); setOpen(true);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') { event.preventDefault(); setOpen(true); setActive(index => Math.min(index + 1, Math.max(0, suggestions.length + (custom ? 1 : 0) - 1))); }
    if (event.key === 'ArrowUp') { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
    if (event.key === 'Escape') setOpen(false);
    if (event.key === 'Enter') {
      event.preventDefault();
      const selected = suggestions[active] ?? custom;
      if (selected) add(selected);
    }
  }

  return <div className="tag-field">
    <label htmlFor={id}>{label}</label>
    <div className="tag-input-wrap" onClick={() => inputRef.current?.focus()}>
      {values.map(value => <span className="tag-chip" key={value}>{value}<button type="button" aria-label={`Remove ${value}`} onMouseDown={event => event.preventDefault()} onClick={() => onChange(values.filter(item => item !== value))}><X size={12}/></button></span>)}
      <input ref={inputRef} id={id} value={text} maxLength={120} role="combobox" aria-autocomplete="list" aria-expanded={open} aria-controls={`${id}-options`} aria-activedescendant={open && suggestions[active] ? `${id}-option-${active}` : undefined} placeholder={values.length ? 'Add another tag' : 'Search or add a tag'} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} onBlur={() => { if (text.trim()) add(options.find(option => searchText(option) === query) ?? text); setOpen(false); }} onChange={event => { setText(event.target.value); setActive(0); setOpen(true); }} onKeyDown={handleKeyDown}/>
      <button className="tag-add-button" type="button" aria-label={`Add ${text || 'tag'}`} disabled={!custom || values.length >= 100} onMouseDown={event => event.preventDefault()} onClick={() => add(custom)}><Plus size={15}/></button>
    </div>
    {open && suggestions.length > 0 && <div className="tag-options" id={`${id}-options`} role="listbox">{suggestions.map((option, index) => <button type="button" role="option" id={`${id}-option-${index}`} aria-selected={active === index} className={active === index ? 'active' : ''} key={option} onMouseDown={event => event.preventDefault()} onClick={() => add(option)}>{option}</button>)}</div>}
    {open && custom && <button className="tag-custom-option" type="button" onMouseDown={event => event.preventDefault()} onClick={() => add(custom)}>Add “{custom}” as a new tag</button>}
  </div>;
}

export function TechnologyFields({ value, onChange }: { value: ResearchTechnologies; onChange: (value: ResearchTechnologies) => void }) {
  return <>{(Object.keys(technologyLabels) as Array<keyof ResearchTechnologies>).map(key => <TagField key={key} label={technologyLabels[key]} values={value[key]} options={profileOptions[key]} onChange={tags => onChange({ ...value, [key]: tags })}/>)}</>;
}

export function ResearchProfile({ project }: { project: string }) {
  const [profile, setProfile] = useState<ProjectResearchProfile>();
  const [taxonomies, setTaxonomies] = useState<Taxonomy['taxonomies']>([]);
  const [inactiveTaxonomy, setInactiveTaxonomy] = useState('');
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let active = true;
    setProfile(undefined); setError(''); setSaved(false); setInactiveTaxonomy('');
    Promise.all([api.projectResearchProfile(project), api.taxonomy()]).then(([value, catalog]) => {
      if (!active) return;
      const available = catalog.taxonomies.filter(item => item.active && item.operations > 0);
      const outdated = value.taxonomyVersion && !available.some(item => item.version === value.taxonomyVersion) ? value.taxonomyVersion : '';
      setTaxonomies(available);
      setInactiveTaxonomy(outdated);
      setProfile(outdated ? { ...value, taxonomyVersion: '' } : value);
    }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; };
  }, [project]);
  function update(value: ProjectResearchProfile) { setProfile(value); setSaved(false); }
  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!profile) return;
    setSaving(true); setError(''); setSaved(false);
    try { setProfile(await api.saveProjectResearchProfile(project, profile)); setInactiveTaxonomy(''); setSaved(true); }
    catch (reason) { setError((reason as Error).message); }
    finally { setSaving(false); }
  }
  return <details className="card research-profile"><summary>Project profile · {project}</summary>
    <p>Choose the taxonomy for future classifications and describe the project with tags. Previously classified stories retain the version used when they were processed.</p>
    {error && <p role="alert" className="inline-error">{error}</p>}
    {!profile ? <p>{error ? 'The profile could not be loaded.' : 'Loading profile…'}</p> : <form onSubmit={save}><fieldset disabled={saving}>
      <label>Taxonomy for story classification<select required value={profile.taxonomyVersion} onChange={event => update({ ...profile, taxonomyVersion: event.target.value })}><option value="">Select a taxonomy</option>{taxonomies.map(item => <option key={item.version} value={item.version}>{item.version} · {item.modules} modules · {item.operations} operations</option>)}</select><small>{inactiveTaxonomy ? `Version ${inactiveTaxonomy} is not available for classification. Choose another. ` : ''}Changing this choice does not reclassify existing stories.</small>{!taxonomies.length && <Link to="/taxonomy">Configure a taxonomy with operations</Link>}</label>
      <TagField label="Platforms" values={profile.platforms} options={profileOptions.platforms} onChange={platforms => update({ ...profile, platforms })}/>
      <TagField label="Application domains" values={profile.applicationDomains} options={profileOptions.applicationDomains} onChange={applicationDomains => update({ ...profile, applicationDomains })}/>
      <label>Purpose<select value={profile.objective} onChange={event => update({ ...profile, objective: event.target.value as ProjectResearchProfile['objective'] })}><option value="">Not specified</option><option value="product">Product</option><option value="prototype">Prototype</option></select></label>
      <TagField label="Software architectures" values={profile.architectures} options={profileOptions.architectures} onChange={architectures => update({ ...profile, architectures })}/>
      <TechnologyFields value={profile.technologies} onChange={technologies => update({ ...profile, technologies })}/>
      <button className="primary" type="submit">{saving ? 'Saving…' : 'Save profile'}</button>
      {saved && <span role="status">Profile saved.</span>}
    </fieldset></form>}
  </details>;
}
