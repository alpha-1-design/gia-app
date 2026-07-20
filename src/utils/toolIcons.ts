export function getToolColor(toolId: string): string {
  const colors: Record<string, string> = {
    send_whatsapp: '#25D366', send_email: '#ea4335', send_sms: '#3b82f6',
    make_phone_call: '#22c55e', share: '#a855f7', clipboard: '#f59e0b',
    vibrate: '#ec4899', screen_brightness: '#f97316', device_info: '#06b6d4',
    get_contacts: '#8b5cf6', open_url: '#6366f1',
    web_search: '#3b82f6', web_scrape: '#10b981', http_request: '#ec4899',
    terminal_run: '#22c55e', environment_info: '#3b82f6', github: '#f0f0f0',
    wikipedia: '#f59e0b', weather: '#3b82f6', define: '#f59e0b',
    image_generation: '#ec4899',
    read_url: '#10b981', browser_navigate: '#3b82f6', page_info: '#06b6d4',
    filesystem_read: '#f59e0b', filesystem_write: '#f59e0b', list_files: '#f59e0b',
    zip_project: '#f59e0b',
    switch_module: '#3b82f6', toggle_feature: '#f59e0b', show_notification: '#ec4899',
    request_clarification: '#3b82f6', forget_memory: '#8b5cf6',
  };
  return colors[toolId] || '#a855f7';
}