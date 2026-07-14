import React, { useEffect, useState, useCallback } from 'react';
import { Table, Tag, Typography, Card, Statistic, Row, Col, Select, Button, Space } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  SafetyCertificateOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import type { AuditRecord } from '../../api/audit';
import { getAuditLogs } from '../../api/audit';

const { Title, Text } = Typography;

const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditRecord[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<AuditRecord[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAuditLogs();
      setLogs(data);
      setFilteredLogs(data);
    } catch { /* handled */ }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, [fetchData]);

  useEffect(() => {
    if (statusFilter === 'all') {
      setFilteredLogs(logs);
    } else {
      setFilteredLogs(logs.filter((log) => log.status === statusFilter));
    }
  }, [statusFilter, logs]);

  const passedCount = logs.filter((l) => l.status === 'passed').length;
  const blockedCount = logs.filter((l) => l.status === 'blocked').length;
  const totalCount = logs.length;

  const columns = [
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 160,
      defaultSortOrder: 'descend' as const,
      sorter: (a: AuditRecord, b: AuditRecord) =>
        a.timestamp.localeCompare(b.timestamp),
    },
    {
      title: '操作人',
      dataIndex: 'user',
      key: 'user',
      width: 100,
    },
    {
      title: '操作命令',
      dataIndex: 'command',
      key: 'command',
      render: (text: string) => (
        <Text code style={{ wordBreak: 'break-all', fontSize: 12 }}>{text}</Text>
      ),
    },
    {
      title: '风险等级',
      dataIndex: 'riskLevel',
      key: 'riskLevel',
      width: 110,
      render: (level: number) => {
        let color = 'green';
        let icon = <CheckCircleOutlined />;
        if (level > 6) {
          color = 'red';
          icon = <CloseCircleOutlined />;
        } else if (level > 3) {
          color = 'orange';
          icon = <WarningOutlined />;
        }
        return <Tag color={color} icon={icon}>{level}/10</Tag>;
      },
      sorter: (a: AuditRecord, b: AuditRecord) => a.riskLevel - b.riskLevel,
    },
    {
      title: '执行状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => {
        if (status === 'passed') return <Tag icon={<CheckCircleOutlined />} color="success">通过</Tag>;
        return <Tag icon={<CloseCircleOutlined />} color="error">拦截</Tag>;
      },
    },
    {
      title: '结果/原因',
      dataIndex: 'result',
      key: 'result',
      ellipsis: true,
    },
    {
      title: '耗时',
      dataIndex: 'duration',
      key: 'duration',
      width: 90,
      render: (ms: number) => ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`,
      sorter: (a: AuditRecord, b: AuditRecord) => a.duration - b.duration,
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <SafetyCertificateOutlined style={{ marginRight: 8 }} />
          安全审计日志
        </Title>
        <Space>
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            style={{ width: 140 }}
            options={[
              { value: 'all', label: '全部记录' },
              { value: 'passed', label: '仅通过' },
              { value: 'blocked', label: '仅拦截' },
            ]}
          />
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="总操作数" value={totalCount} valueStyle={{ color: '#1890ff' }} suffix="次" />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="通过"
              value={passedCount}
              valueStyle={{ color: '#52c41a' }}
              prefix={<CheckCircleOutlined />}
              suffix={`次 / ${totalCount ? Math.round((passedCount / totalCount) * 100) : 0}%`}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic
              title="拦截"
              value={blockedCount}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<CloseCircleOutlined />}
              suffix={`次 / ${totalCount ? Math.round((blockedCount / totalCount) * 100) : 0}%`}
            />
          </Card>
        </Col>
      </Row>

      {/* 审计日志表格 */}
      <Card
        size="small"
        styles={{ body: { padding: 0 } }}
      >
        <Table
          columns={columns}
          dataSource={filteredLogs}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: false,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default AuditLogPage;
