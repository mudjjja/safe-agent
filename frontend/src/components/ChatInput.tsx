import React, { useState } from 'react';
import { Input, Button } from 'antd';
import { SendOutlined } from '@ant-design/icons';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

const ChatInput: React.FC<ChatInputProps> = ({ onSend, disabled }) => {
  const [value, setValue] = useState('');

  const handleSend = () => {
    const text = value.trim();
    if (!text || disabled) return;
    onSend(text);
    setValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div style={{ display: 'flex', gap: 8, padding: '12px 16px', borderTop: '1px solid #f0f0f0', background: '#fff' }}>
      <Input.TextArea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="输入运维指令，例如：帮我看看磁盘还剩多少空间"
        disabled={disabled}
        autoSize={{ minRows: 1, maxRows: 4 }}
        style={{ flex: 1, borderRadius: 8 }}
      />
      <Button
        type="primary"
        icon={<SendOutlined />}
        onClick={handleSend}
        disabled={disabled || !value.trim()}
        style={{ borderRadius: 8, height: 38, alignSelf: 'flex-end' }}
      >
        发送
      </Button>
    </div>
  );
};

export default ChatInput;
