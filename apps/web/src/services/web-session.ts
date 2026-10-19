export function notifySessionExpired(status: number) {
  if (status === 401 && typeof window !== 'undefined') window.dispatchEvent(new Event('us-agent:session-expired'));
}
