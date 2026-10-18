import { useEffect, useState } from 'react';
import { recommenderApi } from '../services/recommender-api';

export const versionKey = (value: { id: string; version: string }) => JSON.stringify([value.id, value.version]);
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
