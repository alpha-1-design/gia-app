import { z } from 'zod';
import { useFileStore } from '../../store/useFileStore';
import type { Tool } from './types';

const fileSearch: Tool = {
  id: 'file_search',
  name: 'file_search',
  description: 'Search uploaded files by name, type, tags, or content. Returns matching file metadata.',
  schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search term to match against file name, tags, or content' },
      type: { type: 'string', description: 'Filter by MIME type prefix — e.g. "image", "text", "application/pdf"' },
      tag: { type: 'string', description: 'Filter by exact tag name' },
      limit: { type: 'number', description: 'Max results to return (default 20, max 100)' },
    },
  },
  execute: async (args) => {
    const schema = z.object({
      query: z.string().optional(),
      type: z.string().optional(),
      tag: z.string().optional(),
      limit: z.number().min(1).max(100).optional().default(20),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { query, type, tag, limit } = parsed.data;
    const { files, searchFiles } = useFileStore.getState();

    let results = query ? searchFiles(query) : [...files];
    if (tag) results = results.filter(f => f.tags.includes(tag));
    if (type) results = results.filter(f => f.type.startsWith(type));
    results.sort((a, b) => (b.lastReferencedAt || b.uploadedAt) - (a.lastReferencedAt || a.uploadedAt));
    const slice = results.slice(0, limit);

    return {
      success: true,
      content: JSON.stringify(slice.map(f => ({
        id: f.id,
        name: f.name,
        type: f.type,
        size: f.size,
        tags: f.tags,
        uploadedAt: f.uploadedAt,
        lastReferencedAt: f.lastReferencedAt,
        source: f.source,
      })), null, 2),
    };
  },
};

const fileGet: Tool = {
  id: 'file_get',
  name: 'file_get',
  description: 'Retrieve the full content of a previously uploaded file by ID. Use file_search to find IDs.',
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'File ID returned by file_search' },
    },
    required: ['id'],
  },
  execute: async (args) => {
    const schema = z.object({ id: z.string().min(1) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { getFile, touchFile } = useFileStore.getState();
    const file = getFile(parsed.data.id);
    if (!file) return { success: false, content: '', error: 'File not found' };

    touchFile(file.id);
    const isText = file.type.startsWith('text/') || file.type.startsWith('application/json') || file.type.startsWith('application/javascript');
    if (!isText && file.preview) {
      return {
        success: true,
        content: `[Image: ${file.name}] (${file.type}, ${(file.size / 1024).toFixed(1)}KB)\nFor vision analysis, the image data URL is: ${file.preview}`,
      };
    }
    return {
      success: true,
      content: `[BEGIN FILE: ${file.name}]\n${file.content}\n[END FILE]`,
    };
  },
};

const fileList: Tool = {
  id: 'file_list',
  name: 'file_list',
  description: 'List all uploaded files with optional filtering. Use file_search for more refined queries.',
  schema: {
    type: 'object',
    properties: {
      source: { type: 'string', description: 'Filter by source — "chat_upload", "manual", or "capture"' },
      limit: { type: 'number', description: 'Max results (default 50, max 200)' },
    },
  },
  execute: async (args) => {
    const schema = z.object({
      source: z.string().optional(),
      limit: z.number().min(1).max(200).optional().default(50),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { files } = useFileStore.getState();
    const results = parsed.data.source
      ? files.filter(f => f.source === parsed.data.source)
      : [...files];
    results.sort((a, b) => b.uploadedAt - a.uploadedAt);
    const slice = results.slice(0, parsed.data.limit);

    return {
      success: true,
      content: JSON.stringify(slice.map(f => ({
        id: f.id, name: f.name, type: f.type, size: f.size,
        tags: f.tags, source: f.source, uploadedAt: f.uploadedAt,
      })), null, 2),
    };
  },
};

const fileDelete: Tool = {
  id: 'file_delete',
  name: 'file_delete',
  description: 'Delete an uploaded file by ID. Permanently removes it from storage.',
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'File ID to delete' },
    },
    required: ['id'],
  },
  execute: async (args) => {
    const schema = z.object({ id: z.string().min(1) });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { getFile, deleteFile } = useFileStore.getState();
    const file = getFile(parsed.data.id);
    if (!file) return { success: false, content: '', error: 'File not found' };
    deleteFile(file.id);
    return { success: true, content: `Deleted file: ${file.name}` };
  },
};

const fileTag: Tool = {
  id: 'file_tag',
  name: 'file_tag',
  description: 'Add or remove tags from an uploaded file. Tags help organize and find files later.',
  schema: {
    type: 'object',
    properties: {
      id: { type: 'string', description: 'File ID' },
      action: { type: 'string', enum: ['add', 'remove'], description: 'Whether to add or remove the tag' },
      tag: { type: 'string', description: 'Tag name to add or remove' },
    },
    required: ['id', 'action', 'tag'],
  },
  execute: async (args) => {
    const schema = z.object({
      id: z.string().min(1),
      action: z.enum(['add', 'remove']),
      tag: z.string().min(1).max(50),
    });
    const parsed = schema.safeParse(args);
    if (!parsed.success) {
      return { success: false, content: '', error: parsed.error.issues.map(i => i.message).join(', ') };
    }
    const { id, action, tag } = parsed.data;
    const { getFile, addTag, removeTag } = useFileStore.getState();
    const file = getFile(id);
    if (!file) return { success: false, content: '', error: 'File not found' };
    if (action === 'add') addTag(id, tag);
    else removeTag(id, tag);
    return { success: true, content: `${action === 'add' ? 'Added' : 'Removed'} tag "${tag}" ${action === 'add' ? 'to' : 'from'} ${file.name}` };
  },
};

export const fileTools: Tool[] = [fileSearch, fileGet, fileList, fileDelete, fileTag];
