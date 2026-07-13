import request from './request';

export interface OperateLogItem {
  id: number;
  username: string;
  action: string;
  target: string;
  target_id: string;
  detail: string;
  ip: string;
  status: string;
  created_at: string;
}

export interface OperateLogParams {
  page?: number;
  size?: number;
  action?: string;
  username?: string;
}

export interface OperateLogResult {
  list: OperateLogItem[];
  total: number;
}

/** 获取操作日志/审计日志 */
export async function getOperateLogs(params?: OperateLogParams): Promise<OperateLogResult> {
  const res = await request.get('/operate-logs', { params });
  const body = res as any;
  const data = body?.data || body;
  return {
    list: data?.list || [],
    total: data?.total || 0,
  };
}
