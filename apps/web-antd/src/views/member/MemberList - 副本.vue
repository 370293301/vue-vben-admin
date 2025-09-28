<script setup lang="ts">
import { reactive, ref } from 'vue';

import axios from 'axios';
import { VxeGrid } from 'vxe-table';

import 'vxe-table/lib/style.css';

const gridRef = ref();

// 自己维护的查询表单数据
const form = reactive({
  field: 'uid',
  keyword: '',
});

const gridOptions = reactive({
  border: true,
  height: 560,
  columns: [
    { type: 'seq', width: 60, title: '#' },
    { field: 'uid', title: '玩家ID', minWidth: 140 },
    { field: 'nickname', title: '玩家名称', minWidth: 180 },
  ],

  // 没有它不会自动触发 query
  pagerConfig: { currentPage: 1, pageSize: 10, pageSizes: [10, 20, 50] },

  proxyConfig: {
    enabled: true,
    autoLoad: true, // 进入页面自动发起一次查询
    response: {
      // 按你的后端返回结构改映射：
      // 这里假设后端返回：{ code:0, data: { list: [], total: 0 } }
      props: {
        result: 'data.list',
        total: 'data.total',
      },
    },
    ajax: {
      // 只实现 query，增删改按需再补
      query: async ({ page }) => {
        // 发 GET，带上分页与搜索参数
        const res = await axios.get('/api/v1/agent/players', {
          params: {
            page: page.currentPage,
            pageSize: page.pageSize,
            field: form.field,
            keyword: form.keyword,
          },
        });
        // vxe 需要返回“后端原始响应对象”，它再按 response.props 去取字段
        return res.data;
      },
    },
  },
});

// 点击搜索时，手动触发一次代理查询
function doSearch() {
  gridRef.value?.commitProxy('query');
}
</script>

<template>
  <div style="padding: 16px">
    <!-- 简单搜索区（不依赖 vxe 的渲染器） -->
    <div
      style="display: flex; gap: 8px; align-items: center; margin-bottom: 12px"
    >
      <select v-model="form.field">
        <option value="uid">玩家ID</option>
        <option value="nickname">玩家名称</option>
      </select>
      <input v-model="form.keyword" placeholder="请输入" />
      <button @click="doSearch">搜索</button>
    </div>

    <!-- 关键：原生 vxe-grid -->
    <VxeGrid ref="gridRef" v-bind="gridOptions" />
  </div>
</template>
