<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';
import type { Dayjs } from 'dayjs';

import { nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue';
import { Page } from '@vben/common-ui';
import { Button, DatePicker, message, Select, Tag, Pagination, Table } from 'ant-design-vue';
import dayjs from 'dayjs';
import * as echarts from 'echarts';

// 导入接口和游戏类型
import { agentGameRoomInfo } from '#/api/game';
import type { DailyStat, GameStatItem } from '#/api/game';
import gameTypeData from '#/data/gametype.json';

// ===== 游戏类型映射 =====
const gameTypeMap = new Map<number, string>();
Object.values(gameTypeData).forEach((game: any) => {
  gameTypeMap.set(game.Id, game.Name_1);
});

const allGameTypes = Array.from(gameTypeMap.entries()).map(([id, name]) => ({
  value: id,
  label: name,
}));

// ===== 过滤条件 =====
const RangePicker = DatePicker.RangePicker;
const filters = reactive({
  dates: [] as [] | [Dayjs, Dayjs],
  gameTypes: [] as number[],
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

// ===== 表格列定义 - Ant Design Table =====
const columns = [
  { title: '日期', dataIndex: 'date', width: 140, key: 'date' },
  { title: '游戏名称', dataIndex: 'gameName', width: 160, key: 'gameName' },
  { title: '大局数', dataIndex: 'roundCount', width: 120, key: 'roundCount' },
  { title: '小局数', dataIndex: 'totalSetCount', width: 120, key: 'totalSetCount' },
  { title: '当日总房间数', dataIndex: 'dailyRoomCount', width: 140, key: 'dailyRoomCount' },
];

// ===== 分页管理 =====
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
  pageSizeOptions: ['10', '20', '50'],
  showSizeChanger: true,
  showTotal: (total: number) => `共 ${total} 条记录`,
});

// ===== 表格数据 - ✅ 使用普通数组，避免 VxeGrid 问题 =====
const allTableData = ref<Row[]>([]);

// ===== 计算当前页数据 =====
function getPaginatedData(): Row[] {
  try {
    const start = (pagination.current - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;

    if (!Array.isArray(allTableData.value)) {
      console.warn('[getPaginatedData] 数据不是数组');
      return [];
    }

    const result = allTableData.value.slice(start, end);
    console.log('[getPaginatedData]', { start, end, total: allTableData.value.length, sliced: result.length });
    return result;
  } catch (error) {
    console.error('[getPaginatedData] 错误:', error);
    return [];
  }
}

// ===== 图表渲染 =====
function renderChart(dailyStats: DailyStat[]) {
  if (!chart && chartRef.value) {
    chart = echarts.init(chartRef.value);
  }
  if (!chart) return;

  try {
    const sortedDailyStats = [...dailyStats].sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateA.localeCompare(dateB);
    });

    const xData = sortedDailyStats.map((stat) => formatDate(stat.date));

    const gameTypeSet = new Set<number>();
    sortedDailyStats.forEach((dayStat) => {
      const gameStats = dayStat.gameStats || [];
      gameStats.forEach((gameStat) => {
        if (gameStat.gameType && gameStat.gameType !== 0) {
          gameTypeSet.add(gameStat.gameType);
        }
      });
    });

    if (gameTypeSet.size === 0) {
      chart.setOption(
        {
          tooltip: { trigger: 'axis' },
          legend: { data: [], top: 10, type: 'scroll' },
          grid: { left: 60, right: 40, top: 60, bottom: 40 },
          xAxis: { type: 'category', data: xData, boundaryGap: false },
          yAxis: { type: 'value', name: '大局数' },
          series: [],
        },
        { notMerge: true, replaceMerge: ['series'] },
      );
      return;
    }

    const series: any[] = [];
    gameTypeSet.forEach((gameType) => {
      const gameName = gameTypeMap.get(gameType) || `游戏${gameType}`;
      const data = sortedDailyStats.map((dayStat) => {
        const gameStats = dayStat.gameStats || [];
        const gameStat = gameStats.find((g) => g.gameType === gameType);
        return gameStat ? (gameStat.roundCount || 0) : 0;
      });

      series.push({
        name: gameName,
        type: 'line',
        smooth: true,
        data,
      });
    });

    chart.setOption(
      {
        tooltip: { trigger: 'axis', axisPointer: { type: 'cross' } },
        legend: { top: 10, type: 'scroll' },
        grid: { left: 60, right: 40, top: 60, bottom: 40 },
        xAxis: { type: 'category', data: xData, boundaryGap: false },
        yAxis: { type: 'value', name: '大局数' },
        series,
      },
      { notMerge: true, replaceMerge: ['series'] },
    );

    chart.resize();
  } catch (error) {
    console.error('[renderChart] 错误:', error);
  }
}

// ===== 日期格式化 =====
function formatDate(dateStr: string): string {
  if (dateStr.length === 8) {
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
  }
  return dateStr;
}

// ===== 构建表格数据 =====
function buildTableData(dailyStats: DailyStat[]): Row[] {
  const rows: Row[] = [];

  dailyStats.forEach((dayStat) => {
    const date = dayStat.date || '';
    const dailyRoomCount = dayStat.dailyRoomCount || 0;
    const gameStats = dayStat.gameStats || [];

    if (!Array.isArray(gameStats) || gameStats.length === 0) {
      return;
    }

    gameStats.forEach((gameStat: GameStatItem) => {
      const gameType = gameStat.gameType || 0;

      if (gameType === 0) {
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

  rows.sort((a, b) => {
    return b.date.localeCompare(a.date);
  });

  return rows;
}

// ===== 查询动作 =====
function runQuery() {
  if (!Array.isArray(filters.dates) || filters.dates.length !== 2) {
    message.info('请选择日期范围');
    return;
  }

  queryGameRoomInfo();
}

// ===== 查询游戏开房统计 =====
async function queryGameRoomInfo() {
  if (!Array.isArray(filters.dates) || filters.dates.length !== 2) {
    message.info('请选择日期范围');
    return;
  }

  const [startD, endD] = filters.dates as [Dayjs, Dayjs];
  const startTime = startD.startOf('day').valueOf();
  const endTime = endD.endOf('day').valueOf();

  const gameType = filters.gameTypes.length > 0 ? filters.gameTypes.join(',') : '';

  try {
    const resp = await agentGameRoomInfo({
      startTime,
      endTime,
      gameType,
    });

    const actualData = resp.data;

    const responseCode = actualData?.code ?? actualData?.data?.code ?? 0;
    if (responseCode !== 0 && responseCode !== undefined) {
      const errorMsg = actualData?.msg || actualData?.data?.msg || '获取数据失败';
      message.error(errorMsg);
      return;
    }

    const data = actualData?.data ?? actualData;
    if (!data) {
      message.warning('返回数据为空');
      return;
    }

    stats.totalRoomCount = data.totalRoomCount || 0;
    stats.totalDays = data.totalDays || 0;
    stats.startDate = data.startDate || '';
    stats.endDate = data.endDate || '';

    let dailyStats: DailyStat[] = data.dailyStats || [];

    dailyStats = dailyStats.sort((a, b) => {
      const dateA = a.date || '';
      const dateB = b.date || '';
      return dateA.localeCompare(dateB);
    });

    if (dailyStats.length === 0) {
      message.info(`查询到总房间数 ${stats.totalRoomCount}，但没有详细的每日统计数据`);

      if (chart) {
        chart.setOption(
          {
            tooltip: { trigger: 'axis' },
            legend: { data: [], top: 10, type: 'scroll' },
            grid: { left: 60, right: 40, top: 60, bottom: 40 },
            xAxis: { type: 'category', data: [], boundaryGap: false },
            yAxis: { type: 'value', name: '大局数' },
            series: [],
          },
          { notMerge: true, replaceMerge: ['series'] },
        );
      }

      allTableData.value = [];
      pagination.total = 0;
      pagination.current = 1;
      return;
    }

    renderChart(dailyStats);

    const rows = buildTableData(dailyStats);

    if (rows.length === 0) {
      message.info(`查询到总房间数 ${stats.totalRoomCount}，但该时间段内没有有效的游戏数据`);

      if (chart) {
        chart.setOption(
          {
            tooltip: { trigger: 'axis' },
            legend: { data: [], top: 10, type: 'scroll' },
            grid: { left: 60, right: 40, top: 60, bottom: 40 },
            xAxis: { type: 'category', data: [], boundaryGap: false },
            yAxis: { type: 'value', name: '大局数' },
            series: [],
          },
          { notMerge: true, replaceMerge: ['series'] },
        );
      }

      allTableData.value = [];
      pagination.total = 0;
      pagination.current = 1;
      return;
    }

    allTableData.value = rows;
    pagination.total = rows.length;
    pagination.current = 1;

    console.log('[queryGameRoomInfo] 数据更新完成，总行数:', rows.length);

  } catch (error) {
    console.error('[queryGameRoomInfo] 错误:', error);
    message.error('请求失败，请稍后重试');
  }
}

// ===== 生命周期 =====
onMounted(() => {
  filters.dates = [dayjs().subtract(6, 'day'), dayjs()] as [Dayjs, Dayjs];
  nextTick(() => {
    runQuery();
  });

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

      <!-- 表格 - ✅ 使用 Ant Design Table 而不是 VxeGrid -->
      <div class="table-wrapper">
        <Table
          :columns="columns"
          :data-source="getPaginatedData()"
          :pagination="pagination"
          :loading="false"
          :bordered="true"
          :size="'middle'"
          @change="(pag: any) => {
            pagination.current = pag.current;
            pagination.pageSize = pag.pageSize;
          }"
        />
      </div>
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
}

.table-wrapper {
  margin-top: 12px;
}
</style>
