import React, { useEffect, useState } from 'react';
import {
  Table, Card, Button, Tag, Space, Modal, Form, Input, Select, message,
  Popconfirm, Typography, Row, Col, Statistic,
} from 'antd';
import {
  UserOutlined, PlusOutlined, EditOutlined, DeleteOutlined,
  ReloadOutlined, TeamOutlined,
} from '@ant-design/icons';
import { getUsers, createUser, updateUser, deleteUser, type SysUser, type CreateUserParams, type UpdateUserParams } from '../../api/users';

const { Title } = Typography;

const UsersPage: React.FC = () => {
  const [users, setUsers] = useState<SysUser[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [roleFilter, setRoleFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<SysUser | null>(null);
  const [form] = Form.useForm();

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const result = await getUsers({ page, size: pageSize, role: roleFilter || undefined, status: statusFilter || undefined });
      setUsers(result.list);
      setTotal(result.total);
    } catch { /* handled by interceptor */ }
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, [page, pageSize, roleFilter, statusFilter]);

  const handleCreate = () => {
    setEditingUser(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (user: SysUser) => {
    setEditingUser(user);
    form.setFieldsValue(user);
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteUser(id);
      message.success('已删除');
      fetchUsers();
    } catch { /* handled */ }
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editingUser) {
        const params: UpdateUserParams = { ...values };
        if (!params.password) delete params.password;
        await updateUser(editingUser.id, params);
        message.success('已更新');
      } else {
        await createUser(values as CreateUserParams);
        message.success('已创建');
      }
      setModalOpen(false);
      fetchUsers();
    } catch { /* handled */ }
  };

  const roleColor: Record<string, string> = { admin: 'red', user: 'blue', viewer: 'default' };
  const statusColor: Record<string, string> = { active: 'success', disabled: 'error' };
  const statusLabel: Record<string, string> = { active: '正常', disabled: '已禁用' };

  const columns = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username', key: 'username', width: 120 },
    {
      title: '角色', dataIndex: 'role', key: 'role', width: 90,
      render: (role: string) => <Tag color={roleColor[role] || 'default'}>{role}</Tag>,
    },
    { title: '邮箱', dataIndex: 'email', key: 'email', width: 180, ellipsis: true },
    { title: '手机号', dataIndex: 'phone', key: 'phone', width: 130 },
    {
      title: '状态', dataIndex: 'status', key: 'status', width: 80,
      render: (s: string) => <Tag color={statusColor[s] || 'default'}>{statusLabel[s] || s}</Tag>,
    },
    {
      title: '创建时间', dataIndex: 'created_at', key: 'created_at', width: 170,
      render: (t: string) => new Date(t).toLocaleString('zh-CN'),
    },
    {
      title: '操作', key: 'action', width: 140,
      render: (_: any, record: SysUser) => (
        <Space>
          <Button type="link" size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>编辑</Button>
          <Popconfirm title="确认删除此用户？" onConfirm={() => handleDelete(record.id)}>
            <Button type="link" size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <TeamOutlined style={{ marginRight: 8 }} />
          用户管理
        </Title>
        <Space>
          <Select
            allowClear placeholder="角色筛选" style={{ width: 110 }}
            value={roleFilter || undefined} onChange={(v) => { setRoleFilter(v || ''); setPage(1); }}
            options={[
              { value: 'admin', label: '管理员' },
              { value: 'user', label: '普通用户' },
              { value: 'viewer', label: '只读用户' },
            ]}
          />
          <Select
            allowClear placeholder="状态筛选" style={{ width: 110 }}
            value={statusFilter || undefined} onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
            options={[
              { value: 'active', label: '正常' },
              { value: 'disabled', label: '已禁用' },
            ]}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchUsers}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>新增用户</Button>
        </Space>
      </div>

      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small"><Statistic title="用户总数" value={total} prefix={<TeamOutlined />} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="管理员" value={users.filter(u => u.role === 'admin').length} valueStyle={{ color: '#cf1322' }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="普通用户" value={users.filter(u => u.role === 'user').length} valueStyle={{ color: '#1890ff' }} /></Card>
        </Col>
        <Col span={6}>
          <Card size="small"><Statistic title="已禁用" value={users.filter(u => u.status === 'disabled').length} valueStyle={{ color: '#ff4d4f' }} /></Card>
        </Col>
      </Row>

      <Card size="small" styles={{ body: { padding: 0 } }}>
        <Table
          columns={columns}
          dataSource={users}
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

      <Modal
        title={editingUser ? '编辑用户' : '新增用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item
            name="password"
            label={editingUser ? '新密码（留空不修改）' : '密码'}
            rules={editingUser ? [] : [{ required: true, message: '请输入密码' }]}
          >
            <Input.Password placeholder="密码" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="user">
            <Select options={[
              { value: 'admin', label: '管理员' },
              { value: 'user', label: '普通用户' },
              { value: 'viewer', label: '只读用户' },
            ]} />
          </Form.Item>
          <Form.Item name="email" label="邮箱">
            <Input placeholder="email@example.com" />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input placeholder="手机号" />
          </Form.Item>
          {editingUser && (
            <Form.Item name="status" label="状态" initialValue="active">
              <Select options={[
                { value: 'active', label: '正常' },
                { value: 'disabled', label: '已禁用' },
              ]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
};

export default UsersPage;
