import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Form, Select, Input, Button, Typography, Alert, Tag, Space,
  Modal, Descriptions, Table, message,
} from 'antd';
import {
  ThunderboltOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ReloadOutlined,
  HistoryOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import {
  getAgentList,
  getSkillList,
  executeCommand,
  getTaskResult,
  type AgentInfo,
  type SkillInfo,
  type ExecuteResult,
} from '../../api/skills';

const { Title, Text } = Typography;
const { TextArea } = Input;

const HIGH_RISK_SKILLS = ['reboot', 'shutdown', 'rm', 'mv', 'dd', 'iptables-save'];

const CommandsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [skills, setSkills] = useState<SkillInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [executing, setExecuting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<ExecuteResult | null>(null);
  const [cmdHistory, setCmdHistory] = useState<{ time: string; skill: string; agent: string; status: string }[]>([]);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingParams, setPendingParams] = useState<any>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [agentList, skillList] = await Promise.all([
        getAgentList(),
        getSkillList(),
      ]);
      setAgents(agentList || []);
      setSkills(skillList || []);
    } catch (err: any) {
      if (!agents.length) setError(err?.message || '获取 Agent/Skill 列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 30000);
    return () => clearInterval(timer);
  }, []);

  const isHighRisk = (skillName: string) => {
    return HIGH_RISK_SKILLS.some((s) => skillName?.toLowerCase().includes(s));
  };

  const handleExecute = async (values: any) => {
    if (isHighRisk(values.skill_name)) {
      setPendingParams(values);
      setConfirmVisible(true);
      return;
    }

    await doExecute(values);
  };

  const doExecute = async (values: any) => {
    const { agent_id, skill_name, params } = values;
    setExecuting(true);
    setError('');
    setResult(null);

    try {
      let paramsObj: Record<string, string> = {};
      try {
        paramsObj = params ? JSON.parse(params) : {};
      } catch {
        paramsObj = { command: params };
      }

      const res = await executeCommand({
        skill_name,
        agent_id,
        params: paramsObj,
      });
      setResult(res);

      // 如果有 task_id 但没执行完，轮询结果
      if (res.task_id && (res.status === 'pending' || res.status === 'running')) {
        pollTaskResult(String(res.task_id));
      }

      // 记录历史
      setCmdHistory((prev) => [{
        time: new Date().toLocaleTimeString(),
        skill: skill_name,
        agent: agent_id,
        status: res.status || 'pending',
      }, ...prev].slice(0, 20));

      message.success('命令已下发');
    } catch (err: any) {
      setError(err?.response?.data?.message || err?.message || '命令执行失败');
      message.error('命令下发失败');
    } finally {
      setExecuting(false);
      setConfirmVisible(false);
    }
  };

  const pollTaskResult = async (taskId: string) => {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 1000));
      try {
        const res = await getTaskResult(taskId);
        setResult(res);
        if (res.status === 'success' || res.status === 'failed') break;
      } catch {
        break;
      }
    }
  };

  const handleConfirm = () => {
    if (pendingParams) {
      doExecute(pendingParams);
    }
  };

  const selectedAgent = agents.find((a) => a.id === form.getFieldValue('agent_id'));
  const selectedSkill = skills.find((s) => s.name === form.getFieldValue('skill_name'));

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <ThunderboltOutlined style={{ marginRight: 8 }} />
          命令执行
        </Title>
        <Space>
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>
            刷新
          </Button>
        </Space>
      </div>

      {error && <Alert message={error} type="error" showIcon closable style={{ marginBottom: 16 }} />}

      <Card style={{ borderRadius: 10, marginBottom: 16 }}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleExecute}
          initialValues={{ params: '{}' }}
        >
          <Space style={{ width: '100%' }} size={16} align="start">
            <Form.Item
              name="agent_id"
              label="目标 Agent"
              rules={[{ required: true, message: '请选择 Agent' }]}
              style={{ minWidth: 220 }}
            >
              <Select
                placeholder="选择在线 Agent"
                loading={loading}
                options={agents.map((a) => ({
                  value: a.id,
                  label: `${a.hostname} (${a.ip}) [${a.status === 'online' ? '在线' : '离线'}]`,
                }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item
              name="skill_name"
              label="执行 Skill"
              rules={[{ required: true, message: '请选择 Skill' }]}
              style={{ minWidth: 220 }}
            >
              <Select
                placeholder="选择 Skill"
                loading={loading}
                options={skills.map((s) => ({
                  value: s.name,
                  label: s.name,
                  description: s.description,
                }))}
                showSearch
                optionFilterProp="label"
              />
            </Form.Item>

            <Form.Item
              name="params"
              label="参数（JSON）"
              style={{ flex: 1, minWidth: 200 }}
            >
              <TextArea
                placeholder='{"command": "df -h"} 或直接输入命令字符串'
                rows={1}
                autoSize={{ minRows: 1, maxRows: 3 }}
              />
            </Form.Item>

            <Form.Item label=" " style={{ marginTop: 4 }}>
              <Button
                type="primary"
                htmlType="submit"
                loading={executing}
                icon={<ThunderboltOutlined />}
                size="large"
                danger={selectedSkill && isHighRisk(selectedSkill.name)}
              >
                {executing ? '执行中...' : '执行'}
              </Button>
            </Form.Item>
          </Space>
        </Form>

        {selectedSkill && (
          <div style={{ marginTop: -8, marginBottom: 8 }}>
            <Space size={4}>
              <Text type="secondary" style={{ fontSize: 12 }}>Skill 说明: {selectedSkill.description}</Text>
              {isHighRisk(selectedSkill.name) && (
                <Tag color="error" icon={<ExclamationCircleOutlined />}>高风险</Tag>
              )}
            </Space>
          </div>
        )}

        {selectedAgent && selectedAgent.status !== 'online' && (
          <Alert message="该 Agent 当前离线，可能无法执行命令" type="warning" showIcon style={{ marginTop: 8 }} />
        )}
      </Card>

      {/* 执行结果 */}
      {result && (
        <Card
          title={<Space><CodeOutlined />执行结果</Space>}
          style={{ borderRadius: 10, marginBottom: 16 }}
          extra={
            <Tag
              color={result.status === 'success' ? 'success' : result.status === 'failed' ? 'error' : 'processing'}
              icon={result.status === 'success' ? <CheckCircleOutlined /> : result.status === 'failed' ? <CloseCircleOutlined /> : undefined}
            >
              {result.status === 'success' ? '成功' : result.status === 'failed' ? '失败' : result.status === 'running' ? '运行中' : '等待中'}
            </Tag>
          }
        >
          <Descriptions size="small" column={3} style={{ marginBottom: 12 }}>
            {result.duration_ms !== undefined && (
              <Descriptions.Item label="耗时">
                {result.duration_ms >= 1000 ? `${(result.duration_ms / 1000).toFixed(1)}s` : `${result.duration_ms}ms`}
              </Descriptions.Item>
            )}
            {result.exit_code !== undefined && (
              <Descriptions.Item label="退出码">
                <Tag color={result.exit_code === 0 ? 'success' : 'error'}>{result.exit_code}</Tag>
              </Descriptions.Item>
            )}
            {result.task_id && (
              <Descriptions.Item label="任务 ID">
                <Text copyable style={{ fontSize: 12 }}>{result.task_id}</Text>
              </Descriptions.Item>
            )}
          </Descriptions>

          {result.stdout && (
            <div style={{ marginBottom: 8 }}>
              <Text strong style={{ fontSize: 12, color: '#52c41a' }}>stdout</Text>
              <pre style={{
                background: '#f6ffed', padding: '8px 12px', borderRadius: 6, fontSize: 12,
                maxHeight: 200, overflow: 'auto', border: '1px solid #b7eb8f',
                marginTop: 4,
              }}>{result.stdout}</pre>
            </div>
          )}
          {result.stderr && (
            <div>
              <Text strong style={{ fontSize: 12, color: '#ff4d4f' }}>stderr</Text>
              <pre style={{
                background: '#fff2f0', padding: '8px 12px', borderRadius: 6, fontSize: 12,
                maxHeight: 200, overflow: 'auto', border: '1px solid #ffccc7',
                marginTop: 4,
              }}>{result.stderr}</pre>
            </div>
          )}
          {result.message && !result.stdout && !result.stderr && (
            <Text>{result.message}</Text>
          )}
        </Card>
      )}

      {/* 执行历史 */}
      {cmdHistory.length > 0 && (
        <Card
          title={<Space><HistoryOutlined />执行历史</Space>}
          size="small"
          styles={{ body: { padding: 0 } }}
          style={{ borderRadius: 10 }}
        >
          <Table
            dataSource={cmdHistory}
            columns={[
              { title: '时间', dataIndex: 'time', width: 80, key: 'time' },
              { title: 'Skill', dataIndex: 'skill', key: 'skill' },
              { title: 'Agent', dataIndex: 'agent', key: 'agent', ellipsis: true },
              {
                title: '状态', dataIndex: 'status', width: 80, key: 'status',
                render: (s: string) => {
                  const map: Record<string, { color: string; label: string }> = {
                    success: { color: 'success', label: '成功' },
                    failed: { color: 'error', label: '失败' },
                    running: { color: 'processing', label: '运行中' },
                    pending: { color: 'default', label: '等待中' },
                  };
                  const c = map[s] || { color: 'default', label: s };
                  return <Tag color={c.color}>{c.label}</Tag>;
                },
              },
            ]}
            rowKey="time"
            size="small"
            pagination={false}
          />
        </Card>
      )}

      {/* 高风险确认弹窗 */}
      <Modal
        title={
          <Space>
            <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />
            <span>高风险操作确认</span>
          </Space>
        }
        open={confirmVisible}
        onOk={handleConfirm}
        onCancel={() => setConfirmVisible(false)}
        okText="确认执行"
        cancelText="取消"
        okButtonProps={{ danger: true, loading: executing }}
      >
        <Alert
          type="error"
          message="高风险操作"
          description="此操作被标记为高风险，请确认操作对象和影响范围后再执行。"
          showIcon
          style={{ marginBottom: 16 }}
        />
        <Descriptions column={1} size="small" bordered>
          <Descriptions.Item label="Agent">{pendingParams?.agent_id}</Descriptions.Item>
          <Descriptions.Item label="Skill">{pendingParams?.skill_name}</Descriptions.Item>
          <Descriptions.Item label="参数">{pendingParams?.params}</Descriptions.Item>
        </Descriptions>
      </Modal>
    </div>
  );
};

export default CommandsPage;
