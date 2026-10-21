// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { Modal } from './Modal';
(globalThis as {IS_REACT_ACT_ENVIRONMENT?:boolean}).IS_REACT_ACT_ENVIRONMENT=true;
let root:Root,container:HTMLDivElement,opener:HTMLButtonElement;
beforeEach(()=>{opener=document.createElement('button');document.body.append(opener);opener.focus();container=document.createElement('div');document.body.append(container);root=createRoot(container);});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();opener.remove();});
test('dialog keeps keyboard focus inside, supports Escape and returns focus to its opener',async()=>{
  const close=vi.fn();await act(async()=>root.render(<Modal label="Edit task" onClose={close}><input aria-label="Task"/><button>Cancel</button></Modal>));
  const input=container.querySelector('input')!,last=container.querySelector('button')!;
  expect(document.activeElement).toBe(input);last.focus();document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true,cancelable:true}));expect(document.activeElement).toBe(input);
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(close).toHaveBeenCalledOnce();
  await act(async()=>root.render(null));expect(document.activeElement).toBe(opener);
});
test('Escape does not dismiss a dialog while a write is pending',async()=>{
  const close=vi.fn();await act(async()=>root.render(<Modal label="Save task" busy onClose={close}><button disabled>Saving</button></Modal>));
  document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}));expect(close).not.toHaveBeenCalled();
});
