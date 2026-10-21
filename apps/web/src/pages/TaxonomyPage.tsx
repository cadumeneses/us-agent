import { useState } from 'react';
import { TaxonomyEditor } from '../components/TaxonomyEditor';
import { PageTitle } from '../components/ui';

export function TaxonomyPage() {
  const [refresh, setRefresh] = useState(0), [busy, setBusy] = useState(false);
  return <section className="page taxonomy-page">
    <PageTitle eyebrow="KNOWLEDGE" title="Taxonomies">Browse, extend and publish taxonomies for classification and recommender attributes.</PageTitle>
    <TaxonomyEditor refresh={refresh} changed={() => setRefresh(value => value + 1)} busy={busy} setBusy={setBusy}/>
  </section>;
}
