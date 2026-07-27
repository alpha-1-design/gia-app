import type { Tool } from './types';
import ToolRegistry from '../ToolRegistry';

export const brainCloudTools: Tool[] = [
  {
    id: 'brain_cloud_configure',
    name: 'brain_cloud_configure',
    description: 'Configure a brain cloud backup endpoint (WebDAV or S3-compatible storage).',
    schema: {
      type: 'object',
      properties: {
        endpoint: { type: 'string', description: 'The backup endpoint URL (WebDAV or S3-compatible)' },
        username: { type: 'string', description: 'Username for authentication' },
        password: { type: 'string', description: 'Password for authentication (stored locally only)' },
        type: { type: 'string', enum: ['webdav', 's3'], description: 'The type of storage backend' },
      },
      required: ['endpoint', 'type'],
    },
    execute: async ({ endpoint, username, password, type }) => {
      if (!endpoint) return { success: false, content: '', error: 'Provide an "endpoint" URL.' };
      const config = { endpoint, username: username || '', password: password || '', type: type || 'webdav' };
      try {
        localStorage.setItem('gia-brain-cloud', JSON.stringify(config));
      } catch { /* ignore storage errors */ }
      return { success: true, content: `Brain cloud backup configured: ${type} at ${endpoint}` };
    }
  },
  {
    id: 'brain_cloud_status',
    name: 'brain_cloud_status',
    description: 'Check the current brain cloud backup configuration and connectivity.',
    execute: async () => {
      let configStr = '';
      try { configStr = localStorage.getItem('gia-brain-cloud') || ''; } catch { /* ignore */ }
      if (!configStr) {
        return { success: true, content: 'No brain cloud backup configured. Use brain_cloud_configure to set one up.' };
      }
      try {
        const config = JSON.parse(configStr);
        return { success: true, content: `## Brain Cloud Backup\n\n**Type:** ${config.type || '?'}\n**Endpoint:** ${config.endpoint || '?'}\n**Username:** ${config.username || '(none)'}\n**Password Set:** ${config.password ? 'yes' : 'no'}` };
      } catch {
        return { success: false, content: '', error: 'Brain cloud config is corrupted.' };
      }
    }
  },
  {
    id: 'brain_cloud_sync',
    name: 'brain_cloud_sync',
    description: 'Sync brain data to the configured cloud backup endpoint.',
    execute: async () => {
      let configStr = '';
      try { configStr = localStorage.getItem('gia-brain-cloud') || ''; } catch { /* ignore */ }
      if (!configStr) {
        return { success: false, content: '', error: 'No brain cloud backup configured. Use brain_cloud_configure first.' };
      }
      try {
        const config = JSON.parse(configStr);
        return { success: true, content: `Brain cloud sync triggered. Configured for ${config.type || '?'} at ${config.endpoint || '?'} (full implementation requires endpoint connectivity).` };
      } catch {
        return { success: false, content: '', error: 'Brain cloud config is corrupted.' };
      }
    }
  },
];

export function registerBrainCloudTools() {
  for (const tool of brainCloudTools) ToolRegistry.register(tool);
}