import GiaTools from '../GiaTools';
import { ProtocolType, ProtocolImpact } from '../../types/protocol';

export const toolSchemas: Record<string, { description: string; required: string[]; properties: Record<string, { type: string; description: string; items?: { type: string } }> }> = {
  web_search: {
    description: 'Search the web for real-time information using DuckDuckGo.',
    required: ['query'],
    properties: { query: { type: 'string', description: 'Search query text' } }
  },
  read_url: {
    description: 'Fetch and read the text content of a URL. Returns up to 25,000 characters.',
    required: ['url'],
    properties: { url: { type: 'string', description: 'Full URL to fetch' } }
  },
  terminal_run: {
    description: 'Execute scripts in a sandboxed container (Python, JS, C++).',
    required: ['command'],
    properties: {
      command: { type: 'string', description: 'Code to execute' },
      language: { type: 'string', description: 'Language: python/js/cpp' }
    }
  },
  filesystem_read: {
    description: 'Read the content of a file from the local filesystem.',
    required: ['path'],
    properties: { path: { type: 'string', description: 'File path' } }
  },
  filesystem_write: {
    description: 'Write or update a file on the local filesystem.',
    required: ['path', 'content'],
    properties: {
      path: { type: 'string', description: 'File path' },
      content: { type: 'string', description: 'File content' }
    }
  },
  list_files: {
    description: 'List files in a directory.',
    required: [],
    properties: { path: { type: 'string', description: 'Directory path (optional, default root)' } }
  },
  zip_project: {
    description: 'Create a ZIP bundle of files.',
    required: [],
    properties: {
      filename: { type: 'string', description: 'Output filename (default: project.zip)' },
      files: { type: 'array', description: 'Array of {path, content} objects', items: { type: 'object' } },
      paths: { type: 'array', description: 'Array of file paths to read from device', items: { type: 'string' } }
    }
  },
  image_generation: {
    description: 'Generate an AI image from a text description.',
    required: ['prompt'],
    properties: { prompt: { type: 'string', description: 'Image description' } }
  },
  switch_module: {
    description: 'Navigate to another module (chat/exam/analyst/writer/planner/settings).',
    required: ['module'],
    properties: { module: { type: 'string', description: 'Target module name' } }
  },
  toggle_feature: {
    description: 'Enable or disable GIA features (web_search, thinking, hands_off).',
    required: ['feature', 'enabled'],
    properties: {
      feature: { type: 'string', description: 'Feature name: web_search/thinking/hands_off' },
      enabled: { type: 'boolean', description: 'true to enable, false to disable' }
    }
  },
  show_notification: {
    description: 'Show a toast notification to the user.',
    required: ['message'],
    properties: { message: { type: 'string', description: 'Notification text' } }
  },
  summarize_conversation: {
    description: 'Compress long conversations to save context space.',
    required: ['messages'],
    properties: { messages: { type: 'array', description: 'Array of {role, content} message objects', items: { type: 'object' } } }
  },
  forget_memory: {
    description: 'Delete stored memories matching a topic.',
    required: [],
    properties: {
      key: { type: 'string', description: 'Topic to forget' },
      all: { type: 'boolean', description: 'Set true to clear all memories' }
    }
  },
  request_clarification: {
    description: 'Ask the user a clarifying question when you need more information.',
    required: ['question'],
    properties: {
      question: { type: 'string', description: 'Clarifying question' },
      options: { type: 'array', description: 'Answer options array' }
    }
  },
  get_environment_info: {
    description: 'Introspect GIA identity, architecture, capabilities, and environment.',
    required: [],
    properties: {}
  },
  get_user_location: {
    description: 'Get the user current GPS position using device geolocation.',
    required: [],
    properties: {}
  },
  search_places: {
    description: 'Search for places, addresses, or landmarks via OpenStreetMap.',
    required: ['query'],
    properties: {
      query: { type: 'string', description: 'Place name or address to search' },
      limit: { type: 'number', description: 'Max results (1-10, default 5)' }
    }
  },
  show_map: {
    description: 'Render an interactive OpenStreetMap centered on coordinates with optional markers.',
    required: ['center'],
    properties: {
      center: { type: 'object', description: '{lat, lng} map center' },
      markers: { type: 'array', description: '[{lat, lng, label, color}] markers', items: { type: 'object' } },
      route: { type: 'array', description: '[{lat, lng}] polyline points', items: { type: 'object' } },
      zoom: { type: 'number', description: 'Zoom level 1-19 (default 13)' },
      title: { type: 'string', description: 'Optional map title' }
    }
  },
  export_brain: {
    description: 'Export GIA memories, identity, and skills as a downloadable JSON file.',
    required: [],
    properties: {}
  },
  import_brain: {
    description: 'Restore GIA knowledge from a previously exported brain JSON file.',
    required: [],
    properties: {}
  },
  filesystem_desktop_read: {
    description: 'Read a file from the user\'s selected project folder on desktop.',
    required: ['path'],
    properties: { path: { type: 'string', description: 'File path relative to project root' } }
  },
  filesystem_desktop_write: {
    description: 'Write or update a file in the user\'s selected project folder on desktop.',
    required: ['path', 'content'],
    properties: {
      path: { type: 'string', description: 'File path relative to project root' },
      content: { type: 'string', description: 'File content' }
    }
  },
  filesystem_desktop_list: {
    description: 'List files and directories in the user\'s selected project folder on desktop.',
    required: [],
    properties: { path: { type: 'string', description: 'Subdirectory path (optional, default root)' } }
  },

  // Task management tools
  task_create: {
    description: 'Create a new task with title, description, priority, tags, and due date.',
    required: ['title'],
    properties: {
      title: { type: 'string', description: 'Task title' },
      description: { type: 'string', description: 'Task description (optional)' },
      priority: { type: 'string', description: 'Priority: low/medium/high/critical (default: medium)' },
      tags: { type: 'array', description: 'Tags for the task', items: { type: 'string' } },
      dueDate: { type: 'string', description: 'Due date in ISO format (optional)' }
    }
  },

  task_read: {
    description: 'Read a task by ID, or list tasks by status (todo, in_progress, done).',
    required: [],
    properties: {
      id: { type: 'string', description: 'Task ID to read (optional)' },
      status: { type: 'string', description: 'Filter by status: todo/in_progress/done (optional)' }
    }
  },

  task_update: {
    description: 'Update a task by ID with new properties.',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Task ID' },
      title: { type: 'string', description: 'New title (optional)' },
      description: { type: 'string', description: 'New description (optional)' },
      status: { type: 'string', description: 'New status: todo/in_progress/done (optional)' },
      priority: { type: 'string', description: 'New priority: low/medium/high/critical (optional)' },
      tags: { type: 'array', description: 'New tags (optional)', items: { type: 'string' } },
      dueDate: { type: 'string', description: 'New due date in ISO format (optional)' }
    }
  },

  task_delete: {
    description: 'Delete a task by ID.',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Task ID to delete' }
    }
  },

  task_move: {
    description: 'Move a task to a different status (todo, in_progress, done).',
    required: ['id', 'status'],
    properties: {
      id: { type: 'string', description: 'Task ID' },
      status: { type: 'string', description: 'New status: todo/in_progress/done' }
    }
  },

  // Notes management tools
  note_create: {
    description: 'Create a new note with title, content, color, and tags.',
    required: ['title'],
    properties: {
      title: { type: 'string', description: 'Note title' },
      content: { type: 'string', description: 'Note content (optional, markdown supported)' },
      color: { type: 'string', description: 'Note color (hex code, optional)' },
      tags: { type: 'array', description: 'Tags for the note', items: { type: 'string' } }
    }
  },

  note_read: {
    description: 'Read a note by ID, or list/search notes.',
    required: [],
    properties: {
      id: { type: 'string', description: 'Note ID to read (optional)' },
      search: { type: 'string', description: 'Search query for notes (optional)' }
    }
  },

  note_update: {
    description: 'Update a note by ID with new properties.',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Note ID' },
      title: { type: 'string', description: 'New title (optional)' },
      content: { type: 'string', description: 'New content (optional)' },
      color: { type: 'string', description: 'New color (hex code, optional)' },
      tags: { type: 'array', description: 'New tags (optional)', items: { type: 'string' } }
    }
  },

  note_delete: {
    description: 'Delete a note by ID.',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Note ID to delete' }
    }
  },

  note_toggle_pin: {
    description: 'Toggle the pinned state of a note.',
    required: ['id'],
    properties: {
      id: { type: 'string', description: 'Note ID' }
    }
  },

  // Device integration tools
  send_sms: {
    description: 'Send an SMS text message directly without opening the SMS app.',
    required: ['phone', 'message'],
    properties: {
      phone: { type: 'string', description: 'Recipient phone number with country code' },
      message: { type: 'string', description: 'SMS message content' },
    }
  },
  send_whatsapp: {
    description: 'Send a WhatsApp message to a specific phone number.',
    required: ['phone', 'message'],
    properties: {
      phone: { type: 'string', description: 'Phone number with country code (e.g. +233501234567)' },
      message: { type: 'string', description: 'Message text' },
    }
  },
  send_email: {
    description: 'Compose an email with recipient, subject, and body.',
    required: ['to', 'subject', 'body'],
    properties: {
      to: { type: 'string', description: 'Recipient email address' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body text' },
    }
  },
  make_phone_call: {
    description: 'Initiate a phone call by opening the dialer with a pre-filled number.',
    required: ['phone'],
    properties: {
      phone: { type: 'string', description: 'Phone number with country code' },
    }
  },
  share: {
    description: 'Share content using the native share sheet.',
    required: ['title', 'text'],
    properties: {
      title: { type: 'string', description: 'Share title' },
      text: { type: 'string', description: 'Share text content' },
      url: { type: 'string', description: 'Optional URL to share' },
    }
  },
  clipboard: {
    description: 'Read from or write to the system clipboard.',
    required: ['action'],
    properties: {
      action: { type: 'string', description: 'read or write' },
      text: { type: 'string', description: 'Text to write (required for write action)' },
    }
  },
  vibrate: {
    description: 'Trigger device vibration or haptic feedback.',
    required: ['duration'],
    properties: {
      duration: { type: 'number', description: 'Vibration duration in milliseconds (100-5000)' },
    }
  },
  screen_brightness: {
    description: 'Get or set device screen brightness (0.0 to 1.0).',
    required: ['action'],
    properties: {
      action: { type: 'string', description: 'get or set' },
      value: { type: 'number', description: 'Brightness level 0.0-1.0 (required for set)' },
    }
  },
  device_info: {
    description: 'Get comprehensive device and system information.',
    required: [],
    properties: {}
  },
  get_contacts: {
    description: 'Search or list contacts from the device address book.',
    required: [],
    properties: {
      query: { type: 'string', description: 'Optional search query' },
      maxResults: { type: 'number', description: 'Max results (default 20, max 100)' },
    }
  },
  open_url: {
    description: 'Open a URL in the default browser or external app.',
    required: ['url'],
    properties: {
      url: { type: 'string', description: 'URL to open (https://, tel:, mailto:, or custom scheme)' },
    }
  },
  set_alarm: {
    description: 'Set an alarm on the device. Uses AlarmManager to set directly.',
    required: ['hour', 'minute'],
    properties: {
      hour: { type: 'number', description: 'Hour in 24-hour format (0-23)' },
      minute: { type: 'number', description: 'Minute (0-59)' },
      label: { type: 'string', description: 'Optional alarm label' },
      days: { type: 'array', description: 'Repeat days: 1=Sun through 7=Sat', items: { type: 'number' } },
    }
  },

  // Autonomy tools
  create_goal: {
    description: 'Create a new autonomous goal for GIA to work on independently. GIA will plan, execute, and track progress.',
    required: ['title', 'description'],
    properties: {
      title: { type: 'string', description: 'Short goal title' },
      description: { type: 'string', description: 'Detailed goal description' },
      priority: { type: 'string', description: 'Priority: low/medium/high/critical (default: medium)' },
    }
  },
  list_goals: {
    description: 'List all current autonomous goals with their status and progress.',
    required: [],
    properties: {}
  },
  pause_goal: {
    description: 'Pause, resume, or cancel an autonomous goal.',
    required: ['goalTitle', 'action'],
    properties: {
      goalTitle: { type: 'string', description: 'Title of the goal (partial match works)' },
      action: { type: 'string', description: 'What to do: pause/resume/cancel' },
    }
  },
  goal_progress: {
    description: 'Get a detailed progress report on a specific goal.',
    required: ['goalTitle'],
    properties: {
      goalTitle: { type: 'string', description: 'Title of the goal (partial match works)' },
    }
  },
  set_autonomy_config: {
    description: 'Configure GIA autonomous behavior — enable/disable autonomous mode, set proactiveness level.',
    required: [],
    properties: {
      enabled: { type: 'boolean', description: 'Enable or disable autonomous background work' },
      proactivenessLevel: { type: 'number', description: 'How proactive (0.0-1.0)' },
    }
  },
};

export function mapSchemaProperty([k, v]: [string, { type: string; description: string; items?: { type: string } }]): [string, { type: string; description: string; items?: { type: string } }] {
  const prop: { type: string; description: string; items?: { type: string } } = { type: v.type, description: v.description };
  if (v.type === 'array' && v.items) {
    prop.items = v.items;
  }
  return [k, prop];
}

export function getAllToolSchemas(): Record<string, { description: string; required: string[]; properties: Record<string, { type: string; description: string; items?: { type: string } }> }> {
  const mcpSchemas = GiaTools.getAllToolSchemas() as unknown as Record<string, { description: string; required: string[]; properties: Record<string, { type: string; description: string; items?: { type: string } }> }>;
  return { ...toolSchemas, ...mcpSchemas };
}

export function buildOpenAITools(): Record<string, unknown>[] {
  return Object.entries(getAllToolSchemas()).map(([id, schema]) => ({
    type: 'function',
    function: {
      name: id,
      description: schema.description,
      parameters: {
        type: 'object',
        properties: Object.fromEntries(
          Object.entries(schema.properties).map((entry) => mapSchemaProperty(entry))
        ),
        required: schema.required.length > 0 ? schema.required : undefined,
      },
    },
  }));
}

export function buildAnthropicTools(): Record<string, unknown>[] {
  return Object.entries(getAllToolSchemas()).map(([id, schema]) => ({
    name: id,
    description: schema.description,
    input_schema: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(schema.properties).map((entry) => mapSchemaProperty(entry))
      ),
      required: schema.required.length > 0 ? schema.required : undefined,
    },
  }));
}

export function buildGeminiTools(): Record<string, unknown>[] {
  return Object.entries(getAllToolSchemas()).map(([id, schema]) => ({
    name: id,
    description: schema.description,
    parameters: {
      type: 'object',
      properties: Object.fromEntries(
        Object.entries(schema.properties).map((entry) => mapSchemaProperty(entry))
      ),
      required: schema.required.length > 0 ? schema.required : undefined,
    },
  }));
}

export function validateToolArgs(id: string, args: Record<string, unknown>): string | null {
  const schema = getAllToolSchemas()[id];
  if (!schema) return null;
  for (const key of schema.required) {
    if (args[key] === undefined || args[key] === null || args[key] === '') {
      return `Missing required argument "${key}" for tool "${id}"`;
    }
  }
  for (const [key, prop] of Object.entries(schema.properties)) {
    if (args[key] !== undefined && args[key] !== null) {
      const actual = Array.isArray(args[key]) ? 'array' : typeof args[key];
      if (actual !== prop.type) {
        return `Invalid type for "${key}" in tool "${id}": expected ${prop.type}, got ${actual}`;
      }
    }
  }
  return null;
}

export function toolToProtocolType(id: string): ProtocolType {
  const map: Record<string, ProtocolType> = {
    web_search: 'web_search', read_url: 'web_fetch', terminal_run: 'code_execution',
    filesystem_read: 'file_read', filesystem_write: 'file_write',
    get_user_location: 'location_access', search_places: 'location_access',
    show_notification: 'notification', image_generation: 'image_generation',
    export_brain: 'brain_export', import_brain: 'brain_import',
    zip_project: 'zip_project', forget_memory: 'memory_modification',
    toggle_feature: 'settings_change', request_clarification: 'clarification',
    get_environment_info: 'environment_info', show_map: 'show_map',
    list_files: 'file_read', summarize_conversation: 'environment_info',
    filesystem_desktop_read: 'file_read', filesystem_desktop_write: 'file_write',
    filesystem_desktop_list: 'file_read',
    create_goal: 'settings_change', list_goals: 'environment_info',
    pause_goal: 'settings_change', goal_progress: 'environment_info',
    set_autonomy_config: 'settings_change',
    // Device integration tools
    send_sms: 'device_action', send_whatsapp: 'device_action',
    send_email: 'device_action', make_phone_call: 'device_action',
    share: 'device_action', clipboard: 'device_action',
    vibrate: 'device_action', screen_brightness: 'device_action',
    device_info: 'device_action', get_contacts: 'device_action',
    open_url: 'device_action', set_alarm: 'device_action',
  };
  return map[id] || 'custom';
}

export function toolToImpact(id: string): ProtocolImpact {
  const readTools = ['web_search', 'read_url', 'filesystem_read', 'list_files', 'get_environment_info',
    'get_user_location', 'search_places', 'device_info', 'get_contacts'];
  const writeTools = ['filesystem_write', 'export_brain', 'import_brain', 'zip_project', 'forget_memory',
    'toggle_feature', 'show_notification', 'summarize_conversation',
    'send_sms', 'send_whatsapp', 'send_email', 'make_phone_call',
    'share', 'clipboard', 'vibrate', 'screen_brightness', 'open_url', 'set_alarm'];
  const destructiveTools = ['forget_memory'];
  const networkTools = ['web_search', 'read_url', 'terminal_run', 'image_generation', 'search_places', 'show_map'];
  const locationTools = ['get_user_location', 'search_places', 'show_map'];
  if (destructiveTools.includes(id)) return 'destructive';
  if (locationTools.includes(id)) return 'location';
  if (networkTools.includes(id)) return 'network';
  if (writeTools.includes(id)) return 'write';
  if (readTools.includes(id)) return 'read';
  if (id === 'list_goals' || id === 'goal_progress' || id === 'set_autonomy_config') return 'read';
  if (id === 'create_goal' || id === 'pause_goal') return 'write';
  return 'execution';
}
