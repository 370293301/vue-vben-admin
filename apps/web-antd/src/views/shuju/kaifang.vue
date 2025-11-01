<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';
import type { Dayjs } from 'dayjs';

import { nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue';
import { Page } from '@vben/common-ui';
import { Button, DatePicker, message, Select, Tag } from 'ant-design-vue';
import dayjs from 'dayjs';
import * as echarts from 'echarts';
import { useVbenVxeGrid } from '#/adapter/vxe-table';

// 导入接口和游戏类型
import { agentGameRoomInfo } from '#/api/game';
import type { DailyStat, GameStatItem } from '#/api/game';
import gameTypeData from '#/data/gametype.json';

// ===== 游戏类型映射 =====
const gameTypeMap = new Map<number, string>();
Object.values(gameTypeData).forEach((game: any) => {
  gameTypeMap.set(game.Id, game.Name_1);
});

// 获取所有游戏类型选项
const allGameTypes = Array.from(gameTypeMap.entries()).map(([id, name]) => ({
  value: id,
  label: name,
}));

// ===== 过滤条件 =====
const RangePicker = DatePicker.RangePicker;
const filters = reactive({
  dates: [] as [] | [Dayjs, Dayjs],
  gameTypes: [] as number[], // 选中的游戏类型ID
});

// ===== 图表 =====
let chart: echarts.ECharts | null = null;
const chartRef = ref<HTMLDivElement | null>(null);

// ===== 统计信息 =====
const stats = reactive({
  totalRoomCount: 0,
  totalDays: 0,
  startDate: '',
  endDate: '',
});

// ===== 表格行类型 =====
type Row = {
  date: string;
  gameName: string;
  gameType: number;
  roundCount: number;
  totalSetCount: number;
  dailyRoomCount: number;
};

// ===== 列定义 =====
const columns: VxeGridProps<Row>['columns'] = [
  { field: 'date', title: '日期', width: 140 },
  { field: 'gameName', title: '游戏名称', minWidth: 160 },
  { field: 'roundCount', title: '大局数', width: 120 },
  { field: 'totalSetCount', title: '小局数', width: 120 },
  { field: 'dailyRoomCount', title: '当日总房间数', width: 140 },
];

// ===== Grid 配置（使用 proxyConfig） =====
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
        console.log('[proxyConfig.query] 开始查询，页码:', page.currentPage, '每页:', page.pageSize);

        // 检查日期范围
        if (!Array.isArray(filters.dates) || filters.dates.length !== 2) {
          message.info('请选择日期范围');
          return { items: [], total: 0 };
        }

        const [startD, endD] = filters.dates as [Dayjs, Dayjs];
        const startTime = startD.startOf('day').valueOf();
        const endTime = endD.endOf('day').valueOf();

        // 游戏类型参数
        const gameType = filters.gameTypes.length > 0 ? filters.gameTypes.join(',') : '';

        console.log('[proxyConfig.query] 查询参数:', { startTime, endTime, gameType });

        try {
          // 调用接口
          const resp = await agentGameRoomInfo({
            startTime,
            endTime,
            gameType,
          });

          const actualData = resp.data;
          console.log('[proxyConfig.query] 接口响应:', actualData);
          console.log('[proxyConfig.query] actualData.code:', actualData?.code);
          console.log('[proxyConfig.query] actualData.data:', actualData?.data);

          // 判断响应码（注意：code 可能在 actualData 中，也可能在 actualData.data 中）
          const responseCode = actualData?.code ?? actualData?.data?.code ?? 0;
          if (responseCode !== 0 && responseCode !== undefined) {
            const errorMsg = actualData?.msg || actualData?.statusText || actualData?.data?.msg || '获取数据失败';
            message.error(errorMsg);
            return { items: [], total: 0 };
          }

          // 获取实际数据（兼容两种结构）
          const data = actualData?.data ?? actualData;
          if (!data) {
            message.warning('返回数据为空');
            return { items: [], total: 0 };
          }

          console.log('[proxyConfig.query] 解析后的数据:', data);

          // 更新统计信息
          stats.totalRoomCount = data.totalRoomCount || 0;
          stats.totalDays = data.totalDays || 0;
          stats.startDate = data.startDate || '';
          stats.endDate = data.endDate || '';

          let dailyStats: DailyStat[] = data.dailyStats || [];

// ===== 新增：按日期正序排列 =====
          dailyStats = dailyStats.sort((a, b) => {
            const dateA = a.date || '';
            const dateB = b.date || '';
            return dateA.localeCompare(dateB);
          })
          console.log('[proxyConfig.query] dailyStats 长度:', dailyStats.length);

          // 如果 dailyStats 为空，清空图表
          if (dailyStats.length === 0) {
            message.info(`查询到总房间数 ${stats.totalRoomCount}，但没有详细的每日统计数据`);

            // 清空图表
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
                    name: '大局数(roundCount)',
                  },
                  series: [],
                },
                {
                  notMerge: true, // 完全替换
                  replaceMerge: ['series'],
                },
              );
            }

            return { items: [], total: 0 };
          }

          // 渲染图表
          renderChart(dailyStats);

          // 构建表格数据
          const rows: Row[] = [];
          dailyStats.forEach((dayStat, index) => {
            const date = dayStat.date || '';
            const dailyRoomCount = dayStat.dailyRoomCount || 0;
            const gameStats = dayStat.gameStats || [];

            console.log(`[proxyConfig.query] 处理第 ${index} 天:`, {
              date,
              dailyRoomCount,
              gameStatsLength: gameStats.length,
            });

            gameStats.forEach((gameStat: GameStatItem) => {
              const gameType = gameStat.gameType || 0;

              // 过滤掉 gameType 为 0 的无效数据
              if (gameType === 0) {
                console.log('[proxyConfig.query] 跳过 gameType=0');
                return;
              }

              const gameName = gameTypeMap.get(gameType) || `游戏${gameType}`;

              rows.push({
                date: formatDate(date),
                gameName,
                gameType,
                roundCount: gameStat.roundCount || 0,
                totalSetCount: gameStat.totalSetCount || 0,
                dailyRoomCount,
              });
            });
          });

          console.log('[proxyConfig.query] 表格数据行数:', rows.length);

          // 如果没有有效数据，清空图表
          rows.sort((a, b) => {
            return b.date.localeCompare(a.date); // 注意是 b - a，倒序
          });
          if (rows.length === 0) {
            message.info(`查询到总房间数 ${stats.totalRoomCount}，但该时间段内没有有效的游戏数据`);

            // 清空图表
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
                    name: '大局数(roundCount)',
                  },
                  series: [],
                },
                {
                  notMerge: true, // 完全替换
                  replaceMerge: ['series'],
                },
              );
            }
          }

          // 返回表格数据
          return {
            items: rows,
            total: rows.length,
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

// ===== 图表渲染 =====
function renderChart(dailyStats: DailyStat[]) {
  if (!chart && chartRef.value) {
    chart = echarts.init(chartRef.value);
  }
  if (!chart) return;

  console.log('[renderChart] dailyStats:', dailyStats);
  // ===== 新增：按日期正序排列 =====
  const sortedDailyStats = [...dailyStats].sort((a, b) => {
    const dateA = a.date || '';
    const dateB = b.date || '';
    return dateA.localeCompare(dateB); // 字符串比较，适用于 YYYYMMDD 格式
  });
  console.log('[renderChart] 排序后的数据:', sortedDailyStats);

  // X轴：日期（使用排序后的数据）
  const xData = dailyStats.map((stat) => formatDate(stat.date));
  // 收集所有有效的游戏类型
  const gameTypeSet = new Set<number>();
  dailyStats.forEach((dayStat) => {
    const gameStats = dayStat.gameStats || [];
    gameStats.forEach((gameStat) => {
      if (gameStat.gameType && gameStat.gameType !== 0) {
        gameTypeSet.add(gameStat.gameType);
      }
    });
  });

  console.log('[renderChart] 有效游戏类型:', Array.from(gameTypeSet));

  // 如果没有有效的游戏类型，显示空图表
  if (gameTypeSet.size === 0) {
    chart.setOption(
      {
        tooltip: { trigger: 'axis' },
        legend: {
          data: [],
          top: 10,
          type: 'scroll',
        },
        grid: {
          left: 60,
          right: 40,
          top: 60,
          bottom: 40,
        },
        xAxis: {
          type: 'category',
          data: xData.length > 0 ? xData : [],
          boundaryGap: false,
        },
        yAxis: {
          type: 'value',
          name: '大局数(roundCount)',
        },
        series: [],
      },
      {
        notMerge: true, // 完全替换配置，不合并
        replaceMerge: ['series'], // 替换 series
      },
    );
    console.log('[renderChart] 没有有效游戏类型，已清空图表');
    return;
  }

  // 为每个游戏类型构建一条折线
  const series: any[] = [];
  gameTypeSet.forEach((gameType) => {
    const gameName = gameTypeMap.get(gameType) || `游戏${gameType}`;
    const data = dailyStats.map((dayStat) => {
      const gameStats = dayStat.gameStats || [];
      const gameStat = gameStats.find((g) => g.gameType === gameType);
      return gameStat ? (gameStat.roundCount || 0) : 0;
    });

    console.log(`[renderChart] ${gameName} 数据:`, data);

    series.push({
      name: gameName,
      type: 'line',
      smooth: true,
      data,
    });
  });

  chart.setOption(
    {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross',
        },
      },
      legend: {
        top: 10,
        type: 'scroll',
      },
      grid: {
        left: 60,
        right: 40,
        top: 60,
        bottom: 40,
      },
      xAxis: {
        type: 'category',
        data: xData,
        boundaryGap: false,
      },
      yAxis: {
        type: 'value',
        name: '大局数(roundCount)',
      },
      series,
    },
    {
      notMerge: true, // 完全替换配置
      replaceMerge: ['series'], // 替换 series
    },
  );

  chart.resize();
  console.log('[renderChart] 图表渲染完成');
}

// ===== 日期格式化 =====
function formatDate(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

// ===== 查询动作 =====
function runQuery() {
  if (!Array.isArray(filters.dates) || filters.dates.length !== 2) {
    message.info('请选择日期范围');
    return;
  }
  console.log('[runQuery] 触发查询');
  gridApi.query();
}

// ===== 生命周期 =====
onMounted(() => {
  // 默认最近 7 天
  filters.dates = [dayjs().subtract(6, 'day'), dayjs()] as [Dayjs, Dayjs];
  nextTick(() => {
    runQuery();
  });

  // 窗口自适应
  window.addEventListener('resize', () => chart?.resize());
});

onBeforeUnmount(() => {
  if (chart) {
    chart.dispose();
    chart = null;
  }
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
        <Select
          v-model:value="filters.gameTypes"
          mode="multiple"
          :max-tag-count="2"
          placeholder="全部游戏（可多选）"
          style="width: 300px"
          allow-clear
        >
          <Select.Option
            v-for="item in allGameTypes"
            :key="item.value"
            :value="item.value"
          >
            {{ item.label }}
          </Select.Option>
        </Select>
        <Button type="primary" @click="runQuery">查询</Button>
      </div>

      <!-- 统计信息标签 -->
      <div class="stats-tags">
        <Tag color="blue">总房间数：{{ stats.totalRoomCount }}</Tag>
        <Tag color="green">统计天数：{{ stats.totalDays }} 天</Tag>
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
      <Grid table-title="游戏开房统计" />
    </div>
  </Page>
</template>

<style scoped>
.panel {
  padding: 8px 12px 16px;
  /*background: #fff;*/
}

.toolbar {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 8px 0 12px;
  flex-wrap: wrap;
}

.stats-tags {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 8px 0;
  flex-wrap: wrap;
}

.chart {
  width: 100%;
  height: 360px;
  margin: 12px 0;
  /*background: #fff;*/
}
</style>
