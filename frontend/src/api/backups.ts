import request from './request';

export interface BackupItem {
  id: number;
  agent_id: string;
  name: string;
  type: string;        // full / incremental
  file_path: string;
  size: number;
  status: string;      // pending / running / success / failed
  created_at: string;
  completed_at?: string;
}

export interface BackupListParams {
  page?: number;
  size?: number;
  agent_id?: string;
  status?: string;
}

export interface BackupListResult {
  list: BackupItem[];
  total: number;
}

export interface CreateBackupParams {
  agent_id: string;
  name: string;
  type?: string;
  file_path?: string;
  size?: number;
}

/** 获取备份列表 */
export async function getBackups(params?: BackupListParams): Promise<BackupListResult> {
  const res = await request.get('/backups', { params });
  const body = res as any;
  const data = body?.data || body;
  return {
    list: data?.list || [],
    total: data?.total || 0,
  };
}

/** 创建备份 */
export async function createBackup(params: CreateBackupParams): Promise<void> {
  await request.post('/backups', params);
}

/** 删除备份 */
export async function deleteBackup(id: number): Promise<void> {
  await request.delete(`/backups/${id}`);
}
