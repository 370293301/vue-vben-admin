<script lang="ts" setup>
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { Page } from '@vben/common-ui';
import { Button, Image, message } from 'ant-design-vue';
import CompetitionMemberActions from './CompetitionMemberActions.vue';

const router = useRouter();

// 赛事列表
const competitions = ref([
  { id: 1, name: '青春集团' },
  { id: 2, name: '青春果园' },
  { id: 3, name: '其他赛事' },
]);

// 当前选中的赛事
const currentCompetition = ref(1);

// 成员列表数据
const memberList = ref([
  {
    id: 1,
    groupName: '明组',
    nickname: '昵称',
    headUrl: '',
    compareScore: 100,
    rounds: 100,
    awards: 100,
    contribution: 100,
    balance: 100,
    frozen: false,
    isPromoter: false,
    isManager: false,
    markStr: '',
  },
]);

const loading = ref(false);

// 切换赛事
function switchCompetition(id: number) {
  currentCompetition.value = id;
  loadMembers();
}

// 加载成员数据
async function loadMembers() {
  loading.value = true;
  try {
    // 这里调用实际的API
    // const resp = await getCompetitionMembers({ competitionId: currentCompetition.value });
    // memberList.value = resp.data;
  } catch (error) {
    console.error('加载成员失败', error);
    message.error('加载失败，请重试');
  } finally {
    loading.value = false;
  }
}

// 查看比赛分明细
function viewDetails(row: any) {
  router.push({
    path: '/competition/details',  // 匹配菜单中的路径
    query: {
      competitionId: currentCompetition.value,
      memberId: row.id,
      nickname: row.nickname,
    },
  });
}

// 操作更新后刷新列表
function handleRowUpdated() {
  loadMembers();
}

// 初始加载
loadMembers();
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

    <!-- 表格标题 + 表头 -->
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

    <!-- 列表 -->
    <div v-if="loading" class="loading-state">加载中...</div>
    <div v-else-if="memberList.length === 0" class="empty-state">暂无数据</div>
    <div v-else class="member-list">
      <div v-for="row in memberList" :key="row.id" class="member-row">
        <!-- 头像/昵称 -->
        <div class="col-nickname">
          <div class="player-cell">
            <Image
              :src="row.headUrl || 'https://via.placeholder.com/40'"
              :width="40"
              :height="40"
              :preview="false"
            />
            <div class="player-name">{{ row.nickname }}</div>
          </div>
        </div>

        <!-- 比赛分 -->
        <div class="col-score clickable" @click="viewDetails(row)">
          {{ row.compareScore }}
        </div>

        <!-- 局数 -->
        <div class="col-rounds">{{ row.rounds }}</div>

        <!-- 大赢家 -->
        <div class="col-awards">{{ row.awards }}</div>

        <!-- 奖励 -->
        <div class="col-contribution">{{ row.contribution }}</div>

        <!-- 贡献 -->
        <div class="col-balance">{{ row.balance }}</div>

        <!-- 战绩 -->
        <div class="col-balance2">{{ row.balance }}</div>

        <!-- 操作 -->
        <div class="col-action">
          <CompetitionMemberActions
            :row="row"
            @row-updated="handleRowUpdated"
          />
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

/* ===== 表格 ===== */
.table-header {
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 2px;
  border: 1px solid #e8e8e8;
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

/* ===== 列表 ===== */
.member-list {
  border-radius: 4px;
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

.player-name {
  font-size: 12px;
  text-align: center;
  line-height: 1.2;
}

.clickable {
  color: #1890ff;
  cursor: pointer;
  text-decoration: underline;
}

.clickable:hover {
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
  border: 1px solid #e8e8e8;
}

/* ===== 响应式布局 ===== */
@media (max-width: 900px) {
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
}

@media (min-width: 901px) {
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
}
</style>
