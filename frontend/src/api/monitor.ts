import request from './request';

export interface MetricsData {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  net_rx_bytes: number;
  net_tx_bytes: number;
  hostname?: string;
  timestamp?: string;
}

export interface HistoryPoint {
  time: string;
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
  network_bytes?: number;
}

/** 获取最新指标 */
export async function getLatestMetrics(): Promise<MetricsData> {
  const res = await request.get('/monitor/latest');
  return (res as any)?.data || res;
}

/** 获取历史曲线数据 */
export async function getHistoryMetrics(minutes = 60): Promise<HistoryPoint[]> {
  const res = await request.get('/monitor/history', { params: { minutes } });
  return (res as any)?.data || res || [];
}
