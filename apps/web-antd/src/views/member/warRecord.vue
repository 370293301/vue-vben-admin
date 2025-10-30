<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';

import { createVNode, reactive, ref, render } from 'vue';
import dayjs from 'dayjs';
import { useRouter } from 'vue-router'; /* === MOD: 用 router 跳转到 RecordList 页面 */
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
// <-- 请把此处替换为你实际的接口实现路径 -->
import { agentReqGameRecord } from '#/api/game';
import MemberActions from '#/components/MemberActions.vue';

import DetailModalContent from './DetailModalContent.vue';

const router = useRouter(); /* === MOD: router */
const { RangePicker } = DatePicker; // 根据实际路径调整

// 弹窗状态
const detailPageSize = ref(10);

/* === MOD: 当点击战绩得分时，跳转到 RecordList 页面（并传 pid） */
function openRecordList(row: any) {
  const pid = Number(row.pid ?? row.id ?? row._raw?.pid ?? 0);
  if (!pid) {
    message.warning('无效的 pid');
    return;
  }
  router.push({ name: 'RecordList', query: { pid: String(pid) } });
}
// 打开弹窗（由列表中点击“战绩得分”时调用）
// row: 当前行对象（含 pid）
function openDetailModal(row: any, page = 1) {
  const pid = Number(row.pid ?? row.id ?? row._raw?.pid ?? 0);
  if (!pid) {
    message.warning('无效的 pid');
    return;
  }

  // container 挂到 body
  const container = document.createElement('div');
  document.body.append(container);

  // onClose: 卸载 vnode 并移除 container
  function onClose() {
    try {
      render(null, container);
      if (container.parentNode) container.remove();
    } catch (error) {
      console.warn('closing modal render error', error);
    }
  }

  // create vnode 并 render
  const vnode = createVNode(DetailModalContent, {
    pid,
    pageSize: detailPageSize, // 你页面里已有 detailPageSize 变量的话可以传进去；否则传 10
    initialPage: page,
    onClose,
  });

  render(vnode, container);
}



// 初始 AGENT_PID（请求者 / 顶级 pid）
const AGENT_PID = Number(
  localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0,
);

// 记录列的本地排序状态：0 = 无, 1 = 降序, 2 = 升序
const colSortState = reactive({
  setCount: 0,
  points: 0,
});
function debugTest() {
  console.log('[debug] debugTest called. gridApi:', gridApi);
  console.log(
    '[debug] colSortState before:',
    JSON.parse(JSON.stringify(colSortState)),
  );
  // 直接触发一次排序函数，观察日志和网络
  onHeaderSort('setCount');
}
// 点击自定义表头时切换 sort 并触发 gridApi.reload()
function onHeaderSort(col: 'points' | 'setCount') {
  // 切换本地UI状态
  colSortState[col] = (colSortState[col] + 1) % 3;
  const order =
    colSortState[col] === 1
      ? 'desc'
      : colSortState[col] === 2
        ? 'asc'
        : undefined;

  // 保持 searchState.sortType（以备后端兼容）
  if (col === 'setCount') {
    searchState.sortType =
      colSortState.setCount === 1 ? 1 : colSortState.setCount === 2 ? 2 : 0;
    colSortState.points = 0;
  } else {
    searchState.sortType =
      colSortState.points === 1 ? 3 : colSortState.points === 2 ? 4 : 0;
    colSortState.setCount = 0;
  }

  const sorts = order ? [{ field: col, order }] : [];

  console.log('[debug] onHeaderSort ->', {
    col,
    colSortState: JSON.parse(JSON.stringify(colSortState)),
    sorts,
    sortType: searchState.sortType,
  });

  // 优先用 query({ sorts }) 传入 adapter；如果不支持，fallback 用 reload（并依赖 searchState.sortType）
  if (gridApi && typeof (gridApi as any).query === 'function') {
    (gridApi as any).query({ sorts });
    return;
  }

  console.warn(
    '[debug] gridApi.query not available, falling back to reload with searchState.sortType',
    gridApi,
  );
  if (gridApi && typeof (gridApi as any).reload === 'function') {
    // reload 不带 sorts，但你的 ajax 中有 finalSortType 会读取 searchState.sortType
    (gridApi as any).reload();
    return;
  }

  console.error(
    '[debug] gridApi unavailable - cannot trigger query/reload',
    gridApi,
  );
}

// 顶部筛选状态
const searchState = reactive({
  timeRange: [
    dayjs().startOf('day').valueOf(), // 当天 00:00:00
    dayjs().endOf('day').valueOf(),   // 当天 23:59:59
  ] as any,
  field: 'uid' as 'uid' | 'nickname' | 'mark',
  keyword: '',
  sortType: 0, // 0 默认、1 钻石 ↓、2 钻石 ↑、3 金豆 ↓、4 金豆 ↑ （复用你定义的含义）
  pageSize: 10,
});

// 统计数字（接口返回）
const statState = reactive({
  sumSetCount: 0,
  sumBigWinnerCount: 0,
  sumPoints: 0,
});

// 表格列定义（根据返回字段适配）
interface RowItem {
  pid: number;
  familyId?: number;
  name?: string;
  headUrl?: string;
  level?: number;
  setCount?: number;
  bigWinnerCount?: number;
  points?: number;
}
const columns: VxeGridProps<RowItem>['columns'] = [

  {  field: 'pid', title: '玩家id', slots: { default: 'cell-id' } },
  {
    field: 'headUrl',
    title: '头像',
    slots: { default: 'avatar' },
  },
  { field: 'level', title: '身份' },
  { field: 'name', title: '玩家名称',slots: { default: 'cell-name' } },
  {
    field: 'setCount',
    title: '局数',
    sortable: false, // 使用自定义排序
    slots: { header: 'header-setCount' },
  },
  {
    field: 'bigWinnerCount',
    title: '大赢家',
    sortable: false,
    slots: { header: 'header-bigWinnerCount' },
  },
  {
    field: 'points',
    title: '战绩得分',
    sortable: false,
    headerAlign: 'center',
    align: 'center',
    slots: { header: 'header-points', default: 'score' },
  },
  { field: 'markStr', title: '备注标记' },
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

// pid 管理（支持查看下级与返回上级）
const currentTargetPid = ref<number>(AGENT_PID);
const pidStack = ref<number[]>([]);

// 表格配置与后端通信（使用 agentReqGameRecord）
const gridOptions: VxeGridProps<RowItem> = {
  columns,
  height: 'auto',
  border: true,
  stripe: true,
  pagerConfig: {
    currentPage: 1,
    pageSize: searchState.pageSize,
    pageSizes: [10, 20, 50, 100],
  },
  toolbarConfig: {
    custom: true,
    export: false,
    refresh: false,
    zoom: false,
  },
  proxyConfig: {
    sort: true,
    ajax: {
      query: async ({ page, sorts }) => {
        // sorts 可能类似 [{ field:'points', order:'asc' }] 或你的 adapter 格式
        console.log('[debug] query called', { page, sorts });
        // 先把 adapter 传来的 sorts 映射成后端约定的 sortType（如果有）
        const sortObj = Array.isArray(sorts) && sorts[0] ? sorts[0] : null;
        let mappedSortType = 0; // 默认
        if (sortObj) {
          switch (sortObj.field) {
            case 'bigWinnerCount': {
              // 如果后端支持大赢家排序可以映射，这里留空或自定义
              // mappedSortType = sortObj.order === 'desc' ? 5 : 6;

              break;
            }
            case 'points': {
              mappedSortType = sortObj.order === 'desc' ? 3 : 4;

              break;
            }
            case 'setCount': {
              mappedSortType = sortObj.order === 'desc' ? 1 : 2;

              break;
            }
            // No default
          }
        }

        // 最终使用哪一个 sortType：优先使用 adapter 的 mappedSortType（非 0），否则使用 UI 状态 searchState.sortType
        const finalSortType =
          mappedSortType === 0 ? (searchState.sortType ?? 0) : mappedSortType;

        // const [startDate, endDate] = searchState.dateRange ?? [];
        // ✅ 获取时间戳
        let startTime = 0;
        let endTime = 0;
        if (searchState.timeRange && searchState.timeRange.length === 2) {
          startTime = Math.floor(searchState.timeRange[0] / 1000); // 转换为秒
          endTime = Math.floor(searchState.timeRange[1] / 1000);
        }
        const params = {
          pagNum: page.currentPage,
          showNum: page.pageSize,
          field: searchState.field,
          keyword: searchState.keyword,
          sortType: finalSortType, // <- 这里使用 finalSortType（修复点）
          startTime, // ✅ 秒级时间戳
          endTime, // ✅ 秒级时间戳
          pid:
            currentTargetPid?.value ??
            Number(localStorage.getItem('AGENT_PID') ?? 0),
          requestPid: Number(
            localStorage.getItem('AGENT_PID') ??
              localStorage.getItem('ACCOUNT_ID') ??
              0,
          ),
        };

        console.log('[debug] warRecord.query -> sending params:', params);

        let res;
        try {
          res = await agentReqGameRecord(params);
        } catch (error) {
          console.error('[debug] agentReqGameRecord request failed', error);
          message.error('查询失败，请检查网络或控制台');
          return { items: [], total: 0 };
        }

        // console.log('[debug] raw HTTP resp:', res);

        // 容错解析各种嵌套：res.data.data.listInfo / res.data.listInfo / res.data / res
        const maybe = res?.data ?? res;
        const payload = (maybe && (maybe.data ?? maybe)) ?? maybe ?? {};

        // console.log('[debug] normalized payload:', payload);

        // 尝试取列表数组（支持多种命名）
        const rawList =
          payload.listInfo ??
          payload.list ??
          payload.data?.listInfo ??
          payload.data?.list ??
          (Array.isArray(payload) ? payload : []);

        // console.log('[debug] resolved rawList (length):', Array.isArray(rawList) ? rawList.length : 'not array', rawList);

        // 统计字段（如果接口返回）
        statState.sumSetCount = Number(
          payload.sumSetCount ??
            payload.sum_set_count ??
            statState.sumSetCount ??
            0,
        );
        statState.sumBigWinnerCount = Number(
          payload.sumBigWinnerCount ??
            payload.sum_big_winner_count ??
            statState.sumBigWinnerCount ??
            0,
        );
        statState.sumPoints = Number(
          payload.sumPoints ?? payload.sum_points ?? statState.sumPoints ?? 0,
        );

        // total 处理（优先后端给的 total / totalPages）
        let total = 0;
        if (typeof payload.total === 'number') {
          total = payload.total;
        } else if (
          typeof payload.totalPages === 'number' &&
          payload.totalPages > 0
        ) {
          total = payload.totalPages * page.pageSize;
        } else if (Array.isArray(rawList)) {
          total = rawList.length;
        }

        // 映射字段：注意 field 名和 columns 对齐（例子用 pid/headUrl/name/setCount/bigWinnerCount/points/remark）
        const list = (Array.isArray(rawList) ? rawList : []).map((it: any) => {
          const pid = Number(it.pid ?? it.id ?? 0);
          const isBannedFromServer = ('banned' in it)
            ? !!it.banned
            : ('isBanned' in it ? !!it.isBanned : undefined);
          const isBanned =
            typeof isBannedFromServer === 'boolean'
              ? isBannedFromServer
              : false;

          return {
            pid,
            headUrl: it.headUrl ?? it.avatar ?? it.headImageUrl ?? '',
            name: it.name ?? it.nickname ?? '',
            level: it.level ?? it.nobleLevel ?? 0,
            setCount: Number(it.setCount ?? it.set_count ?? it.rounds ?? 0),
            bigWinnerCount: Number(
              it.bigWinnerCount ?? it.big_winner_count ?? it.bigWinner ?? 0,
            ),
            points: Number(it.points ?? it.score ?? 0),
            markStr: it.markStr ?? '',
            fenCheng: it.fenCheng != null ? it.fenCheng + '%' : '',
            lowNum: it.lowNum ??  0,
            // 把后端原始数据和标准化字段放进 _raw，保证 MemberActions 能读取 pid/isBanned 等
            _raw: { ...it, pid, isBanned },
            isBanned,
          };
        });

        // console.log('[debug] mapped list:', list, 'total:', total);

        // 返回适配器期望的格式（非常重要）
        return { items: list, total };
      },
    },
  },
};

const [Grid, gridApi] = useVbenVxeGrid<RowItem>({ gridOptions });
console.log('[debug in SFC] Grid, gridApi =>', Grid, gridApi);
// 为了在浏览器 console 调试也能访问，临时挂到 window
// （开发调试用，发布前删掉）
(window as any).__debug_Grid = Grid;
(window as any).__debug_gridApi = gridApi;
// console.log('MemberActions is', MemberActions);
// console.log('Grid component (after init) is', Grid);
// console.log('gridApi available:', typeof gridApi);
// 顶部交互：排序变化会触发 reload（保留当前页）
function onSortChange(v: number) {
  searchState.sortType = v;
  gridApi.reload();
}
// search 按钮触发（回到第一页）
function onSearch() {
  gridApi.reload();
}

// 查看下级（push 当前 pid 到栈）
function viewChildren(row: RowItem) {
  const target = Number(row.pid ?? 0);
  if (!target) {
    message.warning('无效的 pid');
    return;
  }
  pidStack.value.push(currentTargetPid.value);
  currentTargetPid.value = target;
  // 回到第一页
  gridApi.reload();
}

// 返回上级
function goBack() {
  if (pidStack.value.length === 0) return;
  const prev = pidStack.value.pop() as number;
  currentTargetPid.value = prev;
  gridApi.reload();
}

function viewChildrenFromActions(row: RowItem) {
  // 如果 MemberActions 发出 view-children 事件则调用
  viewChildren(row);
}
</script>

<template>
  <Page auto-content-height>
    <Grid table-title="玩家战绩">
      <template #toolbar-tools>
        <RangePicker
          v-model:value="searchState.timeRange"
          style="width: 240px; margin-right: 12px"
          show-time
          format="YYYY-MM-DD HH:mm:ss"
          value-format="x"
        />
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
        <Select
          v-model:value="searchState.sortType"
          @change="onSortChange"
          style="width: 140px; margin-right: 8px"
        >
          <Select.Option :value="1">局数 ↓</Select.Option>
          <Select.Option :value="2">局数 ↑</Select.Option>
          <Select.Option :value="3">得分 ↓</Select.Option>
          <Select.Option :value="4">得分 ↑</Select.Option>
        </Select>

        <Select
          v-model:value="searchState.pageSize"
          @change="() => gridApi.reload()"
          style="width: 120px; margin-right: 8px"
        >
          <Select.Option :value="10">10 / 页</Select.Option>
          <Select.Option :value="20">20 / 页</Select.Option>
          <Select.Option :value="50">50 / 页</Select.Option>
          <Select.Option :value="100">100 / 页</Select.Option>
        </Select>

        <Button type="primary" @click="onSearch">search</Button>

        <div
          style="
            display: inline-flex;
            gap: 12px;
            align-items: center;
            margin-left: 16px;
          "
        >
          <div>当前查询 pid: {{ currentTargetPid }}</div>
          <div>总局数: {{ statState.sumSetCount }}</div>
          <div>总金币(大赢家数): {{ statState.sumBigWinnerCount }}</div>
          <div>总分数: {{ statState.sumPoints }}</div>
        </div>

        <div style="display: inline-flex; gap: 8px; margin-left: 16px">
          <Button @click="() => gridApi.query()">刷新当前页</Button>
          <Button @click="() => gridApi.reload()">刷新并回到第一页</Button>
        </div>

        <div style="margin-left: 12px">
          <Button v-if="pidStack.length > 0" @click="goBack">返回上级</Button>
        </div>
      </template>

      <template #toolbar-tools-after> </template>
      <template #cell-id="{ row }">
        <span :class="{ 'level-1': row.level === 1 }">{{ row.pid }}</span>
      </template>

      <template #cell-name="{ row }">
        <span :class="{ 'level-1': row.level === 1 }">{{ row.name }}</span>
      </template>
      <template #avatar="{ row }">
        <Image :src="row.headUrl" :width="36" :height="36" />
      </template>

      <template #score="{ row }">
        <a
          @click.prevent="openRecordList(row)"
          style="font-weight: 600; text-decoration: underline; cursor: pointer"
        >
          {{ row.points }}
        </a>
      </template>

      <template #header-setCount>
        <div style="display: flex; flex-direction: column; align-items: center">
          <div class="header-top-cell">总局数：{{ statState.sumSetCount }}</div>
          <div class="header-bottom-cell">
            局数
            <span style="display: inline-flex; gap: 6px; margin-left: 8px">
              <button
                @click.stop="() => onHeaderSort('setCount')"
                style="padding: 0; cursor: pointer; background: none; border: 0"
              >
                <span v-if="colSortState.setCount === 1">▼</span>
                <span v-else-if="colSortState.setCount === 2">▲</span>
                <span v-else>◢</span>
              </button>
            </span>
          </div>
        </div>
      </template>
      <template #header-bigWinnerCount>
        <div style="display: flex; flex-direction: column; align-items: center">
          <div class="header-top-cell">
            总金币(大赢家数)：{{ statState.sumBigWinnerCount }}
          </div>
          <div class="header-bottom-cell">大赢家</div>
        </div>
      </template>
      <template #header-points>
        <div
          style="
            display: flex;
            flex-direction: column;
            align-items: center;
            cursor: pointer;
          "
          @click="
            () => {
              console.log('[debug] header-points clicked');
              onHeaderSort('points');
            }
          "
        >
          <div class="header-top-cell">总分数：{{ statState.sumPoints }}</div>
          <div class="header-bottom-cell">
            战绩得分
            <span style="margin-left: 6px">
              <span v-if="colSortState.points === 1">▼</span>
              <span v-else-if="colSortState.points === 2">▲</span>
              <span v-else>◢</span>
            </span>
          </div>
        </div>
      </template>
      <template #action="{ row }">
        <div>
          <MemberActions
            :row="row"
            @view-children="() => viewChildren(row)"
            @row-updated="
              (updated) => {
                // 合并更新字段回 row（包括 _raw）
                Object.assign(row, updated);
                if (updated._raw) {
                  row._raw = Object.assign(row._raw || {}, updated._raw);
                }

                // 局部刷新：优先用适配器提供的 updateRow / refreshRow
                if (typeof gridApi.updateRow === 'function') {
                  gridApi.updateRow(row);
                } else if (typeof gridApi.refreshRow === 'function') {
                  gridApi.refreshRow(row);
                } else {
                  // Fallback: 轻触发重渲染
                  row._tmpRerender = (row._tmpRerender || 0) + 1;
                }
              }
            "
          />
        </div>
      </template>
    </Grid>
  </Page>
</template>

<style scoped>
.level-1 {
  color: #ff4d4f; /* 红色，ant design 常用的 danger 红 */
  font-weight: 600;
}
/* 窄屏时调整：隐藏底部（列名）以节省高度，但保留合计（top），并缩小 top 字体 */
@media (max-width: 900px) {
  /* .header-bottom-cell { display: none; } */
  .header-top-cell {
    display: none;

    /* font-size: 11px; */

    /* white-space: normal;      !* 允许换行显示合计内容 *! */

    /* padding: 2px 4px; */
  }
}

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

.score-link {
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
}

/* ---------- header 双行样式（替换旧规则） ---------- */
.header-top-cell,
.header-bottom-cell {
  display: block;
  padding: 2px 6px;
  overflow: visible;
  line-height: 1.1;

  /* text-overflow: clip; */
  text-align: center;
  white-space: normal; /* allow wrapping instead of forcing single line */
}

/* top 小号字体，保留可见性 */
.header-top-cell {
  font-size: 11px;
  font-weight: 600;
  color: var(--vben-text-2, #9aa0a6);
}

/* bottom 稍大，用作列名 */
.header-bottom-cell {
  font-size: 12px;
  font-weight: 700;
}

/* 当表格列非常窄时，允许单元格内文字换行（防止被 entirely hidden） */

/* 选择器根据 vxe-table DOM 结构可能略有不同，下面匹配常见类 */
.vxe-table .vxe-body--row td,
.vxe-table .vxe-header--row th {
  word-break: break-word !important;
  overflow-wrap: anywhere !important;
  white-space: normal !important;
}
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
/* 如果你之前写过把 header-top-cell 隐藏的规则（例如 @media (max-width:1000px) .header-top-cell {display:none}）请删除它 */
</style>
