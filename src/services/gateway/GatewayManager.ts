export interface GatewayRoute {
  id: string;
  name: string;
  description: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'ANY';
  path: string;
  targetUrl: string;
  headers?: Record<string, string>;
  transform?: 'none' | 'json' | 'graphql';
  rateLimit?: number;
  cacheTTL?: number;
  enabled: boolean;
  created: number;
  lastCalled?: number;
  callCount: number;
}

export interface GatewayLog {
  id: string;
  routeId: string;
  timestamp: number;
  method: string;
  path: string;
  status: number;
  duration: number;
  error?: string;
}

export interface GatewayStats {
  totalRoutes: number;
  enabledRoutes: number;
  totalCalls: number;
  successRate: number;
  avgDuration: number;
  routesByMethod: Record<string, number>;
}

class GatewayManager {
  private routes: Map<string, GatewayRoute> = new Map();
  private logs: GatewayLog[] = [];
  private storeKey = 'gia-gateway-routes';
  private logStoreKey = 'gia-gateway-logs';

  constructor() {
    this.load();
  }

  private load() {
    try {
      const raw = localStorage.getItem(this.storeKey);
      if (raw) {
        const routes: GatewayRoute[] = JSON.parse(raw);
        for (const r of routes) this.routes.set(r.id, r);
      }
    } catch { /* ignore */ }
    try {
      const raw = localStorage.getItem(this.logStoreKey);
      if (raw) this.logs = JSON.parse(raw).slice(0, 500);
    } catch { this.logs = []; }
  }

  private save() {
    try {
      localStorage.setItem(this.storeKey, JSON.stringify(Array.from(this.routes.values())));
      localStorage.setItem(this.logStoreKey, JSON.stringify(this.logs.slice(-500)));
    } catch { /* ignore */ }
  }

  addRoute(route: Omit<GatewayRoute, 'id' | 'created' | 'callCount'>): GatewayRoute {
    const id = `route_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const newRoute: GatewayRoute = {
      ...route,
      id,
      created: Date.now(),
      callCount: 0,
    };
    this.routes.set(id, newRoute);
    this.save();
    return newRoute;
  }

  updateRoute(id: string, updates: Partial<GatewayRoute>): boolean {
    const route = this.routes.get(id);
    if (!route) return false;
    Object.assign(route, updates);
    this.save();
    return true;
  }

  removeRoute(id: string): boolean {
    const deleted = this.routes.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  getRoute(id: string): GatewayRoute | undefined {
    return this.routes.get(id);
  }

  getAllRoutes(): GatewayRoute[] {
    return Array.from(this.routes.values());
  }

  getEnabledRoutes(): GatewayRoute[] {
    return this.getAllRoutes().filter(r => r.enabled);
  }

  getRoutesByMethod(method: string): GatewayRoute[] {
    return this.getAllRoutes().filter(r => r.method === 'ANY' || r.method === method);
  }

  async proxy(routeId: string, body?: unknown): Promise<{ status: number; data: unknown; duration: number }> {
    const route = this.routes.get(routeId);
    if (!route) throw new Error(`Route "${routeId}" not found`);
    if (!route.enabled) throw new Error(`Route "${routeId}" is disabled`);

    const start = performance.now();
    try {
      const headers: Record<string, string> = {
        'User-Agent': 'GIA-Gateway/2.3.1.2',
        ...route.headers,
      };
      if (body) headers['Content-Type'] = 'application/json';

      let finalBody: string | undefined;
      if (body) {
        if (route.transform === 'graphql') {
          finalBody = JSON.stringify({ query: body });
        } else {
          finalBody = JSON.stringify(body);
        }
      }

      const res = await fetch(route.targetUrl, {
        method: route.method === 'ANY' ? 'POST' : route.method,
        headers,
        body: finalBody,
        signal: AbortSignal.timeout(30000),
      });

      const duration = Math.round(performance.now() - start);
      const data = res.headers.get('content-type')?.includes('json')
        ? await res.json()
        : await res.text();

      route.lastCalled = Date.now();
      route.callCount++;
      this.save();

      this.logs.push({
        id: `log_${Date.now()}`,
        routeId,
        timestamp: Date.now(),
        method: route.method,
        path: route.path,
        status: res.status,
        duration,
      });
      this.save();

      return { status: res.status, data, duration };
    } catch (e) {
      const duration = Math.round(performance.now() - start);
      const error = e instanceof Error ? e.message : 'Unknown error';
      this.logs.push({
        id: `log_${Date.now()}`,
        routeId,
        timestamp: Date.now(),
        method: route.method,
        path: route.path,
        status: 0,
        duration,
        error,
      });
      this.save();
      throw e;
    }
  }

  async proxyCustom(url: string, method: string, headers?: Record<string, string>, body?: unknown): Promise<{ status: number; data: unknown; duration: number }> {
    const start = performance.now();
    const res = await fetch(url, {
      method,
      headers: { 'User-Agent': 'GIA-Gateway/2.3.1.2', ...headers },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30000),
    });
    const duration = Math.round(performance.now() - start);
    const data = res.headers.get('content-type')?.includes('json')
      ? await res.json()
      : await res.text();
    return { status: res.status, data, duration };
  }

  getLogs(limit = 50): GatewayLog[] {
    return this.logs.slice(-limit).reverse();
  }

  getRouteLogs(routeId: string, limit = 20): GatewayLog[] {
    return this.logs.filter(l => l.routeId === routeId).slice(-limit).reverse();
  }

  getStats(): GatewayStats {
    const all = this.getAllRoutes();
    const enabled = all.filter(r => r.enabled);
    const recentLogs = this.logs.slice(-100);

    const success = recentLogs.filter(l => l.status >= 200 && l.status < 400).length;
    const avgDur = recentLogs.length > 0
      ? Math.round(recentLogs.reduce((a, l) => a + l.duration, 0) / recentLogs.length)
      : 0;

    const byMethod: Record<string, number> = {};
    for (const r of all) {
      byMethod[r.method] = (byMethod[r.method] || 0) + 1;
    }

    return {
      totalRoutes: all.length,
      enabledRoutes: enabled.length,
      totalCalls: all.reduce((a, r) => a + r.callCount, 0),
      successRate: recentLogs.length > 0 ? Math.round((success / recentLogs.length) * 100) : 100,
      avgDuration: avgDur,
      routesByMethod: byMethod,
    };
  }

  clearLogs(): void {
    this.logs = [];
    this.save();
  }
}

export default new GatewayManager();
