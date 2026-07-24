export type Story = {
  id: string;
  text: string;
  project: string;
  module: string;
  operation: string;
  confidence: number;
  uncertainty: number;
  status: string;
  consensus: number;
};

export type Taxonomy = {
  version: string;
  modules: Record<string, string[]>;
};

export type Dashboard = {
  total: number;
  pending: number;
  accepted: number;
  confidence: number;
  modules: Array<{ name: string; count: number }>;
};

export type QualityTestCase = {
  title: string;
  type: 'positive' | 'negative' | 'boundary' | 'security';
  priority: 'high' | 'medium';
  source: 'taxonomy_heuristic' | 'user';
  assumption: boolean;
};

export type QualityPlanItem = {
  text: string;
  source: 'taxonomy_heuristic' | 'user';
};

export type QualityPlan = {
  story: Story;
  health: 'ready' | 'needs_clarification' | 'needs_review';
  healthIssues: string[];
  questions: QualityPlanItem[];
  acceptanceCriteria: QualityPlanItem[];
  testCases: QualityTestCase[];
  generatorVersion: string;
  status: 'generated' | 'draft' | 'approved';
  updatedAt?: string;
  updatedBy?: string;
};
