export type ProtocolImpact = 'read' | 'write' | 'destructive' | 'network' | 'location' | 'notification' | 'execution';

export type ProtocolState = 'proposed' | 'confirmed' | 'executing' | 'completed' | 'failed' | 'rejected' | 'modified';

export type ProtocolType =
  | 'web_search'
  | 'web_fetch'
  | 'code_execution'
  | 'file_read'
  | 'file_write'
  | 'location_access'
  | 'notification'
  | 'image_generation'
  | 'brain_export'
  | 'brain_import'
  | 'zip_project'
  | 'memory_modification'
  | 'settings_change'
  | 'clarification'
  | 'environment_info'
  | 'show_map'
  | 'custom';

export interface ProtocolProposal {
  id: string;
  type: ProtocolType;
  summary: string;
  description: string;
  args: Record<string, unknown>;
  impact: ProtocolImpact;
  state: ProtocolState;
  result?: string;
  error?: string;
  trace?: string[];
  sources?: { title: string; url: string }[];
  createdAt: number;
  confirmedAt?: number;
  executedAt?: number;
  completedAt?: number;
  messageId?: string;
  progress?: number;
  progressLabel?: string;
}

export interface ProtocolAction {
  type: 'confirm' | 'reject' | 'modify';
  protocolId: string;
  modifiedArgs?: Record<string, unknown>;
  timestamp: number;
}

export const PROTOCOL_META: Record<ProtocolType, { icon: string; color: string; label: string }> = {
  web_search:          { icon: '🔍', color: '#3b82f6', label: 'Web Search' },
  web_fetch:           { icon: '🌐', color: '#3b82f6', label: 'Web Fetch' },
  code_execution:      { icon: '▶', color: '#a855f7', label: 'Code Execution' },
  file_read:           { icon: '📖', color: '#06b6d4', label: 'File Read' },
  file_write:          { icon: '💾', color: '#06b6d4', label: 'File Write' },
  location_access:     { icon: '📍', color: '#10b981', label: 'Location Access' },
  notification:        { icon: '🔔', color: '#f59e0b', label: 'Notification' },
  image_generation:    { icon: '🎨', color: '#ec4899', label: 'Image Generation' },
  brain_export:        { icon: '📤', color: '#8b5cf6', label: 'Brain Export' },
  brain_import:        { icon: '📥', color: '#8b5cf6', label: 'Brain Import' },
  zip_project:         { icon: '📦', color: '#65a30d', label: 'Zip Project' },
  memory_modification: { icon: '🧠', color: '#f97316', label: 'Memory' },
  settings_change:     { icon: '⚙', color: '#6b7280', label: 'Settings' },
  clarification:       { icon: '❓', color: '#eab308', label: 'Clarification' },
  environment_info:    { icon: 'ℹ', color: '#6b7280', label: 'Environment Info' },
  show_map:            { icon: '🗺', color: '#10b981', label: 'Show Map' },
  custom:              { icon: '🔧', color: '#6b7280', label: 'Custom' },
};
