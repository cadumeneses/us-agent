import { useRef, useState } from 'react';
import { ArrowLeft, ChevronRight, FolderTree, List, Plus, Search } from 'lucide-react';
import { recommenderApi } from '../services/recommender-api';
import type { ConfiguredTaxonomy, TaxonomyRecord } from '../types/configurable-recommendations';
import { ReferenceDetails } from './ConfiguredRunDetails';
import { CatalogState, useCatalog, versionKey } from './VersionCatalog';
import { IdentityFields } from './RecommenderEditors';

const empty = (): ConfiguredTaxonomy => ({ schemaVersion: 1, id: '', version: '', name: '', kind: 'list', selection: 'any', source: '', nodes: [{ id: '', name: '', description: '', parentId: null }] });
function treeEntries(nodes: ConfiguredTaxonomy['nodes']) {
  const groups = new Map<string | null, Array<{item: typeof nodes[number]; index: number}>>();
  nodes.forEach((item,index) => { const siblings = groups.get(item.parentId) ?? []; siblings.push({item,index}); groups.set(item.parentId,siblings); });
  const stack = (groups.get(null) ?? []).map(entry => ({...entry,depth:0})).reverse();
  const ordered: Array<{item: typeof nodes[number]; index: number; depth: number}> = [], visited = new Set<number>();
  while (stack.length) { const entry=stack.pop()!; if(visited.has(entry.index))continue; visited.add(entry.index); ordered.push(entry);
    if(entry.item.id) for(const child of [...(groups.get(entry.item.id) ?? [])].reverse())stack.push({...child,depth:entry.depth+1}); }
  nodes.forEach((item,index)=>{if(!visited.has(index))ordered.push({item,index,depth:0});});
  return ordered;
}
export function TaxonomyEditor({ refresh, changed, busy, setBusy, onEditing, initialDraft }: { refresh: number; changed: () => void; busy: boolean; setBusy: (value: boolean) => void; onEditing?: (value: boolean) => void; initialDraft?: ConfiguredTaxonomy }) {
  const catalog = useCatalog(recommenderApi.taxonomyVersions, refresh);
  const [draft, setDraft] = useState<ConfiguredTaxonomy | undefined>(() => initialDraft && structuredClone(initialDraft)), [saved, setSaved] = useState<TaxonomyRecord>(), [signature, setSignature] = useState('');
  const [query, setQuery] = useState(''), [nodeQuery, setNodeQuery] = useState(''), [selected, setSelected] = useState(0);
  const [error, setError] = useState(''), [message, setMessage] = useState('');
  const [showRetired, setShowRetired] = useState(false);
  const running = useRef(false), readonly = !!saved && saved.state !== 'draft';
  const dirty = !!draft && signature !== JSON.stringify(draft);
  async function action(task: () => Promise<void>) {
    if (running.current) return; running.current = true; setBusy(true); setError(''); setMessage('');
    try { await task(); } catch (reason) { setError((reason as Error).message); } finally { running.current = false; setBusy(false); }
  }
  const receive = (record: TaxonomyRecord) => { setDraft(structuredClone(record.snapshot.content)); setSaved(record); setSignature(JSON.stringify(record.snapshot.content)); setSelected(0); setNodeQuery(''); onEditing?.(true); };
  const back = () => { if (dirty && !window.confirm('Discard unsaved taxonomy changes and return to the catalog?')) return; setDraft(undefined); setSaved(undefined); setError(''); setMessage(''); onEditing?.(false); };
  const editNode = (key: keyof ConfiguredTaxonomy['nodes'][number], value: string | boolean | null) => setDraft(current => current && ({ ...current, nodes: current.nodes.map((node, index) => {
    if (index === selected) return { ...node, [key]: value, ...(current.id === 'wis' && key === 'parentId' ? { selectable: value !== null } : {}) };
    return key === 'id' && current.nodes[selected].id && node.parentId === current.nodes[selected].id ? { ...node, parentId: value as string } : node;
  }) }));
  const node = draft?.nodes[selected];
  const wis = draft?.id === 'wis';
  function addNode(parentId: string | null = null) {
    if (!draft) return;
    setSelected(draft.nodes.length); setNodeQuery('');
    setDraft({ ...draft, nodes: [...draft.nodes, { id: `node-${crypto.randomUUID()}`, name: '', description: '', parentId, ...(wis ? { selectable: parentId !== null } : {}) }] });
  }
  const children = node && draft?.nodes.some(value => value.parentId === node.id && node.id !== '');
  const rows = catalog.rows.filter(row => (showRetired || row.state !== 'retired') && `${row.name} ${row.version} ${row.state}`.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()));
  return <section className="catalog-workspace" aria-label="Taxonomy editor">
    {!draft ? <>
      <div className="workspace-heading"><div><h2>Taxonomies</h2><p>Browse versions before opening a taxonomy. Create and edit in a separate workspace.</p></div><button type="button" className="primary" disabled={busy} onClick={() => { setDraft(empty()); setSaved(undefined); setSignature(''); setSelected(0); setError(''); setMessage(''); onEditing?.(true); }}><Plus size={17} aria-hidden="true"/>New taxonomy</button></div>
      <label className="search-field catalog-search"><span>Search taxonomies</span><span><Search size={17} aria-hidden="true"/><input type="search" placeholder="Name, version or state" value={query} onChange={event => setQuery(event.target.value)}/></span></label>
      <label className="checkbox-label"><input type="checkbox" checked={showRetired} onChange={event => setShowRetired(event.target.checked)}/>Include retired versions</label>
      <CatalogState catalog={catalog} title="taxonomy versions"/>
      <div className="reference-cards">{rows.map(row => <article className="card reference-card" key={versionKey(row)}><div className="reference-card-title">{row.kind === 'tree' ? <FolderTree size={21} aria-hidden="true"/> : <List size={21} aria-hidden="true"/>}<span className={`badge ${row.state === 'published' ? 'success' : ''}`}>{row.state}</span></div><h3>{row.name}</h3><p>Version {row.version} · {row.nodeCount} nodes · {row.id === 'wis' ? 'Module / operation tree' : row.kind === 'tree' ? 'Tree' : 'List'}</p><button type="button" disabled={busy} onClick={() => void action(async () => receive(await recommenderApi.taxonomyVersion(row.id, row.version)))}>Open taxonomy<ChevronRight size={16} aria-hidden="true"/></button></article>)}</div>
      {!catalog.loading && !catalog.error && !rows.length && <div className="card empty">{query ? 'No taxonomies match this search.' : 'No taxonomies yet. Create a list or tree for your recommender attributes.'}</div>}
    </> : <div className="card form-workspace taxonomy-edit-workspace">
      <button type="button" className="back-link" disabled={busy} onClick={back}><ArrowLeft size={17} aria-hidden="true"/>Back to taxonomies</button>
      <div className="workspace-heading"><div><span className="eyebrow">{readonly ? 'TAXONOMY DETAILS' : saved ? 'EDIT DRAFT' : 'NEW TAXONOMY'}</span><h2>{draft.name || 'New taxonomy'}</h2><p>{readonly ? 'This version is preserved. Create a new draft version to extend it.' : 'Define the taxonomy, then select a node to edit its content.'}</p></div><span className="badge">{saved?.state ?? 'draft'}</span></div>
      <p role="status">{readonly ? 'Read-only version' : dirty ? 'Unsaved changes' : 'Draft saved'}</p>
      {readonly && <button type="button" disabled={busy} onClick={() => { setDraft({ ...structuredClone(draft), version: '' }); setSaved(undefined); setSignature(''); }}>Create a new taxonomy version</button>}
      <fieldset disabled={busy || readonly} className="configured-form-body">
        <IdentityFields value={draft} onChange={(key, value) => setDraft({ ...draft, [key]: value, ...(key === 'id' && value === 'wis' ? { kind: 'tree', selection: 'leaf', nodes: draft.nodes.map(node => ({ ...node, selectable: node.parentId !== null })) } : {}) })}/>
        <label>Taxonomy source<textarea maxLength={2000} rows={2} value={draft.source} onChange={event => setDraft({ ...draft, source: event.target.value })}/></label>
        <div className="configured-editor-grid"><label>Structure<select disabled={wis} value={draft.kind} onChange={event => setDraft({ ...draft, kind: event.target.value as ConfiguredTaxonomy['kind'] })}><option value="list">List</option><option value="tree">Tree</option></select></label><label>Selectable nodes<select disabled={wis} value={draft.selection} onChange={event => setDraft({ ...draft, selection: event.target.value as ConfiguredTaxonomy['selection'] })}><option value="any">Any node</option><option value="leaf">Leaves only</option></select></label></div>
        {wis && <p className="context-note">WIS has two levels: <strong>module → operation</strong>. Modules group their operations. Save and publish a new version to make changes available for classification and recommender attributes.</p>}
      </fieldset>
      <div className="workspace-heading"><div><h3>{wis ? 'Modules and operations' : 'Nodes'} ({draft.nodes.length})</h3><p>Select one node at a time to inspect its name, description and position in the tree.</p></div>{!readonly && <div className="configured-actions"><button type="button" disabled={busy || draft.nodes.length >= 5000} onClick={() => addNode()}><Plus size={16} aria-hidden="true"/>{wis ? 'Add module' : 'Add node'}</button>{wis && <button type="button" disabled={busy || !node?.id || draft.nodes.length >= 5000} onClick={() => addNode(node?.parentId || node?.id || null)}><Plus size={16} aria-hidden="true"/>Add operation</button>}</div>}</div>
      <div className="node-workspace"><aside><label>Find a node<input type="search" placeholder="Name or ID" value={nodeQuery} onChange={event => setNodeQuery(event.target.value)}/></label><div className="node-list" role="group" aria-label="Taxonomy nodes">{treeEntries(draft.nodes).filter(({item}) => `${item.name} ${item.id}`.toLocaleLowerCase().includes(nodeQuery.toLocaleLowerCase())).map(({item, index,depth}) => <button type="button" key={index} data-depth={depth} style={{paddingLeft:12+Math.min(depth,6)*16}} disabled={busy} aria-pressed={index === selected} onClick={() => setSelected(index)}><span>{item.name || `Unnamed node ${index + 1}`}</span><small>{wis ? item.parentId ? `Operation · ${draft.nodes.find(parent => parent.id === item.parentId)?.name || item.parentId}` : 'Module' : item.parentId ? draft.nodes.find(parent => parent.id === item.parentId)?.name || item.parentId : 'Root node'}</small></button>)}</div></aside>
        {node && <fieldset disabled={busy || readonly} className="node-detail configured-form-body"><legend>{readonly ? 'Node details' : 'Edit selected node'}</legend><label>{wis ? node.parentId ? 'Operation name' : 'Module name' : 'Node name'}<input value={node.name} maxLength={wis && node.parentId === null ? 120 : 180} onChange={event => editNode('name', event.target.value)}/></label><label>Node description<textarea rows={4} value={node.description} onChange={event => editNode('description', event.target.value)}/></label>
          {draft.kind === 'tree' && <label>{wis ? 'Module' : 'Parent node'}<select value={node.parentId ?? ''} onChange={event => editNode('parentId', event.target.value || null)}><option value="">{wis ? 'This node is a module' : 'No parent (root)'}</option>{draft.nodes.filter((item, index) => index !== selected && item.id && (!wis || item.parentId === null)).map((item,index) => <option key={index} value={item.id}>{item.name || item.id}</option>)}</select></label>}
          <label className="checkbox-label"><input disabled={wis && node.parentId === null} type="checkbox" checked={node.selectable !== false} onChange={event => editNode('selectable', event.target.checked)}/>Available for selection</label>
          <details className="technical-details" open={!node.id}><summary>Node identifiers</summary><label>Node ID<input value={node.id} onChange={event => editNode('id', event.target.value)}/><small>Use a unique stable ID. Parent links use this ID.</small></label><label>Parent ID (empty for root)<input value={node.parentId ?? ''} onChange={event => editNode('parentId', event.target.value || null)}/></label></details>
          {!readonly && <><button type="button" className="danger-text" disabled={busy || !!children || draft.nodes.length === 1} onClick={() => { setDraft({ ...draft, nodes: draft.nodes.filter((_,index) => index !== selected) }); setSelected(Math.max(0,selected-1)); }}>Remove selected node</button>{children && <small>Move child nodes to another parent before removing this node.</small>}</>}
        </fieldset>}
      </div>
      <details className="technical-details"><summary>Version reference and full content</summary>{saved && <ReferenceDetails title={readonly ? 'Published taxonomy' : 'Reviewable draft'} reference={{ id: saved.snapshot.content.id, version: saved.snapshot.content.version, format: saved.snapshot.format, sha256: saved.snapshot.sha256 }}/>}<pre className="configured-value">{JSON.stringify(draft, null, 2)}</pre></details>
      {!readonly && <div className="form-actions"><button type="button" disabled={busy} onClick={() => void action(async () => { receive(await recommenderApi.saveTaxonomy(draft)); setMessage('Draft saved. Review the nodes before publishing.'); changed(); })}>{busy ? 'Processing…' : 'Save taxonomy draft'}</button><button type="button" className="primary" disabled={busy || !saved || dirty} onClick={() => void action(async () => { receive(await recommenderApi.publishTaxonomy(draft.id, draft.version, saved!.snapshot.sha256)); setMessage('Taxonomy published. Recommender attributes can now use this version.'); changed(); })}>Publish reviewed taxonomy</button></div>}
    </div>}
    {error && <p role="alert" className="inline-error">{error}</p>}{message && <p role="status" className="inline-success">{message}</p>}
  </section>;
}
