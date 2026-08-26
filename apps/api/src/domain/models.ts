export type Story = {
  id: string;
  text: string;
  project: string;
  sprint: string;
  module: string;
  operation: string;
  confidence: number;
  uncertainty: number;
  status: string;
  consensus: number;
};

export type ProjectSprint = {
  id: string;
  project: string;
  name: string;
  status: 'planning' | 'active' | 'completed';
  stories: number;
};

export type FallbackSuggestionType = 'new_domain' | 'new_module' | 'new_operation' | 'clarify_story' | 'classification';

export type FallbackSuggestion = {
  id?: string;
  source: string;
  type: FallbackSuggestionType;
  proposedDomain?: string;
  targetDomain?: string;
  proposedModule?: string;
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
  taxonomyFeedbacks: TaxonomyFeedback[];
  votes: ProviderVote[];
};

export type TaxonomyFeedback = {
  id: string;
  proposalType: 'new_domain' | 'new_module' | 'new_operation' | 'clarify_story';
  proposedDomain?: string;
  targetDomain?: string;
  proposedModule?: string;
  targetModule?: string;
  proposedOperation?: string;
  justification: string;
  status: string;
  createdAt: string;
};

export type Taxonomy = {
  version: string;
  modules: Record<string, string[]>;
  descriptions?: Record<string, Record<string, string>>;
  domains?: Record<string, { description: string; modules: Record<string, string[]> }>;
  moduleDomains?: Record<string, string>;
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
  id: string;
  title: string;
  type: 'positive' | 'negative' | 'boundary' | 'security';
  priority: 'high' | 'medium';
  source: 'taxonomy_heuristic' | 'user';
  assumption: boolean;
  preconditions: string[];
  testData: string;
  steps: string[];
  expectedResult: string;
  linkedCriteria: string[];
  automation: 'manual' | 'candidate';
};

export type QualityPlanItem = {
  id: string;
  text: string;
  source: 'taxonomy_heuristic' | 'user';
};

export type QualityPlan = {
  id: string;
  project: string;
  sprint: string;
  stories: Story[];
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
