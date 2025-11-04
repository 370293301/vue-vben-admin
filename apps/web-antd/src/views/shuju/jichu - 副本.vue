<script lang="ts" setup>
import type { Dayjs } from 'dayjs';
import type { VxeGridProps } from '#/adapter/vxe-table';

import { onMounted, reactive, ref } from 'vue';
import { Page } from '@vben/common-ui';
import { Button, DatePicker, message, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import * as echarts from 'echarts';
import { useVbenVxeGrid } from '#/adapter/vxe-table';

// 导入接口
import { agentPlayerBaseInfo } from '#/api/game';
import type { DailyPlayerStat } from '#/api/game';

/** ======= 过滤条件 ======= */
const RangePicker = DatePicker.RangePicker;
const filters = reactive({
  dates: [] as [] | [Dayjs, Dayjs],
});

// 获取 AGENT_PID
const AGENT_PID = Number(
  localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0,
);

// 统计信息
const stats = reactive({
  startDate: '',
  endDate: '',
  totalDays: 0,
});

/** ======= ECharts ======= */
const chartRef = ref<HTMLDivElement | null>(null);
let chart: echarts.ECharts | null = null;

function renderChart(dailyStats: DailyPlayerStat[]) {
  if (!chart && chartRef.value) {
    chart = echarts.init(chartRef.value);
  }
  if (!chart) return;

  // X轴：日期
  const dates = dailyStats.map((item) => formatDate(item.date));

  // 定义所有可能的指标
  const allMetrics = [
    {
      name: '日活跃用户',
      data: dailyStats.map((item) => item.dailyActiveUserCount || 0),
    },
    {
      name: '新注册用户',
      data: dailyStats.map((item) => item.newRegUserCount || 0),
    },
    {
      name: '开房次数',
      data: dailyStats.map((item) => item.roomCount || 0),
    },
    {
      name: '游戏总局数',
      data: dailyStats.map((item) => item.totalGameSetCount || 0),
    },
    {
      name: '老玩家登录人数',
      data: dailyStats.map((item) => item.oldPlayerLoginCount || 0),
    },
    {
      name: '次日留存',
      data: dailyStats.map((item) => item.nextDayRetention || 0),
    },
    {
      name: '7日留存',
      data: dailyStats.map((item) => item.sevenDayRetention || 0),
    },
    {
      name: '30日留存',
      data: dailyStats.map((item) => item.thirtyDayRetention || 0),
    },
    {
      name: '总成员数',
      data: dailyStats.map((item) => item.totalMemberCount || 0),
    },
  ];

  // 打印每个指标的数据用于调试
  console.log('[renderChart] 所有指标数据:');
  allMetrics.forEach((metric) => {
    const sum = metric.data.reduce((a, b) => a + b, 0);
    const hasValue = metric.data.some((val) => val > 0);
    console.log(`  ${metric.name}:`, metric.data, `总和=${sum}, 有值=${hasValue}`);
  });

  // 过滤出有数据的指标（至少有一个非0值）
  const validMetrics = allMetrics.filter((metric) => {
    return metric.data.some((val) => val > 0);
  });

  console.log('[renderChart] 有效指标数量:', validMetrics.length);
  console.log('[renderChart] 有效指标:', validMetrics.map((m) => m.name));

  // 如果没有有效指标，清空图表
  if (validMetrics.length === 0) {
    chart.setOption(
      {
        title: { text: '暂无数据', left: 'center', top: 'center' },
        xAxis: { data: [] },
        yAxis: {},
        series: [],
      },
      { notMerge: true },
    );
    return;
  }

  // 构建系列（只包含有数据的指标）
  const series = validMetrics.map((metric) => ({
    name: metric.name,
    type: 'line',
    smooth: true,
    data: metric.data,
    symbol: 'circle',
    symbolSize: 6,
  }));

  chart.setOption(
    {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
      },
      legend: {
        type: 'scroll',
        orient: 'vertical',  // ✅ 纵向排列
        right: 10,
        top: 'center',       // 居中对齐
        data: validMetrics.map((m) => m.name),
      },
      grid: {
        left: 60,
        right: 150,  // 增加右侧空间，给图例留位置
        top: 40,
        bottom: 40,
      },
      xAxis: {
        type: 'category',
        data: dates,
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        name: '数量',
      },
      series,
    },
    {
      notMerge: true,
      replaceMerge: ['series'],
    },
  );

  chart.resize();
}

// 格式化日期
function formatDate(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

/** ======= 表格 ======= */
type Row = {
  date: string;
  新注册用户: number;
  新试玩用户: number;
  日活跃用户: number;
  老玩家登陆人数: number;
  次日留存用户: number;
  '7日留存用户': number;
  '30日留存用户': number;
  开房次数: number;
  游戏总局数: number;
  总成员数: number;
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
  { field: '总成员数', title: '总成员数', width: 110 },
];

const gridOptions: VxeGridProps<Row> = {
  columns,
  height: 380,
  border: true,
  stripe: true,
  pagerConfig: { currentPage: 1, pageSize: 10, pageSizes: [10, 20, 50] },
  toolbarConfig: { custom: true, export: false, refresh: false, zoom: false },
  proxyConfig: {
    ajax: {
      query: async ({ page }) => {
        console.log('[proxyConfig.query] 开始查询');

        // 检查日期范围
        if (!Array.isArray(filters.dates) || filters.dates.length !== 2) {
          message.info('请选择日期范围');
          return { items: [], total: 0 };
        }

        const [startD, endD] = filters.dates as [Dayjs, Dayjs];
        const startTime = startD.startOf('day').valueOf(); // 毫秒时间戳
        const endTime = endD.endOf('day').valueOf();

        console.log('[proxyConfig.query] 查询参数:', {
          requestPid: AGENT_PID,
          startTime,
          endTime,
        });

        try {
          // 调用接口
          const resp = await agentPlayerBaseInfo({
            requestPid: AGENT_PID,
            pagNum: page.currentPage,      // ✅ 新增
            showNum: page.pageSize,        // ✅ 新增
            startTime,
            endTime,
          });

          console.log('[proxyConfig.query] 接口响应:', resp);

          // 处理双层 data 结构：resp.data.data
          const actualData = resp?.data;
          console.log('[proxyConfig.query] actualData:', actualData);

          // 判断响应码
          const responseCode = actualData?.code ?? 0;
          if (responseCode !== 0 && responseCode !== undefined) {
            const errorMsg = actualData?.msg || '获取数据失败';
            message.error(errorMsg);
            return { items: [], total: 0 };
          }

          // 获取实际数据（第二层 data）
          const data = actualData?.data;
          console.log('[proxyConfig.query] data:', data);

          if (!data) {
            message.warning('返回数据为空');
            return { items: [], total: 0 };
          }

          // 更新统计信息
          stats.startDate = data.startDate || '';
          stats.endDate = data.endDate || '';
          stats.totalDays = data.totalDays || 0;

          const dailyStats = data.dailyStats || [];
          console.log('[proxyConfig.query] dailyStats 长度:', dailyStats.length);

          // 如果没有数据，清空图表
          if (dailyStats.length === 0) {
            message.info('该时间段内没有数据');
            if (chart) {
              chart.setOption(
                {
                  tooltip: { trigger: 'axis' },
                  legend: { data: [], top: 10, type: 'scroll' },
                  grid: { left: 60, right: 40, top: 60, bottom: 40 },
                  xAxis: {
                    type: 'category',
                    data: [],
                    boundaryGap: false,
                  },
                  yAxis: {
                    type: 'value',
                    name: '数量',
                  },
                  series: [],
                },
                {
                  notMerge: true,
                  replaceMerge: ['series'],
                },
              );
            }
            return { items: [], total: 0 };
          }

          // 渲染图表
          renderChart(dailyStats);

          // 构建表格数据
          const rows: Row[] = dailyStats.map((item: DailyPlayerStat) => {
            // 计算新试玩用户数（新注册用户 × 试玩比例）
            const newTrialCount = Math.round(
              (item.newRegUserCount || 0) * (item.trialPlayRatio || 0),
            );

            return {
              date: formatDate(item.date || ''),
              新注册用户: item.newRegUserCount || 0,
              新试玩用户: newTrialCount,
              日活跃用户: item.dailyActiveUserCount || 0,
              老玩家登陆人数: item.oldPlayerLoginCount || 0,
              次日留存用户: item.nextDayRetention || 0,
              '7日留存用户': item.sevenDayRetention || 0,
              '30日留存用户': item.thirtyDayRetention || 0,
              开房次数: item.roomCount || 0,
              游戏总局数: item.totalGameSetCount || 0,
              总成员数: item.totalMemberCount || 0,
            };
          });

          console.log('[proxyConfig.query] 表格数据行数:', rows.length);
          let total = 0;
          if (typeof data.totalCount === 'number') {
            total = data.totalCount;      // ✅ 新增：优先使用 totalCount
          } else if (typeof data.total === 'number') {
            total = data.total;
          } else {
            total = rows.length;          // 降级方案
          }
          return {
            items: rows,
            total,
          };
        } catch (error) {
          console.error('[proxyConfig.query] 错误:', error);
          message.error('请求失败，请稍后重试');
          return { items: [], total: 0 };
        }
      },
    },
  },
};

const [Grid, gridApi] = useVbenVxeGrid<Row>({ gridOptions });

/** ======= 查询动作 ======= */
function runQuery() {
  if (!Array.isArray(filters.dates) || filters.dates.length !== 2) {
    message.info('请选择日期范围');
    return;
  }
  console.log('[runQuery] 触发查询');
  gridApi.query();
}

/** ======= 初始化 ======= */
onMounted(() => {
  // 默认最近 7 天
  filters.dates = [dayjs().subtract(6, 'day'), dayjs()] as [Dayjs, Dayjs];
  runQuery();

  // 窗口自适应
  window.addEventListener('resize', () => chart?.resize());
});
</script>

<template>
  <Page auto-content-height>
    <div class="panel">
      <!-- 工具栏 -->
      <div class="toolbar">
        <RangePicker
          v-model:value="filters.dates"
          :input-read-only="true"
          style="width: 280px"
          :placeholder="['开始日期', '结束日期']"
        />
        <Button type="primary" @click="runQuery">查询</Button>
        <Tag style="margin-left: 12px" color="blue">
          统计天数：{{ stats.totalDays }} 天
        </Tag>
        <Tag v-if="stats.startDate">
          起始日期：{{ formatDate(stats.startDate) }}
        </Tag>
        <Tag v-if="stats.endDate">
          结束日期：{{ formatDate(stats.endDate) }}
        </Tag>
      </div>

      <!-- 图表 -->
      <div ref="chartRef" class="chart"></div>

      <!-- 表格 -->
      <Grid table-title="玩家基础信息统计" />
    </div>
  </Page>
</template>

<style scoped>
.panel {
  padding: 8px 12px 16px;
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 0 12px;
  flex-wrap: wrap;
}

.chart {
  width: 100%;
  height: 360px;
  margin-bottom: 12px;
}
</style>
