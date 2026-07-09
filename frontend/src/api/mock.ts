export interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  timestamp: number;
  riskCheck?: RiskCheck;
  execution?: ExecutionResult;
}

export interface RiskCheck {
  passed: boolean;
  level: number;
  reason: string;
  requireConfirm?: boolean;
}

export interface ExecutionResult {
  status: 'success' | 'failed' | 'pending';
  output: string;
  duration: number;
}

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

export interface SystemStatus {
  host: string;
  os: string;
  cpu: number;
  memory: number;
  disk: number;
  uptime: string;
}

// 模拟系统状态
export function getMockSystemStatus(): SystemStatus {
  return {
    host: '192.168.1.100',
    os: '麒麟 V10 (LoongArch)',
    cpu: Math.floor(Math.random() * 40 + 20),
    memory: Math.floor(Math.random() * 30 + 45),
    disk: Math.floor(Math.random() * 20 + 60),
    uptime: '15天 3小时',
  };
}

// 模拟聊天回复
export function mockChatResponse(userMessage: string): {
  message: string;
  riskCheck: RiskCheck;
  execution: ExecutionResult | null;
} {
  const msg = userMessage.toLowerCase();

  if (msg.includes('磁盘') || msg.includes('空间') || msg.includes('df')) {
    return {
      message: '✅ 磁盘使用情况查询完成：\n\n```\n文件系统        容量  已用  可用  已用%\n/dev/sda1      100G   75G   25G   75%\n/dev/sda2       50G   15G   35G   30%\n/dev/sda3      200G  120G   80G   60%\n```\n\n**总结：** 整体使用率 60%，/dev/sda1 使用率较高（75%），建议清理。',
      riskCheck: { passed: true, level: 2, reason: '只读查询操作，无风险' },
      execution: { status: 'success', output: 'Filesystem      Size  Used Avail Use%\n/dev/sda1       100G   75G   25G  75%\n/dev/sda2        50G   15G   35G  30%\n/dev/sda3       200G  120G   80G  60%', duration: 320 },
    };
  }

  if (msg.includes('内存') || msg.includes('mem')) {
    return {
      message: '✅ 内存使用情况：\n\n| 项目 | 数值 |\n|------|------|\n| 总内存 | 16 GB |\n| 已用 | 9.2 GB |\n| 可用 | 6.8 GB |\n| 使用率 | 57% |\n\n内存使用正常，无异常进程。',
      riskCheck: { passed: true, level: 2, reason: '只读查询操作，无风险' },
      execution: { status: 'success', output: '              total        used        free\nMem:           16GB        9.2GB        6.8GB\nSwap:           8GB        0.5GB        7.5GB', duration: 280 },
    };
  }

  if (msg.includes('进程') || msg.includes('ps')) {
    return {
      message: '当前 Top 5 进程（按CPU排序）：\n\n| PID | 进程名 | CPU% | 内存% |\n|-----|--------|------|------|\n| 1234 | java | 12.5 | 30.2 |\n| 5678 | python | 8.3 | 5.1 |\n| 9012 | nginx | 2.1 | 1.5 |\n| 3456 | mysql | 1.8 | 15.3 |\n| 7890 | redis | 0.9 | 2.8 |',
      riskCheck: { passed: true, level: 2, reason: '只读查询操作，无风险' },
      execution: { status: 'success', output: 'PID COMMAND     CPU% MEM%\n1234 java       12.5 30.2\n5678 python      8.3  5.1\n9012 nginx       2.1  1.5\n3456 mysql       1.8 15.3\n7890 redis       0.9  2.8', duration: 410 },
    };
  }

  if (msg.includes('删') || msg.includes('shadow') || msg.includes('rm -rf')) {
    return {
      message: '🚫 **操作已被安全护栏拦截！**\n\n**风险等级：** 9/10 🔴\n**拦截原因：** 检测到删除系统关键文件操作\n**规则命中：** 规则 #3 - 禁止删除 /etc 目录下系统文件\n\n该操作未送达麒麟主机。',
      riskCheck: { passed: false, level: 9, reason: '禁止删除 /etc 目录下的系统关键文件' },
      execution: null,
    };
  }

  if (msg.includes('清') || msg.includes('tmp') || msg.includes('缓存') || msg.includes('临时')) {
    return {
      message: '⚠️ 该操作需要您的确认：\n\n清理 /tmp 目录可能影响正在运行中的进程（部分进程使用 /tmp 存储临时数据）。\n\n**风险等级：** 6/10 🟡\n**建议：** 建议先排查 /tmp 中是否有进程正在使用的文件。',
      riskCheck: { passed: false, level: 6, reason: '清理临时目录，可能影响运行中进程的临时文件', requireConfirm: true },
      execution: null,
    };
  }

  if (msg.includes('重启') || msg.includes('reboot')) {
    return {
      message: '⚠️ **高危操作确认**\n\n即将执行：`reboot` 重启系统\n\n**风险等级：** 8/10 🔴\n**影响：** 系统将会重启，当前所有连接会断开，预计需 2-3 分钟恢复。\n\n请确认是否执行？',
      riskCheck: { passed: false, level: 8, reason: '重启系统将中断所有服务和连接', requireConfirm: true },
      execution: null,
    };
  }

  if (msg.includes('日志') || msg.includes('log') || msg.includes('journal')) {
    return {
      message: '✅ 最近 10 条系统日志（最后 10 分钟）：\n\n```\nJun  7 09:45:12 kylin sshd[1234]: Accepted publickey\nJun  7 09:47:33 kylin systemd[1]: Started nginx\nJun  7 09:50:01 kylin CRON[5678]: (root) CMD (logrotate)\nJun  7 09:52:18 kylin kernel: eth0 link up\nJun  7 09:55:44 kylin sshd[9012]: Failed password\nJun  7 09:56:01 kylin sudo[3456]: user : TTY=pts/0 ; USER=root\nJun  7 09:58:12 kylin systemd[1]: Stopping cron\nJun  7 09:58:13 kylin systemd[1]: Started cron\nJun  7 10:00:01 kylin CRON[7890]: (root) CMD (logrotate)\nJun  7 10:02:30 kylin sshd[1111]: Session opened\n```\n\n⚠️ 检测到一条 Failed password 记录（09:55:44），建议关注。',
      riskCheck: { passed: true, level: 2, reason: '只读查询操作，无风险' },
      execution: { status: 'success', output: 'Jun  7 09:45:12 ... sshd[1234]: Accepted publickey\n...', duration: 350 },
    };
  }

  // 兜底回复
  return {
    message: `已收到指令：**${userMessage}**\n\n✅ 安全检测通过（风险等级 1/10）\n✅ 已在麒麟主机上执行\n\n执行结果：\n\`\`\`\n命令已执行，返回状态码 0\n\`\`\``,
    riskCheck: { passed: true, level: 1, reason: '常规操作' },
    execution: { status: 'success', output: `命令已执行: ${userMessage}`, duration: 150 },
  };
}

// 模拟审计日志
export function getMockAuditLogs(): AuditRecord[] {
  return [
    { id: '1', timestamp: '2026-06-07 10:32:15', user: 'admin', command: 'df -h', riskLevel: 2, status: 'passed', result: '磁盘使用率 75%', duration: 320 },
    { id: '2', timestamp: '2026-06-07 10:30:42', user: 'admin', command: 'rm -rf /etc/shadow', riskLevel: 9, status: 'blocked', result: '安全护栏拦截：禁止删除系统关键文件', duration: 12 },
    { id: '3', timestamp: '2026-06-07 10:28:00', user: 'admin', command: 'systemctl status nginx', riskLevel: 1, status: 'passed', result: 'nginx 运行正常', duration: 180 },
    { id: '4', timestamp: '2026-06-07 10:25:33', user: 'admin', command: 'free -m', riskLevel: 2, status: 'passed', result: '内存使用率 57%', duration: 150 },
    { id: '5', timestamp: '2026-06-07 10:20:12', user: 'admin', command: 'rm -rf /tmp/*', riskLevel: 6, status: 'blocked', result: '需用户确认：清理临时目录', duration: 8 },
    { id: '6', timestamp: '2026-06-07 10:15:45', user: 'admin', command: 'ps aux --sort=-%cpu | head -5', riskLevel: 2, status: 'passed', result: 'Top5进程列表', duration: 200 },
    { id: '7', timestamp: '2026-06-07 10:10:00', user: 'admin', command: 'journalctl -n 10', riskLevel: 2, status: 'passed', result: '最近10条系统日志', duration: 350 },
    { id: '8', timestamp: '2026-06-07 09:55:22', user: 'admin', command: 'reboot', riskLevel: 8, status: 'blocked', result: '需用户确认：重启系统将中断所有服务', duration: 6 },
    { id: '9', timestamp: '2026-06-07 09:50:18', user: 'admin', command: 'cat /etc/passwd', riskLevel: 3, status: 'passed', result: '用户列表已返回', duration: 160 },
    { id: '10', timestamp: '2026-06-07 09:40:05', user: 'admin', command: 'chmod 777 /etc/shadow', riskLevel: 10, status: 'blocked', result: '安全护栏拦截：修改系统文件权限', duration: 10 },
    { id: '11', timestamp: '2026-06-07 09:30:00', user: 'admin', command: 'apt update', riskLevel: 4, status: 'passed', result: '软件源更新成功', duration: 5200 },
    { id: '12', timestamp: '2026-06-07 09:00:00', user: 'system', command: '系统启动', riskLevel: 0, status: 'passed', result: '系统正常启动', duration: 45000 },
  ];
}
