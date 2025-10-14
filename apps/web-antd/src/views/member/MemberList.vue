<script lang="ts" setup>
import MemberActions from '#/components/MemberActions.vue';
import type { VxeGridProps } from '#/adapter/vxe-table';
import { reactive, ref } from 'vue';
import { Page } from '@vben/common-ui';

import { Button, Image, Input, message, Select, Modal } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { apiGetMemberList,apiSetPromoter, apiSetRemark, apiSetRecommend, apiBanGame, apiSetRate } from '#/api/member';
const bannedCache: Record<number, boolean> = reactive({});

// 搜索状态
const searchState = reactive({
  field: 'uid' as 'uid' | 'nickname',
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
  Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0)
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
  { field: 'name', title: '玩家名称' },
  { field: 'nobleLevel', title: '贵族等级' },
  { field: 'crystal', title: '剩余钻石' },
  { field: 'gold', title: '剩余金豆' },
  { field: 'remark', title: '备注' },
  { field: 'action', title: '操作', showOverflow: false, slots: { default: 'action' } },
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
          extra: { targetPid: currentTargetPid.value,sortType: sortState.sortType  },
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
        } else if (typeof payload.totalPages === 'number' && payload.totalPages > 1) {
          total = payload.totalPages * page.pageSize;
        } else {
          total = Array.isArray(rawList) ? rawList.length : 0;
        }
        stats.totalCount = total;
        console.log('Computed total:', rawList);

        const list = (rawList as any[]).map((it) => {
          const pid = Number(it.pid ?? it.id ?? 0);
          // 优先读取后端字段（it.isBanned / it.banned），若没有则使用本地缓存 bannedCache[pid]
          const isBannedFromServer = (typeof it.isBanned !== 'undefined') ? !!it.isBanned
            : (typeof it.banned !== 'undefined') ? !!it.banned
              : undefined;
          const isBanned = typeof isBannedFromServer === 'boolean' ? isBannedFromServer : !!bannedCache[pid];

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
  if (!pidStack.value.length) return;

  // 弹出上级 pid
  const prev = pidStack.value.pop() as number;
  currentTargetPid.value = prev;

  // reload 表格（回到上级列表）
  gridApi.reload();
}
// 你现有的其他按钮处理保持不变...

</script>

<template>
  <Page auto-content-height>
    <Grid table-title="玩家列表">
      <template #toolbar-tools>
        <Select v-model:value="searchState.field" style="width: 120px; margin-right: 8px">
          <Select.Option value="uid">玩家ID</Select.Option>
          <Select.Option value="nickname">玩家名称</Select.Option>
        </Select>
        <Input v-model:value="searchState.keyword" placeholder="搜索内容" allow-clear style="width: 220px; margin-right: 8px"/>
        <!-- 新增：排序选择 -->
        <Select
          v-model:value="sortState.sortType"
          @change="onSortChange"
          style="width: 140px; margin-right:8px"
        >
          <Select.Option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </Select.Option>
        </Select>
        <Button type="primary" @click="() => gridApi.query()">search</Button>

        <!-- 显示统计 & 当前查询对象 -->
        <div style="display:inline-flex; gap:12px; margin-left:16px; align-items:center;">
          <div>当前查询 pid: {{ currentTargetPid }}</div>
          <div>总人数: {{ stats.totalCount }}</div>
          <div>总钻石: {{ stats.sumDiamond }}</div>
          <div>总金豆: {{ stats.sumGold }}</div>
        </div>

        <div style="display: inline-flex; gap: 8px; margin-left: 16px">
          <Button @click="() => gridApi.query()">刷新当前页</Button>
          <Button @click="() => gridApi.reload()">刷新并回到第一页</Button>
        </div>
        <div style="display:inline-flex; gap:12px; align-items:center;">
          <div>当前查询 pid: {{ currentTargetPid }}</div>
          <Button
            v-if="pidStack.length > 0"
            type="default"
            style="margin-right:8px;"
            @click="goBack"
          >
            返回上级
          </Button>
        </div>


      </template>

      <template #avatar="{ row }">
        <Image :src="row.headImageUrl" :width="40" :height="40" />
      </template>

      <template #action="{ row }">
        <!-- 使用抽离后的组件 -->
        <MemberActions
          :row="row"
          @view-children="viewChildren"
          @row-updated="(updated) => {
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
      }"
        />
      </template>
    </Grid>
    <!-- 从属修改弹窗 -->
    <Modal
      v-model:open="showRecommendModal"
      title="从属修改 - 输入推荐者ID"
      :okText="'确认'"
      :cancelText="'取消'"
      :confirmLoading="modalLoading"
      @ok="confirmRecommend"
      @cancel="cancelRecommend"
    >
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div>请在下面输入新的推荐者ID（recommendId）：</div>
        <Input v-model:value="recommendIdInput" placeholder="推荐者ID（数字）" />
        <div style="color:var(--vben-text-3); font-size:12px;">说明：requestPid 会使用当前 AGENT_PID（或 ACCOUNT_ID）</div>
      </div>
    </Modal>
    <!-- 调整充值分成比例弹窗 -->
    <Modal
      v-model:open="showRateModal"
      title="调整充值分成比例"
      :okText="'确认'"
      :cancelText="'取消'"
      :confirmLoading="rateModalLoading"
      @ok="confirmRate"
      @cancel="cancelRate"
    >
      <div style="display:flex; flex-direction:column; gap:8px;">
        <div>请输入新的分成比例（0 - 100）：</div>
        <Input v-model:value="rateInput" placeholder="比例 例如：10 表示 10%" />
        <div style="color:var(--vben-text-3); font-size:12px;">
          请求者 requestPid 将使用当前 AGENT_PID（或 ACCOUNT_ID）
        </div>
      </div>
    </Modal>


  </Page>
</template>
