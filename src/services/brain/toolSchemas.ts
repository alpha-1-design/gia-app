import GiaTools from '../GiaTools';
import { ProtocolType, ProtocolImpact } from '../../types/protocol';

export const toolSchemas: Record<string, { description: string; required: string[]; properties: Record<string, { type: string; description: string; items?: { type: string } }> }> = {
  web_search: {
    description: 'Search the web for real-time information. Uses Exa/Browserless when configured; falls back to search engines.',
    required: ['query'],
    properties: { query: { type: 'string', description: 'Search query text' } }
  },
  read_url: {
    description: 'Fetch and read the text content of a URL. Uses Exa/Browserless or CORS proxies. Returns up to 25,000 characters.',
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
  build_project: {
    description: 'Generate project files, run a build command, and package into a downloadable ZIP.',
    required: ['files'],
    properties: {
      files: { type: 'array', description: 'Array of {path, content} project files', items: { type: 'object' } },
      build_command: { type: 'string', description: 'Optional build command (npm install, pip install, gcc, etc.)' },
      language: { type: 'string', description: 'Execution mode: sh/python/js/cpp (default: sh)' },
      output_filename: { type: 'string', description: 'Output ZIP filename (default: project.zip)' },
      entry: { type: 'string', description: 'Main entry point file path' },
    }
  },
  install_skill: {
    description: 'Install a new skill from a URL, package name, or inline definition. Expands GIA capabilities.',
    required: [],
    properties: {
      source: { type: 'string', description: 'URL to skill JSON, package name (developer/researcher/tutor/creative/security), or data: URI' },
      url: { type: 'string', description: 'Direct URL to a skill JSON definition' },
      name: { type: 'string', description: 'Override the skill name' },
      id: { type: 'string', description: 'Override the skill ID' },
      systemPrompt: { type: 'string', description: 'Override the skill system prompt' },
    }
  },
  image_generation: {
    description: 'Generate an AI image from a text description.',
    required: ['prompt'],
    properties: { prompt: { type: 'string', description: 'Image description' } }
  },
  // Email tools
  email_connect: { description: 'Connect Gmail for reading and sending emails.', required: [], properties: {} },
  email_disconnect: { description: 'Disconnect Gmail.', required: [], properties: {} },
  email_status: { description: 'Check if Gmail is connected.', required: [], properties: {} },
  email_send: {
    description: 'Send an email via Gmail.',
    required: ['to', 'subject', 'body'],
    properties: {
      to: { type: 'string', description: 'Recipient email' },
      subject: { type: 'string', description: 'Email subject' },
      body: { type: 'string', description: 'Email body' },
    }
  },
  email_list: {
    description: 'List recent emails from Gmail inbox.',
    required: [],
    properties: { maxResults: { type: 'number', description: 'Max results (default 10)' } }
  },
  email_read: {
    description: 'Read a specific email by ID.',
    required: ['id'],
    properties: { id: { type: 'string', description: 'Email ID' } }
  },
  email_search: {
    description: 'Search emails by query.',
    required: ['query'],
    properties: { query: { type: 'string', description: 'Search query' }, maxResults: { type: 'number', description: 'Max results' } }
  },

  // Calendar tools
  calendar_connect: { description: 'Connect Google Calendar.', required: [], properties: {} },
  calendar_disconnect: { description: 'Disconnect Google Calendar.', required: [], properties: {} },
  calendar_status: { description: 'Check if Google Calendar is connected.', required: [], properties: {} },
  calendar_list_events: {
    description: 'List calendar events within a time range.',
    required: [],
    properties: {
      timeMin: { type: 'string', description: 'Start time ISO string' },
      timeMax: { type: 'string', description: 'End time ISO string' },
      maxResults: { type: 'number', description: 'Max results' },
    }
  },
  calendar_create_event: {
    description: 'Create a new calendar event.',
    required: ['summary', 'start', 'end'],
    properties: {
      summary: { type: 'string', description: 'Event title' },
      description: { type: 'string', description: 'Event description' },
      start: { type: 'string', description: 'Start time ISO string' },
      end: { type: 'string', description: 'End time ISO string' },
    }
  },
  calendar_update_event: {
    description: 'Update an existing calendar event.',
    required: ['eventId'],
    properties: {
      eventId: { type: 'string', description: 'Event ID' },
      summary: { type: 'string', description: 'New title' },
      description: { type: 'string', description: 'New description' },
      start: { type: 'string', description: 'New start time ISO string' },
      end: { type: 'string', description: 'New end time ISO string' },
    }
  },
  calendar_delete_event: {
    description: 'Delete a calendar event.',
    required: ['eventId'],
    properties: { eventId: { type: 'string', description: 'Event ID' } }
  },

  // Messaging tools
  messaging_setup_telegram: {
    description: 'Connect Telegram bot for two-way chat.',
    required: ['botToken'],
    properties: { botToken: { type: 'string', description: 'Bot token from @BotFather' } }
  },
  messaging_setup_whatsapp: {
    description: 'Connect WhatsApp via wa.me links (one-way notifications only).',
    required: ['phoneNumber'],
    properties: { phoneNumber: { type: 'string', description: 'Phone number with country code' } }
  },
  messaging_send: {
    description: 'Send a message via Telegram or WhatsApp.',
    required: ['text'],
    properties: {
      channel: { type: 'string', description: 'Channel: telegram or whatsapp' },
      text: { type: 'string', description: 'Message text' },
    }
  },
  messaging_status: { description: 'Check messaging connection status.', required: [], properties: {} },
  messaging_disconnect: { description: 'Disconnect messaging channel.', required: [], properties: { channel: { type: 'string', description: 'Channel to disconnect' } } },
  messaging_set_mention_only: {
    description: 'Toggle whether GIA responds to all group messages or only when @mentioned.',
    required: ['enabled'],
    properties: { enabled: { type: 'boolean', description: 'true = @mention only, false = all messages' } }
  },

  // Personal assistant tools
  bible_verse: {
    description: 'Get a Bible verse — daily verse, search by keyword, or read a full chapter.',
    required: [],
    properties: {
      type: { type: 'string', description: '"daily" for verse of the day, "search" for keyword search, "chapter" for full chapter' },
      query: { type: 'string', description: 'Search keyword or "Book Chapter" (e.g. "John 3")' },
    }
  },
  daily_devotion: { description: 'Get a daily devotional message with Bible verse and prayer.', required: [], properties: {} },
  setup_morning_briefing: {
    description: 'Schedule a daily morning briefing sent to Telegram.',
    required: ['channel', 'time'],
    properties: {
      channel: { type: 'string', description: 'telegram or whatsapp' },
      time: { type: 'string', description: 'Time in 24h format (e.g. "07:00")' },
    }
  },
  set_reminder: {
    description: 'Set a recurring reminder sent via app or messaging.',
    required: ['title', 'interval'],
    properties: {
      title: { type: 'string', description: 'Reminder title' },
      interval: { type: 'string', description: 'hourly/daily/weekly' },
      time: { type: 'string', description: 'Time in 24h format' },
      details: { type: 'string', description: 'Extra context' },
      channel: { type: 'string', description: 'telegram or whatsapp' },
    }
  },
  play_music: {
    description: 'Play music via YouTube Music, Spotify, or direct audio URL.',
    required: ['query'],
    properties: {
      query: { type: 'string', description: 'Song name or search query' },
      platform: { type: 'string', description: 'youtube_music/spotify/youtube/audio' },
    }
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
  save_memory: {
    description: 'Save a fact, preference, detail, or anything worth remembering to GIA memory.',
    required: ['key', 'value'],
    properties: {
      key: { type: 'string', description: 'Memory key (e.g. "user_favorite_food")' },
      value: { type: 'string', description: 'Memory value (what to remember)' },
      category: { type: 'string', description: 'Category: profile/fact/preference/goal/project/correction/emotion/subject/score/weak_area/session_summary' },
      tier: { type: 'string', description: 'Tier: working/semantic/episodic (default: semantic)' },
      confidence: { type: 'number', description: 'Confidence 0-1 (default: 0.9)' },
    }
  },
  forget_memory: {
    description: 'Delete stored memories matching a topic or category.',
    required: [],
    properties: {
      key: { type: 'string', description: 'Topic to forget' },
      all: { type: 'boolean', description: 'Set true to clear all memories' },
      category: { type: 'string', description: 'Category filter: profile/fact/preference/goal/project/emotion/etc.' }
    }
  },
  request_clarification: {
    description: 'Ask the user for information before continuing. For a single quick question, pass question and optionally options (tappable buttons + free-text fallback). For several pieces of information at once (e.g. a short setup form), pass fields instead: an array of {id, label, type, options?, placeholder?} where type is "radio", "select", or "text". Fields render together with one "Send answers" button, which is friendlier than asking one question per turn when you need 2+ answers.',
    required: ['question'],
    properties: {
      question: { type: 'string', description: 'Clarifying question, or the intro text shown above a multi-field form' },
      options: { type: 'array', description: 'Answer options array for a single question (ignored if fields is provided)' },
      fields: {
        type: 'array',
        description: 'Multiple fields to collect together in one form: [{id, label, type: "radio"|"select"|"text", options?: string[], placeholder?: string}]'
      }
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
    description: 'Render an interactive OpenStreetMap centered on coordinates with optional markers and route.',
    required: ['center'],
    properties: {
      center: { type: 'object', description: '{lat, lng} map center' },
      markers: { type: 'array', description: '[{lat, lng, label, color}] markers', items: { type: 'object' } },
      route: { type: 'array', description: '[{lat, lng}] polyline points from get_directions', items: { type: 'object' } },
      zoom: { type: 'number', description: 'Zoom level 1-19 (default 13)' },
      title: { type: 'string', description: 'Optional map title' }
    }
  },
  get_directions: {
    description: 'Get turn-by-turn directions and route between two locations. Returns distance, duration, instructions, and a map-ready route.',
    required: ['origin', 'destination'],
    properties: {
      origin: { type: 'string', description: 'Starting place name or {lat, lng} object' },
      destination: { type: 'string', description: 'Destination place name or {lat, lng} object' },
      mode: { type: 'string', description: 'Travel mode: driving/walking/cycling (default: driving)' },
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
  device_health: {
    description: 'Check device health: storage usage, battery level, memory pressure. Alerts on risks.',
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
    zip_project: 'zip_project', build_project: 'zip_project', install_skill: 'settings_change', forget_memory: 'memory_modification',
    toggle_feature: 'settings_change', request_clarification: 'clarification',
    get_environment_info: 'environment_info', show_map: 'show_map',
    list_files: 'file_read', summarize_conversation: 'environment_info',
    create_goal: 'settings_change', list_goals: 'environment_info',
    pause_goal: 'settings_change', goal_progress: 'environment_info',
    set_autonomy_config: 'settings_change',
    // Device integration tools
    send_sms: 'device_action', send_whatsapp: 'device_action',
    send_email: 'device_action', make_phone_call: 'device_action',
    share: 'device_action', clipboard: 'device_action',
    vibrate: 'device_action', screen_brightness: 'device_action',
    device_info: 'device_action', device_health: 'device_action', get_contacts: 'device_action',
    open_url: 'device_action', set_alarm: 'device_action',
    save_memory: 'memory_modification', get_directions: 'location_access',
    // Email tools
    email_connect: 'settings_change', email_disconnect: 'settings_change',
    email_status: 'environment_info', email_send: 'device_action',
    email_list: 'file_read', email_read: 'file_read', email_search: 'web_search',
    // Calendar tools
    calendar_connect: 'settings_change', calendar_disconnect: 'settings_change',
    calendar_status: 'environment_info', calendar_list_events: 'environment_info',
    calendar_create_event: 'settings_change', calendar_update_event: 'settings_change',
    calendar_delete_event: 'settings_change',
    // Messaging tools
    messaging_setup_telegram: 'settings_change', messaging_setup_whatsapp: 'settings_change',
    messaging_send: 'device_action', messaging_status: 'environment_info',
    messaging_disconnect: 'settings_change', messaging_set_mention_only: 'settings_change',
    // Personal tools
    bible_verse: 'web_search', daily_devotion: 'environment_info',
    setup_morning_briefing: 'settings_change', set_reminder: 'settings_change',
    play_music: 'device_action',
  };
  return map[id] || 'custom';
}

export function toolToImpact(id: string): ProtocolImpact {
  const readTools = ['web_search', 'read_url', 'filesystem_read', 'list_files', 'get_environment_info',
    'get_user_location', 'search_places', 'device_info', 'device_health', 'get_contacts',
    'email_list', 'email_read', 'email_search', 'email_status',
    'calendar_list_events', 'calendar_status',
    'messaging_status', 'bible_verse', 'daily_devotion'];
  const writeTools = ['filesystem_write', 'export_brain', 'import_brain', 'zip_project', 'build_project', 'install_skill', 'forget_memory', 'save_memory',
    'toggle_feature', 'show_notification', 'summarize_conversation',
    'send_sms', 'send_whatsapp', 'send_email', 'make_phone_call',
    'share', 'clipboard', 'vibrate', 'screen_brightness', 'open_url', 'set_alarm',
    'email_connect', 'email_disconnect', 'email_send',
    'calendar_connect', 'calendar_disconnect', 'calendar_create_event', 'calendar_update_event', 'calendar_delete_event',
    'messaging_setup_telegram', 'messaging_setup_whatsapp', 'messaging_send', 'messaging_disconnect',
    'setup_morning_briefing', 'set_reminder', 'play_music'];
  const destructiveTools = ['forget_memory'];
  const networkTools = ['web_search', 'read_url', 'terminal_run', 'image_generation', 'search_places', 'show_map', 'get_directions'];
  const locationTools = ['get_user_location', 'search_places', 'show_map', 'get_directions'];
  if (destructiveTools.includes(id)) return 'destructive';
  if (locationTools.includes(id)) return 'location';
  if (networkTools.includes(id)) return 'network';
  if (writeTools.includes(id)) return 'write';
  if (readTools.includes(id)) return 'read';
  if (id === 'list_goals' || id === 'goal_progress' || id === 'set_autonomy_config') return 'read';
  if (id === 'create_goal' || id === 'pause_goal') return 'write';
  return 'execution';
}
