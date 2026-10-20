import { z } from 'zod';
import { canonicalJson, JSON_HASH_FORMAT, snapshotContent, type ContentSnapshot } from './content-snapshot.js';

export const taxonomyIdSchema = z.string().regex(/^[a-z][a-z0-9_-]{0,79}$/);
export const taxonomyVersionSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/);
export const taxonomyReferenceSchema = z.strictObject({
  id: taxonomyIdSchema, version: taxonomyVersionSchema,
  format: z.literal(JSON_HASH_FORMAT), sha256: z.string().regex(/^[a-f0-9]{64}$/)
});
export type TaxonomyReference = z.infer<typeof taxonomyReferenceSchema>;

export const recommenderTaxonomySchema = z.strictObject({
  schemaVersion: z.literal(1), id: taxonomyIdSchema, version: taxonomyVersionSchema,
  name: z.string().min(1).max(160).refine(value => Boolean(value.trim()), 'Informe o nome.'),
  kind: z.enum(['list', 'tree']), selection: z.enum(['any', 'leaf']),
  source: z.string().min(1).max(2000).refine(value => Boolean(value.trim()), 'Informe a origem.'),
  nodes: z.array(z.strictObject({
    id: taxonomyIdSchema, name: z.string().min(1).max(180).refine(value => Boolean(value.trim()), 'Informe o nome do nó.'),
    description: z.string(), parentId: taxonomyIdSchema.nullable(), selectable: z.boolean().optional()
  })).min(1).max(5000)
}).superRefine((taxonomy, context) => {
  const nodes = new Map(taxonomy.nodes.map(node => [node.id, node]));
  const seen = new Set<string>();
  taxonomy.nodes.forEach((node, index) => {
    const issue = (message: string) => context.addIssue({ code: 'custom', path: ['nodes', index], message });
    if (seen.has(node.id)) issue(`ID de nó duplicado: ${node.id}`);
    seen.add(node.id);
    if (taxonomy.kind === 'list' && node.parentId !== null) issue('Lista não aceita relações de parentesco.');
    if (node.parentId !== null && !nodes.has(node.parentId)) issue(`Pai inexistente: ${node.parentId}`);
  });
  // Iterative traversal handles deep trees without recursion or a fixed number of levels.
  const completed = new Set<string>();
  taxonomy.nodes.forEach((node, index) => {
    const path = new Set<string>();
    let current: string | null = node.id;
    while (current !== null && nodes.has(current) && !completed.has(current)) {
      if (path.has(current)) {
        context.addIssue({ code: 'custom', path: ['nodes', index, 'parentId'], message: `Ciclo detectado a partir de ${node.id}.` });
        break;
      }
      path.add(current);
      current = nodes.get(current)!.parentId;
    }
    for (const id of path) completed.add(id);
  });
});
export type RecommenderTaxonomy = z.infer<typeof recommenderTaxonomySchema>;
export type TaxonomyDependency = { state: 'published' | 'retired'; snapshot: ContentSnapshot<RecommenderTaxonomy> };
const dependencySchema = z.strictObject({
  state: z.enum(['published', 'retired']),
  snapshot: z.strictObject({ format: z.literal(JSON_HASH_FORMAT), sha256: z.string().regex(/^[a-f0-9]{64}$/), content: recommenderTaxonomySchema })
});

export function parseRecommenderTaxonomy(raw: unknown): RecommenderTaxonomy {
  canonicalJson(raw);
  return recommenderTaxonomySchema.parse(raw);
}

const key = (id: string, version: string) => JSON.stringify([id, version]);

/** Resolve exact versions only. Retired content is readable, but cannot feed new simulations. */
export function resolveTaxonomies(references: TaxonomyReference[], rawDependencies: readonly unknown[] = []): TaxonomyDependency[] {
  const catalog = new Map<string, TaxonomyDependency>();
  for (const raw of rawDependencies) {
    canonicalJson(raw);
    const dependency = dependencySchema.parse(raw);
    const { content, sha256 } = dependency.snapshot;
    if (snapshotContent(content).sha256 !== sha256) throw new Error(`Hash inválido da taxonomia ${content.id}@${content.version}.`);
    const id = key(content.id, content.version);
    if (catalog.has(id)) throw new Error(`Dependência taxonômica duplicada: ${content.id}@${content.version}.`);
    catalog.set(id, dependency);
  }
  const selected = new Map<string, TaxonomyDependency>();
  for (const reference of references) {
    const id = key(reference.id, reference.version);
    const dependency = catalog.get(id);
    if (!dependency || dependency.state !== 'published') throw new Error(`Taxonomia publicada indisponível: ${reference.id}@${reference.version}.`);
    if (reference.format !== dependency.snapshot.format || reference.sha256 !== dependency.snapshot.sha256) {
      throw new Error(`Referência divergente da publicação: ${reference.id}@${reference.version}.`);
    }
    selected.set(id, dependency);
  }
  return [...selected.values()];
}

export function taxonomyNodeValidator(reference: TaxonomyReference, dependencies: readonly TaxonomyDependency[]): z.ZodType<string> {
  const content = dependencies.find(dependency => dependency.snapshot.content.id === reference.id && dependency.snapshot.content.version === reference.version)!.snapshot.content;
  const parents = new Set(content.nodes.map(node => node.parentId));
  const selectable = new Set(content.nodes.filter(node => node.selectable !== false && (content.selection === 'any' || !parents.has(node.id))).map(node => node.id));
  return z.string().refine(id => selectable.has(id), `Selecione um ID permitido em ${reference.id}@${reference.version} (${content.selection}).`);
}
