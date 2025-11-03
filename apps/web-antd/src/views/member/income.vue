<script lang="ts" setup>
import { reactive, ref } from 'vue';
import dayjs from 'dayjs';

import { Page } from '@vben/common-ui';
import { Button, Image, Input, message, Select, DatePicker, Pagination } from 'ant-design-vue';

import MemberActions from '#/components/MemberActions.vue';
import { agentReqPayBack } from '#/api/game';

const { RangePicker } = DatePicker;

const bannedCache: Record<number, boolean> = reactive({});

// 搜索状态
const searchState = reactive({
  field: 'uid' as 'uid' | 'nickname' | 'mark',
  keyword: '',
});

// 排序状态
const sortState = reactive({
  sortType: 0,
});

const sortOptions = [
  { label: '默认排序', value: 0 },
  { label: '贡献 ↓', value: 1 },
  { label: '贡献 ↑', value: 2 },
  { label: '我的收益 ↓', value: 3 },
  { label: '我的收益 ↑', value: 4 },
];

const revenueTypeMap: Record<number | string, string> = {
  1: '推荐人',
  2: '代理',
  3: '广告',
};

// 时间范围
const timeRange = ref<[dayjs.Dayjs, dayjs.Dayjs] | null>(null);

// 当前查询的目标 pid
const currentTargetPid = ref<number>(
  Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0),
);

// pid 历史栈
const pidStack = ref<number[]>([]);

// 统计信息
const stats = reactive({
  sumPayBack: 0,
  sumContribution: 0,
});

// 收益列表数据
const revenueList = ref<any[]>([]);
const loading = ref(false);
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

// 加载数据
async function loadRevenue(page: number = 1) {
  loading.value = true;
  try {
    let startTime = 0;
    let endTime = 0;
    if (timeRange.value && timeRange.value.length === 2) {
      startTime = Math.floor(timeRange.value[0] / 1000);
      endTime = Math.floor(timeRange.value[1] / 1000);
    }

    const resp = await agentReqPayBack({
      page,
      pageSize: pagination.pageSize,
      field: searchState.field,
      keyword: searchState.keyword,
      sortType: sortState.sortType,
      targetPid: currentTargetPid.value,
      startTime,
      endTime,
    });

    const maybe = resp?.data ?? resp ?? {};
    const payload = maybe.data ?? maybe;
    const rawList = payload.listInfo ?? payload.list ?? [];

    stats.sumPayBack = Number(payload.sumPayBack ?? payload.sumPayback ?? 0);
    stats.sumContribution = Number(payload.sumContribution ?? 0);

    let total = 0;
    if (typeof payload.total === 'number') {
      total = payload.total;
    } else if (payload.totalPages === 1) {
      total = Array.isArray(rawList) ? rawList.length : 0;
    } else if (typeof payload.totalPages === 'number' && payload.totalPages > 1) {
      total = payload.totalPages * pagination.pageSize;
    } else {
      total = Array.isArray(rawList) ? rawList.length : 0;
    }

    const list = (Array.isArray(rawList) ? rawList : []).map((it: any) => {
      const pid = Number(it.pid ?? it.id ?? 0);
      const rawRevenueType = it.revenueType ?? it.revenue_type ?? it.revenueTypeVal ?? it.type ?? '';
      const numericType = isNaN(Number(rawRevenueType)) ? rawRevenueType : Number(rawRevenueType);

      return {
        pid,
        headUrl: it.headUrl ?? it.avatar ?? it.headImageUrl ?? '',
        level: it.level ?? it.identity ?? 0,
        name: it.name ?? it.nickname ?? '',
        contributions: Number(it.contributions ?? it.contribution ?? 0),
        revenueType: revenueTypeMap[numericType as any] ?? String(rawRevenueType ?? ''),
        revenue: Number(it.revenue ?? it.myRevenue ?? it.revenueValue ?? 0),
        markStr: it.markStr ?? '',
        fenCheng: it.fenCheng != null ? it.fenCheng + '%' : '',
        _raw: { ...it, pid },
      };
    });

    revenueList.value = list;
    pagination.total = total;
    pagination.current = page;
  } catch (error) {
    console.error('[debug] loadRevenue failed', error);
    message.error('查询失败，请检查网络');
  } finally {
    loading.value = false;
  }
}

function onSearch() {
  loadRevenue(1);
}

function onPageChange(page: number) {
  loadRevenue(page);
}

function onSortChange(v: number) {
  sortState.sortType = v;
  loadRevenue(1);
}

function viewChildren(row: any) {
  const target = Number(row._raw?.pid ?? row.pid ?? 0);
  if (!target) {
    message.warning('无效的子集 pid');
    return;
  }
  pidStack.value.push(currentTargetPid.value);
  currentTargetPid.value = target;
  loadRevenue(1);
}

function goBack() {
  if (pidStack.value.length === 0) return;
  const prev = pidStack.value.pop() as number;
  currentTargetPid.value = prev;
  loadRevenue(1);
}

// 初始加载
loadRevenue(1);
</script>

<template>
  <Page auto-content-height>
    <!-- 统计信息 -->
    <div class="stats-row">
      <div class="stat-item">
        <span class="stat-label">总贡献：</span>
        <span class="stat-value">{{ stats.sumContribution }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">总收益：</span>
        <span class="stat-value">{{ stats.sumPayBack }}</span>
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
            v-model:value="timeRange"
            class="time-picker"
            placeholder="选择时间范围"
            :show-time="{ format: 'HH:mm:ss' }"
            format="YYYY-MM-DD HH:mm:ss"
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
            <Select.Option value="mark">备注标记</Select.Option>
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
            v-model:value="sortState.sortType"
            @change="onSortChange"
            class="sort-select"
          >
            <Select.Option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </Select.Option>
          </Select>

          <div class="button-group">
            <Button size="small" @click="() => loadRevenue(pagination.current)">
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
      <div class="table-title">玩家收益</div>
      <div class="table-columns">
        <div class="col-player">玩家</div>
        <div class="col-contributions">贡献</div>
        <div class="col-type">类型</div>
        <div class="col-revenue">我的收益</div>
        <div class="col-fencheng">分成</div>
        <div class="col-action">操作</div>
      </div>
    </div>

    <!-- 列表 -->
    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="revenueList.length === 0" class="empty-state">暂无数据</div>
    <div v-else class="revenue-list">
      <div v-for="row in revenueList" :key="row.pid" class="revenue-row">
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

        <!-- 贡献 -->
        <div class="col-contributions">{{ row.contributions }}</div>

        <!-- 类型 -->
        <div class="col-type">{{ row.revenueType }}</div>

        <!-- 我的收益 -->
        <div class="col-revenue">{{ row.revenue }}</div>

        <!-- 分成 -->
        <div class="col-fencheng">{{ row.fenCheng }}</div>

        <!-- 操作 -->
        <div class="col-action">
          <MemberActions
            :row="row"
            @view-children="viewChildren"
            @row-updated="() => loadRevenue(pagination.current)"
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
  padding: 6px 8px;
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

.table-columns .col-contributions,
.table-columns .col-type,
.table-columns .col-revenue,
.table-columns .col-fencheng {
  flex: 0.8;
  justify-content: center;
}

.table-columns .col-action {
  flex: 0.8;
  justify-content: center;
}

/* ===== 列表 ===== */
.revenue-list {
  border-radius: 4px;
  overflow: hidden;
}

.revenue-row {
  display: flex;
  gap: 0;
  padding: 8px 0;
  border-bottom: 1px solid #e8e8e8;
  align-items: center;
}

.revenue-row:last-child {
  border-bottom: none;
}

.revenue-row > div {
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
  flex: 0.8;
  justify-content: center;
  align-items: center;
}

.col-contributions,
.col-type,
.col-revenue,
.col-fencheng {
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

  .col-contributions,
  .col-type,
  .col-revenue,
  .col-fencheng {
    font-size: 10px;
  }

  .table-columns > div,
  .revenue-row > div {
    padding: 4px 4px;
  }

  .col-player {
    flex: 1.2;
  }

  .col-contributions,
  .col-type,
  .col-revenue,
  .col-fencheng {
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

  .col-contributions,
  .col-type,
  .col-revenue,
  .col-fencheng {
    font-size: 11px;
  }

  .col-player {
    flex: 1.1;
  }

  .col-contributions,
  .col-type,
  .col-revenue,
  .col-fencheng {
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

  .col-contributions,
  .col-type,
  .col-revenue,
  .col-fencheng {
    font-size: 12px;
  }

  .col-player {
    flex: 1.2;
  }

  .col-contributions,
  .col-type,
  .col-revenue,
  .col-fencheng {
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

  .col-contributions,
  .col-type,
  .col-revenue,
  .col-fencheng {
    font-size: 13px;
  }

  .col-player {
    flex: 1.3;
  }

  .col-contributions,
  .col-type,
  .col-revenue,
  .col-fencheng {
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
