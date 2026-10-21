import { useEffect, useState } from 'react';
import { recommenderApi } from '../services/recommender-api';
import type { DefinitionSummary } from '../types/configurable-recommendations';

export const versionKey = (value: { id: string; version: string }) => JSON.stringify([value.id, value.version]);
/** Direct links can refer to a publication beyond the first catalog page. */
export function useDefinitionChoice(choice: string, rows: DefinitionSummary[]) {
  const listed = rows.find(row => versionKey(row) === choice);
  const [fallback, setFallback] = useState<DefinitionSummary>(), [error, setError] = useState(''), [retry, setRetry] = useState(0);
  useEffect(() => {
    setFallback(undefined); setError('');
    if (!choice || listed) return;
    const controller = new AbortController(); let active = true;
    async function load() {
      const identity: unknown = JSON.parse(choice);
      if (!Array.isArray(identity) || identity.length !== 2 || identity.some(part => typeof part !== 'string' || !part)) throw new Error('Choose a valid recommender and version.');
      const record = await recommenderApi.definition(identity[0], identity[1], controller.signal);
      if (record.state !== 'published' || !record.snapshot || record.definition.id !== identity[0] || record.definition.version !== identity[1]) throw new Error('This recommender version is unavailable. Choose a published version.');
      if (active) setFallback({ id: record.definition.id, version: record.definition.version, name: record.definition.name, method: record.definition.method.id, state: record.state, attributeCount: record.definition.attributes.length, snapshot: { format: record.snapshot.format, sha256: record.snapshot.sha256 } });
    }
    void load().catch((reason: Error) => { if (active) setError(reason.message); });
    return () => { active = false; controller.abort(); };
  }, [choice, !!listed, retry]);
  return { selected: listed ?? (fallback && versionKey(fallback) === choice ? fallback : undefined), error, retry: () => setRetry(value => value + 1) };
}
export function useCatalog<T>(load: (offset: number, signal?: AbortSignal) => Promise<T[]>, refresh: number) {
  const [rows, setRows] = useState<T[]>([]), [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true), [error, setError] = useState('');
  const [more, setMore] = useState(false), [retry, setRetry] = useState(0);
  useEffect(() => { setOffset(0); setRows([]); }, [refresh]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setLoading(true); setError('');
    load(offset, controller.signal).then(next => { if (active) { setRows(current => offset === 0 ? next : [...current, ...next]); setMore(next.length === recommenderApi.pageSize); } })
      .catch((reason: Error) => { if (active) setError(reason.message); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [load, offset, refresh, retry]);
  return { rows, loading, error, more, next: () => setOffset(value => value + recommenderApi.pageSize), retry: () => setRetry(value => value + 1) };
}
export function CatalogState({ catalog, title }: { catalog: ReturnType<typeof useCatalog>; title: string }) {
  return <>{catalog.loading && <p role="status">Loading {title}…</p>}{catalog.error && <p role="alert" className="inline-error">{catalog.error}</p>}
    <div className="configured-actions">{catalog.error ? <button type="button" disabled={catalog.loading} onClick={catalog.retry}>Retry loading {title}</button> : catalog.more && <button type="button" disabled={catalog.loading} onClick={catalog.next}>Load more {title}</button>}</div></>;
}
