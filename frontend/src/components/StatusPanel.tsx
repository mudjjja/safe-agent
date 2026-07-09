import React, { useEffect, useState } from 'react';
import { Card, Progress, Typography, Space, List, Empty } from 'antd';
import {
  DesktopOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getMockSystemStatus, getMockAuditLogs } from '../api/mock';
import type { SystemStatus, AuditRecord } from '../api/mock';

const { Text } = Typography;

interface StatusPanelProps {
  latestAction?: { command: string; status: string; riskLevel: number } | null;
}

const StatusPanel: React.FC<StatusPanelProps> = ({ latestAction: _latestAction }) => {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [logs, setLogs] = useState<AuditRecord[]>([]);

  useEffect(() => {
    setStatus(getMockSystemStatus());
    setLogs(getMockAuditLogs().slice(0, 10));
    const timer = setInterval(() => setStatus(getMockSystemStatus()), 5000);
    return () => clearInterval(timer);
  }, []);

  const getStatusIcon = (record: AuditRecord) => {
    if (record.status === 'passed') return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
    if (record.status === 'blocked') return <CloseCircleOutlined style={{ color: '#ff4d4f' }} />;
    return <WarningOutlined style={{ color: '#faad14' }} />;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* 系统状态 */}
      <Card
        size="small"
        title={<span><DesktopOutlined /> 系统状态</span>}
        styles={{ body: { padding: 12 } }}
      >
        {status ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>主机</Text>
              <div><Text strong>{status.host}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>操作系统</Text>
              <div><Text strong>{status.os}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>运行时间</Text>
              <div><Text strong>{status.uptime}</Text></div>
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>CPU</Text>
              <Progress percent={status.cpu} size="small" status={status.cpu > 80 ? 'exception' : 'normal'} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>内存</Text>
              <Progress percent={status.memory} size="small" status={status.memory > 80 ? 'exception' : 'normal'} />
            </div>
            <div>
              <Text type="secondary" style={{ fontSize: 12 }}>磁盘</Text>
              <Progress percent={status.disk} size="small" status={status.disk > 85 ? 'exception' : 'normal'} />
            </div>
          </div>
        ) : (
          <Text type="secondary">加载中...</Text>
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
          dataSource={logs}
          locale={{ emptyText: <Empty description="暂无操作记录" /> }}
          renderItem={(record) => (
            <List.Item style={{ padding: '6px 12px' }}>
              <Space size={4}>
                {getStatusIcon(record)}
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
                  {record.command}
                </Text>
              </Space>
              <Text type="secondary" style={{ fontSize: 11 }}>{record.timestamp.slice(11, 16)}</Text>
            </List.Item>
          )}
        />
      </Card>
    </div>
  );
};

export default StatusPanel;
