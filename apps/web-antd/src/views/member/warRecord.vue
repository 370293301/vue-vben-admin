<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';

import { reactive } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  DatePicker,
  Image,
  Input,
  message,
  Select,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
// 如果你有真实接口，换成你的请求方法
import { apiGetMemberList } from '#/api/member';

const { RangePicker } = DatePicker;

interface RecordRow {
  id: number | string;
  avatar: string; // 头像地址
  identity: string; // 身份
  nickname: string; // 玩家名称
  rounds: number; // 局数
  bigWinner: number; // 大赢家次数
  score: number; // 战绩得分
}

// 顶部筛选状态
const searchState = reactive({
  // 日期范围：['2025-09-01', '2025-09-27'] 等
  dateRange: [] as any[],
  field: 'uid', // uid | nickname
  keyword: '',
});

// 统计数字
const statState = reactive({
  s1: 20,
  s2: 30,
  s3: 20,
  s4: 100,
});

// 表格列
const columns: VxeGridProps<RecordRow>['columns'] = [
  { type: 'seq', title: 'ID', width: 60 },
  {
    field: 'avatar',
    title: '头像',
    width: 80,
    showOverflow: false,
    slots: { default: 'avatar' },
  },
  { field: 'identity', title: '身份', width: 100 },
  { field: 'nickname', title: '玩家名称', minWidth: 140 },
  { field: 'rounds', title: '局数', width: 80, sortable: true },
  { field: 'bigWinner', title: '大赢家', width: 90, sortable: true },
  {
    field: 'score',
    title: '战绩得分',
    width: 110,
    sortable: true,
    headerAlign: 'center',
    align: 'center',
    // 下划线效果交给样式
    slots: { default: 'score' },
  },
  {
    field: 'action',
    title: '操作',
    minWidth: 420,
    showOverflow: false,
    fixed: 'right',
    slots: { default: 'action' },
  },
];

// 表格配置（按你的适配器返回结构组装）
const gridOptions: VxeGridProps<RecordRow> = {
  columns,
  height: 'auto',
  border: true,
  stripe: true,
  pagerConfig: { currentPage: 1, pageSize: 10, pageSizes: [10, 20, 50, 100] },
  toolbarConfig: {
    custom: true,
    export: false,
    refresh: false,
    zoom: false,
  },
  proxyConfig: {
    sort: false,
    ajax: {
      // 列表查询
      query: async ({ page }) => {
        const [startDate, endDate] = searchState.dateRange ?? [];
        const params = {
          page: page.currentPage,
          pageSize: page.pageSize,
          field: searchState.field, // uid | nickname
          keyword: searchState.keyword, // 搜索词
          startDate,
          endDate,
        };

        // 这里用你的接口；如果没有，就把下方 mock 赋值给 items/total
        const res = await apiGetMemberList(params);

        // 假设你的接口返回结构：
        // { code: 0, data: { list: Row[], total: number, stat: { s1,s2,s3,s4 } } }
        const list = res?.data?.data?.list ?? [];
        const total = res?.data?.data?.total ?? 0;

        // 刷新统计区（若接口返回）
        if (res?.data?.data?.stat) {
          const { s1, s2, s3, s4 } = res.data.data.stat;
          statState.s1 = s1 ?? statState.s1;
          statState.s2 = s2 ?? statState.s2;
          statState.s3 = s3 ?? statState.s3;
          statState.s4 = s4 ?? statState.s4;
        }

        // 组装适配器需要的结构
        return { items: list, total };
      },
    },
  },
};

// 适配器
const [Grid, gridApi] = useVbenVxeGrid<RecordRow>({ gridOptions });

// —— 操作按钮事件（示例占位，与“玩家列表”一致） ——
function viewChildren(row: RecordRow) {
  message.info(`查看下级：${row.id}`);
}
function setPromoter(row: RecordRow) {
  message.success(`设为推广员：${row.id}`);
}
function setRemark(row: RecordRow) {
  message.info(`设置备注：${row.id}`);
}
function changeBelong(row: RecordRow) {
  message.info(`从属修改：${row.id}`);
}
function freeze(row: RecordRow) {
  message.warning(`冻结：${row.id}`);
}
function adjustShare(row: RecordRow) {
  message.info(`调整充值分成比例：${row.id}`);
}
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="玩家战绩">
      <!-- 顶部工具栏 -->
      <template #toolbar-tools>
        <!-- 选择日期 -->
        <RangePicker
          v-model:value="searchState.dateRange"
          style="width: 240px; margin-right: 12px"
          :placeholder="['开始日期', '结束日期']"
          allow-clear
        />

        <!-- 字段 + 关键字 -->
        <Select
          v-model:value="searchState.field"
          style="width: 120px; margin-right: 8px"
        >
          <Select.Option value="uid">玩家ID</Select.Option>
          <Select.Option value="nickname">玩家名称</Select.Option>
        </Select>
        <Input
          v-model:value="searchState.keyword"
          placeholder="搜索内容"
          allow-clear
          style="width: 220px; margin-right: 8px"
        />
        <Button type="primary" @click="() => gridApi.commitProxy('query')">
          search
        </Button>
      </template>

      <!-- 统计条（20 / 30 / 20 / 100） -->
      <template #toolbar-tools-after>
        <div class="stat-bar">
          <div class="stat-item">{{ statState.s1 }}</div>
          <div class="stat-item">{{ statState.s2 }}</div>
          <div class="stat-item">{{ statState.s3 }}</div>
          <div class="stat-item">{{ statState.s4 }}</div>
        </div>
      </template>

      <!-- 头像列 -->
      <template #avatar="{ row }">
        <Image :src="row.avatar" :width="36" :height="36" />
      </template>

      <!-- 战绩得分列（下划线效果） -->
      <template #score="{ row }">
        <span class="score-link">{{ row.score }}</span>
      </template>

      <!-- 操作列 -->
      <template #action="{ row }">
        <div class="op-wrap">
          <Button size="small" type="primary" ghost @click="viewChildren(row)">
            查看下级
          </Button>
          <Button size="small" type="primary" ghost @click="setPromoter(row)">
            设为推广员
          </Button>
          <Button size="small" @click="setRemark(row)">设置备注</Button>
          <Button size="small" @click="changeBelong(row)">从属修改</Button>
          <Button size="small" danger @click="freeze(row)">冻结</Button>
          <Button size="small" @click="adjustShare(row)">
            调整充值分成比例
          </Button>
        </div>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
/* 统计条样式，贴合你截图的 4 个数字一排 */
.stat-bar {
  display: inline-flex;
  gap: 40px;
  margin-left: 24px;
  vertical-align: middle;
}

.stat-item {
  min-width: 40px;
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}

/* 战绩得分下划线 */
.score-link {
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

/* 操作按钮区域：靠右对齐、自动换行 */
.op-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
</style>
