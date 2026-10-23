import { createContext, useContext, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { clearOrganizationSelection } from '../services/organization';

const AccessContext = createContext<{ signOut?: () => Promise<void>; username?: string }>({});
export const usePrivateSignOut = () => useContext(AccessContext).signOut;
export const usePrivateUsername = () => useContext(AccessContext).username;

export function WebAccessGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<'loading' | 'login' | 'ready' | 'unavailable'>('loading');
  const [enabled, setEnabled] = useState(false), [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  async function status() {
    setState('loading'); setError('');
    try {
      const response = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'Acesso privado indisponível.');
      setEnabled(body.enabled); setUsername(body.username ?? ''); setState(body.authenticated ? 'ready' : 'login');
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Não foi possível conectar.'); setState('unavailable'); }
  }
  useEffect(() => {
    void status();
    const expired = () => { clearOrganizationSelection(); setPassword(''); setError('Your session expired. Please sign in again.'); setState('login'); };
    window.addEventListener('us-agent:session-expired', expired);
    return () => window.removeEventListener('us-agent:session-expired', expired);
  }, []);
  async function signIn(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/session', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: username.trim().toLowerCase(), password }) });
      const body = await response.json();
      if (!response.ok) throw Error(body.error || 'Não foi possível entrar.');
      clearOrganizationSelection(); setPassword(''); setUsername(body.username); setState('ready');
    } catch (reason) { setPassword(''); setError(reason instanceof Error ? reason.message : 'Não foi possível entrar.'); }
    finally { setBusy(false); }
  }
  async function signOut() {
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/auth/session', { method: 'DELETE', credentials: 'same-origin' });
      if (!response.ok) throw Error('Não foi possível encerrar a sessão. Tente novamente.');
      clearOrganizationSelection(); setPassword(''); setState('login');
    } catch (reason) { window.alert(reason instanceof Error ? reason.message : 'Não foi possível sair.'); }
    finally { setBusy(false); }
  }
  if (state === 'ready') return <AccessContext.Provider value={{ signOut: enabled ? signOut : undefined, username: username || undefined }}>{children}</AccessContext.Provider>;
  return <main className="private-access"><section className="private-access-card"><h1>US-Agent</h1>
    {state === 'loading' ? <p role="status">Checking access…</p> : state === 'unavailable' ? <>
      <p role="alert">{error}</p><button onClick={() => void status()}>Try again</button></> : <>
      <p>Sign in with your username and password.</p><form onSubmit={signIn}>
        <label htmlFor="private-username">Username</label>
        <input id="private-username" name="username" type="text" autoComplete="username" autoCapitalize="none" spellCheck={false} required maxLength={64} value={username} onChange={event => setUsername(event.target.value)} disabled={busy}/>
        <label htmlFor="private-password">Password</label>
        <input id="private-password" name="password" type="password" autoComplete="current-password" required maxLength={1024} value={password} onChange={event => setPassword(event.target.value)} disabled={busy}/>
        {error && <p role="alert">{error}</p>}<button type="submit" disabled={busy || !password || !username.trim()}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form></>}
    <p><a href="/guide">Reviewer Guide · ICSE 2027</a></p>
  </section></main>;
}
