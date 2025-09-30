<script lang="ts" setup>
import type { Dayjs } from 'dayjs';

import type { VxeGridProps } from '#/adapter/vxe-table';

import { onMounted, reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, DatePicker, message, Select, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import * as echarts from 'echarts';

import { useVbenVxeGrid } from '#/adapter/vxe-table';

/** ======= 过滤条件 ======= */
const RangePicker = DatePicker.RangePicker;
const allMetrics = [
  '新注册用户',
  '新试玩用户',
  '日活跃用户',
  '老玩家登陆人数',
  '次日留存用户',
  '7日留存用户',
  '30日留存用户',
  '开房次数',
  '游戏总局数',
  '转发人数',
];
const filters = reactive({
  dates: [] as [] | [Dayjs, Dayjs],
  metrics: ['日活跃用户', '开房次数', '游戏总局数'] as string[],
});

/** ======= ECharts ======= */
const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;
function renderChart(x: string[], series: echarts.SeriesOption[]) {
  if (!chart && chartRef.value) chart = echarts.init(chartRef.value);
  if (!chart) return;
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { type: 'scroll', top: 10, right: 10 },
    grid: { left: 50, right: 20, top: 50, bottom: 40 },
    xAxis: { type: 'category', data: x },
    yAxis: { type: 'value', name: '数值' },
    series,
  });
  chart.resize();
}

/** ======= 表格 ======= */
type Row = {
  ['7日留存用户']: number;
  ['30日留存用户']: number;
  date: string;
  开房次数: number;
  新注册用户: number;
  新试玩用户: number;
  日活跃用户: number;
  次日留存用户: number;
  游戏总局数: number;
  老玩家登陆人数: number;
  转发人数: number;
};
const columns: VxeGridProps<Row>['columns'] = [
  { field: 'date', title: '日期', width: 120, fixed: 'left' },
  { field: '新注册用户', title: '新注册用户', width: 110 },
  { field: '新试玩用户', title: '新试玩用户', width: 110 },
  { field: '日活跃用户', title: '日活跃用户', width: 110 },
  { field: '老玩家登陆人数', title: '老玩家登陆人数', width: 130 },
  { field: '次日留存用户', title: '次日留存用户', width: 110 },
  { field: '7日留存用户', title: '7日留存用户', width: 110 },
  { field: '30日留存用户', title: '30日留存用户', width: 120 },
  { field: '开房次数', title: '开房次数', width: 100 },
  { field: '游戏总局数', title: '游戏总局数', width: 110 },
  { field: '转发人数', title: '转发人数', width: 100 },
];
const gridOptions: VxeGridProps<Row> = {
  columns,
  height: 380,
  border: true,
  stripe: true,
  data: [],
  pagerConfig: { currentPage: 1, pageSize: 10, pageSizes: [10, 20, 50] },
  toolbarConfig: { custom: true, export: false, refresh: false, zoom: false },
};
const [Grid, gridApi] = useVbenVxeGrid<Row>({ gridOptions });

/** ======= 造数/拉数 ======= */
/* 接口时把这里替换为你的请求，返回：
   dates: string[]，table: Row[]，series: {name,type:'line',data:number[]}[] */
async function fetchData(start: string, end: string, metrics: string[]) {
  const days = makeDateRange(start, end);
  // 表格行
  const table: Row[] = days.map((d) => {
    const r: any = { date: d };
    allMetrics.forEach((m) => (r[m] = randomForMetric(m)));
    return r as Row;
  });
  // 图表序列（只取选择的指标）
  const series = metrics.map((m) => ({
    name: m,
    type: 'line' as const,
    smooth: true,
    data: table.map((r) => r[m as keyof Row] as number),
  }));
  return { dates: days, table, series };
}

function randomForMetric(metric: string) {
  // 简单的范围差异：留存/转发较小，局数较大
  switch (metric) {
    case '7日留存用户':
    case '30日留存用户':
    case '次日留存用户':
    case '转发人数': {
      return rnd(0, 500);
    }
    case '开房次数': {
      return rnd(100, 8000);
    }
    case '游戏总局数': {
      return rnd(500, 30_000);
    }
    default: {
      return rnd(10, 5000);
    }
  }
}
function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
function makeDateRange(start: string, end: string) {
  const out: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

/** ======= 查询动作 ======= */
async function runQuery() {
  if (!Array.isArray(filters.dates) || filters.dates.length !== 2) {
    return message.info('请选择日期范围');
  }
  const [sd, ed] = filters.dates as [Dayjs, Dayjs];
  const start = sd.format('YYYY-MM-DD');
  const end = ed.format('YYYY-MM-DD');

  const { dates, table, series } = await fetchData(start, end, filters.metrics);
  renderChart(dates, series);
  gridApi.getTable?.()?.reloadData(table);
}

/** ======= 初始化 ======= */
onMounted(() => {
  filters.dates = [dayjs().subtract(6, 'day'), dayjs()] as [Dayjs, Dayjs];
  runQuery();
  window.addEventListener('resize', () => chart?.resize());
});
</script>

<template>
  <Page auto-content-height>
    <div class="panel">
      <div class="toolbar">
        <RangePicker
          v-model:value="filters.dates"
          :input-read-only="true"
          style="width: 280px"
        />
        <Select
          v-model:value="filters.metrics"
          mode="multiple"
          :max-tag-count="3"
          placeholder="选择指标"
          style="width: 360px"
        >
          <Select.Option v-for="m in allMetrics" :key="m" :value="m">
            {{ m }}
          </Select.Option>
        </Select>
        <Button type="primary" @click="runQuery">查询</Button>
        <Tag style="margin-left: 12px">统计维度：按日期 × 指标</Tag>
      </div>

      <div ref="chartRef" class="chart"></div>
      <Grid />
    </div>
  </Page>
</template>

<style scoped>
.panel {
  padding: 8px 12px 16px;
  background: #fff;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 0 12px;
}

.chart {
  width: 100%;
  height: 360px;
  margin-bottom: 12px;
}
</style>
