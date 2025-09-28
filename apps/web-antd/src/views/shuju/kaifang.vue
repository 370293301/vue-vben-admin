<script lang="ts" setup>
import { ref, reactive, onMounted } from 'vue'
import { Page } from '@vben/common-ui'
import { Button, Select, DatePicker, message, Tag } from 'ant-design-vue'
import * as echarts from 'echarts'
import { useVbenVxeGrid } from '#/adapter/vxe-table'
import type { VxeGridProps } from '#/adapter/vxe-table'
import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'

// ===== 过滤条件 =====
const RangePicker = DatePicker.RangePicker
const filters = reactive({
  dates: [] as [Dayjs, Dayjs] | [],
  games: ['炸金花', '斗地主'] as string[],
})
const allGames = ref<string[]>(['炸金花', '斗地主', '牛牛', '捕鱼', '梭哈'])

// ===== 图表 =====
let chart: echarts.ECharts | null = null
const chartRef = ref<HTMLDivElement | null>(null)

// ===== 表格 =====
type Row = { date: string; game: string; rooms: number; dayTotal: number }
const columns: VxeGridProps<Row>['columns'] = [
  { field: 'date', title: '日期', width: 140 },
  { field: 'game', title: '游戏种类', minWidth: 160 },
  { field: 'rooms', title: '消耗数量', width: 120 },
  { field: 'dayTotal', title: '房间总数', width: 120 },
]

const gridOptions: VxeGridProps<Row> = {
  columns,
  height: 380,
  border: true,
  stripe: true,
  data: [],
  pagerConfig: { currentPage: 1, pageSize: 10, pageSizes: [10, 20, 50] },
  toolbarConfig: { custom: true, export: false, refresh: false, zoom: false },
}
const [Grid, gridApi] = useVbenVxeGrid<Row>({ gridOptions })

// ===== 数据获取（示例造数；接接口时替换） =====
async function fetchData(start: string, end: string) {
  // 真实接口示例：
  // const res = await axios.get('/api/v1/analytics/open-rooms', {
  //   params: { startAt: start, endAt: end, games: filters.games.join(',') }
  // })
  // return res.data

  const days = makeDateRange(start, end)
  const rows: Row[] = []
  const series = filters.games.map((g) => ({
    name: g,
    type: 'line' as const,
    smooth: true,
    data: days.map(() => rnd(50, 350)),
  }))
  days.forEach((d, i) => {
    const total = series.reduce((s, srs) => s + (srs.data[i] as number), 0)
    filters.games.forEach((g, gi) => {
      rows.push({ date: d, game: g, rooms: series[gi].data[i] as number, dayTotal: total })
    })
  })
  return { x: days, series, rows }
}
function rnd(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}
function makeDateRange(start: string, end: string) {
  const out: string[] = []
  const s = new Date(start); const e = new Date(end)
  for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
    out.push(d.toISOString().slice(0, 10))
  }
  return out
}

// ===== 图表渲染 =====
function renderChart(x: string[], series: any[]) {
  if (!chart && chartRef.value) chart = echarts.init(chartRef.value)
  if (!chart) return
  chart.setOption({
    tooltip: { trigger: 'axis' },
    legend: { top: 10 },
    grid: { left: 40, right: 20, top: 40, bottom: 40 },
    xAxis: { type: 'category', data: x },
    yAxis: { type: 'value', name: '房间数' },
    series,
  })
  chart.resize()
}

// ===== 查询动作 =====
async function runQuery() {
  if (!Array.isArray(filters.dates) || filters.dates.length !== 2) {
    message.info('请选择日期范围')
    return
  }
  const [startD, endD] = filters.dates as [Dayjs, Dayjs]
  const start = startD.format('YYYY-MM-DD')
  const end   = endD.format('YYYY-MM-DD')

  const { x, series, rows } = await fetchData(start, end)
  renderChart(x, series)

  gridApi.getTable?.()?.reloadData(rows)
}

onMounted(() => {
  // 默认最近 7 天（Dayjs 对象）
  filters.dates = [dayjs().subtract(6, 'day'), dayjs()] as [Dayjs, Dayjs]
  runQuery()
  // 自适应
  window.addEventListener('resize', () => chart?.resize())
})
</script>

<template>
  <Page auto-content-height>
    <div class="panel">
      <div class="toolbar">
        <RangePicker
          v-model:value="filters.dates"
          :inputReadOnly="true"
          style="width: 280px"
        />
        <Select
          v-model:value="filters.games"
          mode="multiple"
          :maxTagCount="2"
          placeholder="选择游戏种类"
          style="width: 260px"
        >
          <Select.Option v-for="g in allGames" :key="g" :value="g">{{ g }}</Select.Option>
        </Select>
        <Button type="primary" @click="runQuery">查询</Button>
        <Tag style="margin-left: 12px">统计维度：按日期 × 游戏种类</Tag>
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
  align-items: center;
  gap: 12px;
  padding: 8px 0 12px;
}
.chart {
  width: 100%;
  height: 360px;
  margin-bottom: 12px;
  background: #fff;
}
</style>
