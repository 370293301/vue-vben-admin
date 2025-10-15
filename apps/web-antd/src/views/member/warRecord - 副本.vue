<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';

import { reactive, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Button,
  DatePicker,
  Image,
  Input,
  message,
  Modal,
  Select,
} from 'ant-design-vue';

import { useVbenVxeGrid } from '#/adapter/vxe-table';
// <-- 请把此处替换为你实际的接口实现路径 -->
import { agentReqGameDetailRecord, agentReqGameRecord } from '#/api/game';
import MemberActions from '#/components/MemberActions.vue';

const { RangePicker } = DatePicker;

// 弹窗状态
const detailModalVisible = ref(false);
const detailLoading = ref(false);
const detailRecords = ref<GameDetailRecord[]>([]);
const detailPage = ref(1);
const detailPageSize = ref(10);
const detailTotalPages = ref(0);
const detailPid = ref<null | number>(null);

// 打开弹窗（由列表中点击“战绩得分”时调用）
// row: 当前行对象（含 pid）
async function openDetailModal(row: any, page = 1) {
  detailPid.value = Number(row.pid ?? row.id ?? row._raw?.pid ?? 0);
  detailPage.value = page;
  detailModalVisible.value = true;
  await fetchDetailPage();
}

async function fetchDetailPage() {
  if (!detailPid.value) return;
  // 明确取出 sortType 并打印（必做）
  const sortType = Number(searchState?.sortType ?? 0);
  console.log(
    '[debug] fetchDetailPage -> pid, page, sortType =',
    detailPid.value,
    detailPage.value,
    sortType,
  );

  detailLoading.value = true;
  try {
    // 确保 agentReqGameDetailRecord 实现能把 sortType 写入 body（见下方说明）
    const resp = await agentReqGameDetailRecord({
      pid: detailPid.value,
      pagNum: detailPage.value,
      showNum: detailPageSize.value,
      sortType, // <-- 一定要传这个
      requestPid: Number(
        localStorage.getItem('AGENT_PID') ??
          localStorage.getItem('ACCOUNT_ID') ??
          0,
      ),
    });

    // 后端返回层次可能不一样，统一解析
    const payload = (resp && (resp.data ?? resp)) ?? {};
    // 假设后端返回： payload.listInfo 是一个 list，每个元素是一个回合（包含 time, roomKey, recordCode, listInfo/players）
    const rawList = payload.listInfo ?? payload.list ?? [];

    // 把后端的结构标准化到 detailRecords 的结构： { time, roomKey, recordCode, players: [ {pid,name,headUrl,points} ] }
    detailRecords.value = (Array.isArray(rawList) ? rawList : []).map(
      (round: any) => {
        const playersRaw = round.listInfo ?? round.players ?? [];
        return {
          time: round.time ?? round.date ?? '',
          roomKey: round.roomKey ?? round.roomKeyId ?? '',
          recordCode: round.recordCode ?? round.replayCode ?? '',
          players: (Array.isArray(playersRaw) ? playersRaw : []).map(
            (p: any) => ({
              pid: Number(p.pid ?? p.id ?? 0),
              name: p.name ?? p.nickname ?? '',
              headUrl: p.headUrl ?? p.avatar ?? '',
              points: Number(p.points ?? p.score ?? 0),
            }),
          ),
        };
      },
    );

    detailTotalPages.value = Number(
      payload.totalPages ?? payload.totalPagesCount ?? payload.total ?? 1,
    );
  } catch (error) {
    console.error('[debug] fetchDetailPage error', error);
    message.error('获取战绩明细失败');
  } finally {
    detailLoading.value = false;
  }
}

// 翻页（弹窗内）
function onDetailPageChange(p: number) {
  detailPage.value = p;
  fetchDetailPage();
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
  dateRange: [] as any[],
  field: 'uid' as 'nickname' | 'uid',
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
  { field: 'pid', title: 'PID' },
  {
    field: 'headUrl',
    title: '头像',
    slots: { default: 'avatar' },
  },
  { field: 'level', title: '身份' },
  { field: 'name', title: '玩家名称' },
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
  { field: 'remark', title: '备注' },

  {
    field: 'action',
    title: '操作',
    width: 220, // <- 必须给一个明确值（根据按钮数量调整）
    showOverflow: false,
    fixed: 'right',
    slots: { default: 'action' },
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

        const [startDate, endDate] = searchState.dateRange ?? [];
        const params = {
          pagNum: page.currentPage,
          showNum: page.pageSize,
          field: searchState.field,
          keyword: searchState.keyword,
          sortType: finalSortType, // <- 这里使用 finalSortType（修复点）
          startDate,
          endDate,
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
            remark: it.remark ?? it.setRemark ?? '',
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
  <!-- 弹窗：战绩明细 -->
  <Modal
    v-model:open="detailModalVisible"
    :title="`战绩明细 - PID: ${detailPid ?? ''}`"
    :width="900"
    :footer="null"
  >
    <div v-if="detailLoading" style="padding: 20px; text-align: center">
      加载中…
    </div>

    <div v-else>
      <div
        v-if="!detailRecords || detailRecords.length === 0"
        style="padding: 20px; color: var(--vben-text-3); text-align: center"
      >
        暂无数据
      </div>

      <div v-else>
        <div
          v-for="(rec, idx) in detailRecords"
          :key="idx"
          style="padding: 8px 0; border-bottom: 1px solid rgb(255 255 255 / 3%)"
        >
          <div
            style="
              display: flex;
              align-items: center;
              justify-content: space-between;
            "
          >
            <div>
              <strong>{{ rec.time || '—' }}</strong>
              <span style="margin-left: 12px"
                >房间: {{ rec.roomKey || '—' }}</span
              >
              <span style="margin-left: 12px"
                >回放码: {{ rec.recordCode || '—' }}</span
              >
            </div>
            <div>
              <!-- 可添加“回放”按钮 / 链接 -->
              <a
                v-if="rec.recordCode"
                :href="`/replay/${rec.recordCode}`"
                target="_blank"
                >回放</a
              >
            </div>
          </div>

          <table
            style="width: 100%; margin-top: 8px; border-collapse: collapse"
          >
            <thead>
              <tr
                style="
                  font-weight: 600;
                  color: var(--vben-text-3);
                  text-align: left;
                "
              >
                <th style="width: 80px; padding: 6px 8px">PID</th>
                <th style="padding: 6px 8px">头像</th>
                <th style="padding: 6px 8px">姓名</th>
                <th style="padding: 6px 8px">得分</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="p in rec.players" :key="p.pid">
                <td style="padding: 6px 8px">{{ p.pid }}</td>
                <td style="padding: 6px 8px">
                  <img
                    v-if="p.headUrl"
                    :src="p.headUrl"
                    style="
                      width: 36px;
                      height: 36px;
                      object-fit: cover;
                      border-radius: 4px;
                    "
                  />
                </td>
                <td style="padding: 6px 8px">{{ p.name }}</td>
                <td style="padding: 6px 8px">{{ p.points }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- 简单分页 -->
        <div style="display: flex; justify-content: center; margin-top: 12px">
          <a-button
            v-if="detailPage > 1"
            @click="onDetailPageChange(detailPage - 1)"
          >
            上一页
          </a-button>
          <div style="padding: 0 12px; line-height: 32px">
            第 {{ detailPage }} / {{ detailTotalPages || 1 }} 页
          </div>
          <a-button
            v-if="detailPage < (detailTotalPages || 1)"
            @click="onDetailPageChange(detailPage + 1)"
          >
            下一页
          </a-button>
        </div>
      </div>
    </div>
  </Modal>
  <Page auto-content-height>
    <Grid table-title="玩家战绩">
      <template #toolbar-tools>
        <RangePicker
          v-model:value="searchState.dateRange"
          style="width: 240px; margin-right: 12px"
          :placeholder="['开始日期', '结束日期']"
          allow-clear
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
          <Select.Option :value="0">默认排序</Select.Option>
          <Select.Option :value="1">钻石 ↓</Select.Option>
          <Select.Option :value="2">钻石 ↑</Select.Option>
          <Select.Option :value="3">金豆 ↓</Select.Option>
          <Select.Option :value="4">金豆 ↑</Select.Option>
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
        <!--        <Button type="default" @click="debugTest" style="margin-left:8px">🔧 DebugSort</Button>-->

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

      <template #toolbar-tools-after>
        <!-- 也可以在这里放你截图中的统计数字样式 -->
      </template>

      <template #avatar="{ row }">
        <Image :src="row.headUrl" :width="36" :height="36" />
      </template>

      <template #score="{ row }">
        <a
          @click.prevent="openDetailModal(row)"
          style="font-weight: 600; text-decoration: underline; cursor: pointer"
        >
          {{ row.points }}
        </a>
      </template>
      <!--      <template #score="{ row }">-->
      <!--      -->
      <!--      </template>-->
      <!-- 局数 合计 + 列名 两行形式 -->
      <!-- 局数 合计 + 列名 两行形式，点击切换排序 -->
      <!-- 替换 header-setCount 的 template -->
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

      <!--      <template #action="{ row }">-->
      <!--        <div style="display:flex; gap:8px; flex-wrap:wrap; justify-content:flex-end;">-->
      <!--          <MemberActions-->
      <!--            :row="row"-->
      <!--            @view-children="viewChildrenFromActions"-->
      <!--            @row-updated="(updated) => {-->
      <!--              // 合并更新-->
      <!--              Object.assign(row, updated);-->
      <!--              if (updated._raw) row._raw = Object.assign(row._raw || {}, updated._raw);-->
      <!--              if (typeof gridApi.updateRow === 'function') gridApi.updateRow(row as any);-->
      <!--            }"-->
      <!--          />-->

      <!--        </div>-->
      <!--      </template>-->
      <template #action="{ row }">
        <div
          style="
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            justify-content: flex-end;
          "
        >
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

/* 如果你之前写过把 header-top-cell 隐藏的规则（例如 @media (max-width:1000px) .header-top-cell {display:none}）请删除它 */
</style>
