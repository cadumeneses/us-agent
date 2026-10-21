import { useEffect, useRef, type ReactNode } from 'react';

/** Common keyboard, backdrop and focus behavior for project and story dialogs. */
export function Modal({ label, busy = false, onClose, children }: { label: string; busy?: boolean; onClose: () => void; children: ReactNode }) {
  const element = useRef<HTMLDivElement>(null), previous = useRef(document.activeElement as HTMLElement | null);
  const closing = useRef({ onClose, busy }); closing.current = { onClose, busy };
  useEffect(() => {
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusables = () => [...(element.current?.querySelectorAll<HTMLElement>('*') ?? [])].filter(node => node.matches('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],[tabindex="0"]') && !node.matches('input[type=hidden]') && !node.closest('[hidden]'));
    if (!element.current?.contains(document.activeElement)) {
      (element.current?.querySelector<HTMLElement>('input:not(:disabled),textarea:not(:disabled),select:not(:disabled)') ?? focusables()[0] ?? element.current)?.focus();
    }
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closing.current.busy) { event.preventDefault(); closing.current.onClose(); }
      if (event.key !== 'Tab') return;
      const targets = focusables(), first = targets[0], last = targets.at(-1);
      if (!first) { event.preventDefault(); element.current?.focus(); return; }
      if (event.shiftKey && (document.activeElement === first || document.activeElement === element.current)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => { document.body.style.overflow = overflow; document.removeEventListener('keydown', keydown); if (previous.current?.isConnected) previous.current.focus(); };
  }, []);
  return <div ref={element} className="modal-backdrop" role="dialog" aria-modal="true" aria-label={label} tabIndex={-1} onMouseDown={event => { if (event.target === event.currentTarget && !busy) onClose(); }}>{children}</div>;
}
