<script lang="ts" setup>
import { reactive, ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';
import { Button, message } from 'ant-design-vue';

const route = useRoute();
const router = useRouter();

// 赛事列表
const competitions = ref([
  { id: 1, name: '青春集团' },
  { id: 2, name: '青春果园' },
  { id: 3, name: '其他赛事' },
]);

// 当前选中的赛事
const currentCompetition = ref(Number(route.query.competitionId) || 1);
const currentMemberId = ref(Number(route.query.memberId) || 0);

// Tab 选项
const tabs = [
  { key: 'all', label: '全部' },
  { key: 'comparePlay', label: '比赛玩牌' },
  { key: 'compareScore', label: '比赛分' },
  { key: 'promoterAward', label: '推广奖励' },
  { key: 'guaranteeCabinet', label: '保险柜' },
];

const activeTab = ref('all');

// 成员信息
const memberInfo = reactive({
  groupName: '明组',
  nickname: '',
  headUrl: '',
});

// 明细列表
const detailList = ref([
  {
    id: 1,
    score: -5,
    roomNumber: '108567',
    amount: '200',
    gameId: '123',
    time: '2025-10-28-18:20:15',
    description: '房间号：108567，余额：200',
  },
  {
    id: 2,
    score: -5,
    description: 'id10005给id123调整分',
    gameId: '123',
    time: '2025-10-28-18:20:15',
  },
]);

const loading = ref(false);

// 切换赛事
function switchCompetition(id: number) {
  currentCompetition.value = id;
  loadDetails();
}

// 切换Tab
function switchTab(key: string) {
  activeTab.value = key;
  loadDetails();
}

// 加载明细数据
async function loadDetails() {
  loading.value = true;
  try {
    // 这里调用实际的API
    // const resp = await getCompetitionDetails({
    //   competitionId: currentCompetition.value,
    //   memberId: currentMemberId.value,
    //   type: activeTab.value,
    // });
    // detailList.value = resp.data;
  } catch (error) {
    console.error('加载明细失败', error);
    message.error('加载失败，请重试');
  } finally {
    loading.value = false;
  }
}

// 返回
function goBack() {
  router.back();
}

// 初始加载
onMounted(() => {
  loadDetails();
});
</script>

<template>
  <Page auto-content-height>
    <!-- 赛事选择器 -->
    <div class="competition-header">
      <div class="competition-tabs">
        <span class="label">赛事名:</span>
        <Button
          v-for="comp in competitions"
          :key="comp.id"
          :type="currentCompetition === comp.id ? 'primary' : 'default'"
          size="small"
          @click="switchCompetition(comp.id)"
          class="tab-btn"
        >
          {{ comp.name }}
        </Button>
        <Button size="small" class="tab-btn">切换</Button>
      </div>
    </div>

    <!-- Tab切换 -->
    <div class="detail-tabs">
      <div class="tabs-wrapper">
        <Button
          v-for="tab in tabs"
          :key="tab.key"
          :type="activeTab === tab.key ? 'primary' : 'default'"
          size="small"
          @click="switchTab(tab.key)"
          class="detail-tab-btn"
        >
          {{ tab.label }}
        </Button>
      </div>
      <Button size="small" @click="goBack" class="back-btn">返回</Button>
    </div>

    <!-- 成员信息 -->


    <!-- 明细列表 -->
    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="detailList.length === 0" class="empty-state">暂无数据</div>
    <div v-else class="detail-list">
      <div v-for="item in detailList" :key="item.id" class="detail-item">
        <div class="detail-content">
          <div class="score-section">
            <span class="score" :class="{ negative: item.score < 0, positive: item.score > 0 }">
              {{ item.score > 0 ? '+' : '' }}{{ item.score }}
            </span>
          </div>

          <div class="info-section">
            <div class="description">{{ item.description }}</div>
          </div>

          <div class="meta-section">
            <div class="time">{{ item.time }}</div>
            <div class="game-id">游戏id：{{ item.gameId }}</div>
          </div>
        </div>
      </div>
    </div>
  </Page>
</template>

<style scoped>
/* ===== 赛事选择器 ===== */
.competition-header {
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 12px;
}

.competition-tabs {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.competition-tabs .label {
  font-weight: 600;
  font-size: 14px;
  margin-right: 8px;
}

.tab-btn {
  min-width: 80px;
}

/* ===== Tab切换 ===== */
.detail-tabs {
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 12px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.tabs-wrapper {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.detail-tab-btn {
  min-width: 70px;
}

.back-btn {
  min-width: 60px;
}

/* ===== 成员信息 ===== */
.member-info-header {
  padding: 12px 16px;
  border-radius: 4px;
  margin-bottom: 12px;
  border: 1px solid #e8e8e8;
}

.info-item {
  display: flex;
  gap: 8px;
  align-items: center;
}

.info-label {
  font-weight: 600;
  font-size: 14px;
}

/* ===== 明细列表 ===== */
.detail-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.detail-item {
  padding: 16px;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
  transition: all 0.3s;
}

.detail-item:hover {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.detail-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.score-section {
  display: flex;
  align-items: center;
}

.score {
  font-size: 20px;
  font-weight: 700;
}

.score.negative {
  color: #ff4d4f;
}

.score.positive {
  color: #52c41a;
}

.info-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.description {
  font-size: 14px;
  color: #333;
  line-height: 1.5;
}

.meta-section {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #999;
}

.time,
.game-id {
  line-height: 1.4;
}

/* ===== 加载和空状态 ===== */
.loading-state,
.empty-state {
  padding: 24px;
  text-align: center;
  color: #999;
  font-size: 14px;
  border-radius: 4px;
  border: 1px solid #e8e8e8;
}

/* ===== 响应式布局 ===== */
@media (max-width: 600px) {
  .competition-tabs,
  .tabs-wrapper {
    gap: 6px;
  }

  .tab-btn,
  .detail-tab-btn {
    min-width: 60px;
    font-size: 12px;
  }

  .detail-tabs {
    padding: 8px 12px;
  }

  .detail-item {
    padding: 12px;
  }

  .score {
    font-size: 18px;
  }

  .description {
    font-size: 13px;
  }
}

@media (min-width: 601px) and (max-width: 900px) {
  .score {
    font-size: 19px;
  }

  .detail-item {
    padding: 14px;
  }
}

@media (min-width: 901px) {
  .detail-content {
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
  }

  .score-section {
    flex: 0 0 100px;
  }

  .info-section {
    flex: 1;
    padding: 0 16px;
  }

  .meta-section {
    flex: 0 0 180px;
    text-align: right;
  }
}
</style>
