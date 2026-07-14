import request from './request';

export interface DashboardStats {
  total_metrics: number;   // 日志总量（指标总数）
  open_alerts: number;     // 未解决告警数
  today_metrics: number;   // 今日采集
  agent_online: number;    // Agent 在线数
}

/** 获取仪表盘统计卡片数据 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const res = await request.get('/dashboard/stats');
  const body = res as any;
  const data = body?.data || body;
  return {
    total_metrics: data?.total_metrics ?? 0,
    open_alerts: data?.open_alerts ?? 0,
    today_metrics: data?.today_metrics ?? 0,
    agent_online: data?.agent_online ?? 0,
  };
}
