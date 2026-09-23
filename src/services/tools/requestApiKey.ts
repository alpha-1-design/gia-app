import type { Tool } from './types';
import { useGiaStore } from '../../store/useGiaStore';

const requestApiKeyTool: Tool = {
  id: 'request_api_key',
  name: 'request_api_key',
  description: 'Request the user to provide an API key for a specific service. This will show an input panel at the bottom of the chat where they can enter and save the key securely.',
  schema: {
    type: 'object',
    properties: {
      providerId: { type: 'string', description: 'The provider ID (e.g., "openai", "anthropic", "google") that needs the API key' },
      description: { type: 'string', description: 'A brief description of what the API key is for (e.g., "OpenAI API key for chat completions")' },
      label: { type: 'string', description: 'Friendly service name shown to the user' },
      kind: { type: 'string', enum: ['api_key', 'token', 'secret'], description: 'Credential type' },
      connectorId: { type: 'string', description: 'Existing connector ID when this is a service credential' },
    },
    required: ['providerId', 'description'],
  },
  execute: async (args) => {
    const providerId = (args.providerId as string) || '';
    const description = (args.description as string) || 'API key required';
    const label = (args.label as string) || providerId;
    const kind = (args.kind as 'api_key' | 'token' | 'secret') || 'api_key';
    const connectorId = (args.connectorId as string) || undefined;

    if (!providerId) {
      return { success: false, content: 'Missing providerId parameter.', error: 'providerId is required' };
    }

    useGiaStore.getState().setPendingApiKeyRequest({ providerId, description, label, kind, connectorId });

    return {
      success: true,
      content: `I need the ${label} ${kind === 'token' ? 'token' : 'API key'} to proceed. I've opened a secure input panel at the bottom of the chat. Please enter it there and click Save, then tell me "done" or "continue" and I'll pick up from where I left off.`,
    };
  },
};

export const requestApiKeyTools: Tool[] = [requestApiKeyTool];
