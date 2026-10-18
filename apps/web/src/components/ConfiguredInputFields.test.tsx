// @vitest-environment jsdom
import { act, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test } from 'vitest';
import { emptyValue, initialValues, inputIssues, taxonomyOptions } from '../services/configured-input';
import type { ConfiguredAttribute, ConfiguredDefinition, ConfiguredInput, TaxonomyDependency } from '../types/configurable-recommendations';
import { ConfiguredInputFields } from './ConfiguredInputFields';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const taxonomy: TaxonomyDependency = { state: 'published', snapshot: { format: 'us-agent-json-v1', sha256: 'f'.repeat(64), content: {
  schemaVersion: 1, id: 'areas', version: '1', name: 'Áreas', kind: 'tree', selection: 'leaf', source: 'Synthetic', nodes: [
    { id: 'root', name: 'Contexto', parentId: null, description: '' }, { id: 'browser', name: 'Navegador', parentId: 'root', description: 'Nome de apresentação' }
  ] } } };
const ref = { id: 'areas', version: '1', format: taxonomy.snapshot.format, sha256: taxonomy.snapshot.sha256 };
const base = { required: true, scope: 'artifact', role: 'context', representation: 'none', cardinality: 'single' } as const;
const attributes: ConfiguredAttribute[] = [
  { ...base, id: 'amount', name: 'Volume', valueType: { type: 'number' } },
  { ...base, id: 'enabled', name: 'Ativo', valueType: { type: 'boolean' } },
  { ...base, id: 'platform', name: 'Plataforma', valueType: { type: 'taxonomy_node', taxonomy: ref } },
  { ...base, id: 'environment', name: 'Ambiente', valueType: { type: 'enum', values: ['lab', 'field'] } },
  { ...base, id: 'extra', name: 'Observação', valueType: { type: 'text' }, required: false },
  { ...base, id: 'context', name: 'Detalhes', cardinality: 'many', valueType: { type: 'record', fields: { count: { type: 'number' }, area: { type: 'taxonomy_node', taxonomy: ref } } } }
];
const definition: ConfiguredDefinition = { schemaVersion: 1, id: 'demo', version: '1', name: 'Demo', state: 'published', attributes, method: { id: 'test', version: '1', parameters: {}, bindings: {} } };
let latest: ConfiguredInput['values'];
let root: Root, container: HTMLDivElement;
function Harness() {
  const [values, setValues] = useState(() => initialValues(definition)); latest = values;
  return <ConfiguredInputFields attributes={attributes} values={values} taxonomies={[taxonomy]} onChange={setValues}/>;
}
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); });
function control(name: string) {
  const label = [...container.querySelectorAll('label')].find(item => item.firstChild?.textContent === name);
  const target = label?.querySelector('input,select'); if (!target) throw new Error(name); return target as HTMLInputElement | HTMLSelectElement;
}
async function change(target: HTMLInputElement | HTMLSelectElement, value: string) {
  await act(async () => { Object.getOwnPropertyDescriptor(target instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype, 'value')!.set!.call(target, value);
    target.dispatchEvent(new Event(target instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true })); });
}

test('configured numbers, booleans, enums, taxonomy IDs and optional fields retain their declared types', async () => {
  await act(async () => root.render(<Harness/>));
  expect(inputIssues(definition, latest, [taxonomy])).toHaveLength(3);
  expect([...((control('Plataforma') as HTMLSelectElement).options)].map(item => item.value)).toEqual(['', 'browser']);
  await change(control('Volume'), '0'); await change(control('Ativo'), 'false'); await change(control('Plataforma'), 'browser'); await change(control('Ambiente'), 'lab');
  expect(latest).toMatchObject({ amount: 0, enabled: false, platform: 'browser', environment: 'lab', context: [] });
  expect(inputIssues(definition, latest, [taxonomy])).toEqual([]); expect(Object.hasOwn(latest, 'extra')).toBe(false);
  const optional = container.querySelector('input[type="checkbox"]') as HTMLInputElement;
  await act(async () => optional.click()); await change(control('Observação'), 'Texto opcional'); expect(latest.extra).toBe('Texto opcional');
  await act(async () => optional.click()); expect(Object.hasOwn(latest, 'extra')).toBe(false);
  await change(control('Volume'), ''); expect(latest.amount).toBeNull(); expect(inputIssues(definition, latest, [taxonomy])[0]).toContain("finite number");
});

test('record lists validate their fields and remove values explicitly without changing adjacent attributes', async () => {
  await act(async () => root.render(<Harness/>));
  const add = [...container.querySelectorAll('button')].find(button => button.textContent === 'Add Detalhes')!;
  await act(async () => add.click());
  expect(latest.context).toEqual([{ count: null, area: '' }]);
  expect(inputIssues(definition, latest, [taxonomy])).toContain('Detalhes 1 / count: enter a finite number.');
  await change(control('count'), '3.5'); await change(control('area'), 'browser');
  expect(latest.context).toEqual([{ count: 3.5, area: 'browser' }]);
  await act(async () => (container.querySelector("[aria-label=\"Remove Detalhes 1\"]") as HTMLElement).click());
  expect(latest.context).toEqual([]); expect(latest.enabled).toBe(false);
});

test('taxonomy resolution requires the exact hash and honors leaf-only selection independently of labels', () => {
  const type = { type: 'taxonomy_node' as const, taxonomy: ref };
  expect(taxonomyOptions(type, [taxonomy])).toEqual([{ id: 'browser', label: 'Contexto / Navegador', description: 'Nome de apresentação' }]);
  expect(taxonomyOptions({ ...type, taxonomy: { ...ref, sha256: '0'.repeat(64) } }, [taxonomy])).toEqual([]);
  const values = { ...initialValues(definition), amount: 1, environment: 'field', platform: 'root' };
  expect(inputIssues(definition, values, [taxonomy])).toContain('Plataforma: choose a node from the published taxonomy.');
  expect(emptyValue({ type: 'record', fields: { active: { type: 'boolean' }, value: { type: 'number' } } })).toEqual({ active: false, value: null });
});
