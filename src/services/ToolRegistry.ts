import type { Tool } from './tools/types';

class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  public register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      console.warn(`Tool with id "${tool.id}" is already registered. Overwriting.`);
    }
    this.tools.set(tool.id, tool);
  }

  public get(id: string): Tool | undefined {
    return this.tools.get(id);
  }

  public unregister(id: string): boolean {
    return this.tools.delete(id);
  }

  public getAll(): Tool[] {
    return Array.from(this.tools.values());
  }

  public getToolSchema(id: string): Tool['schema'] | null {
    const tool = this.get(id);
    return tool?.schema || null;
  }

  public getAllToolSchemas(): Record<string, NonNullable<Tool['schema']>> {
    const record: Record<string, NonNullable<Tool['schema']>> = {};
    for (const tool of this.getAll()) {
      if (tool.schema) {
        record[tool.id] = tool.schema;
      }
    }
    return record;
  }
}

// Export a singleton instance
export default new ToolRegistry();
