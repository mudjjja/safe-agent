import request from './request';

export interface LogStore {
  id: number;
  name: string;
  type: string;
  log_count: number;
  created_at: string;
}

export interface LogEntry {
  id: number;
  agent_id: string;
  store: string;
  content: string;
  level: string;       // INFO / WARN / ERROR
  created_at: string;
}

export interface LogListParams {
  page?: number;
  size?: number;
  store?: string;
  keyword?: string;
  level?: string;
}

export interface LogListResult {
  list: LogEntry[];
  total: number;
}

/** 获取日志库列表 */
export async function getLogStores(): Promise<LogStore[]> {
  const res = await request.get('/log-stores');
  const body = res as any;
  return body?.data || body || [];
}

/** 获取日志条目 */
export async function getLogs(params?: LogListParams): Promise<LogListResult> {
  const res = await request.get('/logs', { params });
  const body = res as any;
  const data = body?.data || body;
  return {
    list: data?.list || [],
    total: data?.total || 0,
  };
}
