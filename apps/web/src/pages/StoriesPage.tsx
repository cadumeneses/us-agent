import { useEffect, useState } from 'react';
import { StoryTable } from '../components/StoryTable';
import { PageTitle } from '../components/ui';
import { api } from '../services/api';
import type { Story } from '../types/models';

export function StoriesPage() {
  const [stories, setStories] = useState<Story[]>([]);
  useEffect(() => { api.stories().then(setStories); }, []);
  return <section className="page"><PageTitle eyebrow="HISTÓRICO" title="Execuções e resultados">Consulte as classificações processadas pelo agente.</PageTitle><div className="card"><StoryTable stories={stories}/></div></section>;
}

export function SettingsPage() {
  return <section className="page"><PageTitle title="Configurações">Esta área será habilitada na próxima etapa de integração.</PageTitle></section>;
}
