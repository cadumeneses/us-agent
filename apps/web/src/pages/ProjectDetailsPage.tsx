import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Plus } from 'lucide-react';
import { PageTitle } from '../components/ui';
import { ResearchProfile } from '../components/ResearchProfile';
import { StoryItemModal, type StoryEditor } from '../components/StoryItemModal';
import { ProjectStoryEditor } from '../components/ProjectStoryEditor';
import { api } from '../services/api';
import { useWorkspace } from '../services/workspace';
import type { PreparedProjectStory, ProjectStory, StoryDetails } from '../types/models';

const statusLabels: Record<string,string> = { unclassified:'Not classified',accepted_auto:'Automatically accepted',reviewed:'Reviewed',
  pending_review:'Pending review',taxonomy_gap:'Taxonomy gap',needs_rewrite:'Needs rewriting',reclassified:'Reclassified' };
export function ProjectDetailsPage() {
  const { projectName='' }=useParams();
  const [params,setParams]=useSearchParams();
  const workspace=useWorkspace();
  const [rows,setRows]=useState<ProjectStory[]>([]), [loaded,setLoaded]=useState<PreparedProjectStory>();
  const [loading,setLoading]=useState(true), [refresh,setRefresh]=useState(0);
  const [editor,setEditor]=useState<StoryEditor|null>(null), [storyEditor,setStoryEditor]=useState<'new'|'edit'|null>(null);
  const [saving,setSaving]=useState(false), [error,setError]=useState('');
  const selected=rows.find(row=>params.has('storyId') ? row.storyId===params.get('storyId') : row.classificationId===params.get('story')) ?? rows[0];
  const story=loaded?.storyId===selected?.storyId ? loaded : undefined;
  useEffect(()=>{
    let active=true;setLoading(true);setRows([]);setLoaded(undefined);setError('');
    api.projectStories(projectName).then(value=>{if(active)setRows(value);}).catch((reason:Error)=>{if(active)setError(reason.message);}).finally(()=>{if(active)setLoading(false);});
    return ()=>{active=false;};
  },[projectName,refresh]);
  useEffect(()=>{
    let active=true;setLoaded(undefined);
    if(selected)api.projectStory(selected.storyId).then(value=>{if(active)setLoaded(value);}).catch((reason:Error)=>{if(active)setError(reason.message);});
    return ()=>{active=false;};
  },[selected?.storyId,selected?.revision,selected?.classificationId]);
  function saved(value:PreparedProjectStory){
    setRows(current=>[value,...current.filter(row=>row.storyId!==value.storyId)]);setLoaded(value);
    setParams({storyId:value.storyId});setEditor(null);setStoryEditor(null);
  }
  async function saveDetails(details:StoryDetails){
    if(!story||saving)return;setSaving(true);setError('');
    try{saved(await api.saveProjectStory(story,story.text,details));}
    catch(reason){setError((reason as Error).message);}finally{setSaving(false);}
  }
  if(workspace.loading)return <section className="page"><p className="state">Loading project…</p></section>;
  if(!workspace.projects.includes(projectName))return <section className="page"><PageTitle title="Project not found">This project does not exist.</PageTitle><Link to="/projects">Back to projects</Link></section>;
  const recommendationUrl=`/recommendations?project=${encodeURIComponent(projectName)}&recommender=${story?.classificationId ? `&classificationId=${encodeURIComponent(story.classificationId)}` : ''}`;
  return <section className="page project-details-page">
    <Link className="back-link" to="/projects"><ArrowLeft size={15}/> My Projects</Link>
    <PageTitle eyebrow="PROJECT DETAILS" title={projectName}>Prepare stories and tasks, classify them when ready, and choose a recommender.</PageTitle>
    <div className="project-detail-toolbar"><span>{rows.length} stor{rows.length===1?'y':'ies'} · {rows.filter(row=>!row.classificationId).length} not classified</span>
      <Link className="project-action" to={recommendationUrl}>Recommenders</Link><button type="button" className="primary project-action" disabled={saving} onClick={()=>setStoryEditor('new')}><Plus size={16}/> Add user story</button></div>
    <ResearchProfile project={projectName}/>
    {error&&<div className="inline-error" role="alert"><p>{error}</p><button disabled={saving} onClick={()=>{setEditor(null);setRefresh(value=>value+1);}}>Reload project stories</button></div>}
    <div className="project-detail-grid"><section className="card project-story-panel"><h2>Project stories</h2><p>{loading?'Loading stories…':rows.length?'Select a story to prepare its tasks or view its classification.':'Add a user story, prepare its tasks, then classify it.'}</p>
      <div className="project-story-list">{rows.map(row=><button disabled={saving} className={selected?.storyId===row.storyId?'selected':''} key={row.storyId} onClick={()=>{setEditor(null);setError('');setParams({storyId:row.storyId});}}><b>US-{row.storyId} · {row.sprint}</b><span>{row.text}</span><small>{statusLabels[row.status]??row.status}</small></button>)}</div></section>
      {selected&&!story&&<p role="status">Loading story details…</p>}
      {story&&<div className="project-story-details"><article className="card story-header"><div className="story-code"><span>US-{story.storyId}</span><span className="sprint-chip">{story.sprint}</span><span className="status-chip">{statusLabels[story.status]??story.status}</span></div><h1>{story.text}</h1>
        {story.classificationId?<p>Classification: <strong>{story.labels.map(label=>`${label.module} / ${label.operation}`).join(' · ')}</strong> · {Math.round(story.confidence*100)}% confidence · taxonomy {story.taxonomyVersion||'not specified'}</p>:<p>This story is saved. Add its tasks below before classifying.</p>}
        <div className="configured-actions">{!story.classificationId&&<button disabled={saving} onClick={()=>setStoryEditor('edit')}>Edit story</button>}
          {!saving&&<Link className="project-action" to={`/classify?project=${encodeURIComponent(projectName)}&storyId=${story.storyId}`}>{story.classificationId?'Reclassify story':'Classify story'}</Link>}
          {story.status==='pending_review'&&<Link to={`/review?classificationId=${story.classificationId}`}>Review classification</Link>}
          {story.classificationId&&<Link to={recommendationUrl}>Choose a recommender</Link>}</div>
      </article>
      <div className="project-detail-sections"><section className="detail-card card"><div className="detail-head"><div><h2>Tasks</h2><p>Prepare categories and technologies before classification.</p></div><button disabled={saving} onClick={()=>setEditor({kind:'task'})}><Plus size={16}/> Add</button></div><div className="details-list">
        {story.details.tasks.length?story.details.tasks.map((item,index)=><button disabled={saving} className="detail-row" key={item.id} onClick={()=>setEditor({kind:'task',index})}><span>{item.title}</span><small>{item.category||'Uncategorized'}</small></button>):<div className="empty">No tasks yet. Add the work needed for this story.</div>}
      </div></section>
      <section className="detail-card card"><div className="detail-head"><div><h2>Linked NFRs</h2><p>NFRs associated with this story.</p></div></div><div className="details-list">{story.details.nonFunctionalRequirements.length?story.details.nonFunctionalRequirements.map(item=><div className="detail-row" key={item.id}><span>{item.description}</span><small>{item.type} · {item.metric}</small></div>):<div className="empty">No NFRs linked yet.</div>}</div></section></div></div>}
    </div>
    {editor&&story&&<StoryItemModal key={`${story.storyId}-${editor.kind}-${editor.index??'new'}`} editor={editor} details={story.details} module={story.module} operation={story.operation} saving={saving} onClose={()=>setEditor(null)} onSave={details=>void saveDetails(details)}/>}
    {storyEditor&&<ProjectStoryEditor key={`${storyEditor}-${storyEditor==='edit'?story?.storyId:''}`} project={projectName} story={storyEditor==='edit'?story:undefined} onSaved={saved} onClose={()=>setStoryEditor(null)}/>}
  </section>;
}
