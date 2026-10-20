const key = 'us-agent-organization';
export function organizationOptions(options?: RequestInit): RequestInit | undefined {
  let id: string | null = null;
  try { id=sessionStorage.getItem(key); } catch { /* Storage can be unavailable. */ }
  if (!id || !/^[a-z][a-z0-9_-]{0,63}$/.test(id)) return options;
  const headers = new Headers(options?.headers);headers.set('X-Organization-Id',id);
  return {...options,headers};
}
export function switchOrganization(id?: string) {
  if (id) sessionStorage.setItem(key,id);else sessionStorage.removeItem(key);
  window.location.assign('/projects');
}
export type AccessContext = { organizationId:string;role:'viewer'|'reviewer'|'maintainer'|'admin';actor:string;
  organizations:Array<{id:string;name:string;role:string}> };
