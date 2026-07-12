import React, { useEffect, useState } from 'react';
import {
  Table, Card, Button, Tag, Space, Modal, Form, Input, Select, message,
  Popconfirm, Typography, Row, Col, Statistic,
} from 'antd';
import {
  PlusOutlined, DeleteOutlined,
  ReloadOutlined, DatabaseOutlined,
} from '@ant-design/icons';
import { getBackups, createBackup, deleteBackup, type BackupItem } from '../../api/backups';

const { Title } = Typography;

const BackupsPage: React.FC = () => {
  const [backups, setBackups] = useState<BackupItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [form] = Form.useForm();

  const fetchBackups = async () => {
    setLoading(true);
    try {
      const result = await getBackups({ page, size: pageSize, status: statusFilter || undefined });
      setBackups(result.list);
      setTotal(result.total);
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { fetchBackups(); }, [page, pageSize, statusFilter]);

  const handleCreate = async () => {
    const values = await form.validateFields();
    try {
      await createBackup(values);
      message.success('备份任务已创建');
      setModalOpen(false);
      form.resetFields();
      fetchBackups();
    } catch { /* handled */ }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteBackup(id);
      message.success('已删除');
      fetchBackups();
    } catch { /* handled */ }
  };

  const statusColor: Record<string, string> = {
    pending: 'default', running: 'processing', success: 'success', failed: 'error',
  };
  const statusLabel: Record<string, string> = {
    pending: '等待中', running: '进行中', success: '已完成', failed: '失败',
  };
  const typeLabel: Record<string, string> = { full: '全量', incremental: '增量' };

  const formatSize = (bytes: number) => {
    if (!bytes) return '-';
    if (bytes < 1024) return `${bytes}B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
    return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '备份名称', dataIndex: 'name', key: 'name', width: 160, ellipsis: true },
    { title: 'Agent', dataIndex: 'agent_id', key: 'agent_id', width: 140 },
    {
      title: '类型', dataIndex: 'type', key: 'type', width: 70,
      render: (t: string) => <Tag>{typeLabel[t] || t}</Tag>,
    },
    {
      title: '大小', dataIndex: 'size', key: 'size', width: 90,
      render: (s: number) => formatSize(s),
    },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 90,
      render: (s: string) => <Tag color={statusColor[s]}>{statusLabel[s]}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
    {
      title: '完成时间', dataIndex: 'completed_at', key: 'completed_at', width: 170,
      render: (t: string) => t ? new Date(t).toLocaleString('zh-CN') : '-',
    },
    {
      title: '操作', key: 'action', width: 70,
      render: (_: any, record: BackupItem) => (
        <Popconfirm title="确认删除此备份记录？" onConfirm={() => handleDelete(record.id)}>
          <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <DatabaseOutlined style={{ marginRight: 8 }} />
          备份管理
        </Title>
        <Space>
          <Select
            allowClear placeholder="状态筛选" style={{ width: 120 }}
            value={statusFilter || undefined}
            onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
            options={[
              { value: 'success', label: '已完成' },
              { value: 'running', label: '进行中' },
              { value: 'failed', label: '失败' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchBackups}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>
            新建备份
          </Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="总备份数" value={total} prefix={<DatabaseOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="已完成" value={backups.filter(b => b.status === 'success').length} valueStyle={{ color: '#52c41a' }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="进行中" value={backups.filter(b => b.status === 'running').length} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="失败" value={backups.filter(b => b.status === 'failed').length} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={backups}
          rowKey="id"
          loading={loading}
          pagination={{
            current: page, pageSize, total,
            showSizeChanger: true,
            showTotal: (t) => `共 ${t} 条`,
            onChange: (p, ps) => { setPage(p); setPageSize(ps); },
          }}
          size="middle"
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="新建备份"
        open={modalOpen}
        onOk={handleCreate}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="agent_id" label="目标 Agent" rules={[{ required: true, message: '请输入 Agent ID' }]}>
            <Input placeholder="如 kylin-agent-01" />
          </Form.Item>
          <Form.Item name="name" label="备份名称" rules={[{ required: true, message: '请输入备份名称' }]}>
            <Input placeholder="如 系统备份-20240712" />
          </Form.Item>
          <Form.Item name="type" label="备份类型" initialValue="full">
            <Select options={[
              { value: 'full', label: '全量备份' },
              { value: 'incremental', label: '增量备份' },
            ]} />
          </Form.Item>
          <Form.Item name="file_path" label="目标路径">
            <Input placeholder="/data/backup" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BackupsPage;
