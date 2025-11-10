<script lang="ts" setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';
import { Button, Image, message } from 'ant-design-vue';
import CompetitionMemberActions from './CompetitionMemberActions.vue';
import { apiGetCompetitionMembers, type CompetitionMember, type CompetitionSummary } from '#/api/competition';

const router = useRouter();

// ===== 俱乐部数据 =====
interface Club {
  id: number;
  name: string;
  clubsign: number;
}

const clubList = ref<Club[]>([]);
const currentClubId = ref<number | null>(null);
const currentClubSign = ref<number | null>(null);
const currentClubName = ref<string>('');

// ===== 成员列表数据 =====
const memberList = ref<CompetitionMember[]>([]);
const summary = ref<CompetitionSummary | null>(null);
const loading = ref(false);

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

// ===== 初始化 =====
onMounted(() => {
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
          currentClubId.value = clubList.value[0].id;
          currentClubSign.value = clubList.value[0].clubsign;
          currentClubName.value = clubList.value[0].name;
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
  const actions = {
    scoreManage: false,
    setRemark: false,
    kickOut: false,
    freeze: false,
  };

  const minister = row.minister || 0;
  const isPromoter = row.isPromotionManag === 1;

  if (minister === 1 || minister === 3) {
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
            :class="['tab-btn', { active: currentClubId === club.id }]"
            @click="switchClub(club)"
          >
            {{ club.name }}
          </button>
        </div>
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
              :class="['time-btn', { active: timeType === opt.value }]"
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
              :class="['sort-btn', { active: sortBy === opt.value }]"
              @click="handleSortChange(opt.value)"
            >
              {{ opt.label }}
            </button>
          </div>

          <!-- 升序/降序 -->
          <div class="order-buttons">
            <button
              :class="['order-btn', { active: sortOrder === 1 }]"
              @click="handleSortOrderChange(1)"
              title="升序"
            >
              ↑ 升序
            </button>
            <button
              :class="['order-btn', { active: sortOrder === 2 }]"
              @click="handleSortOrderChange(2)"
              title="降序"
            >
              ↓ 降序
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 表格标题 + 表头 ===== -->
    <div class="table-header">
      <div class="table-title">成员列表</div>
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
    <div v-if="summary" class="summary-section">
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
      <div v-for="(row, idx) in memberList" :key="idx" class="member-row">
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

        <!-- 操作 -->
        <div class="col-action">
          <CompetitionMemberActions
            :row="row"
            :visible-actions="getVisibleActions(row)"
            @row-updated="handleRowUpdated"
          />
        </div>
      </div>

      <!-- 空状态 - 只在没有数据且没有 summary 时显示 -->
      <div v-if="memberList.length === 0 && !summary" class="empty-state">暂无数据</div>
    </div>
  </Page>
</template>

<style scoped>
/* ===== 竞赛头部 ===== */
.competition-header {
  border-radius: 4px;
  margin-bottom: 12px;
  padding: 12px 16px;
}

/* ===== 俱乐部选项卡 ===== */
.club-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.tabs-label {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
}

.tabs-container {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.tab-btn {
  padding: 6px 16px;
  border: 1px solid #d9d9d9;

  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: all 0.3s;
  white-space: nowrap;
  min-width: auto;
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
  gap: 16px;
  flex-wrap: wrap;
  align-items: center;
}

.control-item {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.control-label {
  font-weight: 600;
  font-size: 14px;
  white-space: nowrap;
}

/* ===== 时间按钮 ===== */
.time-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.time-btn {
  padding: 4px 12px;
  border: 1px solid #d9d9d9;

  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  white-space: nowrap;
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
  gap: 6px;
  flex-wrap: wrap;
}

.sort-btn {
  padding: 4px 12px;
  border: 1px solid #d9d9d9;

  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  white-space: nowrap;
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
  padding: 4px 8px;
  border: 1px solid #d9d9d9;

  border-radius: 3px;
  cursor: pointer;
  font-size: 12px;
  transition: all 0.2s;
  min-width: 40px;
}

.order-btn:hover {
  border-color: #40a9ff;

}

.order-btn.active {


  border-color: #1890ff;
}

/* ===== 表格 ===== */
.table-header {
  border-radius: 4px 4px 0 0;
  overflow: hidden;
  margin-bottom: 0;
  border: 1px solid #e8e8e8;
  border-bottom: none;
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
  border-bottom: 1px solid #e8e8e8;
  text-align: center;

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
  border: 1px solid #e8e8e8;
  border-bottom: none;
  overflow: hidden;
}

.summary-row {

  font-weight: 600;
  display: flex;
  gap: 0;
  padding: 8px 0;
  border-bottom: 1px solid #e8e8e8;
  align-items: center;
}

.summary-row > div {
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
}

/* ===== 成员列表 ===== */
.member-list {
  border-radius: 0 0 4px 4px;
  overflow: hidden;
  border: 1px solid #e8e8e8;
  border-top: none;
}

.member-row {
  display: flex;
  gap: 0;
  padding: 8px 0;
  border-bottom: 1px solid #e8e8e8;
  align-items: center;
  transition: background-color 0.2s;
}

.member-row:hover {

}

.member-row:last-child {
  border-bottom: none;
}

.member-row > div {
  padding: 0 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  word-break: break-word;
  overflow-wrap: break-word;
  white-space: normal;
  flex: 1;
  min-width: 0;
  font-size: 13px;
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
  border-radius: 4px;
  object-fit: cover;
}

.player-name {
  font-size: 12px;
  text-align: center;
  line-height: 1.2;
}

.player-name.is-promoter {

  font-weight: 600;
}

/* 可点击样式 */
.clickable {

  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s;
}

.clickable:hover {

  text-decoration: underline;
}

/* ===== 加载和空状态 ===== */
.loading-state,
.empty-state {
  padding: 24px;
  text-align: center;

  font-size: 14px;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
  margin-top: 12px;
}

/* ===== 响应式布局 ===== */
@media (max-width: 1024px) {
  .filter-controls {
    gap: 12px;
  }

  .time-btn,
  .sort-btn {
    padding: 4px 10px;
    font-size: 11px;
  }

  .order-btn {
    padding: 4px 6px;
    min-width: 36px;
    font-size: 11px;
  }
}

@media (max-width: 900px) {
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
    padding: 4px 4px;
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
    padding: 3px 5px;
    min-width: 32px;
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

  .filter-controls {
    gap: 6px;
    flex-direction: column;
    align-items: stretch;
  }

  .control-item {
    gap: 6px;
  }

  .time-buttons,
  .sort-buttons {
    gap: 4px;
    flex-wrap: wrap;
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
</style>
