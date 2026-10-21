// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AccessPage } from './AccessPage';
import { api } from '../services/api';

vi.mock('../services/api', () => ({ api: { accessContext: vi.fn(), accessMembers: vi.fn(), audit: vi.fn(), updateMember: vi.fn() } }));
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
let root: Root, container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  vi.mocked(api.accessContext).mockResolvedValue({ organizationId:'default',actor:'admin',role:'admin',organizations:[{id:'default',name:'Workspace',role:'admin'}] });
  vi.mocked(api.accessMembers).mockResolvedValue([{username:'existing',role:'reviewer',active:true}]);
  vi.mocked(api.audit).mockResolvedValue({events:[{id:'1',actor:'existing',operation:'INSERT',table_name:'projects',created_at:'2026-10-21T10:00:00Z'}],access:[],offset:0,limit:100});
  container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();});
const render=async()=>{await act(async()=>root.render(<AccessPage/>));};
const button=(name:string)=>[...container.querySelectorAll('button')].find(item=>item.textContent===name)!;
const click=async(node:HTMLElement)=>{await act(async()=>node.click());};
test('membership browsing and editing are separate and failed writes retain the selected user and role',async()=>{
  await render(); expect(container.querySelector('form')).toBeNull();
  await click(button('Edit access'));expect(container.querySelector('table')).toBeNull();
  const username=container.querySelector('input')!;expect(username.readOnly).toBe(true);expect(username.value).toBe('existing');
  vi.mocked(api.updateMember).mockRejectedValue(new Error('Keep at least one active administrator.'));
  await act(async()=>container.querySelector('form')!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true})));
  expect(api.updateMember).toHaveBeenCalledWith('existing','reviewer',true);
  expect(container.querySelector('form')).not.toBeNull();expect(container.textContent).toContain('Keep at least one active administrator.');
});
test('audit shows readable activity columns and keeps raw record details collapsed',async()=>{
  await render();await click(button('Audit records'));
  expect(container.textContent).toContain('Project and catalog activity');expect(container.textContent).toContain('projects');
  const record=[...container.querySelectorAll('details')].find(item=>item.querySelector('summary')?.textContent==='View record');
  expect(record?.open).toBe(false);expect(container.querySelector('form')).toBeNull();
});
test('viewers see their context without member management or audit requests',async()=>{
  vi.mocked(api.accessContext).mockResolvedValue({organizationId:'default',actor:'reader',role:'viewer',organizations:[]});
  await render();expect(api.accessMembers).not.toHaveBeenCalled();expect(api.audit).not.toHaveBeenCalled();expect(button('Grant access')).toBeUndefined();
});
