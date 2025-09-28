<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';

import { reactive } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Image, Input, message, Select } from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
// 如果你已经封装了接口，建议用它；没有就用 axios 直调
import { apiGetMemberList } from '#/api/member'; // ← 没有就改成你的实际路径
// import axios from 'axios'

interface MemberRow {
  id: number | string;
  avatar: string;
  identity: string;
  nickname: string;
  level: number | string;
  diamond: number;
  bean: number;
}

// 顶部搜索状态
const searchState = reactive({
  field: 'uid', // uid | nickname
  keyword: '',
});
// ====== 测试数据 ======
// const testData: MemberRow[] = [
//   {
//     id: 1,
//     headImageUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/Q0j4TwGTfTLFPJR06vhs13nXEWnkmozfuJAukOia40IcsRDMHJibW5OyY88vAZ0Iz2T1qbN1aQZIfuK536pVfMdQ/132',
//     name: '张三',
//     nobleLevel: 3,
//     crystal: 100,
//     gold: 50,
//   },
//   {
//     id: 2,
//     headImageUrl: 'https://thirdwx.qlogo.cn/mmopen/vi_32/sGDdvEtBog0CGSUVCiaH9hBDCuRMQibmAawnXSiauJA2SPGUxjqFrpWyye07QC2vwrpqb3x9FKhjwSRIcPes5gRsA/132',
//     name: '李四',
//     nobleLevel: 1,
//     crystal: 20,
//     gold: 5,
//   },
// ]
// 表格列
const columns: VxeGridProps<MemberRow>['columns'] = [
  { type: 'seq', title: 'ID' },
  { field: 'headImageUrl', title: '头像', slots: { default: 'avatar' } },
  { field: 'name', title: '玩家名称' },
  { field: 'nobleLevel', title: '贵族等级' },
  { field: 'crystal', title: '剩余钻石' },
  { field: 'gold', title: '剩余金豆' },
  {
    field: 'action',
    title: '操作',
    // width: 520,
    showOverflow: false,
    slots: {
      default: 'action', // ↓ 模板里 #action 渲染
    },
  },
];

// 表格配置
const gridOptions: VxeGridProps<MemberRow> = {
  columns,
  height: 'auto',
  pagerConfig: { currentPage: 1, pageSize: 10, pageSizes: [10, 20, 50, 100] },
  toolbarConfig: {
    custom: true,
    export: false,
    refresh: false, // 我们用自定义按钮
    zoom: false,
  },
  proxyConfig: {
    sort: false,
    // 重要：根据你的后端返回结构映射。这里假设 { code:0, data:{ list:[], total:0 } }
    // response: { props: { result: 'data.list', total: 'data.total' } },
    // response: { props: { result: 'data.list', total: 'data.total' } },
    ajax: {
      query: async ({ page }) => {
        const params = {
          page: page.currentPage,
          pageSize: page.pageSize,
          field: searchState.field,
          keyword: searchState.keyword,
        };
        // 如果没有 apiGetMemberList，请改成 axios.get('http://127.0.0.1:5566/api/v1/agent/players', { params })
        const res = await apiGetMemberList(params);
        const list = res?.data?.data?.list ?? [];
        const total = res?.data?.data?.total ?? 0;

        // ★★ 关键：返回全局约定的结构
        const shaped = { items: list, total };
        console.log('[proxy.query] shaped =>', shaped);
        return shaped;
        // console.log('[member] api result:', res.data)
        // return res.data
      },
    },
  },
};

// const gridOptions2: VxeGridProps<MemberRow> = {
//   columns,
//   height: 'auto',
//   data: testData,   // ★ 不走接口，直接渲染这份数据
// }
// 适配器：拿到 Grid 组件和 api
const [Grid, gridApi] = useVbenVxeGrid<MemberRow>({ gridOptions });

// 操作列事件（示例）
function viewChildren(row: MemberRow) {
  message.info(`查看下级：${row.id}`);
}
function setPromoter(row: MemberRow) {
  message.success(`设为推广员：${row.id}`);
}
function setRemark(row: MemberRow) {
  message.info(`设置备注：${row.id}`);
}
function changeBelong(row: MemberRow) {
  message.info(`从属修改：${row.id}`);
}
function freeze(row: MemberRow) {
  message.warning(`冻结：${row.id}`);
}
function adjustShare(row: MemberRow) {
  message.info(`调整充值分成比例：${row.id}`);
}
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="玩家列表">
      <!-- 顶部工具区：自定义搜索栏 -->
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
        <Button type="primary" @click="() => gridApi.commitProxy('query')">
          search
        </Button>

        <!-- 右侧刷新按钮（可选） -->
        <div style="display: inline-flex; gap: 8px; margin-left: 16px">
          <Button @click="() => gridApi.query()">刷新当前页</Button>
          <Button @click="() => gridApi.reload()">刷新并回到第一页</Button>
        </div>
      </template>

      <!-- 头像列 -->
      <template #avatar="{ row }">
        <Image :src="row.headImageUrl" :width="40" :height="40" />
      </template>

      <!-- 操作列 -->
      <template #action="{ row }">
        <div style="display: flex; flex-wrap: wrap; gap: 8px">
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
