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
