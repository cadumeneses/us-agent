import { recommenderApi } from '../services/recommender-api';
import type { ContentReference } from '../types/configurable-recommendations';
import { CatalogState, useCatalog, versionKey } from './VersionCatalog';
import { ReferenceDetails } from './ConfiguredRunDetails';

export const sameReference = (left: ContentReference, right: ContentReference) => versionKey(left) === versionKey(right) && left.format === right.format && left.sha256 === right.sha256;
export function TestCaseCatalogPicker({ value, onChange, required, refresh = 0 }: {
  value?: ContentReference; onChange: (value: ContentReference | undefined) => void; required?: ContentReference; refresh?: number;
}) {
  const catalog = useCatalog(recommenderApi.testCaseCatalogs, refresh);
  const available = catalog.rows.filter(row => row.state === 'published' && row.source.kind === 'synthetic'
    && (!required || sameReference({ id: row.id, version: row.version, ...row.snapshot }, required)));
  return <div><label>Catalog and version<select value={value ? versionKey(value) : ''} onChange={event => {
    const selected = available.find(row => versionKey(row) === event.target.value);
    onChange(selected ? { id: selected.id, version: selected.version, format: selected.snapshot.format, sha256: selected.snapshot.sha256 } : undefined);
  }}><option value="">Select a synthetic catalog</option>{available.map(row => <option key={versionKey(row)} value={versionKey(row)}>{row.id} · {row.version} · {row.itemCount} tests</option>)}</select></label>
    <CatalogState catalog={catalog} title="test catalogs"/>
    {!catalog.loading && !available.length && <p>No matching published synthetic catalog is loaded. Load more versions or publish one in configuration.</p>}
    {required && <ReferenceDetails title="Catalog required by dataset" reference={required}/>}
    {value && <ReferenceDetails title="Selected test catalog" reference={value}/>}
  </div>;
}
