<script lang="ts" setup>
import { reactive, ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';
import { Button, Image, message } from 'ant-design-vue';
import dayjs from 'dayjs';
import { apiGetCompetitionDetails } from '#/api/competition';

const route = useRoute();
const router = useRouter();

// ===== 从路由获取参数 =====
const currentMemberId = ref(Number(route.query.pid) || 0);
const currentClubId = ref(Number(route.query.clubId) || 0);
const currentClubSign = ref(Number(route.query.clubSign) || 0);
const playerName = ref(String(route.query.playerName || ''));
const initTimeType = ref(Number(route.query.type) || 0);

// ===== 俱乐部数据 =====
interface Club {
  id: number;
  name: string;
  clubsign: number;
}

const clubList = ref<Club[]>([]);
const currentClubName = ref('');

// ===== Tab 选项 =====
const tabs = [
  { key: 0, label: '全部' },
  { key: 2, label: '比赛玩牌' },
  { key: 1, label: '比赛分' },
  { key: 7, label: '推广奖励' },
  { key: 6, label: '保险柜' },
];

const activeTab = ref(0);

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
const timeType = ref(initTimeType.value);

// ===== 明细列表数据 =====
const detailList = ref<any[]>([]);
const loading = ref(false);
const pageNum = ref(1);
const hasMore = ref(true);

// ===== execType 分类 =====
const EXEC_TYPE_MAP = {
  playGame: [1, 2, 114, 115, 120, 121],  // 移除119
  score: [122, 123, 124, 125, 137, 138, 139, 140, 130, 141, 142, 1110, 129],  // 移除133
  promotion: [3013],
  safe: [1009, 1010, 1011, 1109, 1012],
};

// ===== 初始化 =====
onMounted(() => {
  loadClubList();
  loadDetails();
});

// 从 localStorage 加载俱乐部列表
function loadClubList() {
  try {
    const clubListStr = localStorage.getItem('clubList');
    if (clubListStr) {
      const parsedList = JSON.parse(clubListStr);
      if (Array.isArray(parsedList)) {
        clubList.value = parsedList;

        // 设置当前俱乐部信息
        if (currentClubId.value) {
          const club = clubList.value.find(c => c.id === currentClubId.value);
          if (club) {
            currentClubName.value = club.name;
            currentClubSign.value = club.clubsign;
          }
        } else if (clubList.value.length > 0) {
          currentClubId.value = clubList.value[0].id;
          currentClubSign.value = clubList.value[0].clubsign;
          currentClubName.value = clubList.value[0].name;
        }
      }
    }
  } catch (error) {
    console.error('加载俱乐部列表失败:', error);
  }
}

// 切换俱乐部
function switchClub(club: Club) {
  currentClubId.value = club.id;
  currentClubSign.value = club.clubsign;
  currentClubName.value = club.name;
  pageNum.value = 1;
  detailList.value = [];
  loadDetails();
}

// 格式化时间
function formatTime(timestamp: number) {
  return dayjs(timestamp).format('MM月DD日 HH:mm:ss');
}

// 判断记录类型
function getRecordType(execType: number) {
  if (EXEC_TYPE_MAP.playGame.includes(execType)) return 'playGame';
  if (EXEC_TYPE_MAP.score.includes(execType)) return 'score';
  if (EXEC_TYPE_MAP.promotion.includes(execType)) return 'promotion';
  if (EXEC_TYPE_MAP.safe.includes(execType)) return 'safe';
  return 'unknown';
}

// 判断是否应该显示该记录
function shouldShowRecord(execType: number, tabKey: number) {
  const recordType = getRecordType(execType);

  if (tabKey === 0) {
    return recordType !== 'unknown';
  }

  if (tabKey === 2) {
    return recordType === 'playGame';
  }

  if (tabKey === 1) {
    return recordType === 'score';
  }

  if (tabKey === 7) {
    return recordType === 'promotion';
  }

  if (tabKey === 6) {
    return recordType === 'safe';
  }

  return false;
}

// 切换Tab
function switchTab(key: number) {
  activeTab.value = key;
  pageNum.value = 1;
  detailList.value = [];
  loadDetails();
}

// 时间改变
function handleTimeChange(value: number) {
  timeType.value = value;
  pageNum.value = 1;
  detailList.value = [];
  loadDetails();
}

// 加载明细数据
async function loadDetails() {
  if (loading.value) return;

  loading.value = true;
  try {
    const resp = await apiGetCompetitionDetails({
      clubId: currentClubId.value,
      pid: currentMemberId.value,
      getType: timeType.value,
      chooseType: activeTab.value,
      pageNum: pageNum.value,
    });

    console.log('[debug] competition details resp:', resp);

    // 处理API响应 - 兼容多种数据格式
    let newList: any[] = [];
    let success = false;

    if (resp.code === 0) {
      // 格式1: { code: 0, data: [...] }
      if (Array.isArray(resp.data)) {
        newList = resp.data;
        success = true;
      }
      // 格式2: { code: 0, data: { list: [...] } }
      else if (resp.data && resp.data.list) {
        newList = resp.data.list;
        success = true;
      }
    }
    // 格式3: { data: { code: 0, data: [...] } }
    else if (resp.data && resp.data.code === 0) {
      if (Array.isArray(resp.data.data)) {
        newList = resp.data.data;
        success = true;
      } else if (resp.data.data && resp.data.data.list) {
        newList = resp.data.data.list;
        success = true;
      }
    }

    if (success) {
      console.log('[debug] newList length:', newList.length);
      console.log('[debug] first item:', newList[0]);

      // 过滤和处理数据
      const filteredList = newList
        .filter((item: any) => {
          const shouldShow = shouldShowRecord(item.execType, activeTab.value);
          if (newList.length <= 5) {
            console.log(`[debug] execType ${item.execType}, shouldShow: ${shouldShow}, tab: ${activeTab.value}`);
          }
          return shouldShow;
        })
        .map((item: any) => ({
          ...item,
          recordType: getRecordType(item.execType),
        }));

      console.log('[debug] filteredList length:', filteredList.length);

      if (pageNum.value === 1) {
        detailList.value = filteredList;
      } else {
        detailList.value.push(...filteredList);
      }

      hasMore.value = newList.length > 0;
    } else {
      const errorMsg = (resp.data && resp.data.msg) || resp.msg || '加载失败';
      message.error(errorMsg);
    }
  } catch (error) {
    console.error('加载明细失败', error);
    message.error('加载失败,请重试');
  } finally {
    loading.value = false;
  }
}

// 格式化比赛玩牌信息
function formatPlayGameInfo(item: any) {
  const value = Number(item.value);
  const result = value >= 0 ? '赢' : '输';
  return {
    gameName: item.msg || item.name || '未知游戏',  // 优先使用msg字段
    time: formatTime(item.execTime),
    value: value >= 0 ? `+${value}` : value,
    result,
    balance: item.curValue,
    roomKey: item.roomKey || '',  // 添加房间号
    valueClass: value >= 0 ? 'positive' : 'negative',
  };
}

// 格式化比赛分信息
function formatScoreInfo(item: any) {
  const value = Number(item.value);
  const action = value >= 0 ? '收到' : '赠送';
  const description = `${item.execName || ''}(${action})${item.name || ''}${Math.abs(value)}分`;

  return {
    time: formatTime(item.execTime),
    description,
    value: value >= 0 ? `+${value}` : value,
    balance: item.curValue,
    valueClass: value >= 0 ? 'positive' : 'negative',
  };
}

// 格式化推广奖励信息
function formatPromotionInfo(item: any) {
  const value = Number(item.value);
  if (value <= 0) return null;

  return {
    gameName: item.name || '未知游戏',
    time: formatTime(item.execTime),
    value: `+${value}`,
    roomKey: item.roomKey || '',
    availableReward: item.curValue,
    valueClass: 'positive',
  };
}

// 格式化保险柜信息
function formatSafeInfo(item: any) {
  const value = Number(item.value);
  const action = value >= 0 ? '转入' : '转出';

  return {
    time: formatTime(item.execTime),
    action: `保险柜${action}${Math.abs(value)}分`,
    value: value >= 0 ? `+${value}` : value,
    balance: item.curValue,
    valueClass: value >= 0 ? 'positive' : 'negative',
  };
}

// 加载更多
function loadMore() {
  if (!hasMore.value || loading.value) return;
  pageNum.value++;
  loadDetails();
}

// 返回
function goBack() {
  router.back();
}
</script>

<template>
  <Page auto-content-height>
    <!-- ===== 俱乐部选择器 ===== -->
    <div class="competition-header">
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

      <!-- 时间和Tab切换 -->
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
            >
              {{ opt.displayLabel }}
            </button>
          </div>
        </div>

        <!-- Tab切换 -->
        <div class="control-item">
          <span class="control-label">类型:</span>
          <div class="tab-buttons">
            <button
              v-for="tab in tabs"
              :key="tab.key"
              :class="['tab-btn', { active: activeTab === tab.key }]"
              @click="switchTab(tab.key)"
            >
              {{ tab.label }}
            </button>
          </div>
        </div>
      </div>

      <!-- 成员信息和返回按钮 -->
      <div class="header-footer">
        <div v-if="playerName" class="player-info">
          <span class="info-label">成员:</span>
          <span class="info-value">{{ playerName }}</span>
        </div>
        <Button size="small" @click="goBack" class="back-btn">返回</Button>
      </div>
    </div>

    <!-- ===== 加载状态 ===== -->
    <div v-if="loading && pageNum === 1" class="loading-state">加载中...</div>

    <!-- ===== 空状态 ===== -->
    <div v-else-if="detailList.length === 0" class="empty-state">暂无数据</div>

    <!-- ===== 明细列表 ===== -->
    <div v-else class="detail-list">
      <!-- 比赛玩牌 -->
      <template v-for="item in detailList" :key="item.id">
        <div v-if="item.recordType === 'playGame'" class="detail-card play-game">
          <div class="card-header">
            <span class="game-name">{{ formatPlayGameInfo(item).gameName }}</span>
            <span
              class="score"
              :class="formatPlayGameInfo(item).valueClass"
            >
              {{ formatPlayGameInfo(item).value }}
            </span>
          </div>
          <div class="card-time">{{ formatPlayGameInfo(item).time }}</div>
          <div class="card-footer">
            <span>{{ formatPlayGameInfo(item).result }}</span>
            <span v-if="formatPlayGameInfo(item).roomKey" class="room-info">
              房间号: {{ formatPlayGameInfo(item).roomKey }}
            </span>
            <span class="balance">比赛分余额: {{ formatPlayGameInfo(item).balance }}</span>
          </div>
        </div>

        <!-- 比赛分 -->
        <div v-else-if="item.recordType === 'score'" class="detail-card score-record">
          <div class="card-header">
            <span class="time">{{ formatScoreInfo(item).time }}</span>
            <span
              class="value"
              :class="formatScoreInfo(item).valueClass"
            >
              {{ formatScoreInfo(item).value }}
            </span>
          </div>
          <div class="card-description">{{ formatScoreInfo(item).description }}</div>
          <div class="card-footer">
            <span class="balance">比赛分余额: {{ formatScoreInfo(item).balance }}</span>
          </div>
        </div>

        <!-- 推广奖励 -->
        <div v-else-if="item.recordType === 'promotion' && formatPromotionInfo(item)" class="detail-card promotion">
          <div class="card-header">
            <span class="game-name">{{ formatPromotionInfo(item)!.gameName }}</span>
            <span class="value positive">{{ formatPromotionInfo(item)!.value }}</span>
          </div>
          <div class="card-time">{{ formatPromotionInfo(item)!.time }}</div>
          <div class="card-footer">
            <span>从房间号{{ formatPromotionInfo(item)!.roomKey }}获取邀请奖励{{ formatPromotionInfo(item)!.value }}分</span>
            <span class="available">可提奖励: {{ formatPromotionInfo(item)!.availableReward }}</span>
          </div>
        </div>

        <!-- 保险柜 -->
        <div v-else-if="item.recordType === 'safe'" class="detail-card safe-record">
          <div class="card-header">
            <span class="time">{{ formatSafeInfo(item).time }}</span>
            <span
              class="value"
              :class="formatSafeInfo(item).valueClass"
            >
              {{ formatSafeInfo(item).value }}
            </span>
          </div>
          <div class="card-action">{{ formatSafeInfo(item).action }}</div>
          <div class="card-footer">
            <span class="balance">比赛分余额: {{ formatSafeInfo(item).balance }}</span>
          </div>
        </div>
      </template>

      <!-- 加载更多 -->
      <div v-if="hasMore && !loading" class="load-more">
        <Button @click="loadMore" size="small">加载更多</Button>
      </div>
      <div v-if="loading && pageNum > 1" class="loading-more">加载中...</div>
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
  margin-bottom: 12px;
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

/* ===== Tab按钮 ===== */
.tab-buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

/* ===== 头部底部 ===== */
.header-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.player-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-weight: 600;
  font-size: 14px;
}

.info-value {
  font-size: 14px;
}

.back-btn {
  min-width: 60px;
}

/* ===== 明细列表 ===== */
.detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-card {
  padding: 16px;
  border-radius: 8px;
  border: 1px solid #e8e8e8;
  transition: all 0.3s;
}

.detail-card:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}

/* ===== 卡片通用样式 ===== */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.card-time {
  font-size: 12px;
  margin-bottom: 8px;
}

.card-description {
  font-size: 14px;
  margin-bottom: 8px;
  line-height: 1.5;
}

.card-action {
  font-size: 14px;
  margin-bottom: 8px;
}

.card-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  flex-wrap: wrap;
  gap: 8px;
}

/* ===== 分数样式 ===== */
.positive {
  font-weight: 700;
}

.negative {
  font-weight: 700;
}

.score {
  font-size: 20px;
}

.value {
  font-size: 18px;
}

/* ===== 特定卡片样式 ===== */
.game-name {
  font-size: 16px;
  font-weight: 600;
}

.time {
  font-size: 12px;
}

.balance {
}

.room-info {
  font-size: 12px;
}

.available {
  font-weight: 500;
}

/* ===== 加载和空状态 ===== */
.loading-state,
.empty-state {
  padding: 24px;
  text-align: center;
  font-size: 14px;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
}

.load-more {
  text-align: center;
  padding: 16px 0;
}

.loading-more {
  text-align: center;
  padding: 16px 0;
  font-size: 14px;
}

/* ===== 响应式布局 ===== */
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

  .detail-card {
    padding: 12px;
  }

  .game-name {
    font-size: 14px;
  }

  .score {
    font-size: 18px;
  }

  .value {
    font-size: 16px;
  }

  .time-btn {
    padding: 3px 8px;
    font-size: 10px;
  }

  .filter-controls {
    gap: 8px;
  }

  .control-item {
    gap: 4px;
  }

  .time-buttons {
    gap: 4px;
  }
}

@media (max-width: 600px) {
  .competition-header {
    padding: 6px 8px;
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
  .tab-buttons {
    gap: 4px;
    flex-wrap: wrap;
  }

  .time-btn {
    flex: 1;
    min-width: 50px;
    padding: 3px 6px;
    font-size: 10px;
  }

  .detail-card {
    padding: 12px;
  }

  .game-name {
    font-size: 14px;
  }

  .score {
    font-size: 16px;
  }

  .card-description,
  .card-action {
    font-size: 13px;
  }
}
</style>
