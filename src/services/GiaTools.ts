import ToolRegistry from './ToolRegistry';
import type { Tool } from './tools/types';

class GiaTools {
  getTool(id: string) {
    return ToolRegistry.get(id);
  }

  getAllTools() {
    return ToolRegistry.getAll();
  }

  registerTool(tool: Tool) {
    ToolRegistry.register(tool);
  }

  unregisterTool(id: string) {
    ToolRegistry.unregister(id);
  }

  getToolSchema(id: string) {
    return ToolRegistry.getToolSchema(id);
  }

  getAllToolSchemas() {
    return ToolRegistry.getAllToolSchemas();
  }
}

export default new GiaTools();
