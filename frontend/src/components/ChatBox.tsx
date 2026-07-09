import React, { useEffect, useRef } from 'react';
import { Typography, Tag, Card, Space } from 'antd';
import {
  CheckCircleOutlined,
  CloseCircleOutlined,
  WarningOutlined,
  UserOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import type { Message } from '../api/mock';

const { Text, Paragraph } = Typography;

interface ChatBoxProps {
  messages: Message[];
}

const ChatBox: React.FC<ChatBoxProps> = ({ messages }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const getRiskTag = (level: number) => {
    if (level <= 3) return <Tag color="success" icon={<CheckCircleOutlined />}>风险 {level}/10</Tag>;
    if (level <= 6) return <Tag color="warning" icon={<WarningOutlined />}>风险 {level}/10</Tag>;
    return <Tag color="error" icon={<CloseCircleOutlined />}>风险 {level}/10</Tag>;
  };

  if (messages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#bbb',
          padding: 40,
        }}
      >
        <RobotOutlined style={{ fontSize: 64, marginBottom: 16, color: '#d9d9d9' }} />
        <Text type="secondary" style={{ fontSize: 16 }}>我是麒麟安全运维助手</Text>
        <Text type="secondary">试试对我说："帮我看看磁盘还剩多少空间"</Text>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      {messages.map((msg) => (
        <div
          key={msg.id}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start',
          }}
        >
          <Space style={{ marginBottom: 4 }}>
            {msg.role === 'user' ? (
              <>
                <Text type="secondary" style={{ fontSize: 12 }}>你</Text>
                <UserOutlined style={{ color: '#1890ff' }} />
              </>
            ) : (
              <>
                <RobotOutlined style={{ color: '#52c41a' }} />
                <Text type="secondary" style={{ fontSize: 12, color: '#52c41a' }}>安全运维Agent</Text>
              </>
            )}
          </Space>

          <Card
            size="small"
            style={{
              maxWidth: '85%',
              background: msg.role === 'user' ? '#e6f7ff' : '#fff',
              border: msg.role === 'user' ? '1px solid #91d5ff' : '1px solid #f0f0f0',
              borderRadius: 12,
              whiteSpace: 'pre-wrap',
            }}
            bodyStyle={{ padding: '8px 12px' }}
          >
            <Paragraph style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.content}</Paragraph>

            {msg.riskCheck && msg.role === 'agent' && (
              <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f0f0f0' }}>
                <Space size={[4, 4]} wrap>
                  {getRiskTag(msg.riskCheck.level)}
                  {msg.riskCheck.passed ? (
                    <Tag icon={<CheckCircleOutlined />} color="success">安全检测通过</Tag>
                  ) : msg.riskCheck.requireConfirm ? (
                    <Tag icon={<WarningOutlined />} color="warning">待确认</Tag>
                  ) : (
                    <Tag icon={<CloseCircleOutlined />} color="error">已拦截</Tag>
                  )}
                </Space>
                <div style={{ marginTop: 4 }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>{msg.riskCheck.reason}</Text>
                </div>
              </div>
            )}

            {msg.execution && msg.role === 'agent' && (
              <div style={{ marginTop: 8 }}>
                <Tag icon={<CheckCircleOutlined />} color="success">执行成功 ({msg.execution.duration}ms)</Tag>
              </div>
            )}
          </Card>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
};

export default ChatBox;
