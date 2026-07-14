import React, { useEffect, useState, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card, Row, Col, Typography, Spin, Alert, Tag, Space, Statistic, Descriptions, Button,
} from 'antd';
import {
  DesktopOutlined,
  ReloadOutlined,
  HistoryOutlined,
  CheckCircleFilled,
  CloseCircleFilled,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { GaugeChart, LineChart, BarChart } from 'echarts/charts';
import {
  TooltipComponent, GridComponent, TitleComponent, LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { getLatestMetrics, getHistoryMetrics, fetchAgentList } from '../../api/monitor';

echarts.use([GaugeChart, LineChart, BarChart, TooltipComponent, GridComponent, TitleComponent, LegendComponent, CanvasRenderer]);

const { Title, Text } = Typography;

interface AgentInfo {
  id: string;
  hostname: string;
  ip: string;
  status: 'online' | 'offline';
  lastSeen: string;
}

const AgentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [agent, setAgent] = useState<AgentInfo | null>(null);
  const [latest, setLatest] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    if (!id) return;
    try {
      const [metrics, hist] = await Promise.all([
        getLatestMetrics(id),
        getHistoryMetrics(60, id),
      ]);
      setLatest(metrics);
      setHistory(hist);
      setError('');
    } catch (err: any) {
      if (!latest) setError(err?.message || '获取数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 获取 Agent 信息
    fetchAgentList().then((agentList) => {
      const found = agentList.find((a: string) => a === id);
      if (found) {
        setAgent({
          id: found,
          hostname: found,
          ip: '-',
          status: 'online',
          lastSeen: new Date().toISOString(),
        });
      } else {
        setAgent({
          id: id || 'unknown',
          hostname: id || 'unknown',
          ip: '-',
          status: 'offline',
          lastSeen: '-',
        });
      }
    });

    fetchData();
    intervalRef.current = setInterval(fetchData, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [id]);

  /** 仪表盘配置 */
  const gaugeOption = (value: number, threshold: number, name: string) => ({
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      pointer: { show: true, length: '55%', width: 4, itemStyle: { color: value >= threshold ? '#ff4d4f' : '#52c41a' } },
      progress: {
        show: true,
        width: 10,
        itemStyle: { color: value >= threshold ? '#ff4d4f' : '#52c41a' },
      },
      axisLine: {
        lineStyle: { width: 10, color: [[threshold / 100, '#ff4d4f'], [1, '#f0f0f0']] },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        fontSize: 16,
        fontWeight: 'bold',
        color: value >= threshold ? '#ff4d4f' : '#333',
        formatter: `{value}%`,
        offsetCenter: [0, '40%'],
      },
      title: {
        offsetCenter: [0, '70%'],
        fontSize: 12,
        color: '#666',
      },
      data: [{ value: parseFloat(value.toFixed(1)), name }],
    }],
  });

  /** 折线图 */
  const lineOption = history.length > 0 ? {
    tooltip: { trigger: 'axis' },
    grid: { left: 40, right: 16, top: 30, bottom: 24 },
    xAxis: {
      type: 'category' as const,
      data: history.map((p) => {
        const t = p.time || '';
        return t.length > 16 ? t.slice(11, 16) : t;
      }),
      boundaryGap: false,
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value' as const, min: 0, max: 100, axisLabel: { fontSize: 11, formatter: '{value}%' } },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8 },
    series: [
      { name: 'CPU', type: 'line', smooth: true, data: history.map(p => p.cpu_percent), lineStyle: { width: 2 }, itemStyle: { color: '#1890ff' }, areaStyle: { color: 'rgba(24,144,255,0.1)' } },
      { name: '内存', type: 'line', smooth: true, data: history.map(p => p.mem_percent), lineStyle: { width: 2 }, itemStyle: { color: '#52c41a' }, areaStyle: { color: 'rgba(82,196,26,0.1)' } },
      { name: '磁盘', type: 'line', smooth: true, data: history.map(p => p.disk_percent), lineStyle: { width: 2 }, itemStyle: { color: '#faad14' }, areaStyle: { color: 'rgba(250,173,20,0.1)' } },
    ],
  } : null;

  if (loading && !latest) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <DesktopOutlined style={{ marginRight: 8 }} />
          Agent 详情: {id}
        </Title>
        <Space>
          {agent && (
            <Tag icon={agent.status === 'online' ? <CheckCircleFilled /> : <CloseCircleFilled />}
              color={agent.status === 'online' ? 'success' : 'error'}>
              {agent.status === 'online' ? '在线' : '离线'}
            </Tag>
          )}
          <Button size="small" icon={<ReloadOutlined />} onClick={fetchData} loading={loading}>刷新</Button>
        </Space>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      {/* Agent 信息 */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
        <Descriptions size="small" column={4}>
          <Descriptions.Item label="Agent ID">{id}</Descriptions.Item>
          <Descriptions.Item label="主机名">{agent?.hostname || '-'}</Descriptions.Item>
          <Descriptions.Item label="IP">{latest?.hostname || agent?.ip || '-'}</Descriptions.Item>
          <Descriptions.Item label="状态">
            <Tag color={agent?.status === 'online' ? 'success' : 'error'}>
              {agent?.status === 'online' ? '在线' : '离线'}
            </Tag>
          </Descriptions.Item>
        </Descriptions>
      </Card>

      {/* 监控仪表盘 */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <ReactECharts option={gaugeOption(latest?.cpu_percent ?? 0, 90, 'CPU')} style={{ height: 160 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <ReactECharts option={gaugeOption(latest?.mem_percent ?? 0, 95, '内存')} style={{ height: 160 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <ReactECharts option={gaugeOption(latest?.disk_percent ?? 0, 90, '磁盘')} style={{ height: 160 }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" style={{ borderRadius: 8, height: '100%' }}>
            <Statistic title="网络接收" value={latest?.net_rx_bytes ? (latest.net_rx_bytes / 1024 / 1024).toFixed(1) : '0'} suffix="MB/s" valueStyle={{ color: '#1890ff', fontSize: 20 }} />
            <div style={{ height: 12 }} />
            <Statistic title="网络发送" value={latest?.net_tx_bytes ? (latest.net_tx_bytes / 1024 / 1024).toFixed(1) : '0'} suffix="MB/s" valueStyle={{ color: '#52c41a', fontSize: 20 }} />
          </Card>
        </Col>
      </Row>

      {/* 趋势图 */}
      <Card title={<><HistoryOutlined /> 近 1 小时资源趋势</>} style={{ borderRadius: 8 }} styles={{ body: { padding: '16px 0 0 0' } }}>
        {lineOption ? (
          <ReactECharts option={lineOption} style={{ height: 260 }} />
        ) : (
          <div style={{ height: 260, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Text type="secondary">暂无历史数据</Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default AgentDetail;
