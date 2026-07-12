import React, { useState } from 'react';
import { Layout as AntLayout, Menu, Typography, Avatar, Dropdown, Space, theme } from 'antd';
import {
  DashboardOutlined,
  MessageOutlined,
  BellOutlined,
  FileTextOutlined,
  ThunderboltOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
  TeamOutlined,
  DatabaseOutlined,
  FolderOpenOutlined,
  BarChartOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const { Header, Content, Footer, Sider } = AntLayout;
const { Text } = Typography;

const Layout: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const { token: themeToken } = theme.useToken();

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
    { key: '/chat', icon: <MessageOutlined />, label: 'AI 对话' },
    { key: '/alerts', icon: <BellOutlined />, label: '告警列表' },
    { key: '/audit', icon: <FileTextOutlined />, label: '审计日志' },
    { key: '/commands', icon: <ThunderboltOutlined />, label: '命令执行' },
    { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
    { key: '/backups', icon: <DatabaseOutlined />, label: '备份管理' },
    { key: '/logs', icon: <FolderOpenOutlined />, label: '日志存储' },
    { key: '/analysis', icon: <BarChartOutlined />, label: '分析看板' },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  const userMenu = {
    items: [
      { key: 'user', label: user?.username || 'admin', disabled: true },
      { type: 'divider' as const },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: '退出登录',
        onClick: handleLogout,
      },
    ],
  };

  return (
    <AntLayout style={{ minHeight: '100vh', background: '#f0f2f5' }}>
      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        width={200}
        style={{
          background: '#001529',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 100,
          overflow: 'auto',
        }}
      >
        <div
          style={{
            height: 64,
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            padding: collapsed ? 0 : '0 16px',
            borderBottom: '1px solid rgba(255,255,255,0.1)',
            cursor: 'pointer',
          }}
          onClick={() => navigate('/')}
        >
          <SafetyCertificateOutlined style={{ fontSize: 28, color: '#52c41a', flexShrink: 0 }} />
          {!collapsed && (
            <Text strong style={{ color: '#fff', marginLeft: 10, fontSize: 15, whiteSpace: 'nowrap' }}>
              麒麟安全运维
            </Text>
          )}
        </div>

        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => navigate(key)}
          style={{ background: '#001529', borderRight: 'none', marginTop: 4 }}
        />

        {/* 侧边栏底部折叠按钮 */}
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            width: '100%',
            borderTop: '1px solid rgba(255,255,255,0.1)',
            textAlign: 'center',
            padding: '8px 0',
            cursor: 'pointer',
            color: 'rgba(255,255,255,0.65)',
          }}
          onClick={() => setCollapsed(!collapsed)}
        >
          {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
        </div>
      </Sider>

      <AntLayout style={{ marginLeft: collapsed ? 80 : 200, transition: 'all 0.2s' }}>
        {/* 顶部栏 */}
        <Header
          style={{
            background: '#fff',
            padding: '0 24px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
            position: 'sticky',
            top: 0,
            zIndex: 99,
            height: 56,
            lineHeight: '56px',
          }}
        >
          <Text style={{ fontSize: 15, fontWeight: 500 }}>
            {menuItems.find((m) => m.key === location.pathname)?.label || '麒麟安全运维'}
          </Text>

          <Space>
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar size="small" icon={<UserOutlined />} style={{ background: themeToken.colorPrimary }} />
                <Text style={{ fontSize: 13 }}>{user?.username || 'admin'}</Text>
              </Space>
            </Dropdown>
          </Space>
        </Header>

        {/* 内容区 */}
        <Content style={{ padding: '16px', maxWidth: 1400, margin: '0 auto', width: '100%' }}>
          <Outlet />
        </Content>

        <Footer style={{ textAlign: 'center', color: '#999', padding: '12px 50px', background: '#f0f2f5' }}>
          麒麟安全运维系统 · 基于 MCP 协议 · 国产操作系统安全运维解决方案
        </Footer>
      </AntLayout>
    </AntLayout>
  );
};

export default Layout;
