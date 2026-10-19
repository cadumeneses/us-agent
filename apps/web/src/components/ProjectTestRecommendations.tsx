import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../services/api';
import { initialValues, taxonomyOptions } from '../services/configured-input';
import { recommenderApi } from '../services/recommender-api';
import type { ConfiguredInput, DatasetSummary, DefinitionRecord, DefinitionSummary, JsonValue } from '../types/configurable-recommendations';
import type { Story } from '../types/models';
import type { NfrContext } from '../types/nfr';
import { TEST_CASE_METHOD } from '../types/test-case-recommendations';
import { CatalogState, useCatalog, versionKey } from './VersionCatalog';
import { TestCaseExecutionForm } from './TestCaseExecutionForm';
import { ConfiguredRunDetails } from './ConfiguredRunDetails';

type Publication = DefinitionRecord & { snapshot: NonNullable<DefinitionRecord['snapshot']> };

// Copy only declared bindings and compatible values. Taxonomy names are not IDs:
// unmatched operational values remain for explicit selection in the published form.
function projectInput(record: Publication, target: NfrContext['target'], labelIndex: number): ConfiguredInput {
  const { definition, taxonomies } = record.snapshot.content;
  const values = initialValues(definition);
  const label = target.labels[labelIndex];
  const source: Record<string, string | string[]> = {
    story_id: target.storyId, module: label?.module ?? '', operation: label?.operation ?? '',
    platforms: target.projectProfile.platforms,
    application_domain: target.projectProfile.applicationDomains.length === 1 ? target.projectProfile.applicationDomains[0] : ''
  };
  for (const [slot, raw] of Object.entries(source)) {
    const attribute = definition.attributes.find(row => row.id === definition.method.bindings[slot]);
    if (!attribute) continue;
    const type = attribute.valueType;
    const accepts = (value: string) => type.type === 'taxonomy_node'
      ? taxonomyOptions(type, taxonomies).some(option => option.id === value)
      : type.type === 'enum' ? type.values.includes(value) : type.type === 'text' || type.type === 'category';
    if (Array.isArray(raw)) {
      // Do not silently drop unknown members and present a partial profile as complete.
      if (raw.every(accepts)) values[attribute.id] = [...new Set(raw)];
    } else if (raw && accepts(raw)) values[attribute.id] = raw;
  }
  return { id: target.storyId, values, provenance: {
    source: `Projeto ${target.project}; perfil e classificação ${target.classificationId}`,
    sourceRecordId: target.classificationId
  } };
}

export function ProjectTestRecommendations({ story, busy, onBusy }: {
  story: Story; busy: boolean; onBusy: (value: boolean) => void;
}) {
  const definitions = useCatalog(recommenderApi.definitions, 0);
  const datasets = useCatalog(recommenderApi.datasets, 0);
  const [choice, setChoice] = useState('');
  const available = definitions.rows.filter(row => row.state === 'published' && row.method === TEST_CASE_METHOD && row.snapshot);
  const selected = available.find(row => versionKey(row) === choice) ?? (!choice && available.length === 1 ? available[0] : undefined);
  return <>
    <section className="card configured-panel"><h2>Casos de teste</h2><p>Use uma configuração publicada e sua base de referência. O perfil e a classificação da história selecionada preenchem os campos compatíveis.</p>
      <label>Recomendador e versão<select disabled={busy || definitions.loading} value={selected ? versionKey(selected) : ''} onChange={event => setChoice(event.target.value)}>
        <option value="">Selecione uma configuração</option>{available.map(row => <option key={versionKey(row)} value={versionKey(row)}>{row.name} · {row.version}</option>)}
      </select></label><CatalogState catalog={definitions} title="recomendadores"/>
      {!definitions.loading && !definitions.error && !available.length && <p>Nenhum recomendador de casos de teste foi publicado. <Link to="/recommender-setup">Configurar recomendador e importar base</Link></p>}
    </section>
    {selected && <ProjectTestExecution key={versionKey(selected)} summary={selected} story={story} datasets={datasets.rows} busy={busy} onBusy={onBusy}>
      <CatalogState catalog={datasets} title="bases de referência"/>
    </ProjectTestExecution>}
  </>;
}

function ProjectTestExecution({ summary, story, datasets, busy, onBusy, children }: {
  summary: DefinitionSummary; story: Story; datasets: DatasetSummary[]; busy: boolean;
  onBusy: (value: boolean) => void; children: React.ReactNode;
}) {
  const [loaded, setLoaded] = useState<{ record: Publication; context: NfrContext }>();
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  const [pair, setPair] = useState('');
  const [resultId, setResultId] = useState('');
  const resultPanel = useRef<HTMLElement>(null);
  useEffect(() => { if (resultId) resultPanel.current?.focus(); }, [resultId]);
  useEffect(() => {
    let active = true; const controller = new AbortController();
    setLoaded(undefined); setError(''); setResultId(''); setPair('');
    Promise.all([recommenderApi.definition(summary.id, summary.version, controller.signal), api.nfrContext(story.id)])
      .then(([record, context]) => {
        if (!active) return;
        if (record.state !== 'published' || !record.snapshot || record.snapshot.sha256 !== summary.snapshot?.sha256 || record.snapshot.format !== summary.snapshot?.format) {
          throw new Error('A configuração mudou. Atualize a página e selecione uma versão publicada.');
        }
        setLoaded({ record: record as Publication, context });
      }).catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; controller.abort(); };
  }, [summary.id, summary.version, summary.snapshot?.sha256, summary.snapshot?.format, story.id, retry]);
  if (error) return <section className="card configured-panel" role="alert"><p>{error}</p><button onClick={() => setRetry(value => value + 1)}>Tentar novamente</button></section>;
  if (!loaded) return <p role="status">Carregando perfil do projeto e configuração…</p>;
  const { record, context } = loaded;
  const labels = context.target.labels;
  const labelIndex = labels.length === 1 ? 0 : pair === '' ? -1 : Number(pair);
  const prepared = labelIndex >= 0 ? projectInput(record, context.target, labelIndex) : undefined;
  const copied = prepared ? record.definition.attributes.filter(attribute => attribute.role === 'feature' &&
    Object.hasOwn(prepared.values, attribute.id) && (Array.isArray(prepared.values[attribute.id])
      ? (prepared.values[attribute.id] as JsonValue[]).length > 0 : !!prepared.values[attribute.id])).map(attribute => attribute.name) : [];
  return <>
    {labels.length !== 1 && <section className="card configured-panel"><label>Classificação para esta recomendação<select disabled={busy} value={pair} onChange={event => { setPair(event.target.value); setResultId(''); }}>
      <option value="">Selecione módulo e operação</option>{labels.map((label, index) => <option key={index} value={index}>{label.module} / {label.operation}</option>)}
    </select></label></section>}
    {prepared && <>
      <section className="card configured-panel"><h2>Complete os dados da história</h2>
        <p>{copied.length ? `Preenchidos a partir do projeto e da classificação: ${copied.join(', ')}.` : 'Selecione abaixo os valores da taxonomia usada por este recomendador.'} Complete os critérios de aceitação e os demais campos necessários. As alterações abaixo valem para esta execução.</p>
        {context.target.nfrs.length > 0 && <details><summary>RNFs já associados à história</summary><ul>{context.target.nfrs.map((item, index) => <li key={index}>{item.type} / {item.attribute}: {item.sentence}</li>)}</ul><p>Selecione no formulário os identificadores correspondentes da taxonomia do recomendador.</p></details>}
        <details><summary>Perfil cadastrado no projeto</summary><p>Plataformas: {context.target.projectProfile.platforms.join(', ') || 'Não informadas'}</p><p>Domínios de aplicação: {context.target.projectProfile.applicationDomains.join(', ') || 'Não informados'}</p></details>
        <p>Valores de outra taxonomia precisam de seleção explícita. O perfil cadastrado permanece disponível em “Ver perfil e tarefas”.</p>
      </section>
      <TestCaseExecutionForm key={`${record.snapshot.sha256}:${labelIndex}`} record={record} datasets={datasets} busy={busy} onBusy={onBusy} initialInput={prepared} onCompleted={run => setResultId(run.id)}>{children}</TestCaseExecutionForm>
    </>}
    {resultId && <section ref={resultPanel} tabIndex={-1} className="card configured-panel" aria-label="Resultado da recomendação de testes"><h2>Casos de teste recomendados</h2><p>Resultado salvo desta execução. Se alterar os campos, gere uma nova recomendação para atualizar os casos.</p><ConfiguredRunDetails key={resultId} id={resultId} compact/></section>}
  </>;
}
