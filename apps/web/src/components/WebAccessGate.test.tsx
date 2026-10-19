// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { WebAccessGate, usePrivateSignOut } from './WebAccessGate';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, container: HTMLDivElement;
const response = (body: unknown, status = 200) => Promise.resolve(new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
function Content() {
  const signOut = usePrivateSignOut();
  return <div>Protected workspace{signOut && <button onClick={() => void signOut()}>Sair</button>}</div>;
}
beforeEach(() => { container = document.createElement('div'); document.body.append(container); root = createRoot(container); });
afterEach(async () => { await act(async () => root.unmount()); container.remove(); vi.unstubAllGlobals(); });
const render = () => act(async () => root.render(<WebAccessGate><Content/></WebAccessGate>));
async function password(value: string) {
  await act(async () => {
    const userInput = container.querySelector<HTMLInputElement>('#private-username')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(userInput, 'mirko');
    userInput.dispatchEvent(new Event('input', { bubbles: true }));
    const input = container.querySelector<HTMLInputElement>('#private-password')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

test('anonymous visitors see a password form and protected content is not mounted', async () => {
  vi.stubGlobal('fetch', vi.fn(() => response({ enabled: true, authenticated: false })));
  await render();
  expect(container.textContent).not.toContain('Protected workspace');
  expect(container.querySelector<HTMLInputElement>('#private-password')?.type).toBe('password');
  expect(container.querySelector<HTMLInputElement>('#private-username')?.autocomplete).toBe('username');
});

test('a rejected login clears the password; success mounts the workspace and logout removes it', async () => {
  const fetcher = vi.fn().mockImplementationOnce(() => response({ enabled: true, authenticated: false }))
    .mockImplementationOnce(() => response({ error: 'Senha inválida.' }, 401))
    .mockImplementationOnce(() => response({ authenticated: true, username: 'mirko' }))
    .mockImplementationOnce(() => response({ authenticated: false }));
  vi.stubGlobal('fetch', fetcher); await render();
  await password('wrong password');
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(container.textContent).toContain('Senha inválida.'); expect(container.querySelector<HTMLInputElement>('#private-password')!.value).toBe('');
  await password('valid private password');
  await act(async () => container.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(container.textContent).toContain('Protected workspace');
  expect(fetcher.mock.calls[2][1].body).toBe(JSON.stringify({ username: 'mirko', password: 'valid private password' }));
  await act(async () => container.querySelector('button')!.click());
  expect(fetcher.mock.calls[3][1].method).toBe('DELETE');
  expect(container.textContent).not.toContain('Protected workspace');
});

test('expired sessions unmount the workspace and return to login', async () => {
  vi.stubGlobal('fetch', vi.fn(() => response({ enabled: true, authenticated: true })));
  await render(); expect(container.textContent).toContain('Protected workspace');
  await act(async () => window.dispatchEvent(new Event('us-agent:session-expired')));
  expect(container.textContent).toContain('Sua sessão expirou.');
  expect(container.textContent).not.toContain('Protected workspace');
});

test('misconfigured deployment shows an actionable error without opening the workspace', async () => {
  vi.stubGlobal('fetch', vi.fn(() => response({ error: 'Aplique a migration 025.' }, 503)));
  await render(); expect(container.textContent).toContain('Aplique a migration 025.');
  expect(container.textContent).not.toContain('Protected workspace');
  expect(container.textContent).toContain('Tentar novamente');
});
