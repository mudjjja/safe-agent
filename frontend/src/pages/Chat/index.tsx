import React, { useState, useCallback, useRef } from 'react';
import { Card, message as antMessage, Typography, Space, Spin, Alert } from 'antd';
import { LoadingOutlined } from '@ant-design/icons';
import ChatBox from '../../components/ChatBox';
import ChatInput from '../../components/ChatInput';
import StatusPanel from '../../components/StatusPanel';
import RiskModal from '../../components/RiskModal';
import { chatSSE, chatSync } from '../../api/chat';
import type { Message as MsgType } from '../../api/mock';

const { Text } = Typography;

interface ToolCallStatus {
  message: string;
  visible: boolean;
}

let messageId = 0;

const ChatPage: React.FC = () => {
  const [messages, setMessages] = useState<MsgType[]>([]);
  const [loading, setLoading] = useState(false);
  const [toolCall, setToolCall] = useState<ToolCallStatus>({ message: '', visible: false });
  const [riskModal, _setRiskModal] = useState({
    visible: false,
    command: '',
    riskLevel: 0,
    reason: '',
    userMessage: '',
  });
  const [latestAction] = useState<{
    command: string;
    status: string;
    riskLevel: number;
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const addMessage = useCallback((msg: MsgType) => {
    setMessages((prev) => [...prev, msg]);
  }, []);

  const updateLastMessage = useCallback((content: string) => {
    setMessages((prev) => {
      const updated = [...prev];
      const last = updated[updated.length - 1];
      if (last && last.role === 'agent') {
        updated[updated.length - 1] = { ...last, content };
      }
      return updated;
    });
  }, []);

  const handleSend = useCallback(async (text: string) => {
    if (loading) return;

    setLoading(true);
    setToolCall({ message: '', visible: false });

    const userMsg: MsgType = {
      id: `msg-${++messageId}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    addMessage(userMsg);

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
  }, [loading, addMessage, updateLastMessage]);

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
    <>
      <div style={{ display: 'flex', gap: 16, height: 'calc(100vh - 140px)' }}>
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

          <ChatBox messages={messages} />

          {loading && !toolCall.visible && (
            <div style={{ textAlign: 'center', padding: '4px 0' }}>
              <Spin size="small" />
              <Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>AI 思考中...</Text>
            </div>
          )}

          <ChatInput onSend={handleSend} disabled={loading} />
        </Card>

        <div style={{ width: 300, flexShrink: 0 }}>
          <StatusPanel latestAction={latestAction} />
        </div>
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
    </>
  );
};

export default ChatPage;
