export type Story = {
  id: string;
  text: string;
  project: string;
  module: string;
  operation: string;
  confidence: number;
  uncertainty: number;
  consensus: number;
  status: string;
};

export type Dashboard = {
  total: number;
  pending: number;
  accepted: number;
  confidence: number;
  modules: Array<{ name: string; count: number }>;
};

export type Taxonomy = {
  version: string;
  modules: Record<string, string[]>;
  descriptions: Record<string, Record<string, string>>;
  taxonomies: Array<{ version: string; active: boolean; modules: number; operations: number }>;
};

export type Classification = {
  id: string;
  text: string;
  module: string;
  operation: string;
  confidence: number;
  needsReview: boolean;
};

export type ApplicationContext = {
  user: { id: string; displayName: string; initials: string; role: string };
  environment: string;
  defaultExecutionMode: string;
  executionModes: Array<{ key: string; name: string; description: string }>;
};

export type QualityPlan = {
  story: Story;
  health: 'ready' | 'needs_clarification' | 'needs_review';
  healthIssues: string[];
  questions: Array<{ text: string; source: 'taxonomy_heuristic' | 'user' }>;
  acceptanceCriteria: Array<{ text: string; source: 'taxonomy_heuristic' | 'user' }>;
  testCases: Array<{
    title: string;
    type: 'positive' | 'negative' | 'boundary' | 'security';
    priority: 'high' | 'medium';
    source: 'taxonomy_heuristic' | 'user';
    assumption: boolean;
  }>;
  generatorVersion: string;
  status: 'generated' | 'draft' | 'approved';
  updatedAt?: string;
  updatedBy?: string;
};

export type StoryDetails = {
  tasks: Array<{ id: string; title: string; done: boolean }>;
  functionalRequirements: Array<{ id: string; description: string }>;
  nonFunctionalRequirements: Array<{ id: string; description: string; type: string; metric: string }>;
};
