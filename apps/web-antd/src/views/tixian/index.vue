<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table'
import { ref, reactive } from 'vue'
import { Page } from '@vben/common-ui'
import { Button, InputNumber, message } from 'ant-design-vue'
import { useVbenVxeGrid } from '#/adapter/vxe-table'

// ====== 页面状态 ======
const balance = ref<number>(100)             // 余额：可由接口赋值
const form = reactive({ amount: undefined as number | undefined })

// ====== 表格列 ======
type Row = {
  id: number | string
  time: string
  applyAmount: number
  status: string
  account: string
}
const columns: VxeGridProps<Row>['columns'] = [
  { type: 'seq', title: '序号', width: 70 },
  { field: 'time', title: '时间', minWidth: 160 },
  { field: 'applyAmount', title: '申请金额', width: 120 },
  { field: 'status', title: '状态', width: 120 },
  { field: 'account', title: '收款账号', minWidth: 160 },
]

// ====== 表格配置（这里先用空数据；接接口时把 proxyConfig 打开即可） ======
const gridOptions: VxeGridProps<Row> = {
  columns,
  height: 'auto',
  border: true,
  stripe: true,
  data: [], // 接口时可删掉此行，改用 proxyConfig 返回 items/total
  pagerConfig: { currentPage: 1, pageSize: 10, pageSizes: [10, 20, 50] },
  toolbarConfig: { custom: true, export: false, refresh: false, zoom: false },
}
const [Grid] = useVbenVxeGrid<Row>({ gridOptions })

// ====== 事件 ======
function onApply() {
  if (!form.amount && form.amount !== 0) return message.warning('请输入提现金额')
  if (form.amount! <= 0) return message.warning('提现金额需大于 0')
  if (form.amount! > balance.value) return message.warning('提现金额不能超过余额')
  // TODO: 调用申请接口
  message.success(`已提交提现申请：￥${form.amount}`)
}
function onSetAccount() {
  // TODO: 打开“设置收款账号”弹窗
  message.info('打开设置收款账号弹窗')
}
</script>

<template>
  <Page auto-content-height>
    <!-- 顶部：余额 -->
    <div class="balance">
      余额：<span class="num">{{ balance }}</span>
    </div>

    <!-- 操作行：输入提现金额 + 申请 + 设置收款账号 -->
    <div class="toolbar">
      <label class="label">输入提现金额：</label>
      <InputNumber
        v-model:value="form.amount"
        :min="0"
        :precision="2"
        class="amount-input"
        size="large"
        placeholder=""
      />
      <Button size="large" class="btn" @click="onApply">申请</Button>
      <Button size="large" class="btn" @click="onSetAccount">设置收款账号</Button>
    </div>

    <!-- 表格 -->
    <Grid table-title="">
      <!-- 无需额外插槽，这里只展示列头和分页 -->
    </Grid>
  </Page>
</template>

<style scoped>
/* 余额展示 */
.balance {
  padding: 20px 8px 8px;
  font-size: 22px;
  font-weight: 700;
  color: #222;
}
.balance .num {
  font-size: 28px;
  margin-left: 6px;
}

/* 工具行布局，贴近截图 */
.toolbar {
  display: flex;
  align-items: center;
  gap: 20px;            /* 控件间距 */
  padding: 16px 8px 12px;
}
.label {
  font-size: 16px;
  font-weight: 700;
  color: #333;
}
.amount-input {
  width: 240px;
}
.btn {
  border-radius: 6px;   /* 白底灰边风格由默认按钮提供 */
}
</style>
