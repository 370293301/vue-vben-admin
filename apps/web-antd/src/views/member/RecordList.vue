<!-- RecordList.vue - 战绩记录页面（卡片式布局） -->
<script setup lang="ts">
import { createVNode, nextTick, onBeforeUnmount, onMounted, reactive, ref, render, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, DatePicker, message, Select, Pagination, Image } from 'ant-design-vue';
import dayjs from 'dayjs';
import { agentReqPlayerGameRecord } from '#/api/game';
import DetailModalContent from './DetailModalContent.vue';
import gameTypeMap from '#/data/gametype.json';

const route = useRoute();
const router = useRouter();

const gameTypeOptions = ref<Array<{ value: number; label: string }>>([]);

// 全局统计数据
const stats = reactive({
  allPoints: 0,
  sumCost: 0,
});

// 生成下拉选项
function buildGameTypeOptions() {
  if (!gameTypeMap || typeof gameTypeMap !== 'object') {
    gameTypeOptions.value = [];
    return;
  }
  gameTypeOptions.value = Object.keys(gameTypeMap)
    .map((k) => {
      const it: any = gameTypeMap[k];
      const id = Number(it?.Id ?? it?.id ?? k);
      const label = String(it?.Name_1 ?? it?.Name ?? '');
      return { value: id, label };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

// 根据游戏类型ID获取游戏名称
function getGameTypeName(gameTypeId: number | string): string {
  const id = Number(gameTypeId);
  if (!gameTypeMap || typeof gameTypeMap !== 'object') {
    return String(gameTypeId);
  }

  for (const key in gameTypeMap) {
    const item: any = gameTypeMap[key];
    if (Number(item?.Id ?? item?.id) === id) {
      return String(item?.Name_1 ?? item?.Name ?? gameTypeId);
    }
  }

  return String(gameTypeId);
}

// 解析 PID
const targetPid = ref<number>(0);

function resolvePidFromRoute() {
  const raw = (route?.query?.pid ?? route?.params?.pid) ?? null;
  const n = Number(raw);
  if (Number.isFinite(n) && n > 0) {
    targetPid.value = n;
  } else {
    targetPid.value = 0;
  }
}

resolvePidFromRoute();

// 监听路由变化
watch(
  () => [route.fullPath, route.query?.pid, route.params?.pid],
  () => {
    const prev = targetPid.value;
    resolvePidFromRoute();
    if (targetPid.value && targetPid.value !== prev) {
      loadList(1);
    }
  },
);

// UI 控制
const manualInputVisible = ref(false);
const manualPid = ref('');

const loading = ref(false);
const records = ref<any[]>([]);
const pagination = reactive({
  current: 1,
  pageSize: 10,
  total: 0,
});

// 筛选条件
const filters = reactive({
  timeType: 0 as number,
  specificDate: null as any,
  gameType: 0 as number,
});

// 规范化后端返回数据
function normalizeListFromResp(resp: any) {
  const maybe = resp?.data ?? resp ?? {};
  const payload = (maybe.data ?? maybe) ?? maybe;
  const rawList = payload.listInfo ?? payload.list ?? payload.items ?? [];
  const list = Array.isArray(rawList) ? rawList : [];
  const total = Number(payload.totalPages ?? payload.total ?? 1);
  return { list, total, payload };
}

// 加载列表
async function loadList(p = 1) {
  const pid = Number(targetPid.value || 0);
  if (!pid) {
    message.warning('缺少 pid，无法查询战绩记录');
    return;
  }
  loading.value = true;
  try {
    const bodyOpts: any = {
      pid,
      pagNum: p,
      showNum: pagination.pageSize,
      requestPid: Number(
        localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0,
      ),
      gameType: filters.gameType ?? 0,
    };

    if ([0, 1, 2].includes(filters.timeType)) {
      bodyOpts.timeType = filters.timeType;
    } else if (filters.timeType === 3 && filters.specificDate) {
      bodyOpts.specificDate =
        filters.specificDate instanceof Date
          ? dayjs(filters.specificDate).format('YYYYMMDD')
          : String(filters.specificDate);
    }

    const resp = await agentReqPlayerGameRecord(bodyOpts);

    const { list, total, payload } = normalizeListFromResp(resp);

    stats.allPoints = Number(payload.allPoints ?? payload.totalPoints ?? payload.sumPoints ?? 0);
    stats.sumCost = Number(payload.sumCost ?? payload.totalCost ?? payload.totalRoomSportsConsume ?? 0);

    records.value = list;
    pagination.total = Number(total || 1) * pagination.pageSize;
    pagination.current = p;
  } catch (err) {
    console.error('[RecordList] loadList error', err);
    message.error('加载战绩记录失败');
  } finally {
    loading.value = false;
  }
}

// 打开战绩明细弹窗
function openDetailForRoom(room: any) {
  try {
    const pid = Number(targetPid.value || 0);
    if (!pid) {
      message.warning('缺少 pid，无法查看明细');
      return;
    }
    const roomId = room?.roomId ?? room?.roomID ?? room?.roomKey ?? null;

    const container = document.createElement('div');
    document.body.append(container);

    function onClose() {
      try {
        render(null, container);
        if (container.parentNode) container.remove();
      } catch (e) {
        console.warn('close detail modal error', e);
      }
    }

    const vnode = createVNode(DetailModalContent, {
      pid,
      pageSize: 10,
      initialPage: 1,
      filterRoomId: roomId,
      onClose,
    });

    render(vnode, container);
  } catch (e) {
    console.error('[RecordList] openDetailForRoom error', e);
    message.error('打开明细失败');
  }
}

// 返回玩家列表
function goBackToList() {
  router.push({ name: 'member' }).catch(() => {});
}

// 手动输入 PID
function openManualInput() {
  manualInputVisible.value = true;
}

function applyManualPid() {
  const v = manualPid.value && manualPid.value.trim();
  if (!v) {
    message.warning('请输入 PID');
    return;
  }
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) {
    message.warning('请输入合法 PID');
    return;
  }
  targetPid.value = n;
  manualInputVisible.value = false;
  loadList(1);
}

// 获取当前玩家的得分
function getPlayerPointByPid(record: any) {
  const pid = Number(targetPid.value || 0);
  if (!pid || !record.listInfo || !Array.isArray(record.listInfo)) {
    return '-';
  }

  const player = record.listInfo.find((p: any) => {
    const playerPid = Number(p?.pid ?? p?.playerId ?? 0);
    return playerPid === pid;
  });

  return player?.point ?? player?.score ?? '-';
}

onMounted(() => {
  buildGameTypeOptions();
  if (targetPid.value) loadList(1);
});
</script>

<template>
  <div style="padding: 12px">
    <!-- 未指定 PID 提示 -->
    <div v-if="!targetPid" class="no-pid">
      <div style="padding: 20px; text-align: center; color: var(--vben-text-3)">
        <div style="font-size: 16px; font-weight: 600; margin-bottom: 8px">
          未指定玩家 PID
        </div>
        <div style="margin-bottom: 12px">
          请从玩家列表点击"战绩得分"进入，或在地址栏添加 ?pid=xxxxx
        </div>
        <div style="display: flex; gap: 8px; justify-content: center">
          <Button type="default" @click="goBackToList">返回玩家列表</Button>
          <Button type="primary" @click="openManualInput">手动输入 PID</Button>
        </div>
      </div>

      <div v-if="manualInputVisible" style="text-align: center; margin-top: 12px">
        <a-input
          v-model:value="manualPid"
          style="width: 220px; margin-right: 8px"
          placeholder="输入 PID 并回车"
          @keydown.enter="applyManualPid"
        />
        <Button type="primary" @click="applyManualPid">查询</Button>
      </div>
      <div style="height: 20px"></div>
      <hr />
    </div>

    <!-- 有 PID 时显示查询和列表 -->
    <div v-else>
      <!-- 统计信息 -->
      <div class="stats-row">
        <div class="stat-item">
          <span class="stat-label">总得分：</span>
          <span class="stat-value">{{ stats.allPoints }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">总房费：</span>
          <span class="stat-value">{{ stats.sumCost }}</span>
        </div>
        <div class="stat-item" style="margin-left: auto">
          <span class="stat-label">玩家 PID：</span>
          <span class="stat-value">{{ targetPid }}</span>
        </div>
      </div>

      <!-- 筛选条件 -->
      <div class="toolbar">
        <div class="toolbar-search">
          <div class="search-row">
            <Select v-model:value="filters.timeType" class="filter-select">
              <Select.Option :value="0">今天</Select.Option>
              <Select.Option :value="1">昨天</Select.Option>
              <Select.Option :value="2">七天内</Select.Option>
              <Select.Option :value="3">指定日期</Select.Option>
            </Select>

            <DatePicker
              v-if="filters.timeType === 3"
              v-model:value="filters.specificDate"
              placeholder="选择日期"
              class="date-picker"
            />

            <Select v-model:value="filters.gameType" class="filter-select" placeholder="选择游戏">
              <Select.Option :value="0">全部游戏</Select.Option>
              <Select.Option
                v-for="opt in gameTypeOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </Select.Option>
            </Select>

            <Button type="primary" @click="() => loadList(1)" class="search-btn">查询</Button>

            <div class="button-group">
              <Button size="small" @click="goBackToList">返回列表</Button>
            </div>
          </div>
        </div>
      </div>

      <!-- 表格标题 + 表头 -->
      <div class="table-header">
        <div class="table-title">战绩记录</div>
        <div class="table-columns">
          <div class="col-time">时间</div>
          <div class="col-room">房间号</div>
          <div class="col-set">局数</div>
          <div class="col-player">人数</div>
          <div class="col-game">游戏类型</div>
          <div class="col-score">得分</div>
          <div class="col-cost">房费</div>
          <div class="col-action">操作</div>
        </div>
      </div>

      <!-- 列表 -->
      <div v-if="loading" class="loading-state">加载中...</div>
      <div v-else-if="records.length === 0" class="empty-state">暂无数据</div>
      <div v-else class="record-list">
        <div v-for="record in records" :key="record?.roomKey ?? JSON.stringify(record)" class="record-row">
          <!-- 时间 -->
          <div class="col-time">{{ record.createTime }}</div>

          <!-- 房间号 -->
          <div class="col-room">{{ record.roomKey }}</div>

          <!-- 局数 -->
          <div class="col-set">{{ record.setCount }}</div>

          <!-- 人数 -->
          <div class="col-player">{{ record.playerNum }}</div>

          <!-- 游戏类型 -->
          <div class="col-game">{{ getGameTypeName(record.gameType) }}</div>

          <!-- 得分 -->
          <div class="col-score">
            <span class="score-value">{{ getPlayerPointByPid(record) }}</span>
          </div>

          <!-- 房费 -->
          <div class="col-cost">{{ record.roomSportsConsume }}</div>

          <!-- 操作 -->
          <div class="col-action">
            <a @click.prevent="() => openDetailForRoom(record)" class="action-link">查看明细</a>
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
          @change="loadList"
          @show-size-change="(_, size) => {
            pagination.pageSize = size;
            loadList(1);
          }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.no-pid {
  max-width: 780px;
  margin: 20px auto;
  border-radius: 8px;
}

/* ===== 统计信息 ===== */
.stats-row {
  display: flex;
  gap: 24px;
  padding: 12px 16px;
  background: #f5f5f5;
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

.search-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.filter-select {
  width: 100px !important;
}

.date-picker {
  width: 160px;
}

.search-btn {
  min-width: 60px;
  height: 32px;
}

.button-group {
  display: flex;
  gap: 6px;
  margin-left: auto;
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

.table-columns .col-time { flex: 0.6; }
.table-columns .col-room { flex: 0.6; }
.table-columns .col-set { flex: 0.6; }
.table-columns .col-player { flex: 0.6; }
.table-columns .col-game { flex: 0.6; }
.table-columns .col-score { flex: 0.6; }
.table-columns .col-cost { flex: 0.6; }
.table-columns .col-action { flex: 0.6; }

/* ===== 列表 ===== */
.record-list {
  border-radius: 4px;
  overflow: hidden;
}

.record-row {
  display: flex;
  gap: 0;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
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

.col-time {
  font-size: 12px;
  flex: 1.2;
}

.col-room,
.col-game {
  font-size: 12px;
  flex: 0.8;
}

.col-set,
.col-player,
.col-score,
.col-cost {
  font-size: 12px;
  flex: 0.6;
  text-align: center;
}

.col-action {
  flex: 0.7;
  text-align: center;
}

.score-value {
  font-weight: 600;
  font-size: 14px;
  color: #1890ff;
}

.action-link {
  color: #1890ff;
  cursor: pointer;
  text-decoration: underline;
}

.action-link:hover {
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

  .filter-select {
    width: 80px !important;
  }

  .date-picker {
    width: 140px;
  }

  .search-btn {
    min-width: 50px;
  }

  .table-columns .col-time { flex: 0.5; }
  .table-columns .col-room { flex: 0.5; }
  .table-columns .col-set { flex: 0.5; }
  .table-columns .col-player { flex: 0.5; }
  .table-columns .col-game { flex: 0.5; }
  .table-columns .col-score { flex: 0.5; }
  .table-columns .col-cost { flex: 0.5; }
  .table-columns .col-action { flex: 0.5; }

  .col-time { font-size: 11px; flex: 1; }
  .col-room,
  .col-game { font-size: 11px; flex: 0.7; }
  .col-set,
  .col-player,
  .col-score,
  .col-cost { font-size: 10px; flex: 0.5; }
  .col-action { font-size: 10px; flex: 0.6; }

  .record-row > div {
    padding: 0 4px;
  }

  .button-group {
    margin-left: 0;
    width: 100%;
    margin-top: 8px;
  }
}

/* 中等屏幕 (平板 600-900px) */
@media (min-width: 601px) and (max-width: 900px) {
  .toolbar-search {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .search-row {
    flex: 1;
    min-width: 100%;
  }

  .filter-select {
    width: 90px !important;
  }

  .date-picker {
    width: 150px;
  }

  .table-columns .col-time { flex: 1.1; }
  .table-columns .col-game { flex: 0.8; }

  .col-time { font-size: 12px; flex: 1.1; }
  .col-game { font-size: 12px; flex: 0.8; }
}

/* 大屏幕 (PC 901-1400px) */
@media (min-width: 901px) and (max-width: 1400px) {
  .toolbar-search {
    flex-direction: row;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  .search-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .filter-select {
    width: 100px !important;
  }

  .date-picker {
    width: 160px;
  }

  .button-group {
    margin-left: auto;
  }
}

/* 超大屏幕 (PC 1400px+) */
@media (min-width: 1401px) {
  .toolbar-search {
    flex-direction: row;
    align-items: center;
    gap: 12px;
  }

  .search-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .filter-select {
    width: 110px !important;
  }

  .date-picker {
    width: 180px;
  }

  .button-group {
    margin-left: auto;
  }
}
</style>
