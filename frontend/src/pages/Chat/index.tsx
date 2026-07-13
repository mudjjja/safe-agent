import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Card, message as antMessage, Typography, Space, Spin, Alert, Button, List, Popconfirm } from 'antd';
import {
  LoadingOutlined,
  PlusOutlined,
  DeleteOutlined,
  MessageOutlined,
} from '@ant-design/icons';
import ChatBox from '../../components/ChatBox';
import ChatInput from '../../components/ChatInput';
import StatusPanel from '../../components/StatusPanel';
import RiskModal from '../../components/RiskModal';
import { chatSSE, chatSync } from '../../api/chat';
import type { Message as MsgType } from '../../api/mock';

const { Text } = Typography;

interface Conversation {
  id: string;
  title: string;
  messages: MsgType[];
  createdAt: number;
}

const STORAGE_KEY = 'kylin_chat_conversations';
let messageId = 0;
let convId = 0;

function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* ignore */ }
  return [];
}

function saveConversations(convs: Conversation[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(convs.slice(0, 50)));
}

const ChatPage: React.FC = () => {
  const [conversations, setConversations] = useState<Conversation[]>(loadConversations);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [toolCall, setToolCall] = useState<{ message: string; visible: boolean }>({ message: '', visible: false });
  const [riskModal] = useState({
    visible: false,
    command: '',
    riskLevel: 0,
    reason: '',
    userMessage: '',
  });
  const [latestAction] = useState<{ command: string; status: string; riskLevel: number } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 当前活跃会话的消息
  const activeConv = conversations.find((c) => c.id === activeConvId);
  const messages = activeConv?.messages || [];

  const updateConversations = useCallback((updater: (convs: Conversation[]) => Conversation[]) => {
    setConversations((prev) => {
      const next = updater(prev);
      saveConversations(next);
      return next;
    });
  }, []);

  const addMessage = useCallback((msg: MsgType) => {
    updateConversations((convs) =>
      convs.map((c) =>
        c.id === activeConvId ? { ...c, messages: [...c.messages, msg] } : c,
      ),
    );
  }, [activeConvId, updateConversations]);

  const updateLastMessage = useCallback((content: string) => {
    updateConversations((convs) =>
      convs.map((c) => {
        if (c.id !== activeConvId) return c;
        const updated = [...c.messages];
        const last = updated[updated.length - 1];
        if (last && last.role === 'agent') {
          updated[updated.length - 1] = { ...last, content };
        }
        return { ...c, messages: updated };
      }),
    );
  }, [activeConvId, updateConversations]);

  const handleNewChat = useCallback(() => {
    const id = `conv-${++convId}-${Date.now()}`;
    const newConv: Conversation = {
      id,
      title: `新对话`,
      messages: [],
      createdAt: Date.now(),
    };
    updateConversations((convs) => [newConv, ...convs]);
    setActiveConvId(id);
  }, [updateConversations]);

  const handleDeleteConv = useCallback((id: string) => {
    updateConversations((convs) => convs.filter((c) => c.id !== id));
    if (activeConvId === id) {
      setActiveConvId(null);
    }
  }, [activeConvId, updateConversations]);

  // 首次进入，自动建一个新对话
  useEffect(() => {
    if (!activeConvId && conversations.length === 0) {
      handleNewChat();
    } else if (!activeConvId && conversations.length > 0) {
      setActiveConvId(conversations[0].id);
    }
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (loading || !activeConvId) return;

    setLoading(true);
    setToolCall({ message: '', visible: false });

    const userMsg: MsgType = {
      id: `msg-${++messageId}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

    // 更新会话标题为第一条用户消息
    updateConversations((convs) =>
      convs.map((c) =>
        c.id === activeConvId && c.title === '新对话'
          ? { ...c, title: text.length > 30 ? text.slice(0, 30) + '...' : text }
          : c,
      ),
    );

    const agentMsgId = `msg-${++messageId}`;
    const agentMsg: MsgType = {
      id: agentMsgId,
      role: 'agent',
      content: '',
      timestamp: Date.now(),
    };
    addMessage(agentMsg);

    let fullContent = '';

    try {
      abortRef.current = chatSSE(
        text,
        (chunk) => {
          fullContent += chunk;
          setToolCall({ message: '', visible: false });
          updateLastMessage(fullContent);
        },
        () => {
          setLoading(false);
          setToolCall({ message: '', visible: false });
          if (!fullContent.trim()) {
            updateLastMessage('(AI 无返回内容)');
          }
        },
        async (err) => {
          console.warn('SSE error, fallback to sync:', err.message);
          try {
            const syncResult = await chatSync(text);
            fullContent = syncResult;
            updateLastMessage(fullContent);
          } catch (syncErr: any) {
            updateLastMessage(`请求失败: ${syncErr.message}`);
          } finally {
            setLoading(false);
            setToolCall({ message: '', visible: false });
          }
        },
        (phase) => {
          setToolCall({ message: phase, visible: true });
        },
      );
    } catch (err: any) {
      setLoading(false);
      setToolCall({ message: '', visible: false });
      if (fullContent) {
        updateLastMessage(fullContent);
      } else {
        updateLastMessage(`连接失败: ${err.message}`);
      }
    }
  }, [loading, activeConvId, addMessage, updateLastMessage, updateConversations]);

  const handleConfirmRisk = useCallback(() => {
    handleSend(riskModal.userMessage + ' --confirmed');
  }, [riskModal, handleSend]);

  const handleCancelRisk = useCallback(() => {
    antMessage.warning('已取消操作');
    const cancelMsg: MsgType = {
      id: `msg-${++messageId}`,
      role: 'agent',
      content: '⏹️ 操作已取消，未向主机发送任何指令。',
      timestamp: Date.now(),
    };
    addMessage(cancelMsg);
    setLoading(false);
  }, [addMessage]);

  return (
    <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 140px)' }}>
      {/* 左侧对话历史列表 */}
      <Card
        style={{ width: 260, flexShrink: 0, borderRadius: 8, display: 'flex', flexDirection: 'column' }}
        styles={{ body: { padding: 0, flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
      >
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #f0f0f0' }}>
          <Button type="primary" block icon={<PlusOutlined />} onClick={handleNewChat} size="small">
            新建对话
          </Button>
        </div>
        <div style={{ flex: 1, overflow: 'auto' }}>
          <List
            dataSource={conversations}
            renderItem={(conv) => (
              <List.Item
                onClick={() => setActiveConvId(conv.id)}
                style={{
                  cursor: 'pointer',
                  padding: '8px 12px',
                  background: conv.id === activeConvId ? '#e6f7ff' : 'transparent',
                  borderLeft: conv.id === activeConvId ? '3px solid #1890ff' : '3px solid transparent',
                  marginBottom: 0,
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <Space size={6} style={{ flex: 1, minWidth: 0 }}>
                  <MessageOutlined style={{ color: '#999', fontSize: 12 }} />
                  <Text ellipsis style={{ fontSize: 13, maxWidth: 160 }}>
                    {conv.title}
                  </Text>
                </Space>
                <Popconfirm title="删除此对话？" onConfirm={(e) => { e?.stopPropagation(); handleDeleteConv(conv.id); }} onCancel={(e) => e?.stopPropagation()}>
                  <DeleteOutlined
                    style={{ color: '#ccc', fontSize: 12, flexShrink: 0 }}
                    onClick={(e) => e.stopPropagation()}
                  />
                </Popconfirm>
              </List.Item>
            )}
            locale={{ emptyText: <Text type="secondary" style={{ padding: 16, display: 'block', textAlign: 'center' }}>暂无对话</Text> }}
            style={{ flex: 1 }}
          />
        </div>
      </Card>

      {/* 中间消息区 */}
      <Card
        style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRadius: 8 }}
        styles={{ body: { flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' } }}
      >
        {toolCall.visible && (
          <Alert
            icon={<LoadingOutlined spin />}
            message={
              <Space>
                <Text style={{ fontSize: 12 }}>{toolCall.message}</Text>
              </Space>
            }
            type="info"
            showIcon={false}
            style={{
              margin: '8px 12px 0', padding: '6px 12px', borderRadius: 6,
              background: '#f0f5ff', border: '1px solid #d6e4ff',
            }}
          />
        )}

        {!activeConvId ? (
          <div style={{ flex: 1, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Space direction="vertical" align="center">
              <MessageOutlined style={{ fontSize: 48, color: '#d9d9d9' }} />
              <Text type="secondary">请新建或选择一个对话</Text>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleNewChat}>新建对话</Button>
            </Space>
          </div>
        ) : (
          <>
            <ChatBox messages={messages} />
            {loading && !toolCall.visible && (
              <div style={{ textAlign: 'center', padding: '4px 0' }}>
                <Spin size="small" />
                <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>AI 思考中...</Text>
              </div>
            )}
            <ChatInput onSend={handleSend} disabled={loading} />
          </>
        )}
      </Card>

      {/* 右侧状态面板 */}
      <div style={{ width: 280, flexShrink: 0 }}>
        <StatusPanel latestAction={latestAction} />
      </div>

      <RiskModal
        visible={riskModal.visible}
        command={riskModal.command}
        riskLevel={riskModal.riskLevel}
        reason={riskModal.reason}
        onConfirm={handleConfirmRisk}
        onCancel={handleCancelRisk}
        loading={false}
      />
    </div>
  );
};

export default ChatPage;
