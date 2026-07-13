import React, { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Typography, Spin, Alert, Statistic, Tag, Space, Select } from 'antd';
import {
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  DesktopOutlined,
  FileTextOutlined,
  BellOutlined,
  RiseOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { GaugeChart } from 'echarts/charts';
import { LineChart } from 'echarts/charts';
import {
  TooltipComponent,
  GridComponent,
  TitleComponent,
  LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { getLatestMetrics, getHistoryMetrics, fetchAgentList, type MetricsData, type HistoryPoint } from '../../api/monitor';
import { getDashboardStats, type DashboardStats } from '../../api/dashboard';

echarts.use([GaugeChart, LineChart, TooltipComponent, GridComponent, TitleComponent, LegendComponent, CanvasRenderer]);

const { Title, Text } = Typography;

const CPU_THRESHOLD = 90;
const MEM_THRESHOLD = 95;
const DISK_THRESHOLD = 85;

/** 仪表盘刻度颜色分段 */
function getLevel(value: number, threshold: number): 'normal' | 'warning' | 'danger' {
  if (value >= threshold) return 'danger';
  if (value >= threshold * 0.85) return 'warning';
  return 'normal';
}

interface GaugeCardProps {
  title: string;
  value: number;
  unit?: string;
  threshold: number;
  color?: string;
  formatter?: string;
  decimals?: number;
}

const GaugeCard: React.FC<GaugeCardProps> = ({
  title, value, unit = '%', threshold, decimals = 1,
}) => {
  const level = getLevel(value, threshold);
  const colorMap = { normal: '#52c41a', warning: '#faad14', danger: '#ff4d4f' };
  const gaugeColor = colorMap[level];

  const option = {
    series: [{
      type: 'gauge',
      startAngle: 200,
      endAngle: -20,
      min: 0,
      max: 100,
      pointer: { show: true, length: '55%', width: 4, itemStyle: { color: gaugeColor } },
      progress: {
        show: true,
        width: 10,
        itemStyle: { color: gaugeColor },
      },
      axisLine: {
        lineStyle: { width: 10, color: [[threshold / 100, '#ff4d4f'], [1, '#f0f0f0']] },
      },
      axisTick: { show: false },
      splitLine: { show: false },
      axisLabel: { show: false },
      detail: {
        fontSize: 18,
        fontWeight: 'bold',
        color: gaugeColor,
        formatter: `{value}${unit}`,
        offsetCenter: [0, '40%'],
      },
      title: {
        offsetCenter: [0, '70%'],
        fontSize: 12,
        color: '#666',
      },
      data: [{ value: parseFloat(value.toFixed(decimals)), name: title }],
    }],
  };

  return (
    <Card
      hoverable
      style={{
        borderRadius: 10,
        border: level === 'danger' ? '1px solid #ff4d4f' : '1px solid #f0f0f0',
        boxShadow: level === 'danger' ? '0 2px 8px rgba(255,77,79,0.2)' : undefined,
      }}
    >
      <ReactECharts echarts={echarts} option={option} style={{ height: 180 }} />
      <div style={{ textAlign: 'center', marginTop: -8 }}>
        {level === 'danger' ? (
          <Tag color="error" icon={<WarningOutlined />}>异常</Tag>
        ) : level === 'warning' ? (
          <Tag color="warning">偏高</Tag>
        ) : (
          <Tag color="success" icon={<CheckCircleOutlined />}>正常</Tag>
        )}
      </div>
    </Card>
  );
};

const Dashboard: React.FC = () => {
  const [latest, setLatest] = useState<MetricsData | null>(null);
  const [history, setHistory] = useState<HistoryPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState('');
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [agents, setAgents] = useState<string[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async (agentId?: string) => {
    try {
      const agentList = await fetchAgentList();
      let targetAgent = agentId;
      if (agentList.length > 0) {
        setAgents(agentList);
        if (!targetAgent) {
          targetAgent = agentList[0];
          setSelectedAgent(agentList[0]);
        }
      }

      const [metrics, hist, dashboardStats] = await Promise.all([
        getLatestMetrics(targetAgent || undefined),
        getHistoryMetrics(60, targetAgent || undefined),
        getDashboardStats(),
      ]);
      setLatest(metrics);
      setHistory(hist);
      setStats(dashboardStats);
      setLastUpdate(new Date().toLocaleTimeString());
      setError('');
    } catch (err: any) {
      if (!latest) setError(err?.message || '获取监控数据失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAgentChange = (agentId: string) => {
    setSelectedAgent(agentId);
    fetchData(agentId);
  };

  useEffect(() => {
    fetchData(selectedAgent || undefined);
    intervalRef.current = setInterval(() => {
      fetchData(selectedAgent || undefined);
    }, 5000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  /** 折线图配置 */
  const lineOption = history.length > 0 ? {
    tooltip: { trigger: 'axis' as const },
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
    yAxis: {
      type: 'value' as const,
      min: 0,
      max: 100,
      axisLabel: { fontSize: 11, formatter: '{value}%' },
    },
    legend: { bottom: 0, icon: 'circle', itemWidth: 8 },
    series: [
      {
        name: 'CPU',
        type: 'line' as const,
        smooth: true,
        data: history.map((p) => p.cpu_percent),
        lineStyle: { width: 2 },
        itemStyle: { color: '#1890ff' },
        areaStyle: { color: 'rgba(24,144,255,0.1)' },
        markLine: {
          silent: true,
          data: [{ yAxis: CPU_THRESHOLD, label: { formatter: `阈值 ${CPU_THRESHOLD}%`, color: '#ff4d4f', fontSize: 10 } }],
          lineStyle: { color: '#ff4d4f', type: 'dashed' },
        },
      },
      {
        name: '内存',
        type: 'line' as const,
        smooth: true,
        data: history.map((p) => p.mem_percent),
        lineStyle: { width: 2 },
        itemStyle: { color: '#52c41a' },
        areaStyle: { color: 'rgba(82,196,26,0.1)' },
      },
      {
        name: '磁盘',
        type: 'line' as const,
        smooth: true,
        data: history.map((p) => p.disk_percent),
        lineStyle: { width: 2 },
        itemStyle: { color: '#faad14' },
        areaStyle: { color: 'rgba(250,173,20,0.1)' },
      },
    ],
  } : null;

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <DesktopOutlined style={{ marginRight: 8 }} />
          系统监控仪表盘
        </Title>
        <Space size="small">
          {agents.length > 0 && (
            <Select
              value={selectedAgent || undefined}
              onChange={handleAgentChange}
              style={{ width: 180 }}
              size="small"
              placeholder="选择 Agent"
              options={agents.map(a => ({ value: a, label: a }))}
            />
          )}
          {lastUpdate && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              <ReloadOutlined style={{ marginRight: 4 }} />
              上次更新: {lastUpdate}
            </Text>
          )}
          {loading && <Spin size="small" />}
        </Space>
      </div>

      {error && !latest && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      {/* 4 个统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="日志总量"
              value={stats?.total_metrics ?? 0}
              prefix={<FileTextOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
              suffix="条"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="今日采集"
              value={stats?.today_metrics ?? 0}
              prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              suffix="条"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="待处理告警"
              value={stats?.open_alerts ?? 0}
              prefix={<BellOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
              suffix="条"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small" hoverable>
            <Statistic
              title="Agent 在线"
              value={agents.length}
              prefix={<TeamOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
              suffix="台"
            />
          </Card>
        </Col>
      </Row>

      {/* 4 个环形仪表盘 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} md={6}>
          <GaugeCard title="CPU" value={latest?.cpu_percent ?? 0} threshold={CPU_THRESHOLD} />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <GaugeCard title="内存" value={latest?.mem_percent ?? 0} threshold={MEM_THRESHOLD} />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <GaugeCard title="磁盘" value={latest?.disk_percent ?? 0} threshold={DISK_THRESHOLD} />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card
            hoverable
            style={{ borderRadius: 10, height: '100%' }}
            styles={{ body: { display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 210 } }}
          >
            <Statistic
              title="网络接收"
              value={latest?.net_rx_bytes ? (latest.net_rx_bytes / 1024 / 1024).toFixed(1) : '0'}
              suffix="MB/s"
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
            />
            <div style={{ height: 16 }} />
            <Statistic
              title="网络发送"
              value={latest?.net_tx_bytes ? (latest.net_tx_bytes / 1024 / 1024).toFixed(1) : '0'}
              suffix="MB/s"
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
            />
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>实时流量</Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 折线图 */}
      <Card
        title="近 1 小时资源趋势"
        style={{ marginTop: 16, borderRadius: 10 }}
        styles={{ body: { padding: '16px 0 0 0' } }}
      >
        {lineOption ? (
          <ReactECharts echarts={echarts} option={lineOption} style={{ height: 280 }} />
        ) : (
          <div style={{ height: 280, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Text type="secondary">{loading ? '加载中...' : '暂无历史数据'}</Text>
          </div>
        )}
      </Card>

      {!latest && !loading && !error && (
        <Alert
          message="暂无监控数据"
          description="请确保 Agent 已启动并正在推送数据。在麒麟服务器上执行：export AGENT_ID=kylin-agent-01 && export ADMIN_URL=http://localhost:8080 && ./agent"
          type="info"
          showIcon
          style={{ marginTop: 16 }}
        />
      )}
    </div>
  );
};

export default Dashboard;
