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
// async function setPromoter(row: any) {
//   try {
//     // 防重点击可以加一个 local flag
//     (row as any).__promoterLoading = true;
//
//     // 请求者 id（谁在操作）
//     const requestPid = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);
//     const pid = Number(row._raw?.pid ?? row.id ?? 0);
//     if (!pid) {
//       message.warning('无效的玩家 pid，无法设置');
//       (row as any).__promoterLoading = false;
//       return;
//     }
//
//     // 调用后端接口，type=0 表示设为推广员（按后端约定）
//     const resp = await apiSetPromoter({ pid, type: 0, requestPid });
//
//     // 解析后端返回：兼容多种返回形式
//     const result =
//       resp?.data?.setResult ?? // 常见：{ setResult: true }
//       resp?.data?.data?.setResult ?? // 另一个包层
//       resp?.data?.result ?? // 偶见
//       resp?.data; // 退而求其次
//
//     // 判断是否成功（请根据后端的真实返回结构调整判断条件）
//     const ok =
//       result === true ||
//       (typeof result === 'object' && (result.setResult === true || result.setResult === 1)) ||
//       (resp && (resp as any).code === 0);
//
//     if (ok) {
//       message.success('设置为推广员成功');
//
//       // 临时修改当前行的数据（不请求整表）
//       try {
//         // 在 row._raw 中打个标记，方便后续查看/风格变化
//         if (!row._raw) row._raw = {};
//         row._raw.isPromoter = true;
//         // 你也可以设置 role 字段或其他后端有的字段用于渲染
//         row._raw.role_name = '推广员';
//         // 同步映射字段（如果表格使用 row.nobleLevel/其它字段展示）
//         // 例如把 nobleLevel 修改为 1（仅示例，按你实际字段）
//         // row.nobleLevel = 1;
//
//         // 如果你的表格对 row 的直接修改不会立即生效，可强制触发 grid 刷新：
//         // gridApi.updateRow?.(row) // 如果适配器有 updateRow API
//         // 否则轻微 reload 当前页以保证视图更新：
//         // gridApi.reload();
//
//       } catch (e) {
//         console.warn('临时修改 row 失败', e);
//       }
//     } else {
//       // 尝试解析后端错误信息
//       const errMsg = resp?.data?.msg ?? resp?.data?.message ?? '设置失败（返回值不为 true）';
//       message.error(errMsg);
//     }
//   } catch (e: any) {
//     console.error('[setPromoter] error', e);
//     message.error(e?.message || '设置推广员失败');
//   } finally {
//     (row as any).__promoterLoading = false;
//   }
// }
// async function setRemark(row: any) {
//   try {
//     (row as any).__remarkLoading = true;
//     const currentRemark = row._raw?.remark ?? row._raw?.setRemark ?? '';
//     const remark = window.prompt('请输入备注内容：', String(currentRemark ?? ''));
//     if (remark === null) {
//       (row as any).__remarkLoading = false;
//       return;
//     }
//     const trimmed = String(remark).trim();
//     if (!trimmed) {
//       message.warning('备注不能为空');
//       (row as any).__remarkLoading = false;
//       return;
//     }
//
//     const pid = Number(row._raw?.pid ?? row.id ?? 0);
//     if (!pid) {
//       message.error('无效玩家 pid，无法设置备注');
//       (row as any).__remarkLoading = false;
//       return;
//     }
//
//     const requestPid = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);
//     const resp = await apiSetRemark({ pid, remark: trimmed, requestPid });
//     const data = resp?.data ?? {};
//     const setResult = data?.setResult ?? data?.data?.setResult ?? (data?.code === 0 ? true : undefined);
//
//     if (setResult === true) {
//       message.success('设置备注成功');
//
//       // === 本地更新行数据（不 reload） ===
//       // 把备注放到 row.remark（列 field: 'remark' 依赖这个字段）
//       row.remark = data?.setRemark ?? trimmed;
//       if (!row._raw) row._raw = {};
//       row._raw.remark = data?.setRemark ?? trimmed;
//
//       // 尝试用适配器的局部更新方法（如果存在）
//       try {
//         // 有些 adapter 提供 updateRow / setRow 方法
//         if (typeof gridApi.updateRow === 'function') {
//           gridApi.updateRow(row);
//         } else if (typeof gridApi.refreshRow === 'function') {
//           gridApi.refreshRow(row);
//         } else {
//           // 最保守方式：触发一次小的 re-render（修改一个 reactive key）
//           // 如果你有一个 reactive 状态可以触发 grid 重绘，这里可以用它；否则跳过
//           // Example fallback: no-op
//         }
//       } catch (e) {
//         console.warn('局部更新 row 失败：', e);
//       }
//
//     } else {
//       const errMsg = data?.msg ?? data?.message ?? '设置备注失败';
//       message.error(errMsg);
//     }
//   } catch (err: any) {
//     console.error('[setRemark] error', err);
//     message.error(err?.message ?? '设置备注失败');
//   } finally {
//     (row as any).__remarkLoading = false;
//   }
// }
//
// // 新增：弹窗状态与选中的行
// const showRecommendModal = ref(false);
// const recommendIdInput = ref('');
// const selectedRowForRecommend = ref<any>(null);
// const modalLoading = ref(false);
// // 把原来的 changeBelong(row) 改为打开弹窗
// function changeBelong(row: any) {
//   // 打开弹窗并把当前行缓存
//   selectedRowForRecommend.value = row;
//   // 如果行有已存在的 recommendId，填进去作为占位
//   recommendIdInput.value = row._raw?.recommendId ? String(row._raw.recommendId) : '';
//   showRecommendModal.value = true;
// }
//
// // 确认弹窗后的实际调用
// async function confirmRecommend() {
//   if (!selectedRowForRecommend.value) {
//     message.error('未选择玩家行');
//     return;
//   }
//
//   // 校验输入
//   const rec = String(recommendIdInput.value ?? '').trim();
//   if (rec.length === 0) {
//     message.warning('请输入推荐者 ID');
//     return;
//   }
//   const recommendId = Number(rec);
//   if (Number.isNaN(recommendId) || recommendId <= 0) {
//     message.warning('请输入有效的推荐者 ID（数字）');
//     return;
//   }
//
//   const pid = Number(selectedRowForRecommend.value._raw?.pid ?? selectedRowForRecommend.value.id ?? 0);
//   if (!pid) {
//     message.error('当前行无效的玩家 pid，无法修改');
//     return;
//   }
//
//   // requestPid 取当前 AGENT_PID 或 ACCOUNT_ID
//   const requestPid = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);
//   if (!requestPid) {
//     message.error('未检测到当前 AGENT_PID，无法执行操作');
//     return;
//   }
//
//   try {
//     modalLoading.value = true;
//     const resp = await apiSetRecommend({ pid, recommendId, requestPid });
//
//     const data = resp?.data ?? {};
//     const ok =
//       data?.setResult === true ||
//       data?.code === 0 ||
//       (typeof data === 'boolean' && data === true);
//
//     if (ok) {
//       message.success('从属修改成功');
//
//       // 局部更新行数据，避免整表刷新
//       try {
//         const row = selectedRowForRecommend.value;
//         if (!row._raw) row._raw = {};
//         row._raw.recommendId = recommendId;
//         row._raw.familyId = recommendId; // 如果后端把从属字段存在 familyId 或类似，视情况设置
//         // 若需要把表格列直接显示 pid/某字段，可同步修改 row.xxx：
//         // row.someField = 新值
//         // 尝试调用 gridApi 的更新方法（如果存在）
//         if (typeof gridApi.updateRow === 'function') {
//           gridApi.updateRow(row);
//         } else if (typeof gridApi.refreshRow === 'function') {
//           gridApi.refreshRow(row);
//         }
//       } catch (e) {
//         console.warn('局部更新行失败', e);
//       }
//
//       // 关闭弹窗
//       showRecommendModal.value = false;
//       selectedRowForRecommend.value = null;
//       recommendIdInput.value = '';
//     } else {
//       const errMsg = data?.msg ?? data?.message ?? '从属修改失败';
//       message.error(errMsg);
//     }
//   } catch (err: any) {
//     console.error('[confirmRecommend] error', err);
//     message.error(err?.message ?? '从属修改接口调用失败');
//   } finally {
//     modalLoading.value = false;
//   }
// }
//
// // 取消弹窗
// function cancelRecommend() {
//   showRecommendModal.value = false;
//   selectedRowForRecommend.value = null;
//   recommendIdInput.value = '';
// }
// async function freeze(row: any) {
//   try {
//     (row as any).__freezeLoading = true;
//
//     const pid = Number(row._raw?.pid ?? row.id ?? 0);
//     if (!pid) {
//       message.error('无效玩家 pid，无法操作');
//       return;
//     }
//
//     // 当前状态优先用行的 isBanned，再用缓存
//     const currentlyBanned = !!(row._raw?.isBanned ?? row.isBanned ?? bannedCache[pid] ?? false);
//
//     // type: 1 冻结，0 解冻
//     const type = currentlyBanned ? 0 : 1;
//
//     const requestPid = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);
//     if (!requestPid) {
//       message.error('未检测到 AGENT_PID，无法操作');
//       return;
//     }
//
//     const resp = await apiBanGame({ pid, type, requestPid });
//     const data = resp?.data ?? {};
//
//     const ok =
//       data?.setResult === true ||
//       data?.code === 0 ||
//       (typeof data === 'boolean' && data === true);
//
//     if (!ok) {
//       const errMsg = data?.msg ?? data?.message ?? '操作失败';
//       message.error(errMsg);
//       return;
//     }
//
//     // 成功：计算新状态（true 表示现在是被冻结）
//     const newState = type === 1;
//     // 写入本地缓存
//     bannedCache[pid] = newState;
//
//     // 更新当前行（避免整表刷新）
//     if (!row._raw) row._raw = {};
//     row._raw.isBanned = newState;
//     row.isBanned = newState;
//
//     message.success(newState ? '冻结成功' : '解冻成功');
//
//     // 尝试用适配器局部更新表格（如果存在）
//     try {
//       if (typeof gridApi.updateRow === 'function') {
//         gridApi.updateRow(row);
//       } else if (typeof gridApi.refreshRow === 'function') {
//         gridApi.refreshRow(row);
//       } else {
//         // 不使用 gridApi.query()/reload()，因为那会用后端数据覆盖本地状态。
//         // 如果没有局部更新函数，尽量通过微变动触发渲染：
//         // 例如修改 row.remark（或任何非关键字段）来触发视图重绘（保留本地 isBanned）
//         row._tmpRerender = (row._tmpRerender || 0) + 1;
//       }
//     } catch (e) {
//       // fallback: 也不要强制 query()，因为那可能把后端旧值又覆盖回来
//       console.warn('局部刷新失败', e);
//     }
//   } catch (err: any) {
//     console.error('[freeze] error', err);
//     message.error(err?.message ?? '冻结/解冻操作失败');
//   } finally {
//     (row as any).__freezeLoading = false;
//   }
// }
//
// // function adjustShare(row: any) { message.info(`调整充值分成比例：${row.id}`); }
// // 打开弹窗（由操作列按钮触发）
// function openRateModal(row: any) {
//   selectedRowForRate.value = row;
//   // 预填（若后端返回字段名不同请替换）
//   rateInput.value = String(row._raw?.rate ?? row._raw?.setRate ?? '');
//   showRateModal.value = true;
// }
//
// // 确认修改比例
// async function confirmRate() {
//   if (!selectedRowForRate.value) {
//     message.error('未选择玩家行');
//     return;
//   }
//
//   const r = String(rateInput.value ?? '').trim();
//   if (r.length === 0) {
//     message.warning('请输入比例值（0-100）');
//     return;
//   }
//   const rateNum = Number(r);
//   if (Number.isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
//     message.warning('比例必须是 0 到 100 的数字');
//     return;
//   }
//
//   const pid = Number(selectedRowForRate.value._raw?.pid ?? selectedRowForRate.value.id ?? 0);
//   if (!pid) {
//     message.error('当前行无效的玩家 pid，无法修改');
//     return;
//   }
//
//   const requestPid = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);
//   if (!requestPid) {
//     message.error('未检测到当前 AGENT_PID，无法执行操作');
//     return;
//   }
//
//   try {
//     rateModalLoading.value = true;
//     const resp = await apiSetRate({ pid, rate: rateNum, requestPid });
//
//     const data = resp?.data ?? {};
//     // 后端返回风格可能不同，这里兼容几种情况
//     const ok =
//       data?.setResult === true ||
//       data?.code === 0 ||
//       (typeof data === 'boolean' && data === true) ||
//       (data?.data && data.data.setResult === true);
//
//     if (ok) {
//       message.success('设置分成比例成功');
//
//       // 局部更新行数据，避免全表刷新
//       try {
//         const row = selectedRowForRate.value;
//         if (!row._raw) row._raw = {};
//         row._raw.rate = rateNum;
//         // 同步映射到表格字段（如果你在列里显示 field: 'rate' 或 remark 等）
//         row.rate = rateNum;
//
//         // 适配器尝试局部刷新（按你 adapter 的 API）
//         if (typeof gridApi.updateRow === 'function') {
//           gridApi.updateRow(row);
//         } else if (typeof gridApi.refreshRow === 'function') {
//           gridApi.refreshRow(row);
//         }
//       } catch (e) {
//         console.warn('局部更新 row 失败', e);
//       }
//
//       // 关闭弹窗并清理
//       showRateModal.value = false;
//       selectedRowForRate.value = null;
//       rateInput.value = '';
//     } else {
//       const errMsg = data?.msg ?? data?.message ?? '设置失败';
//       message.error(errMsg);
//     }
//   } catch (err: any) {
//     console.error('[confirmRate] error', err);
//     message.error(err?.message ?? '设置分成比例失败');
//   } finally {
//     rateModalLoading.value = false;
//   }
// }
//
// function cancelRate() {
//   showRateModal.value = false;
//   selectedRowForRate.value = null;
//   rateInput.value = '';
// }
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
