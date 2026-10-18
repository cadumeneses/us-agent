import type { Taxonomy } from './models.js';

export type ClassificationLabel = { module: string; operation: string };
export type ClassificationUncertainty = {
  score: number; band: 'low' | 'medium' | 'high';
  disagreementRate: number; disagreementLevel: 'none' | 'light' | 'strong';
  disagreementRisk: number; hypothesisCount: number; labelOverlap: number;
  normalizedEntropy: number; confidenceRisk: number; entropyRisk: number;
  naGapPenalty: number; naRatio: number; taxonomyGapRatio: number; reviewRisk: number;
};
export type ClassificationProvenance = {
  schemaVersion: 1;
  engine: 'web_committee_v2' | 'web_preview_rules_v1';
  policyVersion: string;
  promptVersion: string | null;
  input: { text: string };
  taxonomy: { version: string; sha256: string; snapshot: Omit<Taxonomy, 'taxonomies'> };
  prompt: { system: string; user: string } | null;
  execution: { arbitration: false; reruns: 0 };
  providers: Array<{ provider: string; requestedModel: string | null; model: string | null; status: string }>;
  decision: {
    labels: ClassificationLabel[]; confidence: number; needsReview: boolean;
    consensusRatio: number | null; uncertainty: ClassificationUncertainty | null;
    reviewReasons: string[]; reason: string;
    providerHealth: { total: number; successful: number; failed: number };
  };
};
