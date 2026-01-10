<script lang="ts" setup>
import type { CompetitionMember, CompetitionSummary } from '#/api/competition';

import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import { Image, Input, message } from 'ant-design-vue';

import {
  apiGetCompetitionMembers,
  apiGetPlayerBalance,
} from '#/api/competition';

import CompetitionMemberActions from './CompetitionMemberActions.vue';

const router = useRouter();

// ===== 俱乐部数据 =====
interface Club {
  id: number;
  name: string;
  clubsign: number;
  unionId?: number; // 添加 unionId 字段
}

const clubList = ref<Club[]>([]);
const currentClubId = ref<null | number>(null);
const currentClubSign = ref<null | number>(null);
const currentClubName = ref<string>('');
const currentUnionId = ref<null | number>(null); // 新增当前 unionId
// 在已有的 ref 定义区域添加
const isPort5667 = ref(false);
// ✨ 新增: 搜索关键词
const searchQuery = ref<string>('');
// ===== 成员列表数据 =====
const memberList = ref<CompetitionMember[]>([]);
const summary = ref<CompetitionSummary | null>(null);
const loading = ref(false);

// ✨ 新增: 当前登录玩家余额信息
const playerBalance = ref({
  sportsPoint: 0, // 竞技点余额
  allowSportsPoint: 0, // 可操作竞技点额度
  caseSportsPoint: 0, // 保险柜竞技点
  prizePoint: 0, // 奖励点数
  loading: false, // 加载状态
});

// ===== 排序和筛选 =====
const timeType = ref(0);
const sortBy = ref(1);
const sortOrder = ref(1);

// ===== 时间选项 =====
const getTimeOptions = () => {
  const today = new Date();

  const formatDate = (daysAgo: number) => {
    const date = new Date(today);
    date.setDate(date.getDate() - daysAgo);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    return `${month}月${day}号`;
  };

  return [
    { label: '今天', value: 0, displayLabel: '今天' },
    { label: '昨天', value: 1, displayLabel: '昨天' },
    { label: formatDate(2), value: 2, displayLabel: formatDate(2) },
    { label: formatDate(3), value: 3, displayLabel: formatDate(3) },
    { label: formatDate(4), value: 4, displayLabel: formatDate(4) },
    { label: formatDate(5), value: 5, displayLabel: formatDate(5) },
    { label: formatDate(6), value: 6, displayLabel: formatDate(6) },
  ];
};

const timeOptions = getTimeOptions();

// ===== 排序选项 =====
const sortOptions = [
  { label: '比赛分', value: 1 },
  { label: '局数', value: 2 },
  { label: '大赢家', value: 3 },
  { label: '奖励', value: 4 },
  { label: '贡献', value: 5 },
  { label: '战绩', value: 6 },
];

// ===== 计算排序参数 =====
const orderBy = computed(() => {
  return Number(`${sortOrder.value}${sortBy.value}`);
});
// ✨ 新增: 过滤后的成员列表
const filteredMemberList = computed(() => {
  let result = memberList.value;
  // 5667端口不启用搜索功能
  if (isPort5667.value) {
    const currentPid = Number(
      localStorage.getItem('AGENT_PID') ??
        localStorage.getItem('ACCOUNT_ID') ??
        0,
    );

    if (currentPid) {
      result = memberList.value.filter((member) => member.pid === currentPid);
    }
    return result;
  }

  if (!searchQuery.value.trim()) {
    return memberList.value;
  }

  const query = searchQuery.value.toLowerCase().trim();
  return memberList.value.filter((member) => {
    // 搜索 PID、昵称
    const pidMatch = String(member.pid || '')
      .toLowerCase()
      .includes(query);
    const nameMatch = String(member.name || '')
      .toLowerCase()
      .includes(query);
    return pidMatch || nameMatch;
  });
});
// ===== 初始化 =====
onMounted(() => {
  const currentPort = window.location.port;
  console.log('当前端口:', currentPort); // 输出: "5667" 或其他端口

  isPort5667.value = currentPort === '5667';
  console.log('是否为5667端口:', isPort5667.value); // 输出: true 或 false
  loadClubList();
});

// 从 localStorage 加载俱乐部列表
function loadClubList() {
  try {
    const clubListStr = localStorage.getItem('clubList');
    if (clubListStr) {
      const parsedList = JSON.parse(clubListStr);
      if (Array.isArray(parsedList)) {
        clubList.value = parsedList;
        if (clubList.value.length > 0) {
          const firstClub = clubList.value[0];
          currentClubId.value = firstClub.id;
          currentClubSign.value = firstClub.clubsign;
          currentClubName.value = firstClub.name;

          // 尝试获取 unionId (可能从 id 或 clubsign 获取)
          currentUnionId.value = firstClub.unionId || firstClub.id || null;

          console.log('[debug] 初始化俱乐部:', {
            id: currentClubId.value,
            clubsign: currentClubSign.value,
            name: currentClubName.value,
            unionId: currentUnionId.value,
          });

          loadMembers();
        }
      }
    }
  } catch (error) {
    console.error('加载俱乐部列表失败:', error);
    message.error('加载俱乐部列表失败');
  }
}

// 切换俱乐部
function switchClub(club: Club) {
  currentClubId.value = club.id;
  currentClubSign.value = club.clubsign;
  currentClubName.value = club.name;

  // 尝试获取 unionId (可能从 unionId, id 获取)
  currentUnionId.value = club.unionId || club.id || null;

  console.log('[debug] 切换俱乐部:', {
    id: currentClubId.value,
    clubsign: currentClubSign.value,
    name: currentClubName.value,
    unionId: currentUnionId.value,
  });

  loadMembers();
}

// 加载成员列表
async function loadMembers() {
  if (!currentClubSign.value) {
    message.warning('请先选择俱乐部');
    return;
  }

  loading.value = true;
  try {
    const resp = await apiGetCompetitionMembers({
      clubId: currentClubId.value,
      pageNum: 1,
      type: timeType.value,
      orderBy: orderBy.value,
    });

    console.log('[debug] resp:', resp);

    // 按照实际返回结构:{ code: 0, data: { ... } }
    if (resp.data.code === 0 && resp.data.data) {
      memberList.value = resp.data.data.clubPromotionLevelItemList || [];
      summary.value = resp.data.data.newItem || null;
      console.log('[debug] memberList:', memberList.value);
      console.log('[debug] summary:', summary.value);
      // ✨ 加载当前登录玩家的余额
      loadPlayerBalance();
    } else if (resp.code !== 0) {
      message.error(resp.msg || '加载失败');
    }
  } catch (error) {
    console.error('加载成员列表失败:', error);
    message.error('加载成员列表失败,请重试');
  } finally {
    loading.value = false;
  }
}
// ✨ 新增: 加载当前登录玩家余额
async function loadPlayerBalance() {
  // 获取当前操作者 PID
  const agentPid = Number(
    localStorage.getItem('AGENT_PID') ??
      localStorage.getItem('ACCOUNT_ID') ??
      0,
  );

  if (!agentPid || !currentClubId.value) {
    console.log('[余额查询] 缺少必要参数');
    return;
  }

  playerBalance.value.loading = true;

  try {
    const resp = await apiGetPlayerBalance({
      clubId: currentClubId.value,
      opPid: agentPid, // 查询自己的余额
      type: 0,
      value: 0,
      requestPid: agentPid,
    });

    console.log('[余额查询] 响应:', resp);

    if (resp.data.code === 0 && resp.data.data) {
      playerBalance.value.sportsPoint = resp.data.data.sportsPoint;
      playerBalance.value.allowSportsPoint = resp.data.data.allowSportsPoint;
      playerBalance.value.caseSportsPoint = resp.data.data.caseSportsPoint;
      playerBalance.value.prizePoint = resp.data.data.prizePoint;
    }
  } catch (error) {
    console.error('[余额查询] 失败:', error);
  } finally {
    playerBalance.value.loading = false;
  }
}
// 时间改变
function handleTimeChange(value: number) {
  timeType.value = value;
  loadMembers();
}

// 排序改变
function handleSortChange(value: number) {
  sortBy.value = value;
  loadMembers();
}

// 排序顺序改变
function handleSortOrderChange(order: number) {
  sortOrder.value = order;
  loadMembers();
}

// 查看比赛分明细 - 修改为使用路由名称
function viewDetails(row: CompetitionMember) {
  router.push({
    name: 'competitionDetails',
    query: {
      pid: row.pid || 0,
      clubId: currentClubId.value,
      clubSign: currentClubSign.value,
      playerName: row.name,
      type: timeType.value,
    },
  });
}

// 操作更新后刷新列表
function handleRowUpdated() {
  loadMembers();
}

// 按钮可见性逻辑
function getVisibleActions(row: CompetitionMember) {
  if (isPort5667.value) {
    return {
      scoreManage: false,
      setRemark: false,
      kickOut: false,
      freeze: false,
    };
  }
  const actions = {
    scoreManage: false,
    setRemark: false,
    kickOut: false,
    freeze: false,
  };

  const minister = row.minister || 0;
  const isPromoter = row.isPromotionManag === 1;

  if (minister === 0 || minister === 1 || minister === 2 || minister === 3) {
    actions.scoreManage = true;
    actions.setRemark = true;
    actions.kickOut = true;
    actions.freeze = true;
  } else if (isPromoter) {
    actions.scoreManage = true;
    actions.setRemark = true;
  }

  return actions;
}
</script>

<template>
  <Page auto-content-height>
    <!-- ===== 俱乐部选择器 ===== -->
    <div class="competition-header">
      <!-- 俱乐部选项卡 -->
      <div class="club-tabs">
        <span class="tabs-label">俱乐部:</span>
        <div class="tabs-container">
          <button
            v-for="club in clubList"
            :key="club.id"
            class="tab-btn"
            :class="[{ active: currentClubId === club.id }]"
            @click="switchClub(club)"
          >
            {{ club.name }}
          </button>
        </div>
      </div>
      <!-- ✨ 新增: 搜索框 - 只在非5667端口显示 -->
      <div v-if="!isPort5667" class="search-section">
        <span class="control-label">搜索:</span>
        <Input
          v-model:value="searchQuery"
          placeholder="输入 PID 或昵称搜索"
          allow-clear
          class="search-input"
        />
      </div>
      <!-- 筛选和排序控制 -->
      <div class="filter-controls">
        <!-- 时间选择 -->
        <div class="control-item">
          <span class="control-label">时间:</span>
          <div class="time-buttons">
            <button
              v-for="opt in timeOptions"
              :key="opt.value"
              class="time-btn"
              :class="[{ active: timeType === opt.value }]"
              @click="handleTimeChange(opt.value)"
              :title="opt.displayLabel"
            >
              {{ opt.displayLabel }}
            </button>
          </div>
        </div>

        <!-- 排序选择 -->
        <div class="control-item">
          <span class="control-label">排序:</span>
          <div class="sort-buttons">
            <button
              v-for="opt in sortOptions"
              :key="opt.value"
              class="sort-btn"
              :class="[{ active: sortBy === opt.value }]"
              @click="handleSortChange(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>

          <!-- 升序/降序 -->
          <div class="order-buttons">
            <button
              class="order-btn"
              :class="[{ active: sortOrder === 1 }]"
              @click="handleSortOrderChange(1)"
              title="升序"
            >
              ↑ 升序
            </button>
            <button
              class="order-btn"
              :class="[{ active: sortOrder === 2 }]"
              @click="handleSortOrderChange(2)"
              title="降序"
            >
              ↓ 降序
            </button>
          </div>
        </div>
      </div>
    </div>
    <!-- ✨ 新增: 当前玩家余额信息 -->
    <div v-if="currentClubId" class="balance-info-section">
      <div class="balance-title">我的余额</div>
      <div class="balance-cards">
        <div class="balance-card">
          <div class="balance-label">竞技点余额</div>
          <div class="balance-value">
            <span v-if="playerBalance.loading" class="loading-text"
              >加载中...</span
            >
            <span v-else class="value-text">{{
              playerBalance.sportsPoint.toFixed(2)
            }}</span>
          </div>
        </div>
        <div class="balance-card">
          <div class="balance-label">可操作额度</div>
          <div class="balance-value">
            <span v-if="playerBalance.loading" class="loading-text"
              >加载中...</span
            >
            <span v-else class="value-text">{{
              playerBalance.allowSportsPoint.toFixed(2)
            }}</span>
          </div>
        </div>
        <div class="balance-card">
          <div class="balance-label">保险柜</div>
          <div class="balance-value">
            <span v-if="playerBalance.loading" class="loading-text"
              >加载中...</span
            >
            <span v-else class="value-text">{{
              playerBalance.caseSportsPoint.toFixed(2)
            }}</span>
          </div>
        </div>
        <div class="balance-card">
          <div class="balance-label">奖励点数</div>
          <div class="balance-value">
            <span v-if="playerBalance.loading" class="loading-text"
              >加载中...</span
            >
            <span v-else class="value-text">{{
              playerBalance.prizePoint.toFixed(2)
            }}</span>
          </div>
        </div>
      </div>
    </div>
    <!-- ===== 表格标题 + 表头 ===== -->
    <div class="table-header">
      <div class="table-title">
        成员列表
        <span v-if="searchQuery && !isPort5667" class="search-result-count">
          (搜索结果: {{ filteredMemberList.length }} 条)
        </span>
      </div>
      <div class="table-columns">
        <div class="col-nickname">头像/昵称</div>
        <div class="col-score">比赛分</div>
        <div class="col-rounds">局数</div>
        <div class="col-awards">大赢家</div>
        <div class="col-contribution">奖励</div>
        <div class="col-balance">贡献</div>
        <div class="col-balance2">战绩</div>
        <div class="col-action">操作</div>
      </div>
    </div>

    <!-- ===== 合计行 ===== -->
    <div v-if="summary && (!searchQuery || isPort5667)" class="summary-section">
      <div class="member-row summary-row">
        <div class="col-nickname">
          <div class="player-cell">
            <div class="player-name" style="font-weight: 600">合计</div>
          </div>
        </div>
        <div class="col-score">{{ summary.sportsPoint }}</div>
        <div class="col-rounds">{{ summary.setCount }}</div>
        <div class="col-awards">{{ summary.winner }}</div>
        <div class="col-contribution">{{ summary.scorePoint }}</div>
        <div class="col-balance">{{ summary.actualEntryFee }}</div>
        <div class="col-balance2">{{ summary.sportsPointConsume }}</div>
        <div class="col-action"></div>
      </div>
    </div>

    <!-- ===== 加载状态 ===== -->
    <div v-if="loading" class="loading-state">加载中...</div>

    <!-- ===== 成员列表 ===== -->
    <div v-else class="member-list">
      <!-- 成员行 -->
      <div
        v-for="(row, idx) in filteredMemberList"
        :key="idx"
        class="member-row"
      >
        <!-- 头像/昵称 -->
        <div class="col-nickname">
          <div class="player-cell">
            <Image
              :src="row.iconUrl || 'https://via.placeholder.com/40'"
              :width="40"
              :height="40"
              :preview="false"
            />
            <div
              class="player-name"
              :class="{ 'is-promoter': row.isPromotionManag === 1 }"
            >
              {{ row.name }}
            </div>
            <div>{{ row.pid }}</div>
          </div>
        </div>

        <!-- 比赛分 - 添加点击事件 -->
        <div class="col-score clickable" @click="viewDetails(row)">
          {{ row.sportsPoint }}
        </div>

        <!-- 局数 -->
        <div class="col-rounds">{{ row.setCount }}</div>

        <!-- 大赢家 -->
        <div class="col-awards">{{ row.winner }}</div>

        <!-- 奖励 -->
        <div class="col-contribution">{{ row.scorePoint }}</div>

        <!-- 贡献 -->
        <div class="col-balance">{{ row.actualEntryFee }}</div>

        <!-- 战绩 -->
        <div class="col-balance2">{{ row.sportsPointConsume }}</div>

        <!-- 操作 - 传递 clubId 和 unionId -->
        <div class="col-action">
          <CompetitionMemberActions
            :row="row"
            :current-club-id="currentClubId"
            :current-union-id="currentUnionId"
            :visible-actions="getVisibleActions(row)"
            @row-updated="handleRowUpdated"
          />
        </div>
      </div>

      <!-- 空状态 - 只在没有数据且没有 summary 时显示 -->
      <div
        v-if="filteredMemberList.length === 0 && !summary"
        class="empty-state"
      >
        {{ searchQuery && !isPort5667 ? '未找到匹配的玩家' : '暂无数据' }}
      </div>
    </div>
  </Page>
</template>

<style scoped>
/* ===== 响应式布局 ===== */
@media (max-width: 1024px) {
  .search-input {
    max-width: 250px;
  }

  .filter-controls {
    gap: 12px;
  }

  .time-btn,
  .sort-btn {
    padding: 4px 10px;
    font-size: 11px;
  }

  .order-btn {
    min-width: 36px;
    padding: 4px 6px;
    font-size: 11px;
  }
}

@media (max-width: 900px) {
  .search-input {
    max-width: 200px;
  }

  .competition-header {
    padding: 8px 12px;
  }

  .club-tabs {
    margin-bottom: 8px;
  }

  .tab-btn {
    padding: 4px 12px;
    font-size: 12px;
  }

  .tabs-label,
  .control-label {
    font-size: 12px;
  }

  .table-columns,
  .member-row {
    font-size: 11px;
  }

  .table-columns > div,
  .member-row > div {
    padding: 4px;
  }

  .player-cell :deep(img) {
    width: 32px;
    height: 32px;
  }

  .player-name {
    font-size: 10px;
  }

  .col-nickname {
    flex: 1;
  }

  .col-score,
  .col-rounds,
  .col-awards,
  .col-contribution,
  .col-balance,
  .col-balance2 {
    flex: 0.7;
  }

  .col-action {
    flex: 1.5;
  }

  .time-btn,
  .sort-btn {
    padding: 3px 8px;
    font-size: 10px;
  }

  .order-btn {
    min-width: 32px;
    padding: 3px 5px;
    font-size: 10px;
  }

  .filter-controls {
    gap: 8px;
  }

  .control-item {
    gap: 4px;
  }

  .time-buttons,
  .sort-buttons {
    gap: 4px;
  }
}

@media (max-width: 600px) {
  .search-section {
    flex-direction: column;
    gap: 6px;
    align-items: stretch;
  }

  .search-input {
    max-width: 100%;
  }

  .competition-header {
    padding: 6px 8px;
  }

  .club-tabs {
    margin-bottom: 6px;
  }

  .tabs-label,
  .control-label {
    font-size: 11px;
  }

  .tab-btn {
    padding: 3px 10px;
    font-size: 11px;
  }

  /* 余额信息卡片响应式 */
  .balance-info-section {
    padding: 12px;
    margin: 10px 0;
  }

  .balance-title {
    margin-bottom: 10px;
    font-size: 13px;
  }

  .balance-cards {
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
  }

  .balance-card {
    padding: 10px;
  }

  .balance-label {
    margin-bottom: 6px;
    font-size: 11px;
  }

  .balance-value {
    font-size: 16px;
  }

  .balance-value .loading-text {
    font-size: 12px;
  }

  .filter-controls {
    flex-direction: column;
    gap: 6px;
    align-items: stretch;
  }

  .control-item {
    gap: 6px;
  }

  .time-buttons,
  .sort-buttons {
    flex-wrap: wrap;
    gap: 4px;
  }

  .time-btn,
  .sort-btn {
    flex: 1;
    min-width: 50px;
    padding: 3px 6px;
    font-size: 10px;
  }

  .order-buttons {
    flex: 1;
    gap: 3px;
  }

  .order-btn {
    flex: 1;
    min-width: auto;
    padding: 3px 4px;
    font-size: 10px;
  }
}

.competition-header {
  padding: 12px 16px;
  margin-bottom: 12px;
  border-radius: 4px;
}

/* ✨ 新增: 搜索区域样式 */
.search-section {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

/* ✨ 新增: 搜索结果计数 */
.search-result-count {
  margin-left: 8px;
  font-size: 12px;
  font-weight: 400;
  color: #666;
}

.search-input {
  flex: 1;
  max-width: 300px;
}

/* ===== 俱乐部选项卡 ===== */
.club-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 12px;
}

.tabs-label {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

.tabs-container {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.tab-btn {
  min-width: auto;
  padding: 6px 16px;
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
  transition: all 0.3s;
}

.tab-btn:hover {
  border-color: #40a9ff;
}

.tab-btn.active {
  border-color: #1890ff;
}

/* ===== 筛选控制 ===== */
.filter-controls {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  align-items: center;
}

.control-item {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.control-label {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
}

/* ===== 时间按钮 ===== */
.time-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.time-btn {
  padding: 4px 12px;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  transition: all 0.2s;
}

.time-btn:hover {
  border-color: #40a9ff;
}

.time-btn.active {
  border-color: #1890ff;
}

/* ===== 排序按钮 ===== */
.sort-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.sort-btn {
  padding: 4px 12px;
  font-size: 12px;
  white-space: nowrap;
  cursor: pointer;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  transition: all 0.2s;
}

.sort-btn:hover {
  border-color: #40a9ff;
}

.sort-btn.active {
  border-color: #1890ff;
}

/* ===== 顺序按钮 ===== */
.order-buttons {
  display: flex;
  gap: 4px;
}

.order-btn {
  min-width: 40px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  border: 1px solid #d9d9d9;
  border-radius: 3px;
  transition: all 0.2s;
}

.order-btn:hover {
  border-color: #40a9ff;
}

.order-btn.active {
  border-color: #1890ff;
}

/* ===== 表格 ===== */
.table-header {
  margin-bottom: 0;
  overflow: hidden;
  border: 1px solid #e8e8e8;
  border-bottom: none;
  border-radius: 4px 4px 0 0;
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
  padding: 8px 0;
  font-size: 12px;
  font-weight: 600;
  text-align: center;
  border-bottom: 1px solid #e8e8e8;
}

.table-columns > div {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 6px 8px;
  text-align: center;
}

.col-nickname {
  flex: 1.2;
}

.col-score,
.col-rounds,
.col-awards,
.col-contribution,
.col-balance,
.col-balance2 {
  flex: 0.8;
}

.col-action {
  flex: 2;
}

/* ===== 合计行容器 ===== */
.summary-section {
  overflow: hidden;
  border: 1px solid #e8e8e8;
  border-bottom: none;
}

.summary-row {
  display: flex;
  gap: 0;
  align-items: center;
  padding: 8px 0;
  font-weight: 600;
  border-bottom: 1px solid #e8e8e8;
}

.summary-row > div {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 8px;
  font-size: 13px;
  font-weight: 600;
}

/* ===== 成员列表 ===== */
.member-list {
  overflow: hidden;
  border: 1px solid #e8e8e8;
  border-top: none;
  border-radius: 0 0 4px 4px;
}

.member-row {
  display: flex;
  gap: 0;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e8e8e8;
  transition: background-color 0.2s;
}

.member-row:hover {
}

.member-row:last-child {
  border-bottom: none;
}

.member-row > div {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  min-width: 0;
  padding: 0 8px;
  font-size: 13px;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
}

/* ===== 玩家信息 ===== */
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
  object-fit: cover;
  border-radius: 4px;
}

.player-name {
  font-size: 12px;
  line-height: 1.2;
  text-align: center;
}

.player-name.is-promoter {
  font-weight: 600;
}

/* 可点击样式 */
.clickable {
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s;
}

.clickable:hover {
  text-decoration: underline;
}

/* ===== 余额信息卡片 ===== */
.balance-info-section {
  padding: 16px;
  margin: 12px 0;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 8px;
  box-shadow: 0 2px 8px rgb(0 0 0 / 10%);
}

.balance-title {
  margin-bottom: 12px;
  font-size: 14px;
  font-weight: 600;
  color: #fff;
  opacity: 0.9;
}

.balance-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 12px;
}

.balance-card {
  padding: 12px;
  background: rgb(255 255 255 / 15%);
  border: 1px solid rgb(255 255 255 / 20%);
  border-radius: 6px;
  backdrop-filter: blur(10px);
}

.balance-label {
  margin-bottom: 8px;
  font-size: 12px;
  color: rgb(255 255 255 / 85%);
}

.balance-value {
  font-size: 20px;
  font-weight: 700;
  color: #fff;
}

.balance-value .loading-text {
  font-size: 13px;
  font-weight: 400;
  opacity: 0.7;
}

.balance-value .value-text {
  display: inline-block;
}

/* ===== 加载和空状态 ===== */
.loading-state,
.empty-state {
  padding: 24px;
  margin-top: 12px;
  font-size: 14px;
  text-align: center;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
}

/* ===== 竞赛头部 ===== */
</style>
