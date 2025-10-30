<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';

import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { Page } from '@vben/common-ui';
import { Button, Image, Input, message, Modal, Select } from 'ant-design-vue';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { apiGetMemberList } from '#/api/member';
import MemberActions from '#/components/MemberActions.vue';
import { createTotalsThemeManager } from '#/utils/totalsThemeManager';
import { useResponsiveColumnWidth } from '#/composables/useResponsiveColumnWidth';

const bannedCache: Record<number, boolean> = reactive({});


// 搜索状态
const searchState = reactive({
  field: 'uid' as 'uid' | 'nickname' | 'mark',
  keyword: '',
});

// 排序状态
const sortState = reactive({
  sortType: 0,
});

const sortOptions = [
  { label: '默认排序', value: 0 },
  { label: '钻石 ↓', value: 1 },
  { label: '钻石 ↑', value: 2 },
  { label: '金豆 ↓', value: 3 },
  { label: '金豆 ↑', value: 4 },
];

const currentTargetPid = ref<number>(
  Number(
    localStorage.getItem('AGENT_PID') ??
    localStorage.getItem('ACCOUNT_ID') ??
    0,
  ),
);

const pidStack = ref<number[]>([]);

const stats = reactive({
  totalCount: 0,
  totalPages: 0,
  sumDiamond: 0,
  sumGold: 0,
});

const showRateModal = ref(false);
const rateInput = ref('');
const selectedRowForRate = ref<any>(null);
const rateModalLoading = ref(false);

// 表格列定义
const columns: VxeGridProps<any>['columns'] = [
  { field: 'id', title: '玩家ID', slots: { default: 'cell-id' } },
  { field: 'headImageUrl', title: '头像', slots: { default: 'avatar' } },
  { field: 'name', title: '玩家名称', slots: { default: 'cell-name' } },
  { field: 'level', title: '身份' },
  { field: 'crystal', title: '剩余钻石' },
  { field: 'gold', title: '剩余金豆' },
  { field: 'markStr', title: '备注' },
  { field: 'lowNum', title: '下级数量' },
  { field: 'fenCheng', title: '分成' },
  {
    field: 'action',
    title: '操作',
    showOverflow: false,
    slots: { default: 'action' },
    width: 220,
    minWidth: 100,
  },
];

const gridOptions: VxeGridProps<any> = {
  columns,
  height: 'auto',
  pagerConfig: { currentPage: 1, pageSize: 10, pageSizes: [10, 20, 50, 100] },
  toolbarConfig: { custom: true, export: false, refresh: false, zoom: false },
  proxyConfig: {
    sort: false,
    ajax: {
      query: async ({ page }) => {
        const params = {
          page: page.currentPage,
          pageSize: page.pageSize,
          field: searchState.field,
          keyword: searchState.keyword,
        };

        const res = await apiGetMemberList({
          field: params.field,
          keyword: params.keyword,
          page: params.page,
          pageSize: params.pageSize,
          extra: {
            targetPid: currentTargetPid.value,
            sortType: sortState.sortType,
          },
        });

        const payload = res?.data?.data ?? {};
        const rawList = payload.listInfo ?? (payload as any).list ?? [];

        stats.sumDiamond = Number(payload.sumDiamond ?? 0);
        stats.sumGold = Number(payload.sumGold ?? 0);
        stats.totalPages = Number(payload.totalPages ?? 0);

        let total = 0;
        if (typeof (payload as any).total === 'number') {
          total = (payload as any).total;
        } else if (payload.totalPages === 1) {
          total = Array.isArray(rawList) ? rawList.length : 0;
        } else if (
          typeof payload.totalPages === 'number' &&
          payload.totalPages > 1
        ) {
          total = payload.totalPages * page.pageSize;
        } else {
          total = Array.isArray(rawList) ? rawList.length : 0;
        }
        stats.totalCount = total;

        const list = (rawList as any[]).map((it) => {
          const pid = Number(it.pid ?? it.id ?? 0);
          const isBannedFromServer =
            'banned' in it
              ? !!it.banned
              : 'isBanned' in it
                ? !!it.isBanned
                : undefined;
          const isBanned =
            typeof isBannedFromServer === 'boolean'
              ? isBannedFromServer
              : !!bannedCache[pid];

          return {
            id: pid,
            headImageUrl: it.headUrl ?? it.headImageUrl ?? it.avatar ?? '',
            name: it.name ?? it.nickname ?? '',
            level: it.level ?? 0,
            crystal: it.diamond ?? 0,
            gold: it.gold ?? it.bean ?? 0,
            markStr: it.markStr ?? '',
            lowNum: it.lowNum ?? 0,
            fenCheng: it.fenCheng != null ? it.fenCheng + '%' : '',
            _raw: { ...it, pid, isBanned },
            isBanned,
          };
        });

        return { items: list, total };
      },
    },
  },
};

const [Grid, gridApi] = useVbenVxeGrid<any>({ gridOptions });

const totalsTableRef = ref<HTMLElement | null>(null);
const vxeGridRef = ref<any>(null);

const totalsManager = createTotalsThemeManager({
  totalsTableRef,
  vxeGridRef,
  columns,
  stats,
});


// ✅ 使用 composable 替代原来的代码
// const { isMobile } = useResponsiveColumnWidth({
//   columns,
//   gridApi,
//   columnField: 'action',
//   mobileWidth: undefined, // 手机端自适应
//   pcWidth: 320,           // PC端固定220px
//   breakpoint: 768,
// });
// 生命周期钩子
onMounted(() => {
  // 初始化 isMobile
  // isMobile.value = window.innerWidth <= mobileBreakpoint;
  //
  // // 添加 resize 监听
  // window.addEventListener('resize', handleResize);

  nextTick(() => {
    totalsManager.start();
    // updateActionColumnWidth();
  });
});

onBeforeUnmount(() => {
  // window.removeEventListener('resize', handleResize);
  totalsManager.stop();
});

watch(
  [() => stats.sumDiamond, () => stats.sumGold, () => columns.length],
  () => {
    nextTick(() => {
      totalsManager.sync();
    });
  },
);

function onSortChange(v: number) {
  sortState.sortType = v;
  gridApi.reload();
}

function viewChildren(row: any) {
  const target = Number(row._raw?.pid ?? row.id ?? 0);
  if (!target) {
    message.warning('无效的子集 pid');
    return;
  }

  pidStack.value.push(currentTargetPid.value);
  currentTargetPid.value = target;
  gridApi.reload();
}

function goBack() {
  if (pidStack.value.length === 0) return;
  const prev = pidStack.value.pop() as number;
  currentTargetPid.value = prev;
  gridApi.reload();
}
</script>

<template>
  <Page auto-content-height>
    <table
      ref="totalsTableRef"
      class="totals-only"
      aria-hidden="true"
      style="
        display: none;
        width: 100%;
        margin-bottom: 8px;
        table-layout: fixed;
        border-collapse: collapse;
      "
    >
      <colgroup>
        <col v-for="col in columns" :key="col.field" />
      </colgroup>
      <thead>
      <tr>
        <th v-for="col in columns" :key="col.field">
          <template v-if="col.field === 'id'">合计</template>
          <template v-else-if="col.field === 'crystal'">
            {{ stats.sumDiamond }}
          </template>
          <template v-else-if="col.field === 'gold'">
            {{ stats.sumGold }}
          </template>
          <template v-else>&nbsp;</template>
        </th>
      </tr>
      </thead>
    </table>

    <Grid ref="vxeGridRef" table-title="玩家列表">
      <template #toolbar-tools>
        <Select
          v-model:value="searchState.field"
          style="width: 120px; margin-right: 8px"
        >
          <Select.Option value="uid">玩家ID</Select.Option>
          <Select.Option value="nickname">玩家名称</Select.Option>
          <Select.Option value="mark">备注标记</Select.Option>
        </Select>
        <Input
          v-model:value="searchState.keyword"
          placeholder="搜索内容"
          allow-clear
          style="width: 220px; margin-right: 8px"
        />
        <Select
          v-model:value="sortState.sortType"
          @change="onSortChange"
          style="width: 140px; margin-right: 8px"
        >
          <Select.Option
            v-for="opt in sortOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </Select.Option>
        </Select>
        <Button type="primary" @click="() => gridApi.query()">search</Button>

        <div style="display: inline-flex; gap: 12px; align-items: center; margin-left: 16px">
          <div>当前查询 pid: {{ currentTargetPid }}</div>
        </div>

        <div style="display: inline-flex; gap: 8px; margin-left: 16px">
          <Button @click="() => gridApi.query()">刷新当前页</Button>
          <Button @click="() => gridApi.reload()">刷新并回到第一页</Button>
        </div>
        <div style="display: inline-flex; gap: 12px; align-items: center">
          <Button
            v-if="pidStack.length > 0"
            type="default"
            style="margin-right: 8px"
            @click="goBack"
          >
            返回上级
          </Button>
        </div>
      </template>

      <template #cell-id="{ row }">
        <span :class="{ 'level-1': row.level === 1 }">{{ row.id }}</span>
      </template>

      <template #cell-name="{ row }">
        <span :class="{ 'level-1': row.level === 1 }">{{ row.name }}</span>
      </template>

      <template #avatar="{ row }">
        <Image :src="row.headImageUrl" :width="40" :height="40" />
      </template>

      <template #action="{ row }">
        <MemberActions
          :row="row"
          @view-children="viewChildren"
          @row-updated="
            (updated) => {
              Object.assign(row, updated);
              if (updated._raw) {
                row._raw = Object.assign(row._raw || {}, updated._raw);
              }
              if (typeof gridApi.updateRow === 'function') {
                gridApi.updateRow(row);
              } else if (typeof gridApi.refreshRow === 'function') {
                gridApi.refreshRow(row);
              } else {
                row._tmpRerender = (row._tmpRerender || 0) + 1;
              }
            }
          "
        />
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.level-1 {
  color: #ff4d4f;
  font-weight: 600;
}

/*.totals-only th {*/
/*  box-sizing: border-box;*/
/*  padding: 4px 6px; !* ✅ 从 6px 8px 改为 4px 6px *!*/
/*  font-size: 13px;*/
/*}*/

/* ✅ CSS 媒体查询 - 控制操作列宽度 */
@media (max-width: 768px) {
  :deep(.vxe-table) {
    table-layout: auto !important;
  }

  :deep(.vxe-table colgroup col:last-child) {
    width: auto !important;
  }

  :deep(.vxe-table .vxe-header--column:last-child),
  :deep(.vxe-table .vxe-body--column:last-child) {
    width: 80px !important;
    min-width: 80px !important;
  }


  /* ✅ 手机端操作列内边距设为 0 */
  :deep(.vxe-table .vxe-body--column:last-child .vxe-cell) {
    padding: 0 !important;
  }

  :deep(.vxe-table .vxe-header--column:last-child .vxe-cell) {
    padding: 0 4px !important;
  }
}

@media (min-width: 769px) {
  :deep(.vxe-table colgroup col:last-child) {
    width: 220px !important;
  }

  :deep(.vxe-table .vxe-header--column:last-child),
  :deep(.vxe-table .vxe-body--column:last-child) {
    width: 220px !important;
  }
}
</style>
