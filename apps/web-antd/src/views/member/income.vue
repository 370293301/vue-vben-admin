<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table'
import { reactive, ref } from 'vue'
import { Page } from '@vben/common-ui'
import { Button, Image, Input, Select, DatePicker, message, Row, Col, Statistic, Tag } from 'ant-design-vue'
import { useVbenVxeGrid } from '#/adapter/vxe-table'
import { apiGetMemberList } from '#/api/member' // 没有就用 axios.get 替换

type MemberRow = {
  id: number | string
  headImageUrl: string
  identity: string
  name: string
  incomeContrib: number
  incomeType: string
  myIncome: number
}

const RangePicker = DatePicker.RangePicker

// 顶部搜索状态
const searchState = reactive({
  field: 'uid',              // uid | nickname
  keyword: '',
  dates: [] as [string, string] | [],
})

// 顶部统计（中间那两个“30”、“100”）
const totalPlayers = ref<number>(30)
const myIncomeTotal = ref<number>(100)

// 表格列
const columns: VxeGridProps<MemberRow>['columns'] = [
  { type: 'seq', title: 'ID', width: 70 },
  { field: 'headImageUrl', title: '头像', width: 80, showOverflow: false, slots: { default: 'avatar' } },
  { field: 'identity', title: '身份', width: 100 },
  { field: 'name', title: '玩家名称', minWidth: 160 },
  { field: 'incomeContrib', title: '收益贡献', width: 110 },
  { field: 'incomeType', title: '收益类型', width: 100 },
  { field: 'myIncome', title: '我的收益', width: 110 },
  {
    field: 'action',
    title: '操作',
    minWidth: 520,
    showOverflow: false,
    fixed: 'right',
    slots: { default: 'action' },
  },
]

// 表格配置
const gridOptions: VxeGridProps<MemberRow> = {
  columns,
  height: 'auto',
  stripe: true,
  border: true,
  pagerConfig: { currentPage: 1, pageSize: 10, pageSizes: [10, 20, 50, 100] },
  toolbarConfig: { custom: true, export: false, refresh: false, zoom: false },
  proxyConfig: {
    sort: false,
    ajax: {
      query: async ({ page }) => {
        const [startAt, endAt] = (searchState.dates as any) || []
        const params = {
          page: page.currentPage,
          pageSize: page.pageSize,
          field: searchState.field,
          keyword: searchState.keyword,
          startAt,
          endAt,
        }
        // 如果没有封装 api：用 axios.get('http://127.0.0.1:5566/api/v1/agent/players', { params })
        const res = await apiGetMemberList(params)

        // ★ 按你的后端结构映射（下面只是示例字段名，照你的返回调整）
        // rows: res.data.data.list
        // total: res.data.data.total
        // summary: { totalPlayers, myIncomeTotal, myShareRate }
        const list = (res?.data?.data?.list ?? []) as MemberRow[]
        const total = res?.data?.data?.total ?? 0
        totalPlayers.value = res?.data?.data?.summary?.totalPlayers ?? totalPlayers.value
        myIncomeTotal.value = res?.data?.data?.summary?.myIncomeTotal ?? myIncomeTotal.value
        myShareRate.value = res?.data?.data?.summary?.myShareRate ?? myShareRate.value

        return { items: list, total }
      },
    },
  },
}

// 适配器
const [Grid, gridApi] = useVbenVxeGrid<MemberRow>({ gridOptions })

// 顶部“我的分成比例：80%”
const myShareRate = ref<number>(80)

// 操作列事件
function viewChildren(row: MemberRow) {
  message.info(`查看下级：${row.id}`)
}
function setPromoter(row: MemberRow) {
  message.success(`设为推广员：${row.id}`)
}
function setRemark(row: MemberRow) {
  message.info(`设置备注：${row.id}`)
}
function changeBelong(row: MemberRow) {
  message.info(`从属修改：${row.id}`)
}
function freeze(row: MemberRow) {
  message.warning(`冻结：${row.id}`)
}
function adjustShare(row: MemberRow) {
  message.info(`调整充值分成比例：${row.id}`)
}
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="玩家列表">
      <!-- 工具栏（与图一致：选择日期 / 分成比例 / 字段下拉 / 关键词 / search） -->
      <template #toolbar-tools>
        <RangePicker
          v-model:value="searchState.dates"
          style="width: 260px; margin-right: 8px"
          :allowClear="true"
          :inputReadOnly="true"
          placeholder="选择日期"
        />
        <Tag color="blue" style="margin-right: 12px">我的分成比例：{{ myShareRate }}%</Tag>

        <Select v-model:value="searchState.field" style="width: 120px; margin-right: 8px">
          <Select.Option value="uid">玩家ID</Select.Option>
          <Select.Option value="nickname">玩家名称</Select.Option>
        </Select>

        <Input
          v-model:value="searchState.keyword"
          placeholder="搜索内容"
          allow-clear
          style="width: 220px; margin-right: 8px"
        />
        <Button type="primary" @click="() => gridApi.commitProxy('query')">search</Button>

        <!-- 右侧刷新 -->
        <div style="display: inline-flex; gap: 8px; margin-left: 16px">
          <Button @click="() => gridApi.query()">刷新当前页</Button>
          <Button @click="() => gridApi.reload()">刷新并回到第一页</Button>
        </div>
      </template>

      <!-- 统计区（放在表格标题下，尽量还原中间“30 / 100”的效果） -->
      <template #toolbar-bottom>
        <Row justify="center" style="padding: 8px 0 4px">
          <Col :span="4" style="text-align: center">
            <Statistic :value="totalPlayers" title="玩家数" />
          </Col>
          <Col :span="4" style="text-align: center">
            <Statistic :value="myIncomeTotal" title="我的收益" />
          </Col>
        </Row>
      </template>

      <!-- 头像列 -->
      <template #avatar="{ row }">
        <Image :src="row.headImageUrl" :width="40" :height="40" />
      </template>

      <!-- 操作列 -->
      <template #action="{ row }">
        <div style="display: flex; flex-wrap: wrap; gap: 4px">
          <Button size="small" type="primary" ghost @click="viewChildren(row)">查看下级</Button>
          <Button size="small" type="primary" ghost @click="setPromoter(row)">设为推广员</Button>
          <Button size="small" @click="setRemark(row)">设置备注</Button>
          <Button size="small" @click="changeBelong(row)">从属修改</Button>
          <Button size="small" danger @click="freeze(row)">冻结</Button>
          <Button size="small" @click="adjustShare(row)">调整充值分成比例</Button>
        </div>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
/* 让工具栏元素更贴近原图的“扁平/紧凑”观感 */
:deep(.ant-select), :deep(.ant-input), :deep(.ant-picker) {
  height: 32px;
}
:deep(.ant-statistic-title) {
  font-size: 12px;
  color: #888;
}
:deep(.ant-statistic-content) {
  font-size: 20px;
  line-height: 20px;
  font-weight: 600;
}
</style>
