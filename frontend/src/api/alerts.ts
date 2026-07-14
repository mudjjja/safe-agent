import request from './request';

/** 适配后端 Alert 模型 */
export interface AlertItem {
  id: number;
  title: string;
  /** 后端字段名 severity (low/medium/high/critical) — 前端统一映射到 Level */
  severity: string;
  /** 前端统一映射字段 */
  level: 'info' | 'warning' | 'critical';
  agent_id?: string;
  trigger_reason?: string;
  /** 后端 status: open / resolved */
  status: string;
  summary?: string;
  root_cause?: string;
  suggestion?: string;
  created_at: string;
  resolved_at?: string;
}

export interface AlertListParams {
  page?: number;
  /** 后端参数名 size */
  size?: number;
  /** 后端参数名 severity */
  severity?: string;
  status?: string;
}

export interface AlertListResult {
  data: AlertItem[];
  total: number;
}

const SEVERITY_MAP: Record<string, string> = {
  low: 'info',
  medium: 'warning',
  high: 'critical',
  critical: 'critical',
};

/** severity -> level 映射 */
export function mapSeverity(s: string): 'info' | 'warning' | 'critical' {
  return (SEVERITY_MAP[s] as any) || 'info';
}

/** 获取告警列表 */
export async function getAlerts(params?: AlertListParams): Promise<AlertListResult> {
  // 前端 params 参数名 -> 后端实际参数名
  const backendParams: Record<string, any> = {};
  if (params) {
    if (params.page) backendParams.page = params.page;
    if (params.size) backendParams.size = params.size;
    if (params.severity) backendParams.severity = params.severity;
    if (params.status) backendParams.status = params.status;
  }

  const res = await request.get('/alerts', { params: backendParams });
  // 后端返回: { code:0, data: { total, list: [...] } }
  const body = (res as any);
  const data = body?.data || body;
  const list = data?.list || data || [];
  const total = data?.total || (Array.isArray(list) ? list.length : 0);

  return {
    data: (Array.isArray(list) ? list : []).map((item: any) => normalizeAlert(item)),
    total,
  };
}

/** 解决告警 */
export async function resolveAlert(id: number): Promise<void> {
  await request.put(`/alerts/${id}/resolve`);
}

/** 将后端 Alert 字段归一化为前端 AlertItem */
export function normalizeAlert(item: any): AlertItem {
  return {
    id: item.id,
    title: item.title || item.trigger_reason || `告警 #${item.id}`,
    severity: item.severity || 'medium',
    level: mapSeverity(item.severity || 'medium'),
    status: item.status === 'open' ? 'pending' : item.status || 'pending',
    agent_id: item.agent_id,
    trigger_reason: item.trigger_reason,
    summary: item.summary,
    root_cause: item.root_cause,
    suggestion: item.suggestion,
    created_at: item.created_at,
    resolved_at: item.resolved_at,
  };
}
