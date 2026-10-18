import { z } from 'zod';
import { canonicalJson, snapshotContent, type ContentSnapshot } from './content-snapshot.js';
import { definitionTaxonomyReferences, recommenderDefinitionSchema, type RecommenderDefinitionVersion } from './recommender-definition.js';
import { resolveTaxonomies, type TaxonomyDependency } from './recommender-taxonomy.js';

const publicationSchema = z.strictObject({
  schemaVersion: z.literal(1), definition: recommenderDefinitionSchema,
  taxonomies: z.array(z.unknown()),
  implementation: z.strictObject({ methodId: z.string().min(1), adapterVersion: z.string().min(1) })
});
export type DefinitionPublication = {
  schemaVersion: 1; definition: RecommenderDefinitionVersion; taxonomies: TaxonomyDependency[];
  implementation: { methodId: string; adapterVersion: string };
};

/** Integrity validation is independent of the currently installed method implementation. */
export function parseDefinitionPublication(raw: unknown): DefinitionPublication {
  canonicalJson(raw);
  const publication = publicationSchema.parse(raw);
  if (publication.definition.state !== 'published') throw new Error('Pacote publicado requer definição no estado published.');
  if (publication.implementation.methodId !== publication.definition.method.id) throw new Error('Implementação difere do método declarado.');
  const selected = resolveTaxonomies(definitionTaxonomyReferences(publication.definition), publication.taxonomies);
  if (selected.length !== publication.taxonomies.length) throw new Error('Pacote contém dependências não referenciadas.');
  if (canonicalJson(selected) !== canonicalJson(publication.taxonomies)) throw new Error('Dependências devem seguir a ordem das referências na definição.');
  return { ...publication, taxonomies: selected };
}

export function snapshotDefinitionPublication(raw: unknown): ContentSnapshot<DefinitionPublication> {
  return snapshotContent(parseDefinitionPublication(raw));
}
