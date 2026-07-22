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
