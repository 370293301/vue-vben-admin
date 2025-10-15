<script lang="ts" setup >
import MemberActions from '#/components/MemberActions.vue'; // 或改为相对路径试试
// import {useVbenVxeGrid, VxeGridProps} from '#/adapter/vxe-table';
import type { VxeGridProps } from '#/adapter/vxe-table';
import {reactive, ref} from 'vue';
import { agentReqGameRecord,agentReqGameDetailRecord  } from '#/api/game';
import {message} from "ant-design-vue";
import { useVbenVxeGrid } from '#/adapter/vxe-table';
// 假设 Grid 已经定义好了，这里只展示如何在 action slot 使用 MemberActions
// 弹窗状态
const detailModalVisible = ref(false);
const detailLoading = ref(false);
const detailRecords = ref<GameDetailRecord[]>([]);
const detailPage = ref(1);
const detailPageSize = ref(10);
const detailTotalPages = ref(0);
const detailPid = ref<number | null>(null)
const searchState = reactive({
  dateRange: [] as any[],
  field: 'uid' as 'uid' | 'nickname',
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
async function fetchDetailPage() {
  if (!detailPid.value) return;
  // 明确取出 sortType 并打印（必做）
  const sortType = 0;
  console.log('[debug] fetchDetailPage -> pid, page, sortType =', detailPid.value, detailPage.value, sortType);

  detailLoading.value = true;
  try {
    // 确保 agentReqGameDetailRecord 实现能把 sortType 写入 body（见下方说明）
    const resp = await agentReqGameDetailRecord({
      pid: detailPid.value,
      pagNum: detailPage.value,
      showNum: detailPageSize.value,
      sortType, // <-- 一定要传这个
      requestPid: Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0),
    });

    // 后端返回层次可能不一样，统一解析
    const payload = (resp && (resp.data ?? resp)) ?? {};
    // 假设后端返回： payload.listInfo 是一个 list，每个元素是一个回合（包含 time, roomKey, recordCode, listInfo/players）
    const rawList = payload.listInfo ?? payload.list ?? [];

    // 把后端的结构标准化到 detailRecords 的结构： { time, roomKey, recordCode, players: [ {pid,name,headUrl,points} ] }
    detailRecords.value = (Array.isArray(rawList) ? rawList : []).map((round: any) => {
      const playersRaw = round.listInfo ?? round.players ?? [];
      return {
        time: round.time ?? round.date ?? '',
        roomKey: round.roomKey ?? round.roomKeyId ?? '',
        recordCode: round.recordCode ?? round.replayCode ?? '',
        players: (Array.isArray(playersRaw) ? playersRaw : []).map((p: any) => ({
          pid: Number(p.pid ?? p.id ?? 0),
          name: p.name ?? p.nickname ?? '',
          headUrl: p.headUrl ?? p.avatar ?? '',
          points: Number(p.points ?? p.score ?? 0),
        })),
      };
    });

    detailTotalPages.value = Number(payload.totalPages ?? payload.totalPagesCount ?? payload.total ?? 1);
  } catch (err) {
    console.error('[debug] fetchDetailPage error', err);
    message.error('获取战绩明细失败');
  } finally {
    detailLoading.value = false;
  }
}

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
const AGENT_PID = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);
const columns: VxeGridProps<RowItem>['columns'] = [
  { field: 'pid', title: 'PID'},
  {
    field: 'headUrl',
    title: '头像',
    slots: { default: 'avatar' },
  },
  { field: 'level', title: '身份' },
  { field: 'name', title: '玩家名称' },
  { field: 'setCount', title: '局数',
    sortable: false, // 使用自定义排序
    slots: { header: 'header-setCount' } },
  { field: 'bigWinnerCount', title: '大赢家',
    sortable: false,
    slots: { header: 'header-bigWinnerCount' } },
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
    width: 220,          // <- 必须给一个明确值（根据按钮数量调整）
    showOverflow: false,
    fixed: 'right',
    slots: { default: 'action' },
  },
];
const currentTargetPid = ref<number>(AGENT_PID);
const pidStack = ref<number[]>([]);
const gridOptions: VxeGridProps<RowItem> = {
  columns,
  height: 'auto',
  border: true,
  stripe: true,
  pagerConfig: { currentPage: 1, pageSize: searchState.pageSize, pageSizes: [10, 20, 50, 100] },
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
        const sortObj = (Array.isArray(sorts) && sorts[0]) ? sorts[0] : null;
        let mappedSortType = 0; // 默认
        if (sortObj) {
          if (sortObj.field === 'setCount') {
            mappedSortType = sortObj.order === 'desc' ? 1 : 2;
          } else if (sortObj.field === 'points') {
            mappedSortType = sortObj.order === 'desc' ? 3 : 4;
          } else if (sortObj.field === 'bigWinnerCount') {
            // 如果后端支持大赢家排序可以映射，这里留空或自定义
            // mappedSortType = sortObj.order === 'desc' ? 5 : 6;
          }
        }

        // 最终使用哪一个 sortType：优先使用 adapter 的 mappedSortType（非 0），否则使用 UI 状态 searchState.sortType
        const finalSortType = mappedSortType !== 0 ? mappedSortType : (searchState.sortType ?? 0);

        const [startDate, endDate] = searchState.dateRange ?? [];
        const params = {
          pagNum: page.currentPage,
          showNum: page.pageSize,
          field: searchState.field,
          keyword: searchState.keyword,
          sortType: finalSortType, // <- 这里使用 finalSortType（修复点）
          startDate,
          endDate,
          pid: currentTargetPid?.value ?? Number(localStorage.getItem('AGENT_PID') ?? 0),
          requestPid: Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0),
        };

        console.log('[debug] warRecord.query -> sending params:', params);

        let res;
        try {
          res = await agentReqGameRecord(params);
        } catch (err) {
          console.error('[debug] agentReqGameRecord request failed', err);
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
        statState.sumSetCount = Number(payload.sumSetCount ?? payload.sum_set_count ?? statState.sumSetCount ?? 0);
        statState.sumBigWinnerCount = Number(payload.sumBigWinnerCount ?? payload.sum_big_winner_count ?? statState.sumBigWinnerCount ?? 0);
        statState.sumPoints = Number(payload.sumPoints ?? payload.sum_points ?? statState.sumPoints ?? 0);

        // total 处理（优先后端给的 total / totalPages）
        let total = 0;
        if (typeof payload.total === 'number') {
          total = payload.total;
        } else if (typeof payload.totalPages === 'number' && payload.totalPages > 0) {
          total = payload.totalPages * page.pageSize;
        } else if (Array.isArray(rawList)) {
          total = rawList.length;
        }

        // 映射字段：注意 field 名和 columns 对齐（例子用 pid/headUrl/name/setCount/bigWinnerCount/points/remark）
        const list = (Array.isArray(rawList) ? rawList : []).map((it: any) => {
          const pid = Number(it.pid ?? it.id ?? 0);
          const isBannedFromServer = typeof it.isBanned !== 'undefined' ? !!it.isBanned : (typeof it.banned !== 'undefined' ? !!it.banned : undefined);
          const isBanned = typeof isBannedFromServer === 'boolean' ? isBannedFromServer : false;

          return {
            pid,
            headUrl: it.headUrl ?? it.avatar ?? it.headImageUrl ?? '',
            name: it.name ?? it.nickname ?? '',
            level: it.level ?? it.nobleLevel ?? 0,
            setCount: Number(it.setCount ?? it.set_count ?? it.rounds ?? 0),
            bigWinnerCount: Number(it.bigWinnerCount ?? it.big_winner_count ?? it.bigWinner ?? 0),
            points: Number(it.points ?? it.score ?? 0),
            remark: it.remark ?? it.setRemark ?? '',
            // 把后端原始数据和标准化字段放进 _raw，保证 MemberActions 能读取 pid/isBanned 等
            _raw: { ...(it ?? {}), pid, isBanned },
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
const [Grid, gridApi] = useVbenVxeGrid({ gridOptions });

// 回调：收到 child 的更新后合并并尝试局部刷新
function onRowUpdated_Generic(row: any, updated: Partial<any>) {
  Object.assign(row, updated);
  if (updated._raw) row._raw = Object.assign(row._raw || {}, updated._raw);
  // 如果适配器支持局部更新：
  if (typeof gridApi.updateRow === 'function') {
    gridApi.updateRow(row);
  } else {
    // 兜底：触发重渲染
    row._tmpRerender = (row._tmpRerender || 0) + 1;
  }
}

function onViewChildrenFromActions(row: any) {
  // 你已有的切换下级逻辑
  // push pid stack, set currentTargetPid, gridApi.reload()...
}
</script>

<template>
  <Grid table-title="玩家战绩">
    <!-- ...其它 slot ... -->
    <template #action="{ row }">
      <MemberActions
        :row="row"
        @view-children="() => onViewChildrenFromActions(row)"
        @row-updated="(updated) => onRowUpdated_Generic(row, updated)"
      />
    </template>
  </Grid>
</template>
