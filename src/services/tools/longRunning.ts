import { useGiaStore } from '../../store/useGiaStore';
import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const longRunningTools: Tool[] = [
  {
    id: 'long_running_enable',
    name: 'long_running_enable',
    description: 'Enable Long-Running Mode — prevents screen dimming and browser tab suspension during extended tasks.',
    execute: async () => {
      useGiaStore.getState().setLongRunningMode(true);
      return { success: true, content: 'Long-Running Mode enabled. Screen will stay on and the tab won\'t suspend.' };
    }
  },
  {
    id: 'long_running_disable',
    name: 'long_running_disable',
    description: 'Disable Long-Running Mode. Screen may dim and the tab may suspend after the normal inactivity timeout.',
    execute: async () => {
      useGiaStore.getState().setLongRunningMode(false);
      return { success: true, content: 'Long-Running Mode disabled.' };
    }
  },
  {
    id: 'long_running_status',
    name: 'long_running_status',
    description: 'Check whether Long-Running Mode is currently enabled.',
    execute: async () => {
      const enabled = useGiaStore.getState().longRunningMode;
      return { success: true, content: `Long-Running Mode is ${enabled ? 'enabled' : 'disabled'}.` };
    }
  },
];

export function registerLongRunningTools() {
  for (const tool of longRunningTools) ToolRegistry.register(tool);
}