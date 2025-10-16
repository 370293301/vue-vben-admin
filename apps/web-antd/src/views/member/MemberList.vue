<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';

import { reactive, ref, computed, nextTick, onMounted, onBeforeUnmount, watch } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Image, Input, message, Modal, Select } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { apiGetMemberList } from '#/api/member';
import MemberActions from '#/components/MemberActions.vue';
import { createTotalsThemeManager } from '#/utils/totalsThemeManager'; // 按你项目路径调整

const bannedCache: Record<number, boolean> = reactive({});

// 搜索状态
const searchState = reactive({
  field: 'uid' as 'nickname' | 'uid',
  keyword: '',
});
// 排序状态：0 默认、1 钻石降序、2 钻石升序、3 金豆降序、4 金豆升序
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
// 当前查询的目标 pid（用于“查看下级”功能）
// 初始为 AGENT_PID 或 ACCOUNT_ID（谁在请求）
const currentTargetPid = ref<number>(
  Number(
    localStorage.getItem('AGENT_PID') ??
      localStorage.getItem('ACCOUNT_ID') ??
      0,
  ),
);
// pid 历史栈：用于返回上一级
const pidStack = ref<number[]>([]);
// 全局统计数据
const stats = reactive({
  totalCount: 0,
  totalPages: 0,
  sumDiamond: 0,
  sumGold: 0,
});
// ---------- 新增：调整分成比例的 Modal 状态 ----------
const showRateModal = ref(false);
const rateInput = ref(''); // 文本输入，确认时转 Number
const selectedRowForRate = ref<any>(null);
const rateModalLoading = ref(false);
// 表格列同你的原来定义...
const columns: VxeGridProps<any>['columns'] = [
  { field: 'id', title: '玩家ID' },
  { field: 'headImageUrl', title: '头像', slots: { default: 'avatar' } },
  { field: 'name', title: '玩家名称'},
  { field: 'nobleLevel', title: '贵族等级' },
  { field: 'crystal', title: '剩余钻石' },
  { field: 'gold', title: '剩余金豆' },
  { field: 'remark', title: '备注' },
  {
    field: 'action',
    title: '操作',
    showOverflow: false,
    slots: { default: 'action' },
    width: 220,
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

        // 把 currentTargetPid 传给后端（作为 targetPid），无论是否搜索都传过去由后端/逻辑决定
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

        // 更新统计信息
        stats.sumDiamond = Number(payload.sumDiamond ?? 0);
        stats.sumGold = Number(payload.sumGold ?? 0);
        stats.totalPages = Number(payload.totalPages ?? 0);

        // 计算 total（优先后端 total；没有则尝试估算）
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
        console.log('Computed total:', rawList);

        const list = (rawList as any[]).map((it) => {
          const pid = Number(it.pid ?? it.id ?? 0);
          // 优先读取后端字段（it.isBanned / it.banned），若没有则使用本地缓存 bannedCache[pid]
          // const isBannedFromServer =
          //   it.isBanned === undefined
          //     ? it.banned === undefined
          //       ? undefined
          //       : !!it.banned)
          //     : !!it.isBanned;
          const isBannedFromServer = ('banned' in it)
            ? !!it.banned
            : ('isBanned' in it ? !!it.isBanned : undefined);
          const isBanned =
            typeof isBannedFromServer === 'boolean'
              ? isBannedFromServer
              : !!bannedCache[pid];

          return {
            id: pid,
            headImageUrl: it.headUrl ?? it.headImageUrl ?? it.avatar ?? '',
            name: it.name ?? it.nickname ?? '',
            nobleLevel: it.nobleLevel ?? it.level ?? 0,
            crystal: it.diamond ?? 0,
            gold: it.gold ?? it.bean ?? 0,
            remark: it.remark ?? it.setRemark ?? '',
            _raw: { ...it, pid, isBanned }, // 把 isBanned 放到 _raw
            isBanned, // 也把字段放到行顶层，方便模板判断
          };
        });

        return { items: list, total };
      },
    },
  },
};

const [Grid, gridApi] = useVbenVxeGrid<any>({ gridOptions });
// totals 表格的 DOM ref（独立一行合计）
const totalsTableRef = ref<HTMLElement | null>(null);

// function getFirstNonTransparentAncestor(el: Element | null) {
//   let cur: Element | null = el;
//   while (cur && cur.nodeType === 1) {
//     const cs = getComputedStyle(cur as Element);
//     const bgColor = cs.backgroundColor;
//     const bgImage = cs.backgroundImage;
//     // 判定为“有背景”的条件 —— 背景色不是 fully transparent 或有背景图片
//     const isBgColorVisible = !!bgColor && !bgColor.includes('rgba(0, 0, 0, 0)') && !bgColor.includes('transparent');
//     const hasBgImage = !!bgImage && bgImage !== 'none' && bgImage !== 'initial';
//     if (isBgColorVisible || hasBgImage) return cur;
//     cur = cur.parentElement;
//   }
//   return null;
// }
const vxeGridRef = ref<any>(null);


const totalsManager = createTotalsThemeManager({
  totalsTableRef,
  vxeGridRef,
  columns,
  stats,
});









onMounted(() => {
  // 等 DOM 渲染完后启动（nextTick 确保 template 中的 table 已存在）
  nextTick(() => {
    totalsManager.start();
  });
});

onBeforeUnmount(() => {
  totalsManager.stop();
});

// 当合计或列定义变化时再次同步（保证标题文本更新后宽度匹配）
watch([() => stats.sumDiamond, () => stats.sumGold, () => columns.length], () => {
  nextTick(() => totalsManager.sync());
});

// 当 sort 变化时触发重新加载（保持在当前页）
function onSortChange(v: number) {
  sortState.sortType = v;
  // reload 保留当前页，query 会重新根据 proxyConfig.query 请求
  gridApi.reload();
}
// 查看下级：把 currentTargetPid 设为当前行 pid 并回到第一页加载
function viewChildren(row: any) {
  const target = Number(row._raw?.pid ?? row.id ?? 0);
  if (!target) {
    message.warning('无效的子集 pid');
    return;
  }

  // push 当前 pid 到栈（用于返回）
  pidStack.value.push(currentTargetPid.value);

  // 设置为新的查询目标 pid（子级），并回到第一页加载
  currentTargetPid.value = target;

  // 可选：清空搜索关键字，避免搜索条件沿用（视你需求决定是否保留）
  // searchState.keyword = '';

  // reload 表格（通常会回到第一页）
  gridApi.reload();
}
// 返回上级：弹出栈顶，把 pid 设回并 reload
function goBack() {
  if (pidStack.value.length === 0) return;

  // 弹出上级 pid
  const prev = pidStack.value.pop() as number;
  currentTargetPid.value = prev;

  // reload 表格（回到上级列表）
  gridApi.reload();
}
</script>

<template>
  <Page auto-content-height>
    <!-- 独立的合计表格（放在 Grid 上方） -->
    <!-- 放在 Grid 之前（或你希望显示的位置），替换掉旧的 totals-only 表格 -->
    <table
      ref="totalsTableRef"
      class="totals-only"
      aria-hidden="true"
      style="border-collapse: collapse; width:100%; table-layout: fixed; margin-bottom:8px; display:none;"
    >
      <colgroup>
        <col v-for="col in columns" :key="col.field" />
      </colgroup>
      <thead>
      <tr>
        <th
          v-for="col in columns"
          :key="col.field"
          style="padding:6px 8px; font-weight:600; text-align:center; white-space:nowrap; min-height:36px; box-sizing:border-box;"
        >
          <template v-if="col.field === 'id'">合计</template>
          <template v-else-if="col.field === 'crystal'">{{ stats.sumDiamond }}</template>
          <template v-else-if="col.field === 'gold'">{{ stats.sumGold }}</template>
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
        </Select>
        <Input
          v-model:value="searchState.keyword"
          placeholder="搜索内容"
          allow-clear
          style="width: 220px; margin-right: 8px"
        />
        <!-- 新增：排序选择 -->
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

        <!-- 显示统计 & 当前查询对象 -->
        <div
          style="
            display: inline-flex;
            gap: 12px;
            align-items: center;
            margin-left: 16px;
          "
        >
          <div>当前查询 pid: {{ currentTargetPid }}</div>
          <!--          <div>总人数: {{ stats.totalCount }}</div>-->
          <!--          <div>总钻石: {{ stats.sumDiamond }}</div>-->
          <!--          <div>总金豆: {{ stats.sumGold }}</div>-->
        </div>

        <div style="display: inline-flex; gap: 8px; margin-left: 16px">
          <Button @click="() => gridApi.query()">刷新当前页</Button>
          <Button @click="() => gridApi.reload()">刷新并回到第一页</Button>
        </div>
        <div style="display: inline-flex; gap: 12px; align-items: center">
          <!--          <div>当前查询 pid: {{ currentTargetPid }}</div>-->
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
      <!-- header slots: 在列头内渲染合计 + 列标题（两行） -->
<!--      <template #header-name>-->
<!--        <div class="header-top-cell">总人数：{{ stats.totalCount }}</div>-->
<!--        <div class="header-bottom-cell">玩家名称</div>-->
<!--      </template>-->

<!--      <template #header-crystal>-->
<!--        <div class="header-top-cell">总钻石：{{ stats.sumDiamond }}</div>-->
<!--        <div class="header-bottom-cell">剩余钻石</div>-->
<!--      </template>-->

<!--      <template #header-gold>-->
<!--        <div class="header-top-cell">总金豆：{{ stats.sumGold }}</div>-->
<!--        <div class="header-bottom-cell">剩余金豆</div>-->
<!--      </template>-->
      <template #avatar="{ row }">
        <Image :src="row.headImageUrl" :width="40" :height="40" />
      </template>

      <template #action="{ row }">
        <!-- 使用抽离后的组件 -->
        <MemberActions
          :row="row"
          @view-children="viewChildren"
          @row-updated="
            (updated) => {
              // 合并更新字段到 row
              Object.assign(row, updated);
              if (updated._raw) {
                row._raw = Object.assign(row._raw || {}, updated._raw);
              }
              // 如果适配器提供 updateRow / refreshRow，调用它来局部刷新视图
              if (typeof gridApi.updateRow === 'function') {
                gridApi.updateRow(row);
              } else if (typeof gridApi.refreshRow === 'function') {
                gridApi.refreshRow(row);
              } else {
                // fallback: 轻触发重渲染
                row._tmpRerender = (row._tmpRerender || 0) + 1;
              }
            }
          "
        />
      </template>
    </Grid>
    <!-- 从属修改弹窗 -->
    <Modal
      v-model:open="showRecommendModal"
      title="从属修改 - 输入推荐者ID"
      ok-text="确认"
      cancel-text="取消"
      :confirm-loading="modalLoading"
      @ok="confirmRecommend"
      @cancel="cancelRecommend"
    >
      <div style="display: flex; flex-direction: column; gap: 8px">
        <div>请在下面输入新的推荐者ID（recommendId）：</div>
        <Input
          v-model:value="recommendIdInput"
          placeholder="推荐者ID（数字）"
        />
        <div style="font-size: 12px; color: var(--vben-text-3)">
          说明：requestPid 会使用当前 AGENT_PID（或 ACCOUNT_ID）
        </div>
      </div>
    </Modal>
    <!-- 调整充值分成比例弹窗 -->
    <Modal
      v-model:open="showRateModal"
      title="调整充值分成比例"
      ok-text="确认"
      cancel-text="取消"
      :confirm-loading="rateModalLoading"
      @ok="confirmRate"
      @cancel="cancelRate"
    >
      <div style="display: flex; flex-direction: column; gap: 8px">
        <div>请输入新的分成比例（0 - 100）：</div>
        <Input v-model:value="rateInput" placeholder="比例 例如：10 表示 10%" />
        <div style="font-size: 12px; color: var(--vben-text-3)">
          请求者 requestPid 将使用当前 AGENT_PID（或 ACCOUNT_ID）
        </div>
      </div>
    </Modal>
  </Page>
</template>
<style scoped>
.header-top-cell {
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--vben-text-2);
  text-align: center;
}

.header-bottom-cell {
  padding: 6px 8px;
  font-size: 13px;
  font-weight: 700;
  text-align: center;
}

/* 如果需要在顶部合计行靠左显示（例如 PID），可单独调整： */
.header-top-cell:first-child {
  justify-content: flex-start;
  padding-left: 12px;
}

.op-wrap {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}
.totals-only th {
  /*background: #fafafa;*/
  /*border-bottom: 1px solid #eee;*/
  box-sizing: border-box;
  padding: 6px 8px;
  font-size: 13px;
}
.totals-only {
  /*background: var(--vben-header-bg, transparent);*/
}
/*.totals-only th {*/
/*  color: var(--vben-text-1, #e6eef8) !important;*/
/*  font-weight: 600;*/
/*}*/
</style>
