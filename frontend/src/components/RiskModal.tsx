import React from 'react';
import { Modal, Typography, Tag, Alert, Space, Descriptions } from 'antd';
import { WarningOutlined, ExclamationCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';

const { Text } = Typography;

interface RiskModalProps {
  visible: boolean;
  command: string;
  riskLevel: number;
  reason: string;
  onConfirm: () => void;
  onCancel: () => void;
  loading?: boolean;
}

const RiskModal: React.FC<RiskModalProps> = ({
  visible,
  command,
  riskLevel,
  reason,
  onConfirm,
  onCancel,
  loading,
}) => {
  const getLevelConfig = () => {
    if (riskLevel <= 3) return { color: 'success', icon: <WarningOutlined />, title: '低风险操作' };
    if (riskLevel <= 6) return { color: 'warning', icon: <ExclamationCircleOutlined />, title: '中风险操作' };
    return { color: 'error', icon: <CloseCircleOutlined />, title: '高危操作' };
  };

  const config = getLevelConfig();

  return (
    <Modal
      title={
        <Space>
          {config.icon}
          <span>{config.title}</span>
          <Tag color={config.color}>风险等级 {riskLevel}/10</Tag>
        </Space>
      }
      open={visible}
      onOk={onConfirm}
      onCancel={onCancel}
      okText="确认执行"
      cancelText="取消"
      okButtonProps={{
        danger: riskLevel > 6,
        loading,
        style: riskLevel > 6 ? {} : undefined,
      }}
      width={520}
      centered
    >
      <div style={{ padding: '8px 0' }}>
        <Alert
          type={riskLevel > 6 ? 'error' : riskLevel > 3 ? 'warning' : 'info'}
          message="操作确认"
          description={reason}
          showIcon
          style={{ marginBottom: 16 }}
        />

        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="操作命令">
            <Text code style={{ wordBreak: 'break-all' }}>{command}</Text>
          </Descriptions.Item>
          <Descriptions.Item label="风险等级">
            <Tag color={config.color}>{riskLevel}/10</Tag>
          </Descriptions.Item>
          <Descriptions.Item label="拦截原因">
            {reason}
          </Descriptions.Item>
        </Descriptions>

        {riskLevel > 6 && (
          <div style={{ marginTop: 12, padding: 8, background: '#fff2f0', borderRadius: 6, border: '1px solid #ffccc7' }}>
            <Text type="danger">
              ⚠️ 此操作风险等级较高，请确认操作对象和影响范围后再执行。
            </Text>
          </div>
        )}
      </div>
    </Modal>
  );
};

export default RiskModal;
