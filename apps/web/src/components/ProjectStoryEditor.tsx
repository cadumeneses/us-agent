import { useRef, useState } from 'react';
import { api } from '../services/api';
import { Modal } from './Modal';
import type { PreparedProjectStory } from '../types/models';

export function ProjectStoryEditor({ project, story, onSaved, onClose }: {
  project: string; story?: PreparedProjectStory; onSaved: (value: PreparedProjectStory) => void; onClose: () => void;
}) {
  const [text,setText] = useState(story?.text ?? '');
  const [sprint,setSprint] = useState(story?.sprint ?? 'Backlog');
  const [busy,setBusy] = useState(false), [error,setError] = useState('');
  const pending = useRef<{ key: string; requestId: string } | null>(null);
  const running = useRef(false);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (running.current) return;
    running.current=true; setBusy(true); setError('');
    try {
      const payload={ project,sprint:sprint.trim(),text:text.trim() };
      const key=JSON.stringify(payload);
      if (!pending.current || pending.current.key!==key) pending.current={ key,requestId:crypto.randomUUID() };
      const saved=story ? await api.saveProjectStory(story,payload.text,story.details)
        : await api.createProjectStory({ ...payload,requestId:pending.current.requestId });
      onSaved(saved);
    } catch (reason) { setError((reason as Error).message); }
    finally { running.current=false; setBusy(false); }
  }
  return <Modal label={story ? 'Edit story' : 'Add user story'} busy={busy} onClose={onClose}><form className="project-modal card" aria-labelledby="story-editor-title" onSubmit={event => void save(event)}>
    <div className="modal-head"><h2 id="story-editor-title">{story ? 'Edit story' : 'Add user story'}</h2><button type="button" aria-label="Close" disabled={busy} onClick={onClose}>×</button></div>
    <p>Save the story first, add its tasks, then classify it when ready.</p>
    <fieldset disabled={busy}><label>Sprint<input required maxLength={120} value={sprint} disabled={!!story} onChange={event => setSprint(event.target.value)}/></label>
      <label>User story<textarea autoFocus required minLength={10} maxLength={20000} value={text} onChange={event => setText(event.target.value)}/></label></fieldset>
    {error && <p role="alert" className="inline-error">{error}</p>}
    <div className="modal-actions"><button type="button" disabled={busy} onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={busy || text.trim().length<10 || !sprint.trim()}>{busy ? 'Saving…' : 'Save story'}</button></div>
  </form></Modal>;
}
