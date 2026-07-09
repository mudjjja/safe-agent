import React, { useEffect, useState, useRef } from 'react';
import { Card, Row, Col, Typography, Spin, Alert, Statistic, Tag, Space } from 'antd';
import {
  ReloadOutlined,
  WarningOutlined,
  CheckCircleOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import ReactEChartsCore from 'echarts-for-react/lib/core';
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
import { getLatestMetrics, getHistoryMetrics, type MetricsData, type HistoryPoint } from '../../api/monitor';

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
      <ReactEChartsCore echarts={echarts} option={option} style={{ height: 180 }} />
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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchData = async () => {
    try {
      const [metrics, hist] = await Promise.all([
        getLatestMetrics(),
        getHistoryMetrics(60),
      ]);
      setLatest(metrics);
      setHistory(hist);
      setLastUpdate(new Date().toLocaleTimeString());
      setError('');
    } catch (err: any) {
      if (!latest) setError(err?.message || '获取监控数据失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    intervalRef.current = setInterval(fetchData, 5000);
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
        data: history.map((p) => p.memory_percent),
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

      {/* 4 个环形仪表盘 */}
      <Row gutter={[16, 16]}>
        <Col xs={12} sm={12} md={6}>
          <GaugeCard title="CPU" value={latest?.cpu_percent ?? 0} threshold={CPU_THRESHOLD} />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <GaugeCard title="内存" value={latest?.memory_percent ?? 0} threshold={MEM_THRESHOLD} />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <GaugeCard title="磁盘" value={latest?.disk_percent ?? 0} threshold={DISK_THRESHOLD} />
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card
            hoverable
            style={{ borderRadius: 10, height: '100%' }}
            bodyStyle={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', minHeight: 210 }}
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
          <ReactEChartsCore echarts={echarts} option={lineOption} style={{ height: 280 }} />
        ) : (
          <div style={{ height: 280, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
            <Text type="secondary">{loading ? '加载中...' : '暂无历史数据'}</Text>
          </div>
        )}
      </Card>
    </div>
  );
};

export default Dashboard;
