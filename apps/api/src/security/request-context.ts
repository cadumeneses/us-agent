import { AsyncLocalStorage } from 'node:async_hooks';
export type AccessRole = 'viewer' | 'reviewer' | 'maintainer' | 'admin';
export type RequestScope = { actor: string; organizationId: string; schema?: string; role: AccessRole };
export const requestScope = new AsyncLocalStorage<RequestScope>();
export const currentActor = () => requestScope.getStore()?.actor ?? (process.env.INGEST_API_KEY ? 'internal-api' : 'local-development');
