import { parseRecommenderDefinition } from '../domain/recommender-definition.js';
import { RNF_ADAPTER_VERSION, validateConfiguredNfrDefinition } from './configured-nfr.js';
import { E21_EQUATIONS_DEMO } from './testrec-equations.js';
import { TESTREC_ADAPTER_VERSION, validateTestrecDefinition } from './testrec-method.js';

export function validateImplementedDefinition(raw: unknown, taxonomies?: readonly unknown[]) {
  const definition = parseRecommenderDefinition(raw);
  if (definition.method.id === E21_EQUATIONS_DEMO) {
    return { definition: validateTestrecDefinition(definition, taxonomies), adapterVersion: TESTREC_ADAPTER_VERSION };
  }
  return { definition: validateConfiguredNfrDefinition(definition, taxonomies), adapterVersion: RNF_ADAPTER_VERSION };
}
