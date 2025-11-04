<script lang="ts" setup>
import { createVNode, reactive, ref, render } from 'vue';
import dayjs from 'dayjs';
import { useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';

import {
  Button,
  DatePicker,
  Image,
  Input,
  message,
  Select,
  Pagination,
} from 'ant-design-vue';

import { agentReqGameRecord } from '#/api/game';
import MemberActions from '#/components/MemberActions.vue';
import DetailModalContent from './DetailModalContent.vue';

const router = useRouter();
const { RangePicker } = DatePicker;

// 弹窗状态
const detailPageSize = ref(10);

function openRecordList(row: any) {
  const pid = Number(row.pid ?? row.id ?? row._raw?.pid ?? 0);
  if (!pid) {
    message.warning('无效的 pid');
    return;
  }
  router.push({ name: 'RecordList', query: { pid: String(pid) } });
}

function openDetailModal(row: any, page = 1) {
  const pid = Number(row.pid ?? row.id ?? row._raw?.pid ?? 0);
  if (!pid) {
    message.warning('无效的 pid');
    return;
  }

  const container = document.createElement('div');
  document.body.append(container);

  function onClose() {
    try {
      render(null, container);
      if (container.parentNode) container.remove();
    } catch (error) {
      console.warn('closing modal render error', error);
    }
  }

  const vnode = createVNode(DetailModalContent, {
    pid,
    pageSize: detailPageSize,
    initialPage: page,
    onClose,
  });

  render(vnode, container);
}

// 初始 PID
const AGENT_PID = Number(
  localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0,
);

// 排序状态
const colSortState = reactive({
  setCount: 0,
  points: 0,
});

function onHeaderSort(col: 'points' | 'setCount') {
  colSortState[col] = (colSortState[col] + 1) % 3;
  const order =
    colSortState[col] === 1
      ? 'desc'
      : colSortState[col] === 2
        ? 'asc'
        : undefined;

  if (col === 'setCount') {
    searchState.sortType =
      colSortState.setCount === 1 ? 1 : colSortState.setCount === 2 ? 2 : 0;
    colSortState.points = 0;
  } else {
    searchState.sortType =
      colSortState.points === 1 ? 3 : colSortState.points === 2 ? 4 : 0;
    colSortState.setCount = 0;
  }

  loadRecords(1);
}

// 搜索状态
const searchState = reactive({
  timeRange: [
    dayjs().startOf('day').valueOf(),
    dayjs().endOf('day').valueOf(),
  ] as any,
  field: 'uid' as 'uid' | 'nickname' | 'mark',
  keyword: '',
  sortType: 0,
  pageSize: 10,
});

// 统计信息
const statState = reactive({
  sumSetCount: 0,
  sumBigWinnerCount: 0,
  sumPoints: 0,
});

// 玩家记录数据
const recordList = ref<any[]>([]);
const loading = ref(false);
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

// PID 管理
const currentTargetPid = ref<number>(AGENT_PID);
const pidStack = ref<number[]>([]);

// 加载数据
async function loadRecords(page: number = 1) {
  loading.value = true;
  try {
    let startTime = 0;
    let endTime = 0;
    if (searchState.timeRange && searchState.timeRange.length === 2) {
      startTime = Math.floor(searchState.timeRange[0] / 1000);
      endTime = Math.floor(searchState.timeRange[1] / 1000);
    }

    const params = {
      pagNum: page,
      showNum: pagination.pageSize,
      field: searchState.field,
      keyword: searchState.keyword,
      sortType: searchState.sortType,
      startTime,
      endTime,
      pid: currentTargetPid.value ?? AGENT_PID,
      requestPid: AGENT_PID,
    };

    console.log('[debug] loadRecords params:', params);

    const res = await agentReqGameRecord(params);
    const maybe = res?.data ?? res;
    const payload = (maybe && (maybe.data ?? maybe)) ?? maybe ?? {};

    const rawList =
      payload.listInfo ??
      payload.list ??
      payload.data?.listInfo ??
      payload.data?.list ??
      (Array.isArray(payload) ? payload : []);

    statState.sumSetCount = Number(
      payload.sumSetCount ?? payload.sum_set_count ?? 0,
    );
    statState.sumBigWinnerCount = Number(
      payload.sumBigWinnerCount ?? payload.sum_big_winner_count ?? 0,
    );
    statState.sumPoints = Number(
      payload.sumPoints ?? payload.sum_points ?? 0,
    );

    let total = 0;
    if (typeof payload.total === 'number') {
      total = payload.total;
    } else if (
      typeof payload.totalPages === 'number' &&
      payload.totalPages > 0
    ) {
      total = payload.totalPages * pagination.pageSize;
    } else if (Array.isArray(rawList)) {
      total = rawList.length;
    }
    // ✅ 新增：检查是否只有一个玩家且pid等于当前targetPid
    const isSelfOnly =
      Array.isArray(rawList) &&
      rawList.length === 1 &&
      Number(rawList[0]?.pid ?? rawList[0]?.id ?? 0) === currentTargetPid.value;
    const list = (Array.isArray(rawList) ? rawList : []).map((it: any) => {
      const pid = Number(it.pid ?? it.id ?? 0);
      const isBannedFromServer = ('banned' in it)
        ? !!it.banned
        : ('isBanned' in it ? !!it.isBanned : undefined);
      const isBanned =
        typeof isBannedFromServer === 'boolean' ? isBannedFromServer : false;

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
        _raw: { ...it, pid, isBanned },
        isBanned,
        canViewChildren: !isSelfOnly, // ✅ 禁用标志：true 表示可以查看，false 表示不能查看
      };
    });

    recordList.value = list;
    pagination.total = total;
    pagination.current = page;
  } catch (error) {
    console.error('[debug] loadRecords failed', error);
    message.error('查询失败，请检查网络');
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  loadRecords(1);
}

function onPageChange(page: number) {
  loadRecords(page);
}

function viewChildren(row: any) {
  const target = Number(row.pid ?? 0);
  if (!target) {
    message.warning('无效的 pid');
    return;
  }
  pidStack.value.push(currentTargetPid.value);
  currentTargetPid.value = target;
  loadRecords(1);
}

function goBack() {
  if (pidStack.value.length === 0) return;
  const prev = pidStack.value.pop() as number;
  currentTargetPid.value = prev;
  loadRecords(1);
}

// 初始加载
loadRecords(1);
</script>

<template>
  <Page auto-content-height>
    <!-- 统计信息 -->
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-label">总局数：</span>
        <span class="stat-value">{{ statState.sumSetCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">总大赢家：</span>
        <span class="stat-value">{{ statState.sumBigWinnerCount }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">总得分：</span>
        <span class="stat-value">{{ statState.sumPoints }}</span>
      </div>
      <div class="stat-item" style="margin-left: auto">
        <span class="stat-label">PID：</span>
        <span class="stat-value">{{ currentTargetPid }}</span>
      </div>
    </div>

    <!-- 搜索工具栏 -->
    <div class="toolbar">
      <div class="toolbar-search">
        <!-- 第一行：时间选择 -->
        <div class="search-row-1">
          <RangePicker
            v-model:value="searchState.timeRange"
            class="time-picker"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            value-format="x"
          />
        </div>

        <!-- 第二行：搜索和筛选 -->
        <div class="search-row-2">
          <Select
            v-model:value="searchState.field"
            class="search-field"
          >
            <Select.Option value="uid">玩家ID</Select.Option>
            <Select.Option value="nickname">玩家名称</Select.Option>
            <Select.Option value="mark">备注</Select.Option>
          </Select>
          <Input
            v-model:value="searchState.keyword"
            placeholder="搜索"
            allow-clear
            class="search-input"
          />
          <Button type="primary" @click="onSearch" class="search-btn">
            搜索
          </Button>
        </div>

        <!-- 第三行：排序和操作 -->
        <div class="search-row-3">
          <Select
            v-model:value="searchState.sortType"
            @change="() => loadRecords(1)"
            class="sort-select"
          >
            <Select.Option :value="0">默认排序</Select.Option>
            <Select.Option :value="1">局数 ↓</Select.Option>
            <Select.Option :value="2">局数 ↑</Select.Option>
            <Select.Option :value="3">得分 ↓</Select.Option>
            <Select.Option :value="4">得分 ↑</Select.Option>
          </Select>

          <Select
            v-model:value="pagination.pageSize"
            @change="() => loadRecords(1)"
            class="page-size-select"
          >
            <Select.Option :value="10">10/页</Select.Option>
            <Select.Option :value="20">20/页</Select.Option>
            <Select.Option :value="50">50/页</Select.Option>
            <Select.Option :value="100">100/页</Select.Option>
          </Select>

          <div class="button-group">
            <Button size="small" @click="() => loadRecords(pagination.current)">
              刷新
            </Button>
            <Button v-if="pidStack.length > 0" size="small" type="default" @click="goBack">
              返回
            </Button>
          </div>
        </div>
      </div>
    </div>

    <!-- 表格标题 + 表头 -->
    <div class="table-header">
      <div class="table-title">玩家战绩</div>
      <div class="table-columns">
        <div class="col-player">玩家</div>
        <div class="col-setcount">局数</div>
        <div class="col-bigwinner">大赢家</div>
        <div class="col-points">得分</div>
        <div class="col-action">操作</div>
      </div>
    </div>

    <!-- 玩家列表 -->
    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="recordList.length === 0" class="empty-state">暂无数据</div>
    <div v-else class="record-list">
      <div v-for="row in recordList" :key="row.pid" class="record-row">
        <!-- 玩家信息 -->
        <div class="col-player">
          <div class="player-cell">
            <Image
              :src="row.headUrl"
              :width="40"
              :height="40"
              :preview="false"
            />
            <div class="player-info">
              <div class="player-id" :class="{ 'level-1': row.level === 1 }">
                {{ row.pid }}
              </div>
              <div class="player-name" :class="{ 'level-1': row.level === 1 }">
                {{ row.name }}
              </div>
              <div v-if="row.markStr" class="player-mark">
                ({{ row.markStr }})
              </div>
            </div>
          </div>
        </div>

        <!-- 局数 -->
        <div class="col-setcount">{{ row.setCount }}</div>

        <!-- 大赢家 -->
        <div class="col-bigwinner">{{ row.bigWinnerCount }}</div>

        <!-- 得分 -->
        <div class="col-points">
          <a
            @click.prevent="openRecordList(row)"
            class="score-link"
          >
            {{ row.points }}
          </a>
        </div>

        <!-- 操作 -->
        <div class="col-action">
          <MemberActions
            :row="row"
            @view-children="viewChildren"
            @row-updated="() => loadRecords(pagination.current)"
          />
        </div>
      </div>
    </div>

    <!-- 分页 -->
    <div class="pagination-wrapper">
      <Pagination
        v-model:current="pagination.current"
        :total="pagination.total"
        :page-size="pagination.pageSize"
        :page-size-options="['10', '20', '50', '100']"
        show-size-changer
        @change="onPageChange"
        @show-size-change="(_, size) => {
          pagination.pageSize = size;
          onPageChange(1);
        }"
      />
    </div>
  </Page>
</template>

<style scoped>
.level-1 {
  color: #ff4d4f;
  font-weight: 600;
}

/* ===== 统计信息 ===== */
.stats-row {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 12px;
  align-items: center;
  flex-wrap: wrap;
}

.stat-item {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 14px;
}

.stat-label {
  font-weight: 600;
  color: #666;
}

.stat-value {
  font-weight: 600;
  color: #1890ff;
  font-size: 16px;
}

/* ===== 工具栏 ===== */
.toolbar {
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 12px;
}

.toolbar-search {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.search-row-1,
.search-row-2,
.search-row-3 {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.time-picker {
  width: 100%;
  max-width: 320px;
}

.search-field {
  width: 80px !important;
}

.search-input {
  flex: 1;
  min-width: 120px;
}

.search-btn {
  min-width: 60px;
  height: 32px;
}

.sort-select {
  width: 100px !important;
}

.page-size-select {
  width: 80px !important;
}

.button-group {
  display: flex;
  gap: 6px;
}

/* ===== 表格 ===== */
.table-header {
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 2px;
}

.table-title {
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  border-bottom: 1px solid #f0f0f0;
}

.table-columns {
  display: flex;
  gap: 0;
  padding: 6px 0;
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid #e8e8e8;
}

.table-columns > div {
  padding: 6px 0;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
  flex: 1;
  min-width: 0;
}

.table-columns .col-player {
  flex: 0.8;
  justify-content: center;
}

.table-columns .col-setcount,
.table-columns .col-bigwinner,
.table-columns .col-points {
  flex: 0.8;
  justify-content: center;
}

.table-columns .col-action {
  flex: 0.8;
  justify-content: center;
}

/* ===== 列表 ===== */
.record-list {
  border-radius: 4px;
  overflow: hidden;
}

.record-row {
  display: flex;
  gap: 0;
  padding: 8px 0;
  border-bottom: 1px solid #e8e8e8;
  align-items: center;
}

.record-row:last-child {
  border-bottom: none;
}

.record-row > div {
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  flex: 1;
  min-width: 0;
}

.col-player {
  flex: 1.2;
  justify-content: center;
  align-items: center;
}

.col-setcount,
.col-bigwinner,
.col-points {
  font-size: 13px;
  text-align: center;
  flex: 0.8;
  justify-content: center;
}

.col-action {
  flex: 1;
  justify-content: center;
}

/* 玩家信息 */
.player-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  width: 100%;
}

.player-cell :deep(img) {
  width: 40px;
  height: 40px;
  border-radius: 4px;
  object-fit: cover;
}

.player-info {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  text-align: center;
}

.player-id {
  font-size: 11px;
  font-weight: 600;
  line-height: 1.2;
}

.player-name {
  font-size: 10px;
  line-height: 1.2;
}

.player-mark {
  font-size: 9px;
  line-height: 1.2;
}

.score-link {
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
  color: #1890ff;
}

.score-link:hover {
  color: #40a9ff;
}

/* ===== 加载和空状态 ===== */
.loading-state,
.empty-state {
  padding: 24px;
  text-align: center;
  color: #999;
  font-size: 14px;
  border-radius: 4px;
}

/* ===== 分页 ===== */
.pagination-wrapper {
  padding: 12px;
  border-radius: 4px;
  margin-top: 12px;
  display: flex;
  justify-content: center;
}

/* ===== 响应式布局 ===== */
/* 小屏幕 (手机) */
@media (max-width: 600px) {
  .stats-row {
    gap: 12px;
    padding: 8px 12px;
  }

  .stat-item {
    font-size: 12px;
  }

  .stat-value {
    font-size: 14px;
  }

  .search-field {
    width: 70px !important;
  }

  .search-btn {
    min-width: 50px;
  }

  .sort-select {
    width: 90px !important;
  }

  .player-cell :deep(img) {
    width: 32px;
    height: 32px;
  }

  .player-id {
    font-size: 10px;
  }

  .player-name {
    font-size: 9px;
  }

  .player-mark {
    font-size: 8px;
  }

  .col-setcount,
  .col-bigwinner,
  .col-points {
    font-size: 10px;
  }

  .table-columns > div,
  .record-row > div {
    padding: 4px 4px;
  }

  .col-player {
    flex: 1;
  }

  .col-setcount,
  .col-bigwinner,
  .col-points {
    flex: 0.7;
  }

  .col-action {
    flex: 0.9;
  }

  .player-info {
    gap: 1px;
  }

  .time-picker {
    max-width: 100%;
  }
}

/* 中等屏幕 (平板 600-900px) */
@media (min-width: 601px) and (max-width: 900px) {
  .toolbar-search {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .search-row-1 {
    flex: 1;
    min-width: 100%;
  }

  .search-row-2 {
    flex: 1;
    min-width: 300px;
  }

  .search-row-3 {
    flex: 1;
    min-width: 300px;
  }

  .search-field {
    width: 80px !important;
  }

  .search-input {
    width: 150px;
  }

  .player-cell :deep(img) {
    width: 36px;
    height: 36px;
  }

  .player-id {
    font-size: 11px;
  }

  .player-name {
    font-size: 10px;
  }

  .col-setcount,
  .col-bigwinner,
  .col-points {
    font-size: 11px;
  }

  .col-player {
    flex: 1.1;
  }

  .col-setcount,
  .col-bigwinner,
  .col-points {
    flex: 0.8;
  }

  .col-action {
    flex: 1;
  }

  .player-info {
    gap: 2px;
  }
}

/* 大屏幕 (PC 901-1400px) */
@media (min-width: 901px) and (max-width: 1400px) {
  .toolbar-search {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .search-row-1,
  .search-row-2,
  .search-row-3 {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .search-row-1 {
    flex: 1;
  }

  .search-field {
    width: 90px !important;
  }

  .search-input {
    width: 180px;
  }

  .player-cell :deep(img) {
    width: 36px;
    height: 36px;
  }

  .player-id {
    font-size: 11px;
  }

  .player-name {
    font-size: 10px;
  }

  .col-setcount,
  .col-bigwinner,
  .col-points {
    font-size: 12px;
  }

  .col-player {
    flex: 1.2;
  }

  .col-setcount,
  .col-bigwinner,
  .col-points {
    flex: 0.9;
  }

  .col-action {
    flex: 1;
  }

  .player-info {
    gap: 2px;
  }
}

/* 超大屏幕 (PC 1400px+) */
@media (min-width: 1401px) {
  .toolbar-search {
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }

  .search-row-1,
  .search-row-2,
  .search-row-3 {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .search-field {
    width: 100px !important;
  }

  .search-input {
    width: 220px;
  }

  .sort-select {
    width: 130px !important;
  }

  .player-cell :deep(img) {
    width: 40px;
    height: 40px;
  }

  .player-id {
    font-size: 12px;
  }

  .player-name {
    font-size: 11px;
  }

  .player-mark {
    font-size: 10px;
  }

  .col-setcount,
  .col-bigwinner,
  .col-points {
    font-size: 13px;
  }

  .col-player {
    flex: 1.3;
  }

  .col-setcount,
  .col-bigwinner,
  .col-points {
    flex: 1;
  }

  .col-action {
    flex: 1.1;
  }

  .player-info {
    gap: 3px;
  }
}
</style>
