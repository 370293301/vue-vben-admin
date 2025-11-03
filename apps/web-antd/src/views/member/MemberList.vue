<script lang="ts" setup>
import type { VxeGridProps } from '#/adapter/vxe-table';

import {
  nextTick,
  onBeforeUnmount,
  onMounted,
  reactive,
  ref,
  watch,
} from 'vue';

import { Page } from '@vben/common-ui';
import { Button, Image, Input, message, Modal, Select, Pagination } from 'ant-design-vue';
import { useVbenVxeGrid } from '#/adapter/vxe-table';
import { apiGetMemberList } from '#/api/member';
import MemberActions from '#/components/MemberActions.vue';

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
  { label: '默认', value: 0 },
  { label: '钻石↓', value: 1 },
  { label: '钻石↑', value: 2 },
  { label: '金豆↓', value: 3 },
  { label: '金豆↑', value: 4 },
];

const currentTargetPid = ref<number>(
  Number(
    localStorage.getItem('AGENT_PID') ??
    localStorage.getItem('ACCOUNT_ID') ??
    0,
  ),
);

const pidStack = ref<number[]>([]);

const stats = reactive({
  totalCount: 0,
  totalPages: 0,
  sumDiamond: 0,
  sumGold: 0,
});

// 玩家列表数据
const playerList = ref<any[]>([]);
const loading = ref(false);
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

const columns: VxeGridProps<any>['columns'] = [
  { field: 'playerInfoNew', title: '玩家', minWidth: 100, slots: { default: 'cell-player-info' } },
  { field: 'crystal', title: '钻石', minWidth: 60 },
  { field: 'gold', title: '金豆', minWidth: 60 },
  { field: 'lowNum', title: '下级', minWidth: 50 },
  { field: 'fenCheng', title: '分成', minWidth: 50 },
  { field: 'action', title: '操作', minWidth: 90, slots: { default: 'action' } },
];

// 修改为独立的数据加载函数
async function loadPlayers(page: number = 1) {
  loading.value = true;
  try {
    const res = await apiGetMemberList({
      field: searchState.field,
      keyword: searchState.keyword,
      page: page,
      pageSize: pagination.pageSize,
      extra: {
        targetPid: currentTargetPid.value,
        sortType: sortState.sortType,
      },
    });

    const payload = res?.data?.data ?? {};
    const rawList = payload.listInfo ?? (payload as any).list ?? [];

    stats.sumDiamond = Number(payload.sumDiamond ?? 0);
    stats.sumGold = Number(payload.sumGold ?? 0);
    stats.totalPages = Number(payload.totalPages ?? 0);

    let total = 0;
    if (typeof (payload as any).total === 'number') {
      total = (payload as any).total;
    } else if (payload.totalPages === 1) {
      total = Array.isArray(rawList) ? rawList.length : 0;
    } else if (payload.totalPages > 1) {
      total = payload.totalPages * pagination.pageSize;
    } else {
      total = Array.isArray(rawList) ? rawList.length : 0;
    }

    stats.totalCount = total;
    pagination.total = total;
    pagination.current = page;

    const list = (rawList as any[]).map((it) => {
      const pid = Number(it.pid ?? it.id ?? 0);
      const isBannedFromServer =
        'banned' in it ? !!it.banned : 'isBanned' in it ? !!it.isBanned : undefined;
      const isBanned =
        typeof isBannedFromServer === 'boolean' ? isBannedFromServer : !!bannedCache[pid];

      return {
        id: pid,
        headImageUrl: it.headUrl ?? it.headImageUrl ?? it.avatar ?? '',
        name: it.name ?? it.nickname ?? '',
        level: it.level ?? 0,
        crystal: it.diamond ?? 0,
        gold: it.gold ?? it.bean ?? 0,
        markStr: it.markStr ?? '',
        lowNum: it.lowNum ?? 0,
        fenCheng: it.fenCheng != null ? it.fenCheng + '%' : '',
        _raw: { ...it, pid, isBanned },
        isBanned,
      };
    });

    playerList.value = list;
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  loadPlayers(1);
});

function onSearch() {
  loadPlayers(1);
}

function onSortChange() {
  loadPlayers(1);
}

function onPageChange(page: number) {
  loadPlayers(page);
}

function viewChildren(row: any) {
  const target = Number(row._raw?.pid ?? row.id ?? 0);
  if (!target) {
    message.warning('无效的子集 pid');
    return;
  }

  pidStack.value.push(currentTargetPid.value);
  currentTargetPid.value = target;
  loadPlayers(1);
}

function goBack() {
  if (pidStack.value.length === 0) return;
  const prev = pidStack.value.pop() as number;
  currentTargetPid.value = prev;
  loadPlayers(1);
}
</script>

<template>
  <Page auto-content-height>
    <!-- 统计信息 -->
    <div class="stats-row">
      <span>合计</span>
      <span>钻石:{{ stats.sumDiamond }}</span>
      <span>金豆:{{ stats.sumGold }}</span>
    </div>

    <!-- 搜索工具栏 -->
    <div class="toolbar">
      <div class="toolbar-search">
        <div class="search-row-1">
          <Select v-model:value="searchState.field" class="search-field">
            <Select.Option value="uid">ID</Select.Option>
            <Select.Option value="nickname">名称</Select.Option>
            <Select.Option value="mark">备注</Select.Option>
          </Select>
          <Input
            v-model:value="searchState.keyword"
            placeholder="搜索"
            allow-clear
            class="search-input"
          />
          <Button type="primary" @click="onSearch" class="search-btn">搜索</Button>
        </div>

        <div class="search-row-2">
          <Select v-model:value="sortState.sortType" @change="onSortChange" class="sort-select">
            <Select.Option v-for="opt in sortOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </Select.Option>
          </Select>

          <div class="button-group">
            <Button size="small" @click="onSearch">刷新</Button>
            <Button v-if="pidStack.length > 0" size="small" type="default" @click="goBack">
              返回
            </Button>
          </div>
        </div>

        <div class="search-row-3">
          <span class="pid-info">PID: {{ currentTargetPid }}</span>
        </div>
      </div>
    </div>

    <!-- 表格标题 + 表头 -->
    <div class="table-header">
      <div class="table-title">玩家列表</div>
      <div class="table-columns">
        <div class="col-player">玩家</div>
        <div class="col-crystal">钻石</div>
        <div class="col-gold">金豆</div>
        <div class="col-lownum">下级</div>
        <div class="col-fencheng">分成</div>
        <div class="col-action">操作</div>
      </div>
    </div>

    <!-- 玩家列表（卡片式） -->
    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="playerList.length === 0" class="empty-state">暂无玩家数据</div>
    <div v-else class="player-list">
      <div v-for="row in playerList" :key="row.id" class="player-row">
        <!-- 玩家信息 -->
        <div class="col-player">
          <div class="player-cell">
            <Image :src="row.headImageUrl" :width="40" :height="40" :preview="false" />
            <div class="player-info">
              <div class="player-id" :class="{ 'level-1': row.level === 1 }">
                {{ row.id }}
              </div>
              <div class="player-name" :class="{ 'level-1': row.level === 1 }">
                {{ row.name }}
              </div>
              <div v-if="row.markStr" class="player-mark">({{ row.markStr }})</div>
            </div>
          </div>
        </div>

        <!-- 钻石 -->
        <div class="col-crystal">{{ row.crystal }}</div>

        <!-- 金豆 -->
        <div class="col-gold">{{ row.gold }}</div>

        <!-- 下级 -->
        <div class="col-lownum">{{ row.lowNum }}</div>

        <!-- 分成 -->
        <div class="col-fencheng">{{ row.fenCheng }}</div>

        <!-- 操作 -->
        <div class="col-action">
          <MemberActions
            :row="row"
            @view-children="viewChildren"
            @row-updated="() => loadPlayers(pagination.current)"
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
  gap: 16px;
  padding: 12px;
  border-radius: 4px;
  margin-bottom: 12px;
  font-size: 14px;
  align-items: center;
}

.stats-row span:first-child {
  font-weight: 600;
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
  gap: 6px;
  align-items: center;
  flex-wrap: wrap;
}

.search-field {
  width: 70px !important;
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
  width: 90px !important;
}

.button-group {
  display: flex;
  gap: 6px;
}

.pid-info {
  font-size: 12px;
  color: #666;
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

.table-columns .col-crystal,
.table-columns .col-gold,
.table-columns .col-lownum,
.table-columns .col-fencheng {
  flex: 0.8;
  justify-content: center;
}

.table-columns .col-action {
  flex: 0.8;
  justify-content: center;
}

/* ===== 玩家列表 ===== */
.player-list {

  border-radius: 4px;
  overflow: hidden;
}

.player-row {
  display: flex;
  gap: 0;
  padding: 8px 0;
  border-bottom: 1px solid #e8e8e8;
  align-items: center;
}

.player-row:last-child {
  border-bottom: none;
}

.player-row > div {
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
}

.col-crystal,
.col-gold,
.col-lownum,
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

.player-row > div {
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
}

.col-player {
  justify-content: center;
  flex: 1.2;
}

.col-action {
  justify-content: center;
  flex: 1;
}

.col-crystal,
.col-gold,
.col-lownum,
.col-fencheng {
  font-size: 13px;
  text-align: center;
  flex: 0.8;
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
  flex-shrink: 0;
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
  font-size: 12px;
  font-weight: 600;
  line-height: 1.2;
  word-break: break-word;
  overflow-wrap: break-word;
}

.player-name {
  font-size: 11px;
  line-height: 1.2;
  word-break: break-word;
  overflow-wrap: break-word;
}

.player-mark {
  font-size: 10px;
  line-height: 1.2;
  word-break: break-word;
  overflow-wrap: break-word;
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
  .search-field {
    width: 60px !important;
  }

  .search-btn {
    min-width: 50px;
  }

  .sort-select {
    width: 80px !important;
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

  .col-crystal,
  .col-gold,
  .col-lownum,
  .col-fencheng {
    font-size: 10px;
  }

  .table-columns > div,
  .player-row > div {
    padding: 4px 4px;
  }

  .col-player {
    flex: 1;
  }

  .col-crystal,
  .col-gold,
  .col-lownum,
  .col-fencheng {
    flex: 0.7;
  }

  .col-action {
    flex: 0.9;
  }

  .player-info {
    gap: 1px;
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
    min-width: 300px;
  }

  .search-row-2 {
    display: flex;
    gap: 8px;
  }

  .search-row-3 {
    flex: 1;
    justify-content: flex-end;
  }

  .search-field {
    width: 80px !important;
  }

  .search-input {
    width: 200px;
  }

  .player-cell :deep(img) {
    width: 34px;
    height: 34px;
  }

  .player-id {
    font-size: 11px;
  }

  .player-name {
    font-size: 10px;
  }

  .player-mark {
    font-size: 9px;
  }

  .col-crystal,
  .col-gold,
  .col-lownum,
  .col-fencheng {
    font-size: 11px;
  }

  .col-player {
    flex: 1.1;
  }

  .col-crystal,
  .col-gold,
  .col-lownum,
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
    gap: 12px;
  }

  .search-row-1,
  .search-row-2 {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .search-row-3 {
    margin-left: auto;
  }

  .search-field {
    width: 100px !important;
  }

  .search-input {
    width: 200px;
  }

  .search-btn {
    min-width: 70px;
  }

  .sort-select {
    width: 120px !important;
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

  .player-mark {
    font-size: 9px;
  }

  .col-crystal,
  .col-gold,
  .col-lownum,
  .col-fencheng {
    font-size: 12px;
  }

  .col-player {
    flex: 1.2;
  }

  .col-crystal,
  .col-gold,
  .col-lownum,
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
  .search-row-2 {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .search-row-3 {
    margin-left: auto;
  }

  .search-field {
    width: 100px !important;
  }

  .search-input {
    width: 280px;
  }

  .search-btn {
    min-width: 70px;
  }

  .sort-select {
    width: 140px !important;
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

  .col-crystal,
  .col-gold,
  .col-lownum,
  .col-fencheng {
    font-size: 13px;
  }

  .col-player {
    flex: 1.3;
  }

  .col-crystal,
  .col-gold,
  .col-lownum,
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
