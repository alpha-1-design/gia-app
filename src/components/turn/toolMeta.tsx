import React from 'react';
import {
  Search, Globe, FileText, Terminal, Zap, CheckCircle,
  Brain, Sparkles, Database, Shield, Send, Network, Image, MapPin,
  Archive, Activity,
} from 'lucide-react';

export interface ToolMeta {
  label: string;
  color: string;
  icon: React.ReactNode;
  category: string;
}

export const TOOL_META: Record<string, ToolMeta> = {
  web_search:        { label: 'Searching the web',    color: '#14b8a6', icon: <Search size={12} />,       category: 'research' },
  read_url:          { label: 'Reading page',         color: '#14b8a6', icon: <Globe size={12} />,        category: 'research' },
  check_website:     { label: 'Checking website',     color: '#14b8a6', icon: <Globe size={12} />,        category: 'research' },
  browser_navigate:  { label: 'Navigating browser',   color: '#14b8a6', icon: <Globe size={12} />,        category: 'research' },
  browser_click:     { label: 'Clicking element',     color: '#14b8a6', icon: <Globe size={12} />,        category: 'research' },
  browser_fill:      { label: 'Filling form',         color: '#14b8a6', icon: <Globe size={12} />,        category: 'research' },
  browser_scroll:    { label: 'Scrolling page',       color: '#14b8a6', icon: <Globe size={12} />,        category: 'research' },
  page_info:         { label: 'Fetching page info',   color: '#14b8a6', icon: <Globe size={12} />,        category: 'research' },
  terminal_run:      { label: 'Running code',         color: '#8b5cf6', icon: <Terminal size={12} />,     category: 'code' },
  sandbox_exec:      { label: 'Executing in sandbox', color: '#8b5cf6', icon: <Terminal size={12} />,     category: 'code' },
  filesystem_read:   { label: 'Reading file',         color: '#6366f1', icon: <FileText size={12} />,     category: 'files' },
  filesystem_write:  { label: 'Writing file',         color: '#6366f1', icon: <FileText size={12} />,     category: 'files' },
  list_files:        { label: 'Listing files',        color: '#6366f1', icon: <FileText size={12} />,     category: 'files' },
  file_search:       { label: 'Searching files',      color: '#6366f1', icon: <FileText size={12} />,     category: 'files' },
  image_generation:  { label: 'Generating image',     color: '#ec4899', icon: <Image size={12} />,        category: 'creative' },
  create_pdf:        { label: 'Creating PDF',         color: '#f97316', icon: <FileText size={12} />,     category: 'files' },
  save_memory:       { label: 'Saving to memory',     color: '#a855f7', icon: <Brain size={12} />,        category: 'memory' },
  neura_query:       { label: 'Querying knowledge',   color: '#a78bfa', icon: <Network size={12} />,      category: 'knowledge' },
  sub_agent_call:    { label: 'Delegating to agent',  color: '#22c55e', icon: <Sparkles size={12} />,     category: 'agents' },
  build_project:     { label: 'Building project',     color: '#f97316', icon: <Zap size={12} />,          category: 'code' },
  zip_project:       { label: 'Creating archive',     color: '#f59e0b', icon: <Archive size={12} />,      category: 'files' },
  security_scan:     { label: 'Scanning security',    color: '#ef4444', icon: <Shield size={12} />,       category: 'security' },
  ssh_connect:       { label: 'SSH connecting',       color: '#6366f1', icon: <Terminal size={12} />,     category: 'code' },
  db_query:          { label: 'Querying database',    color: '#3b82f6', icon: <Database size={12} />,     category: 'data' },
  note_create:       { label: 'Creating note',        color: '#f59e0b', icon: <FileText size={12} />,     category: 'files' },
  task_create:       { label: 'Creating task',        color: '#22c55e', icon: <CheckCircle size={12} />,  category: 'tasks' },
  social_create_post:{ label: 'Creating post',        color: '#ec4899', icon: <Send size={12} />,         category: 'social' },
  weather:           { label: 'Checking weather',     color: '#3b82f6', icon: <Globe size={12} />,        category: 'research' },
  wikipedia:         { label: 'Reading Wikipedia',    color: '#14b8a6', icon: <Globe size={12} />,        category: 'research' },
  get_directions:    { label: 'Getting directions',   color: '#22c55e', icon: <MapPin size={12} />,       category: 'research' },
  connector_call:    { label: 'Calling API',          color: '#3b82f6', icon: <Activity size={12} />,     category: 'data' },
};

export const ACTION_META: Record<string, { verb: string; singular: string; plural: string }> = {
  web_search: { verb: 'Searched', singular: 'query', plural: 'queries' },
  read_url: { verb: 'Browsed', singular: 'page', plural: 'pages' },
  browser_navigate: { verb: 'Browsed', singular: 'page', plural: 'pages' },
  browser_click: { verb: 'Clicked', singular: 'element', plural: 'elements' },
  browser_fill: { verb: 'Filled', singular: 'form field', plural: 'form fields' },
  browser_scroll: { verb: 'Scrolled', singular: 'page', plural: 'pages' },
  check_website: { verb: 'Checked', singular: 'site', plural: 'sites' },
  page_info: { verb: 'Inspected', singular: 'page', plural: 'pages' },
  wikipedia: { verb: 'Read', singular: 'article', plural: 'articles' },
  weather: { verb: 'Checked', singular: 'forecast', plural: 'forecasts' },
  get_directions: { verb: 'Mapped', singular: 'route', plural: 'routes' },
  terminal_run: { verb: 'Ran', singular: 'command', plural: 'commands' },
  sandbox_exec: { verb: 'Ran', singular: 'command', plural: 'commands' },
  ssh_connect: { verb: 'Connected to', singular: 'server', plural: 'servers' },
  filesystem_read: { verb: 'Read', singular: 'file', plural: 'files' },
  filesystem_write: { verb: 'Wrote', singular: 'file', plural: 'files' },
  list_files: { verb: 'Listed', singular: 'directory', plural: 'directories' },
  file_search: { verb: 'Searched', singular: 'file', plural: 'files' },
  create_pdf: { verb: 'Created', singular: 'PDF', plural: 'PDFs' },
  zip_project: { verb: 'Archived', singular: 'project', plural: 'projects' },
  note_create: { verb: 'Created', singular: 'note', plural: 'notes' },
  image_generation: { verb: 'Generated', singular: 'image', plural: 'images' },
  save_memory: { verb: 'Saved', singular: 'memory', plural: 'memories' },
  neura_query: { verb: 'Queried', singular: 'knowledge source', plural: 'knowledge sources' },
  sub_agent_call: { verb: 'Delegated', singular: 'task', plural: 'tasks' },
  build_project: { verb: 'Built', singular: 'project', plural: 'projects' },
  security_scan: { verb: 'Scanned', singular: 'item', plural: 'items' },
  db_query: { verb: 'Queried', singular: 'database', plural: 'databases' },
  task_create: { verb: 'Created', singular: 'task', plural: 'tasks' },
  social_create_post: { verb: 'Created', singular: 'post', plural: 'posts' },
  connector_call: { verb: 'Called', singular: 'API', plural: 'APIs' },
};

export const CATEGORY_FALLBACK: Record<string, { verb: string; singular: string; plural: string }> = {
  research: { verb: 'Researched', singular: 'source', plural: 'sources' },
  files: { verb: 'Handled', singular: 'file', plural: 'files' },
  code: { verb: 'Ran', singular: 'command', plural: 'commands' },
  creative: { verb: 'Created', singular: 'asset', plural: 'assets' },
  memory: { verb: 'Saved', singular: 'memory', plural: 'memories' },
  knowledge: { verb: 'Queried', singular: 'knowledge source', plural: 'knowledge sources' },
  agents: { verb: 'Delegated', singular: 'task', plural: 'tasks' },
  security: { verb: 'Scanned', singular: 'item', plural: 'items' },
  data: { verb: 'Queried', singular: 'dataset', plural: 'datasets' },
  tasks: { verb: 'Created', singular: 'task', plural: 'tasks' },
  social: { verb: 'Created', singular: 'post', plural: 'posts' },
  other: { verb: 'Used', singular: 'tool', plural: 'tools' },
};

export function toolIcon(toolName: string): React.ReactNode {
  return TOOL_META[toolName]?.icon ?? <Zap size={12} />;
}

export function toolColor(toolName: string, category: string): string {
  return TOOL_META[toolName]?.color ?? (category === 'other' ? '#a1a1aa' : '#a78bfa');
}

export function toolLabel(toolName: string): string {
  return TOOL_META[toolName]?.label ?? toolName;
}
