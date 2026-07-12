import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Card, Tag, Space, Select, Input, Button, Typography, Row, Col, Statistic,
} from 'antd';
import {
  FileTextOutlined, SearchOutlined, ReloadOutlined,
  InfoCircleOutlined, WarningOutlined, CloseCircleOutlined,
} from '@ant-design/icons';
import { getLogStores, getLogs, type LogStore, type LogEntry } from '../../api/logs';

const { Title, Text } = Typography;

const LOG_LEVELS = ['INFO', 'WARN', 'ERROR'];

const LogsPage: React.FC = () => {
  const [stores, setStores] = useState<LogStore[]>([]);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [storeFilter, setStoreFilter] = useState<string>('');
  const [levelFilter, setLevelFilter] = useState<string>('');
  const [keyword, setKeyword] = useState('');

  const fetchStores = async () => {
    try {
      const data = await getLogStores();
      setStores(Array.isArray(data) ? data : []);
    } catch { /* handled */ }
  };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getLogs({
        page, size: pageSize,
        store: storeFilter || undefined,
        level: levelFilter || undefined,
        keyword: keyword || undefined,
      });
      setLogs(result.list);
      setTotal(result.total);
    } catch { /* handled */ }
    setLoading(false);
  }, [page, pageSize, storeFilter, levelFilter, keyword]);

  useEffect(() => { fetchStores(); }, []);
  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const levelColor: Record<string, string> = { INFO: 'blue', WARN: 'orange', ERROR: 'red' };
  const levelIcon: Record<string, React.ReactNode> = {
    INFO: <InfoCircleOutlined />,
    WARN: <WarningOutlined />,
    ERROR: <CloseCircleOutlined />,
  };

  const columns = [
    {
      title: '时间', dataIndex: 'created_at', key: 'created_at', width: 170,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
      defaultSortOrder: 'descend' as const,
      sorter: (a: LogEntry, b: LogEntry) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
    { title: 'Agent', dataIndex: 'agent_id', key: 'agent_id', width: 140 },
    { title: '日志库', dataIndex: 'store', key: 'store', width: 120 },
    {
      title: '级别', dataIndex: 'level', key: 'level', width: 80,
      render: (lvl: string) => (
        <Tag icon={levelIcon[lvl]} color={levelColor[lvl] || 'default'}>{lvl}</Tag>
      ),
    },
    {
      title: '内容', dataIndex: 'content', key: 'content', ellipsis: true,
      render: (text: string) => (
        <Text style={{ fontFamily: 'monospace', fontSize: 12, whiteSpace: 'pre-wrap' }}>
          {text.length > 200 ? text.slice(0, 200) + '...' : text}
        </Text>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <FileTextOutlined style={{ marginRight: 8 }} />
          日志存储
        </Title>
        <Space wrap>
          <Select
            allowClear placeholder="日志库" style={{ width: 140 }}
            value={storeFilter || undefined}
            onChange={(v) => { setStoreFilter(v || ''); setPage(1); }}
            options={stores.map(s => ({ value: s.name, label: s.name }))}
          />
          <Select
            allowClear placeholder="日志级别" style={{ width: 120 }}
            value={levelFilter || undefined}
            onChange={(v) => { setLevelFilter(v || ''); setPage(1); }}
            options={LOG_LEVELS.map(l => ({ value: l, label: l }))}
          />
          <Input
            placeholder="搜索关键字"
            prefix={<SearchOutlined />}
            style={{ width: 200 }}
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onPressEnter={() => setPage(1)}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={() => fetchLogs()}>刷新</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="总日志数" value={total} prefix={<FileTextOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="日志库数量" value={stores.length} prefix={<InfoCircleOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="ERROR" value={logs.filter(l => l.level === 'ERROR').length} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="WARN" value={logs.filter(l => l.level === 'WARN').length} valueStyle={{ color: '#faad14' }} /></Card>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page, pageSize, total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          size="middle"
          scroll={{ x: 900 }}
        />
      </Card>
    </div>
  );
};

export default LogsPage;
