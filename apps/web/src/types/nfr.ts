import type { ProjectResearchProfile } from './models';

export type NfrContext = {
  target: {
    classificationId: string; storyId: string; text: string; project: string; taxonomyVersion: string;
    labels: Array<{ module: string; operation: string }>;
    projectProfile: ProjectResearchProfile;
    tasks: Array<{ category: string }>;
  };
  issues: string[];
};
export type NfrRun = {
  id: string; classificationId: string | null; createdAt: string; method: string; k: number;
  status: 'blocked' | 'no_candidates' | 'no_items' | 'completed';
  target: { text: string; project: string; taxonomyVersion: string };
  label: { module: string; operation: string } | null;
  messages: string[]; dimensions: string[]; eligibleCount: number; excludedCount: number;
  neighbor: null | { classificationId: string; storyId: string; project: string; text: string; similarity: number; vector: number[]; matched: string[]; missing: string[] };
  items: Array<{ key: string; type: string; attribute: string; sentence: string; score: number; alreadyLinked: boolean }>;
  decisions: Record<string, 'accepted' | 'rejected'>;
};
