import React, { useEffect, useState } from 'react';
import { Card, Table, Tag, Typography, Space, Button, Row, Col, Statistic } from 'antd';
import {
  DatabaseOutlined, ReloadOutlined, FolderOpenOutlined,
} from '@ant-design/icons';
import { getLogStores, type LogStore } from '../../api/logs';

const { Title, Text } = Typography;

const LogStoresPage: React.FC = () => {
  const [stores, setStores] = useState<LogStore[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    setLoading(true);
    try {
      const data = await getLogStores();
      setStores(Array.isArray(data) ? data : []);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const totalLogs = stores.reduce((sum, s) => sum + (s.log_count || 0), 0);

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '日志库名称', dataIndex: 'name', key: 'name' },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 120,
      render: (t: string) => <Tag color="blue">{t}</Tag>,
    },
    {
      title: '日志数量', dataIndex: 'log_count', key: 'log_count', width: 120,
      sorter: (a: LogStore, b: LogStore) => (a.log_count || 0) - (b.log_count || 0),
      render: (count: number) => <Text strong>{count ?? 0}</Text>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170,
      render: (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          日志库管理
        </Title>
        <Space>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={8}>
          <Card size="small">
            <Statistic title="日志库数量" value={stores.length} prefix={<DatabaseOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="总日志量" value={totalLogs} prefix={<FolderOpenOutlined />} valueStyle={{ color: '#52c41a' }} suffix="条" />
          </Card>
        </Col>
        <Col span={8}>
          <Card size="small">
            <Statistic title="日志类型" value={new Set(stores.map(s => s.type)).size} prefix={<DatabaseOutlined />} valueStyle={{ color: '#722ed1' }} suffix="种" />
          </Card>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={stores}
          rowKey="id"
          loading={loading}
          pagination={false}
          size="middle"
          locale={{ emptyText: <Text type="secondary">暂无日志库</Text> }}
        />
      </Card>
    </div>
  );
};

export default LogStoresPage;
