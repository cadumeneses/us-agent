import type { ConfiguredInput, ContentReference, DefinitionPublication, Snapshot } from './configurable-recommendations';
export const CONFIGURABLE_KNN = 'configurable_project_knn_v1';
export type ProjectRecommendationRequest = { id: string; definition: ContentReference; dataset: ContentReference; input: ConfiguredInput };
export type ProjectRecommendationRun = {
  id: string; createdBy: string; createdAt: string; durationMs: number;
  snapshot: Snapshot<{
    schemaVersion: 3; request: Snapshot<ProjectRecommendationRequest>; definition: Snapshot<DefinitionPublication>;
    dataset: Snapshot<{ id: string; version: string; source: { description: string; authorization: { basis: string; reference: string } } }>;
    projection: Snapshot<{ dimensions: Array<{ attributeId: string; value: string; weight: number }>; targetVector: number[]; totalWeight: number }>;
    result: Snapshot<{ method: string; k: number; scientificReproduction: false; status: 'completed' | 'no_candidates' | 'no_items';
      neighbors: Array<{ recordId: string; distance: number; similarity: number; contributions: Array<{ attributeId: string; weight: number; distance: number }> }>;
      items: Array<{ key: string; attributeId: string; text: string; support: number; recordIds: string[] }> }>;
    explanation: Snapshot<{ policy: Record<string, string> }>;
    software: { adapterVersion: string; policyVersion: string; kernelVersion: string };
  }>;
};
export type ProjectRecommenderProfile = { projectId: string; revision: number; values: ConfiguredInput['values'] };
