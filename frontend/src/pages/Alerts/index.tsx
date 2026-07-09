import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Table, Tag, Typography, Badge, Space, Alert, Empty,
  Spin, Button, Row, Col, Statistic,
} from 'antd';
import {
  BellOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { getAlerts, type AlertItem } from '../../api/alerts';

const { Title, Text } = Typography;

/** level -> 标签配置 */
const LEVEL_CONFIG: Record<string, { color: string; label: string; icon: React.ReactNode }> = {
  info: { color: 'blue', label: '信息', icon: <InfoCircleOutlined /> },
  warning: { color: 'orange', label: '警告', icon: <WarningOutlined /> },
  critical: { color: 'red', label: '严重', icon: <CloseCircleOutlined /> },
};

const STATUS_MAP: Record<string, { color: string; label: string }> = {
  pending: { color: 'processing', label: '待处理' },
  resolved: { color: 'success', label: '已解决' },
  ignored: { color: 'default', label: '已忽略' },
};

const AlertsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [severityFilter] = useState<string | undefined>();

  const fetchAlerts = useCallback(async (p = page) => {
    setLoading(true);
    setError('');
    try {
      const result = await getAlerts({
        page: p,
        size: 20,
        severity: severityFilter,
      });
      setAlerts(result.data || []);
      setTotal(result.total || 0);
    } catch (err: any) {
      setError(err?.message || '获取告警列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, severityFilter]);

  useEffect(() => {
    fetchAlerts();
    const timer = setInterval(() => fetchAlerts(), 15000);
    return () => clearInterval(timer);
  }, [page, severityFilter]);

  const pendingCount = alerts.filter((a) => a.status === 'pending').length;

  const columns = [
    {
      title: '级别',
      dataIndex: 'severity',
      key: 'level',
      width: 80,
      render: (_: string, record: AlertItem) => {
        const cfg = LEVEL_CONFIG[record.level] || LEVEL_CONFIG.info;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    {
      title: '告警标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
      render: (title: string, record: AlertItem) => (
        <Space>
          {record.status === 'pending' && <Badge status="processing" />}
          <Text strong={record.level === 'critical'}>{title}</Text>
          {!record.summary && record.status === 'pending' && (
            <Tag icon={<RobotOutlined />} color="purple" style={{ fontSize: 11 }}>待AI分析</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '触发原因',
      dataIndex: 'trigger_reason',
      key: 'trigger_reason',
      width: 140,
      render: (reason: string) => (
        <Text code style={{ fontSize: 12 }}>
          {reason || '-'}
        </Text>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 150,
      render: (t: string) => (
        <Text type="secondary" style={{ fontSize: 12 }}>{t || '-'}</Text>
      ),
      sorter: (a: AlertItem, b: AlertItem) => (a.created_at || '').localeCompare(b.created_at || ''),
      defaultSortOrder: 'descend' as const,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 90,
      render: (status: string) => {
        const cfg = STATUS_MAP[status] || STATUS_MAP.pending;
        return <Badge status={cfg.color as any} text={cfg.label} />;
      },
    },
  ];

  /** 是否已 AI 分析：有 summary 字段就算 */
  const hasAiAnalysis = (record: AlertItem) =>
    !!(record.summary || record.root_cause || record.suggestion);

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <BellOutlined style={{ marginRight: 8 }} />
          告警列表
        </Title>
        <Space>
          {pendingCount > 0 && (
            <Tag color="red" style={{ fontSize: 13 }}>
              待处理: {pendingCount} 条
            </Tag>
          )}
          <Button size="small" icon={<ReloadOutlined />} onClick={() => fetchAlerts()} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} closable />}

      {/* 统计摘要 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="全部告警" value={total} valueStyle={{ color: '#1890ff' }} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="待处理" value={pendingCount} valueStyle={{ color: '#ff4d4f' }} suffix="条" />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="严重"
              value={alerts.filter((a) => a.level === 'critical').length}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="已解决"
              value={alerts.filter((a) => a.status === 'resolved').length}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* 告警表格 */}
      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={alerts}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page,
            pageSize: 20,
            total,
            onChange: setPage,
            showTotal: (t) => `共 ${t} 条告警`,
          }}
          size="middle"
          locale={{ emptyText: <Empty description="暂无告警" /> }}
          expandable={{
            expandedRowKeys: expandedId ? [expandedId] : [],
            onExpand: (_, record) => setExpandedId(expandedId === record.id ? null : record.id),
            rowExpandable: () => true,
            expandedRowRender: (record: AlertItem) => (
              <div style={{ padding: '12px 0', maxWidth: 800 }}>
                {hasAiAnalysis(record) ? (
                  <div>
                    <Space style={{ marginBottom: 12 }}>
                      <RobotOutlined style={{ color: '#722ed1', fontSize: 16 }} />
                      <Text strong style={{ color: '#722ed1' }}>AI 分析报告</Text>
                    </Space>

                    {record.summary && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ color: '#333' }}>📋 摘要</Text>
                        <div style={{
                          background: '#f9f9f9', padding: '8px 12px', borderRadius: 6, marginTop: 4,
                          borderLeft: '3px solid #722ed1',
                        }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {record.summary}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {record.root_cause && (
                      <div style={{ marginBottom: 12 }}>
                        <Text strong style={{ color: '#cf1322' }}>🔍 根因分析</Text>
                        <div style={{
                          background: '#fff2f0', padding: '8px 12px', borderRadius: 6, marginTop: 4,
                          borderLeft: '3px solid #cf1322',
                        }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {record.root_cause}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}

                    {record.suggestion && (
                      <div>
                        <Text strong style={{ color: '#389e0d' }}>💡 处置建议</Text>
                        <div style={{
                          background: '#f6ffed', padding: '8px 12px', borderRadius: 6, marginTop: 4,
                          borderLeft: '3px solid #52c41a',
                        }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {record.suggestion}
                          </ReactMarkdown>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', padding: 20 }}>
                    <Spin size="small" style={{ marginRight: 8 }} />
                    <Text type="secondary">AI 正在分析此告警，请稍后查看...</Text>
                  </div>
                )}
              </div>
            ),
          }}
        />
      </Card>
    </div>
  );
};

export default AlertsPage;
