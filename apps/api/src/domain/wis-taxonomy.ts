import type { RecommenderTaxonomy } from './recommender-taxonomy.js';

/** The classifier consumes module/operation pairs from this ordinary two-level tree. */
export function validateWisTaxonomy(taxonomy: RecommenderTaxonomy) {
  if (taxonomy.id !== 'wis') return;
  if (taxonomy.kind !== 'tree' || taxonomy.selection !== 'leaf' || taxonomy.version.length > 40) {
    throw new Error('WIS uses a module → operation tree, leaf selection and a version of at most 40 characters.');
  }
  const roots = new Map(taxonomy.nodes.filter(node => node.parentId === null).map(node => [node.id, node]));
  const names = new Set<string>();
  for (const node of taxonomy.nodes) {
    if (node.parentId === null) {
      if (node.selectable !== false || node.name.length > 120) throw new Error('WIS modules are root organizers, with names of at most 120 characters. Only operations are selectable.');
    } else if (!roots.has(node.parentId)) {
      throw new Error('WIS has two levels: module roots and their operations. An operation cannot contain another node.');
    }
    const identity = JSON.stringify([node.parentId, node.name]);
    if (names.has(identity)) throw new Error('WIS requires distinct module names and distinct operation names within each module.');
    names.add(identity);
  }
}
