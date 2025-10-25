<script lang="ts" setup>

// ====== 基础 ======
import type { VxeGridProps } from '#/adapter/vxe-table';
import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';
import dayjs from 'dayjs';

import { Page } from '@vben/common-ui';
import { Button, Image, Input, message, Modal, Select, DatePicker } from 'ant-design-vue';
import { useVbenVxeGrid } from '#/adapter/vxe-table';

// 你已有组件/工具
import MemberActions from '#/components/MemberActions.vue';
import { createTotalsThemeManager } from '#/utils/totalsThemeManager';

// === MOD: 引入收益接口 ===
import { agentReqPayBack } from '#/api/game';

const bannedCache: Record<number, boolean> = reactive({});

// ====== 搜索 / 排序 / 目标PID ======
const searchState = reactive({
  field: 'uid' as 'uid' | 'nickname' | 'mark',
  keyword: '',
});

// === MOD: 收益排序（0默认、1贡献↓、2贡献↑、3我的收益↓、4我的收益↑） ===
const sortState = reactive({
  sortType: 0,
});
const sortOptions = [
  { label: '默认排序', value: 0 },
  { label: '贡献 ↓', value: 1 },
  { label: '贡献 ↑', value: 2 },
  { label: '我的收益 ↓', value: 3 },
  { label: '我的收益 ↑', value: 4 },
];

// === MOD: 日期（必传 timeSpace，未选则默认“今天0点”） ===
const filterDate = ref<Date | null>(null);
const timeRange = ref<[number, number] | null>(null);
// 当前查询的目标 pid（用于“查看下级”功能）
const currentTargetPid = ref<number>(
  Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0),
);
// pid 历史栈：用于返回上一级
const pidStack = ref<number[]>([]);

// ====== 合计/统计 ======
const stats = reactive({
  totalPages: 0,
  sumPayBack: 0,       // === MOD: 总收益
  sumContribution: 0,  // === MOD: 总贡献
});

// （若需要）调分成弹窗
const showRateModal = ref(false);
const rateInput = ref('');
const rateModalLoading = ref(false);

// ====== 列定义（收益维度） ======
const columns: VxeGridProps<any>['columns'] = [
  { field: 'pid', title: '玩家ID' }, // === MOD
  { field: 'headUrl', title: '头像', slots: { default: 'avatar' }, width: 90 },
  { field: 'level', title: '身份', width: 90 },
  { field: 'name', title: '玩家名称' },
  { field: 'contributions', title: '收益贡献', width: 120 },  // === MOD
  { field: 'revenueType', title: '收益类型', width: 120 },    // === MOD
  { field: 'revenue', title: '我的收益', width: 120 },        // === MOD
  {
    field: 'action',
    title: '操作',
    showOverflow: false,
    slots: { default: 'action' },
    width: 220,
  },
];

// ====== Grid 配置 ======
const gridOptions: VxeGridProps<any> = {
  columns,
  height: 'auto',
  pagerConfig: { currentPage: 1, pageSize: 10, pageSizes: [10, 20, 50, 100] },
  toolbarConfig: { custom: true, export: false, refresh: false, zoom: false },
  proxyConfig: {
    sort: false,
    ajax: {
      query: async ({ page }) => {
        // === MOD: ALWAYS 传 timeSpace & name（后端必填）
        const requestPid = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);
        // const timeSpaceMs = dayjs(filterDate.value ?? new Date()).startOf('day').valueOf(); // Long 毫秒
        let startTime = 0;
        let endTime = 0;
        if (timeRange.value && timeRange.value.length === 2) {
          startTime = Math.floor(timeRange.value[0] / 1000); // 转换为秒
          endTime = Math.floor(timeRange.value[1] / 1000);
        }
        // === MOD: 请求收益接口
        const resp = await agentReqPayBack({
          page: page.currentPage,
          pageSize: page.pageSize,
          field: searchState.field,
          keyword: searchState.keyword,
          sortType: sortState.sortType,
          targetPid: currentTargetPid.value,
          startTime,
          endTime,
          // date: filterDate.value ?? new Date(), // 兜底今天
        });

        const maybe = resp?.data ?? resp ?? {};
        const payload = maybe.data ?? maybe;
        const rawList = payload.listInfo ?? payload.list ?? [];

        // === MOD: 更新合计
        stats.sumPayBack = Number(payload.sumPayBack ?? payload.sumPayback ?? 0);
        stats.sumContribution = Number(payload.sumContribution ?? 0);
        stats.totalPages = Number(payload.totalPages ?? payload.total ?? 1);

        // 计算 total（优先后端 total；否则估算）
        let total = 0;
        if (typeof payload.total === 'number') {
          total = payload.total;
        } else if (payload.totalPages === 1) {
          total = Array.isArray(rawList) ? rawList.length : 0;
        } else if (typeof payload.totalPages === 'number' && payload.totalPages > 1) {
          total = payload.totalPages * page.pageSize;
        } else {
          total = Array.isArray(rawList) ? rawList.length : 0;
        }

        // === MOD: 规范化每行
        const list = (Array.isArray(rawList) ? rawList : []).map((it: any) => {
          const pid = Number(it.pid ?? it.id ?? 0);
          return {
            pid,
            headUrl: it.headUrl ?? it.avatar ?? it.headImageUrl ?? '',
            level: it.level ?? it.identity ?? 0,
            name: it.name ?? it.nickname ?? '',
            contributions: Number(it.contributions ?? it.contribution ?? 0),
            revenueType: it.revenueType ?? it.revenue_type ?? '',
            revenue: Number(it.revenue ?? it.myRevenue ?? it.revenueValue ?? 0),
            markStr: it.markStr ?? '',
            _raw: { ...it, pid },
          };
        });

        return { items: list, total };
      },
    },
  },
};

const [Grid, gridApi] = useVbenVxeGrid<any>({ gridOptions });

// ====== 合计行（顶置表） ======
const totalsTableRef = ref<HTMLElement | null>(null);
const vxeGridRef = ref<any>(null);
const totalsManager = createTotalsThemeManager({
  totalsTableRef,
  vxeGridRef,
  columns,
  stats,
});

onMounted(() => nextTick(() => totalsManager.start()
));

onBeforeUnmount(() => totalsManager.stop());
watch([() => stats.sumPayBack, () => stats.sumContribution, () => columns.length], () => {
  nextTick(() => totalsManager.sync());
});

// ====== 交互 ======
function onSortChange(v: number) {
  sortState.sortType = v;
  gridApi.reload();
}

function viewChildren(row: any) {
  const target = Number(row._raw?.pid ?? row.pid ?? 0);
  if (!target) {
    message.warning('无效的子集 pid');
    return;
  }
  pidStack.value.push(currentTargetPid.value);
  currentTargetPid.value = target;
  gridApi.reload();
}

function goBack() {
  if (!pidStack.value.length) return;
  const prev = pidStack.value.pop() as number;
  currentTargetPid.value = prev;
  gridApi.reload();
}

// 可选：调分成弹窗（保留）
function confirmRate() {
  rateModalLoading.value = true;
  setTimeout(() => {
    rateModalLoading.value = false;
    showRateModal.value = false;
  }, 600);
}
</script>

<template>
  <Page auto-content-height>
    <!-- === MOD: 顶部合计表（复制头背景，显示合计“贡献/收益”） === -->
    <table
      ref="totalsTableRef"
      class="totals-only"
      aria-hidden="true"
      style="display: none; width: 100%; margin-bottom: 8px; table-layout: fixed; border-collapse: collapse;"
    >
      <colgroup>
        <col v-for="col in columns" :key="col.field" />
      </colgroup>
      <thead>
      <tr>
        <th v-for="(col, idx) in columns" :key="col.field">
          <template v-if="idx === 0">合计</template>
          <template v-else-if="col.field === 'contributions'">{{ stats.sumContribution }}</template>
          <template v-else-if="col.field === 'revenue'">{{ stats.sumPayBack }}</template>
          <template v-else>&nbsp;</template>
        </th>
      </tr>
      </thead>
    </table>

    <Grid ref="vxeGridRef" table-title="玩家收益">
      <template #toolbar-tools>
        <!-- 搜索：ID / 姓名 -->
        <Select v-model:value="searchState.field" style="width: 120px; margin-right: 8px">
          <Select.Option value="uid">玩家ID</Select.Option>
          <Select.Option value="nickname">玩家名称</Select.Option>
          <Select.Option value="mark">备注标记</Select.Option>
        </Select>
        <Input v-model:value="searchState.keyword" placeholder="搜索内容" allow-clear style="width: 220px; margin-right: 8px" />

        <!-- 排序：贡献 / 我的收益 -->
        <Select v-model:value="sortState.sortType" @change="onSortChange" style="width: 160px; margin-right: 8px">
          <Select.Option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </Select.Option>
        </Select>

        <!-- === MOD: 日期选择（若未选，接口自动发今天0点） === -->
        <!-- ✅ 时间范围选择 -->
        <RangePicker
          v-model:value="timeRange"
          style="width: 280px; margin-right: 8px"
          placeholder="选择时间范围"
          show-time
        />

        <Button type="primary" @click="() => gridApi.query()">查询</Button>

        <!-- 当前对象 + 刷新 -->
        <div style="display: inline-flex; gap: 12px; align-items: center; margin-left: 16px;">
          <div>当前查询 pid: {{ currentTargetPid }}</div>
        </div>
        <div style="display: inline-flex; gap: 8px; margin-left: 16px">
          <Button @click="() => gridApi.query()">刷新当前页</Button>
          <Button @click="() => gridApi.reload()">刷新并回到第一页</Button>
        </div>

        <div style="display: inline-flex; gap: 12px; align-items: center">
          <Button v-if="pidStack.length > 0" type="default" style="margin-right: 8px" @click="goBack">返回上级</Button>
        </div>
      </template>

      <template #avatar="{ row }">
        <Image :src="row.headUrl" :width="40" :height="40" />
      </template>

      <template #action="{ row }">
        <MemberActions
          :row="row"
          @view-children="viewChildren"
          @row-updated="(updated) => {
            Object.assign(row, updated);
            if (updated._raw) row._raw = Object.assign(row._raw || {}, updated._raw);
            if (typeof gridApi.updateRow === 'function') gridApi.updateRow(row);
            else if (typeof gridApi.refreshRow === 'function') gridApi.refreshRow(row);
            else row._tmpRerender = (row._tmpRerender || 0) + 1;
          }"
        />
      </template>
    </Grid>

    <!-- 可选：调整充值分成比例弹窗 -->
    <Modal
      v-model:open="showRateModal"
      title="调整充值分成比例"
      ok-text="确认"
      cancel-text="取消"
      :confirm-loading="rateModalLoading"
      @ok="confirmRate"
      @cancel="() => (showRateModal = false)"
    >
      <div style="display: flex; flex-direction: column; gap: 8px">
        <div>请输入新的分成比例（0 - 100）：</div>
        <Input v-model:value="rateInput" placeholder="比例 例如：10 表示 10%" />
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.totals-only th {
  box-sizing: border-box;
  padding: 6px 8px;
  font-size: 13px;
}
</style>
