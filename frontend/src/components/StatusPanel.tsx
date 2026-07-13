import React, { useEffect, useState, useRef } from 'react';
import { Card, Progress, Typography, Space, List, Empty } from 'antd';
import {
  DesktopOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getLatestMetrics } from '../api/monitor';
import { getOperateLogs } from '../api/operate-logs';

const { Text } = Typography;

interface StatusPanelProps {
  latestAction?: { command: string; status: string; riskLevel: number } | null;
}

const StatusPanel: React.FC<StatusPanelProps> = ({ latestAction: _latestAction }) => {
  const [metrics, setMetrics] = useState<{ cpu: number; mem: number; disk: number } | null>(null);
  const [recentOps, setRecentOps] = useState<any[]>([]);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [m, ops] = await Promise.all([
          getLatestMetrics(),
          getOperateLogs({ page: 1, size: 10 }),
        ]);
        if (m) {
          setMetrics({ cpu: Math.round(m.cpu_percent), mem: Math.round(m.mem_percent), disk: Math.round(m.disk_percent) });
        }
        if (ops?.list) {
          setRecentOps(ops.list);
        }
      } catch { /* noop */ }
    };
    fetchData();
    intervalRef.current = setInterval(fetchData, 15000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 系统状态 */}
      <Card
        size="small"
        title={<span><DesktopOutlined /> 实时状态</span>}
        styles={{ body: { padding: 12 } }}
      >
        {metrics ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>CPU</Text>
              <Progress percent={metrics.cpu} size="small" status={metrics.cpu > 80 ? 'exception' : 'normal'} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>内存</Text>
              <Progress percent={metrics.mem} size="small" status={metrics.mem > 80 ? 'exception' : 'normal'} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>磁盘</Text>
              <Progress percent={metrics.disk} size="small" status={metrics.disk > 85 ? 'exception' : 'normal'} />
            </div>
          </div>
        ) : (
          <Text type="secondary" style={{ fontSize: 12 }}>等待 Agent 数据...</Text>
        )}
      </Card>

      {/* 操作记录 */}
      <Card
        size="small"
        title={<span><ClockCircleOutlined /> 最近操作</span>}
        styles={{ body: { padding: 0 } }}
      >
        <List
          size="small"
          dataSource={recentOps}
          locale={{ emptyText: <Empty description="暂无操作记录" /> }}
          renderItem={(record: any) => (
            <List.Item style={{ padding: '6px 12px' }}>
              <Space size={4}>
                <CheckCircleOutlined style={{ color: '#52c41a' }} />
                <Text
                  style={{
                    fontSize: 12,
                    maxWidth: 120,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    display: 'inline-block',
                  }}
                >
                  {record.detail || record.action || '-'}
                </Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 11 }}>
                {record.created_at ? new Date(record.created_at).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }) : ''}
              </Text>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default StatusPanel;
