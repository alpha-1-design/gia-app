import ToolRegistry from '../ToolRegistry';
import type { Tool } from './types';

import { autonomyTools } from './autonomy';
import { browserAutomationTools } from './browserAutomation';
import { buildTools } from './build';
import { calendarTools } from './calendar';
import { cameraTools } from './camera';
import { clipboardTools } from './clipboard';
import { connectorTools } from './connectors';
import { controlTools } from './controls';
import { coreTools } from './core';
import { createPdfTool } from './createPdf';
import { databaseTools } from './database';
import { deviceTools } from './device';
import { deviceIntegrationTools } from './deviceIntegration';
import { documentTools } from './documents';
import { emailTools } from './email';
import { filegenTools } from './filegen';
import { filesystemTools } from './filesystem';
import { fileTools } from './filetool';
import { gatewayTools } from './gateway';
import { gatewayDaemonTools } from './gatewayDaemon';
import { geolocationTools } from './geolocation';
import { hapticsTools } from './haptics';
import { locationTools } from './location';
import { mcpTools } from './mcp';
import { mediaAccessTools } from './mediaAccess';
import { memoryTools } from './memory';
import { messagingTools } from './messaging';
import { networkTools } from './network';
import { neuraTools } from './neura';
import { noteTools } from './notes';
import { notificationTools } from './notifications';
import { personalTools } from './personal';
import { pluginTools } from './plugin';
import { powerTools } from './powerTools';
import { ragTools } from './rag';
import { pdfTools } from './readPdf';
import { sandboxTools } from './sandbox';
import { securityTools } from './security';
import { shareTools } from './share';
import { skillTools } from './skills';
import { smartHomeTools } from './smartHome';
import { socialMediaTools } from './socialMedia';
import { sshTools } from './ssh';
import { taskTools } from './tasks';
import { telegramTools } from './telegram';
import { terminalTools } from './terminal';
import { webSearchTools } from './webSearch';
import { websocketTools } from './websocket';

export function registerAllTools(): void {
  const allToolsLists: (Tool | Tool[])[] = [
    autonomyTools,
    browserAutomationTools,
    buildTools,
    calendarTools,
    cameraTools,
    clipboardTools,
    connectorTools,
    controlTools,
    coreTools,
    createPdfTool,
    databaseTools,
    deviceTools,
    deviceIntegrationTools,
    documentTools,
    emailTools,
    filegenTools,
    filesystemTools,
    fileTools,
    gatewayTools,
    gatewayDaemonTools,
    geolocationTools,
    hapticsTools,
    locationTools,
    mcpTools,
    mediaAccessTools,
    memoryTools,
    messagingTools,
    networkTools,
    neuraTools,
    noteTools,
    notificationTools,
    personalTools,
    pluginTools,
    powerTools,
    ragTools,
    pdfTools,
    sandboxTools,
    securityTools,
    shareTools,
    skillTools,
    smartHomeTools,
    socialMediaTools,
    sshTools,
    taskTools,
    telegramTools,
    terminalTools,
    webSearchTools,
    websocketTools,
  ];

  for (const item of allToolsLists) {
    if (Array.isArray(item)) {
      for (const tool of item) {
        if (tool && tool.id) {
          ToolRegistry.register(tool);
        }
      }
    } else if (item && item.id) {
      ToolRegistry.register(item);
    }
  }
}
