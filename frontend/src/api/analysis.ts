import request from './request';

export interface DailyCount {
  date: string;
  count: number;
}

export interface SeverityCount {
  severity: string;
  count: number;
}

export interface AnalysisTrendResult {
  log_trend: DailyCount[];
  alert_severity: SeverityCount[];
}

/** 获取分析趋势数据 */
export async function getAnalysisTrend(days: number = 7, store?: string): Promise<AnalysisTrendResult> {
  const res = await request.get('/analysis/trend', {
    params: { days, store },
  });
  const body = res as any;
  const data = body?.data || body;
  return {
    log_trend: data?.log_trend || [],
    alert_severity: data?.alert_severity || [],
  };
}
