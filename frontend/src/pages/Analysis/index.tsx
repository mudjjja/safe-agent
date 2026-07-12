import React, { useEffect, useState } from 'react';
import { Card, Row, Col, Typography, Spin, Select, Space, Statistic } from 'antd';
import {
  BarChartOutlined, LineChartOutlined,
  AlertOutlined, RiseOutlined,
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts/core';
import { BarChart, LineChart } from 'echarts/charts';
import {
  TooltipComponent, GridComponent, TitleComponent, LegendComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';
import { getAnalysisTrend, type AnalysisTrendResult, type DailyCount } from '../../api/analysis';
import { getLogStores } from '../../api/logs';

echarts.use([BarChart, LineChart, TooltipComponent, GridComponent, TitleComponent, LegendComponent, CanvasRenderer]);

const { Title } = Typography;

const AnalysisPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalysisTrendResult | null>(null);
  const [days, setDays] = useState(7);
  const [stores, setStores] = useState<string[]>([]);
  const [selectedStore, setSelectedStore] = useState<string>('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [trend, storeData] = await Promise.all([
        getAnalysisTrend(days, selectedStore || undefined),
        getLogStores().catch(() => []),
      ]);
      setData(trend);
      if (Array.isArray(storeData)) {
        setStores(storeData.map((s: any) => s.name));
      }
    } catch { /* handled */ }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, [days, selectedStore]);

  const severityColor: Record<string, string> = {
    low: '#52c41a', medium: '#faad14', high: '#fa8c16', critical: '#ff4d4f',
  };
  const severityLabel: Record<string, string> = {
    low: '低', medium: '中', high: '高', critical: '严重',
  };

  /** 日志趋势折线图 */
  const trendOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0];
        return `${p.axisValue}<br/>日志量: ${p.value} 条`;
      },
    },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: (data?.log_trend || []).map((d: DailyCount) => d.date),
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value', name: '条数' },
    series: [{
      data: (data?.log_trend || []).map((d: DailyCount) => d.count),
      type: 'line',
      smooth: true,
      lineStyle: { color: '#1890ff', width: 2 },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: 'rgba(24,144,255,0.3)' },
          { offset: 1, color: 'rgba(24,144,255,0.05)' },
        ]),
      },
      symbol: 'circle',
      symbolSize: 6,
    }],
  };

  /** 告警严重级别柱状图 */
  const severityOption = {
    tooltip: {
      trigger: 'axis',
      formatter: (params: any) => {
        const p = params[0];
        return `${severityLabel[p.name] || p.name}级告警<br/>数量: ${p.value} 条`;
      },
    },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: (data?.alert_severity || []).map((s: any) => severityLabel[s.severity] || s.severity),
      axisLabel: { fontSize: 11 },
    },
    yAxis: { type: 'value', name: '数量' },
    series: [{
      data: (data?.alert_severity || []).map((s: any) => ({
        value: s.count,
        itemStyle: { color: severityColor[s.severity] || '#1890ff' },
      })),
      type: 'bar',
      barWidth: '50%',
    }],
  };

  const totalLogs = (data?.log_trend || []).reduce((sum, d) => sum + d.count, 0);
  const totalAlerts = (data?.alert_severity || []).reduce((sum, s: any) => sum + s.count, 0);

  if (loading && !data) {
    return (
      <div style={{ textAlign: 'center', padding: 100 }}>
        <Spin size="large" tip="加载分析数据..." />
      </div>
    );
  }

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={4} style={{ margin: 0 }}>
          <BarChartOutlined style={{ marginRight: 8 }} />
          分析看板
        </Title>
        <Space>
          <Select
            allowClear placeholder="日志库" style={{ width: 140 }}
            value={selectedStore || undefined}
            onChange={(v) => setSelectedStore(v || '')}
            options={stores.map(s => ({ value: s, label: s }))}
          />
          <Select
            value={days}
            onChange={setDays}
            style={{ width: 100 }}
            options={[
              { value: 7, label: '近 7 天' },
              { value: 14, label: '近 14 天' },
              { value: 30, label: '近 30 天' },
            ]}
          />
        </Space>
      </div>

      {/* 统计卡片 */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <Card size="small">
            <Statistic title="日志总量" value={totalLogs} prefix={<LineChartOutlined />} valueStyle={{ color: '#1890ff' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic title="告警总数" value={totalAlerts} prefix={<AlertOutlined />} valueStyle={{ color: '#ff4d4f' }} />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="日均日志量"
              value={days ? Math.round(totalLogs / days) : 0}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card size="small">
            <Statistic
              title="严重告警"
              value={(data?.alert_severity || []).find((s: any) => s.severity === 'critical')?.count || 0}
              prefix={<AlertOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title={<><LineChartOutlined /> 日志趋势</>} size="small" styles={{ body: { padding: '12px 8px' } }}>
            <ReactECharts option={trendOption} style={{ height: 320 }} />
          </Card>
        </Col>
        <Col span={12}>
          <Card title={<><AlertOutlined /> 告警级别分布</>} size="small" styles={{ body: { padding: '12px 8px' } }}>
            <ReactECharts option={severityOption} style={{ height: 320 }} />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AnalysisPage;
