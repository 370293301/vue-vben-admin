<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';
import { reactive, ref, nextTick } from 'vue';
import { Page } from '@vben/common-ui';
import { Button, InputNumber, Input, Modal, Select, message } from 'ant-design-vue';
import { useVbenVxeGrid } from '#/adapter/vxe-table';

import {
  agentGetDrawMoney,
  agentCash,
  agentCashRecord,
  agentSetCashAccount,
} from '#/api/wallet';

// ====== 页面状态 ======
const balanceLoading = ref(false);
const balance = ref<number>(0);
const form = reactive({ amount: undefined as number | undefined });

const sortState = reactive({
  sortType: 0, // 0默认 1时间↓ 2时间↑ 3状态↓ 4状态↑ 5金额↓ 6金额↑
});
const sortOptions = [
  { label: '默认排序', value: 0 },
  { label: '时间 ↓', value: 1 },
  { label: '时间 ↑', value: 2 },
  { label: '状态 ↓', value: 3 },
  { label: '状态 ↑', value: 4 },
  { label: '金额 ↓', value: 5 },
  { label: '金额 ↑', value: 6 },
];

// ====== 设置收款账号弹窗 ======
const setDlgOpen = ref(false);
const setDlgLoading = ref(false);
const storageKey = 'recAccountID';
const cashAccountInput = ref(localStorage.getItem(storageKey) ?? '')

// ====== 表格列 ======
type Row = {
  id: number | string;
  time: string;
  cashNum: number;
  status: number;
  cashAccount: string;
};
const columns: VxeGridProps<Row>['columns'] = [
  { type: 'seq', title: '序号', width: 70 },
  { field: 'time', title: '时间', minWidth: 160 },
  { field: 'cashNum', title: '申请金额', width: 120 },
  {
    field: 'status',
    title: '状态',
    width: 120,
    formatter: ({ cellValue }) => (['审核中', '已通过','系统审核中','已驳回','线下申请'][Number(cellValue)] ?? cellValue),
  },
  { field: 'cashAccount', title: '收款账号', minWidth: 160 },
];

// ====== 表格配置（接接口） ======
const gridOptions: VxeGridProps<Row> = {
  columns,
  height: 'auto',
  border: true,
  stripe: true,
  pagerConfig: { currentPage: 1, pageSize: 10, pageSizes: [10, 20, 50, 100] },
  toolbarConfig: { custom: true, export: false, refresh: false, zoom: false },
  proxyConfig: {
    sort: false,
    ajax: {
      query: async ({ page }) => {
        const res = await agentCashRecord({
          pagNum: page.currentPage,
          showNum: page.pageSize,
          sortType: sortState.sortType,
        });

        const data = res?.data ?? res ?? {};
        const list = Array.isArray(data.data.listInfo) ? data.data.listInfo : [];
        console.log(list);
        const items: Row[] = list.map((it: any) => ({
          id: it.id,
          time: it.time,
          cashNum: Number(it.cashNum ?? 0),
          status: Number(it.status ?? 0),
          cashAccount: it.cashAccount ?? '',
        }));

        // 后端未返回 total 时，用 totalPages 估算
        let total = 0;
        if (typeof data.total === 'number') total = data.total;
        else if (typeof data.totalPages === 'number' && data.totalPages > 1)
          total = data.totalPages * page.pageSize;
        else total = items.length;

        return { items, total };
      },
    },
  },
};

const [Grid, gridApi] = useVbenVxeGrid<Row>({ gridOptions });

// ====== 余额相关 ======
async function refreshBalance() {
  try {
    balanceLoading.value = true;
    const res = await agentGetDrawMoney();
    const d = res?.data ?? res ?? {};
    console.log(d)
    balance.value = Number(d.data ?? 0);
  } finally {
    balanceLoading.value = false;
  }
}
refreshBalance();

// ====== 事件 ======
async function onApply() {
  if (!form.amount && form.amount !== 0) {
    message.warning('请输入提现金额');
    return;
  }
  const n = Number(form.amount);




  if (!Number.isFinite(n) || n <= 0) return message.warning('提现金额需大于 0');


  // 👇 新增：检查最小金额限制
  if (n < 0.01) {
    message.warning('提现金额不能小于 0.01');
    return;
  }
  if (n > balance.value) return message.warning('提现金额不能超过余额');
  // 👇 新增：判断是否为小数，只有小数才乘以100
  let cashNumToSend = n;
  cashNumToSend = Math.round(n * 100);
  // if (n % 1 !== 0) {
  //   // 是小数，乘以100
  //
  // }
  const hide = message.loading('提交中…', 0);
  try {
    const res = await agentCash({ cashNum: cashNumToSend  });
    const d = res?.data ?? res ?? {};
    if (d.result === true || d.result === 1 || d.code === 0) {
      message.success(d.message || '提交成功');
      form.amount = undefined;
      refreshBalance();
      gridApi.reload(); // 刷新列表回第一页
    } else {
      message.error(d.message || '提交失败');
    }
  } finally {
    hide();
  }
}

function openSetAccount() {
  setDlgOpen.value = true;
  // 若后端可返回最近设置过的账号，这里也可先查并回填
}

async function confirmSetAccount() {
  if (!cashAccountInput.value?.trim()) {
    message.warning('请输入收款账号');
    return;
  }
  setDlgLoading.value = true;
  try {
    const res = await agentSetCashAccount({ cashAccount: cashAccountInput.value.trim() });
    const d = res?.data ?? res ?? {};
    if (d.result === true || d.result === 1 || d.code === 0) {
      message.success(d.message || '设置成功');
      setDlgOpen.value = false;
      cashAccountInput.value = '';
      gridApi.query(); // 保持当前页刷新
    } else {
      message.error(d.message || '设置失败');
    }
  } finally {
    setDlgLoading.value = false;
  }
}

function onSortChange(v: number) {
  sortState.sortType = v;
  gridApi.reload();
}
</script>

<template>
  <Page auto-content-height>
    <!-- 顶部：余额 -->
    <div class="wallet-head">
      <div class="balance">
        余额：
        <span class="num" :class="{ loading: balanceLoading }">{{ balance }}</span>
        <Button size="small" @click="refreshBalance" :loading="balanceLoading" class="ml8">刷新余额</Button>
      </div>

      <!-- 操作行：输入提现金额 + 申请 + 设置收款账号 -->
      <div class="actions">
        <div class="amount-section">
          <div class="label">输入提现金额：</div>
          <InputNumber
            v-model:value="form.amount"
            :min="0"
            :precision="2"
            class="amount-input"
            size="large"
            placeholder="请输入整数/两位小数"
          />
          <Button type="primary" size="large" class="btn btn-apply" @click="onApply">申 请</Button>
        </div>

        <div class="button-section">
          <Button size="large" class="btn btn-set-account" @click="openSetAccount">设置收款账号</Button>
          <Select v-model:value="sortState.sortType" class="sort-select" @change="onSortChange">
            <Select.Option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</Select.Option>
          </Select>
        </div>
      </div>
    </div>

    <!-- 表格 -->
    <Grid table-title="提现记录" />

    <!-- 设置收款账号弹窗 -->
    <Modal
      v-model:open="setDlgOpen"
      title="设置收款账号"
      ok-text="确定"
      cancel-text="取消"
      :confirm-loading="setDlgLoading"
      @ok="confirmSetAccount"
    >
      <div style="display: flex; align-items: center; gap: 10px">
        <span style="white-space: nowrap">收款账号：</span>
        <Input v-model:value="cashAccountInput" placeholder="请输入收款账号" />
      </div>
    </Modal>
  </Page>
</template>

<style scoped>
.wallet-head {
  padding: 16px 8px 8px;
}
.balance {
  font-size: 20px;
  font-weight: 700;
}
.balance .num {
  margin-left: 6px;
  font-size: 26px;
}
.balance .ml8 {
  margin-left: 8px;
}
.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 16px 0 8px;
}
.amount-section {
  display: flex;
  gap: 12px;
  align-items: center;
}
.button-section {
  display: flex;
  gap: 12px;
  align-items: center;
}
.actions .label {
  font-size: 14px;
  font-weight: 700;
  white-space: nowrap;
}
.amount-input {
  flex: 1;
  min-width: 0;
}
.btn {
  border-radius: 6px;
  white-space: nowrap;
}
.btn-apply {
  min-width: 100px;
}
.btn-set-account {
  flex: 1;
}
.sort-select {
  width: 140px;
}

/* 平板及以上屏幕：水平布局 */
@media (min-width: 768px) {
  .actions {
    flex-direction: row;
    align-items: center;
    gap: 16px;
  }
  .amount-section {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .button-section {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-left: auto;
  }
  .amount-input {
    width: 240px;
    flex: none;
  }
  .btn-apply {
    flex: none;
  }
  .btn-set-account {
    flex: none;
    width: auto;
  }
}

/* 超大屏幕：可选调整 */
@media (min-width: 1200px) {
  .amount-input {
    width: 280px;
  }
}
</style>
