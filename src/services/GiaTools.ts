import type { Tool, ToolResult } from './tools/types';
import { webSearchTools } from './tools/webSearch';
import { filesystemTools } from './tools/filesystem';
import { coreTools } from './tools/core';
import { controlTools } from './tools/controls';
import { memoryTools } from './tools/memory';
import { locationTools } from './tools/location';
import { taskTools } from './tools/tasks';
import { noteTools } from './tools/notes';
import { autonomyTools } from './tools/autonomy';
import { powerTools } from './tools/powerTools';
import { deviceIntegrationTools } from './tools/deviceIntegration';
import { socialMediaTools } from './tools/socialMedia';
import { connectorTools } from './tools/connectors';
import { gatewayTools } from './tools/gateway';
import { telegramTools } from './tools/telegram';
import { terminalTools } from './tools/terminal';
import { gatewayDaemonTools } from './tools/gatewayDaemon';
import { clipboardTools } from './tools/clipboard';
import { hapticsTools } from './tools/haptics';
import { shareTools } from './tools/share';
import { geolocationTools } from './tools/geolocation';
import { notificationTools } from './tools/notifications';
import { deviceTools } from './tools/device';
import { buildTools } from './tools/build';
import { sandboxTools } from './tools/sandbox';
import { cameraTools } from './tools/camera';
import { filegenTools } from './tools/filegen';
import { documentTools } from './tools/documents';

export type { ToolResult };
export type { Tool };

class GiaTools {
  private tools: Map<string, Tool> = new Map();

  constructor() {
    this.registerBuiltInTools();
  }

  private registerBuiltInTools() {
    const allTools: Tool[] = [
      ...webSearchTools,
      ...filesystemTools,
      ...coreTools,
      ...controlTools,
      ...memoryTools,
      ...locationTools,
      ...taskTools,
      ...noteTools,
      ...autonomyTools,
      ...powerTools,
      ...deviceIntegrationTools,
      ...socialMediaTools,
      ...connectorTools,
      ...gatewayTools,
      ...telegramTools,
      ...terminalTools,
      ...gatewayDaemonTools,
      ...clipboardTools,
      ...hapticsTools,
      ...shareTools,
      ...geolocationTools,
      ...notificationTools,
      ...deviceTools,
      ...buildTools,
      ...sandboxTools,
      ...cameraTools,
      ...filegenTools,
      ...documentTools,
    ];
    for (const tool of allTools) {
      this.tools.set(tool.id, tool);
    }
  }

  getTool(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  getAllTools(): Tool[] {
    return Array.from(this.tools.values());
  }

  registerTool(tool: Tool): void {
    this.tools.set(tool.id, tool);
  }

  unregisterTool(id: string): void {
    this.tools.delete(id);
  }

  getToolSchema(id: string): Tool['schema'] {
    return this.tools.get(id)?.schema;
  }

  getAllToolSchemas(): Record<string, { description: string; properties: Record<string, unknown>; required?: string[] }> {
    const result: Record<string, { description: string; properties: Record<string, unknown>; required?: string[] }> = {};
    for (const [id, tool] of this.tools) {
      if (tool.schema) {
        result[id] = {
          description: tool.description,
          properties: tool.schema.properties,
          required: tool.schema.required,
        };
      }
    }
    return result;
  }
}

export default new GiaTools();
