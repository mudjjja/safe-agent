import request from './request';

export interface AgentInfo {
  id: string;
  hostname: string;
  ip: string;
  status: 'online' | 'offline';
  last_heartbeat: string;
}

export interface SkillInfo {
  id?: number;
  name: string;
  description: string;
  risk_level?: string;
  category?: string;
  params?: string;       // JSON string: ["IP", "Port"]
}

export interface ExecuteCommandParams {
  skill_name: string;
  agent_id: string;
  params: Record<string, string>;
  reason?: string;
}

export interface ExecuteResult {
  execution_id?: number;
  task_id?: number;
  command?: string;
  message?: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  stdout?: string;
  stderr?: string;
  exit_code?: number;
  duration_ms?: number;
}

/** 获取可用 Skill 列表 — 后端 GET /api/skills */
export async function getSkillList(): Promise<SkillInfo[]> {
  try {
    const res = await request.get('/skills');
    // 后端返回: { code:0, data: [...] }
    const body = (res as any);
    const data = body?.data || body;
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.warn('getSkillList 失败，返回空列表:', err);
    return [];
  }
}

/** 获取在线 Agent 列表 — ⚠️ 后端暂无此接口，用本地 fallback */
export async function getAgentList(): Promise<AgentInfo[]> {
  try {
    // 尝试从 /api/agent/tasks?agent_id=xxx 发现 Agent，但无直接列表接口
    // 因此返回一个包含 "后端无此接口" 提示的空列表
    console.warn('后端暂无 GET /api/agent/list 接口，Agent 列表为空');
    return [];
  } catch {
    return [];
  }
}

/** 下发命令执行 — 后端 POST /api/skills/execute */
export async function executeCommand(params: ExecuteCommandParams): Promise<ExecuteResult> {
  const res = await request.post('/skills/execute', {
    skill_name: params.skill_name,
    agent_id: params.agent_id,
    params: params.params,
    reason: params.reason || '',
  });
  // 后端返回: { code:0, data: { execution_id, task_id, command, message } }
  const body = (res as any);
  const data = body?.data || body;
  return {
    ...data,
    status: 'pending',
  };
}

/** 查询任务执行状态 — ⚠️ 后端无单任务查询接口，用 /skills/history 兜底 */
export async function getTaskResult(taskId: string): Promise<ExecuteResult> {
  try {
    const res = await request.get('/skills/history', { params: { page: 1, size: 50 } });
    const body = (res as any);
    const data = body?.data || body;
    const list = data?.list || [];
    const task = list.find((t: any) => String(t.id) === String(taskId));
    if (task) {
      return {
        execution_id: task.id,
        task_id: task.id,
        status: task.status || 'pending',
        stdout: task.stdout || '',
        stderr: task.stderr || '',
        exit_code: task.exit_code,
        duration_ms: task.duration_ms,
        command: task.command,
      };
    }
    return { status: 'pending' };
  } catch {
    return { status: 'pending' };
  }
}
