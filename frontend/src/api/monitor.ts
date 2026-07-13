import request from './request';

export interface MetricsData {
  cpu_percent: number;
  mem_percent: number;
  disk_percent: number;
  net_rx_bytes: number;
  net_tx_bytes: number;
  hostname?: string;
  timestamp?: string;
}

export interface HistoryPoint {
  time: string;
  cpu_percent: number;
  mem_percent: number;
  disk_percent: number;
  network_bytes?: number;
}

/** 获取最新指标（agent_id 可选，不传则查全部） */
export async function getLatestMetrics(agentId?: string): Promise<MetricsData | null> {
  const params: Record<string, string | number> = {};
  if (agentId) params.agent_id = agentId;
  const res = await request.get('/monitor/latest', { params });
  const body = (res as any);
  const data = body?.data || body;
  return data && typeof data === 'object' && 'cpu_percent' in data ? data : null;
}

/** 获取历史曲线数据（agent_id 可选，不传则查全部） */
export async function getHistoryMetrics(minutes = 60, agentId?: string): Promise<HistoryPoint[]> {
  const params: Record<string, string | number> = { minutes };
  if (agentId) params.agent_id = agentId;
  const res = await request.get('/monitor/history', { params });
  const body = (res as any);
  const data = body?.data || body;
  // 兼容不同后端返回格式
  return data?.list || (Array.isArray(data) ? data : []);
}

/** 获取 Agent 列表（从 agent/list 接口） */
export async function fetchAgentList(): Promise<string[]> {
  try {
    const res = await request.get('/agent/list');
    const body = res as any;
    const data = body?.data || body;
    if (Array.isArray(data)) {
      return data.map((a: any) => a.agent_id).filter(Boolean);
    }
    return [];
  } catch {
    return [];
  }
}
