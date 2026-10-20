import type { Request } from 'express';
const authenticated = new WeakMap<Request, string>();
export const markBrowserSession = (req: Request, username: string) => authenticated.set(req, username);
export const hasBrowserSession = (req: Request) => authenticated.has(req);
export const browserUsername = (req: Request) => authenticated.get(req);
