import { getOperateLogs, type OperateLogItem } from './operate-logs';

export interface AuditRecord {
  id: string;
  timestamp: string;
  user: string;
  command: string;
  riskLevel: number;
  status: 'passed' | 'blocked';
  result: string;
  duration: number;
}

/** 从 /api/operate-logs 获取审计日志 */
export async function getAuditLogs(): Promise<AuditRecord[]> {
  try {
    const result = await getOperateLogs({ page: 1, size: 100 });
    return (result.list || []).map(normalizeOperateLog);
  } catch {
    return [];
  }
}

/** 将后端 OperateLog 归一化为前端 AuditRecord */
function normalizeOperateLog(item: OperateLogItem): AuditRecord {
  return {
    id: String(item.id),
    timestamp: item.created_at,
    user: item.username || '-',
    command: item.detail || `${item.action} ${item.target}#${item.target_id}`,
    riskLevel: item.action === 'delete' ? 8 : item.action === 'update' ? 5 : 3,
    status: item.status === 'success' ? 'passed' : 'blocked',
    result: item.detail || '-',
    duration: 0, // operate-logs 不记录耗时
  };
}
