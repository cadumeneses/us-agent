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

export type FallbackSuggestionType = 'new_domain' | 'new_operation' | 'clarify_story' | 'classification';

export type FallbackSuggestion = {
  id?: string;
  source: string;
  type: FallbackSuggestionType;
  proposedDomain?: string;
  targetModule?: string;
  proposedOperation?: string;
  reason: string;
  evidence?: string[];
  appliedAt?: string;
};

export type ProviderVote = {
  provider: string;
  status: string;
  error?: string;
  confidence?: number;
  rationale?: string;
  needsReview: boolean;
  rows: Array<{ module: string; operation: string }>;
  evidence: string[];
  issues: string[];
  suggestedQuestions: string[];
};

export type ReviewContext = {
  final: {
    reason?: string;
    notesForHuman?: string;
    disagreementCause?: string;
    action?: string;
  };
  suggestions: FallbackSuggestion[];
  votes: ProviderVote[];
};

export type Taxonomy = {
  version: string;
  modules: Record<string, string[]>;
  descriptions?: Record<string, Record<string, string>>;
  taxonomies?: Array<{ version: string; active: boolean; modules: number; operations: number }>;
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
