<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';
import { message } from 'ant-design-vue';
import dayjs from 'dayjs';

import { agentReqGameDetailRecord } from '#/api/game';
import type { GameDetailRecordItem, PlayerPointInfo } from '#/api/game';

const props = defineProps<{
  initialPage?: number;      // 初始页，默认 1
  onClose: () => void;       // 关闭回调
  pageSize?: number;         // 每页数量，默认 10
  pid: number;               // 要查看战绩的 PID（必须）
  filterRoomId?: string | number | null;  // 可选 roomID
}>();

// 内部状态
const page = ref<number>(props.initialPage ?? 1);
const pageSize = 10;
const loading = ref(false);
const records = ref<GameDetailRecordItem[]>([]);
const totalPages = ref<number>(1);
const total = ref<number>(0);

// 格式化时间戳（秒 -> 日期时间）
function formatTime(timestamp: number): string {
  if (!timestamp) return '—';
  return dayjs.unix(timestamp).format('YYYY-MM-DD HH:mm:ss');
}

// 获取指定 pid 玩家的分数
function getPlayerScore(item: GameDetailRecordItem, pid: number): number {
  const player = item.listInfo?.find((p) => p.pid === pid);
  return player?.point ?? 0;
}

// 加载某一页
async function loadPage(p = 1) {
  if (!props.pid) return;
  loading.value = true;
  console.log('[DetailModalContent] loadPage11111:', props, 'page:', p);
  try {
    const resp = await agentReqGameDetailRecord({
      pid: props.pid,
      pagNum: p,
      showNum: pageSize,
      requestPid: Number(
        localStorage.getItem('AGENT_PID') ??
        localStorage.getItem('ACCOUNT_ID') ??
        0,
      ),
      rooID: props.filterRoomId ?? undefined,
    });

    console.log('[DetailModalContent] loadPage resp:', resp);

    // 处理双层 data 结构
    const actualData = resp?.data;
    const responseCode = actualData?.code ?? resp?.code ?? 0;

    if (responseCode !== 0 && responseCode !== undefined) {
      const errorMsg = actualData?.msg ?? resp?.msg ?? '获取数据失败';
      message.error(errorMsg);
      records.value = [];
      return;
    }

    // 获取实际数据列表
    const dataList = actualData?.data ?? resp?.data;

    if (Array.isArray(dataList)) {
      records.value = dataList;
      total.value = dataList.length;
      // 简单计算总页数（如果后端没有返回 totalPages）
      totalPages.value = Math.ceil(dataList.length / pageSize) || 1;
    } else {
      records.value = [];
      total.value = 0;
      totalPages.value = 1;
    }

    page.value = p;

    console.log('[DetailModalContent] records:', records.value.length);
  } catch (error) {
    console.error('[DetailModalContent] loadPage error', error);
    message.error('获取战绩明细失败');
    records.value = [];
  } finally {
    loading.value = false;
  }
}

// 当前页显示的记录（客户端分页）
const displayRecords = computed(() => {
  const start = (page.value - 1) * pageSize;
  const end = start + pageSize;
  return records.value.slice(start, end);
});

// 生命周期：初始加载 & pid 变化自动刷新
onMounted(() => loadPage(page.value));

watch(
  () => props.pid,
  (newPid) => {
    if (!newPid) return;
    page.value = 1;
    loadPage(1);
  },
);

// 翻页函数
function prev() {
  if (page.value > 1) {
    page.value--;
  }
}

function next() {
  if (page.value < totalPages.value) {
    page.value++;
  }
}

function close() {
  props.onClose && props.onClose();
}
</script>

<template>
  <div class="dbg-modal-root" role="dialog" aria-modal="true">
    <!-- 背景遮罩 -->
    <div class="dbg-modal-mask" @click="close"></div>

    <!-- 面板 -->
    <div class="dbg-modal-panel">
      <div class="dbg-modal-header">
        <div style="font-weight: 700">战绩明细 - PID: {{ props.pid }}</div>
        <div><button class="dbg-close-btn" @click="close">关闭</button></div>
      </div>

      <div class="dbg-modal-body">
        <div v-if="loading" class="dbg-loading">加载中…</div>

        <div v-else>
          <div v-if="!displayRecords || displayRecords.length === 0" class="dbg-empty">
            暂无数据
          </div>

          <div v-else>
            <table class="detail-table">
              <thead>
              <tr>
                <th style="width: 80px">房间号</th>
                <th style="width: 80px">局数</th>
                <th style="width: 180px">结束时间</th>
                <th style="width: 100px">得分</th>
                <th style="width: 120px">回放码</th>
                <th>玩家信息</th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="(rec, index) in displayRecords" :key="index">
                <td>{{ rec.roomID || '—' }}</td>
                <td>{{ rec.setID || '—' }}</td>
                <td>{{ formatTime(rec.endTime) }}</td>
                <td>
                    <span
                      :style="{
                        color: getPlayerScore(rec, props.pid) > 0 ? '#52c41a' :
                               getPlayerScore(rec, props.pid) < 0 ? '#ff4d4f' :
                               'inherit'
                      }"
                    >
                      {{ getPlayerScore(rec, props.pid) }}
                    </span>
                </td>
                <td>
                  <a
                    v-if="rec.playbackCode"
                    :href="`/replay/${rec.playbackCode}`"
                    target="_blank"
                    style="color: #1890ff"
                  >
                    {{ rec.playbackCode }}
                  </a>
                  <span v-else>—</span>
                </td>
                <td>
                  <div class="players-list">
                    <div
                      v-for="player in rec.listInfo"
                      :key="player.pid"
                      class="player-item"
                      :class="{ 'is-current': player.pid === props.pid }"
                    >
                      <img
                        v-if="player.headUrl"
                        :src="player.headUrl"
                        :alt="player.name"
                        class="player-avatar"
                      />
                      <span class="player-name">{{ player.name }}</span>
                      <span
                        class="player-score"
                        :style="{
                            color: player.point > 0 ? '#52c41a' :
                                   player.point < 0 ? '#ff4d4f' :
                                   'inherit'
                          }"
                      >
                          {{ player.point > 0 ? '+' : '' }}{{ player.point }}
                        </span>
                    </div>
                  </div>
                </td>
              </tr>
              </tbody>
            </table>

            <!-- 分页控件 -->
            <div class="dbg-pager">
              <button :disabled="page <= 1" @click="prev">上一页</button>
              <div>第 {{ page }} / {{ totalPages }} 页（共 {{ total }} 条）</div>
              <button :disabled="page >= totalPages" @click="next">下一页</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 响应式 */
@media (max-width: 900px) {
  .dbg-modal-panel {
    top: 8%;
    left: 50%;
    width: calc(100% - 20px);
    transform: translateX(-50%);
  }
}

.dbg-modal-root {
  position: fixed;
  inset: 0;
  z-index: 5000;
  display: block;
}

.dbg-modal-mask {
  position: absolute;
  inset: 0;
  background: rgb(0 0 0 / 45%);
}

.dbg-modal-panel {
  position: absolute;
  top: 8%;
  left: 50%;
  display: flex;
  flex-direction: column;
  width: 900px;
  max-width: calc(100% - 32px);
  max-height: 80vh;
  padding: 16px;
  overflow: hidden;
  color: var(--vben-text, #333);
  background: var(--vben-bg, #fff);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgb(0 0 0 / 20%);
  transform: translateX(-50%);
}

.dbg-modal-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 12px;
  border-bottom: 1px solid #f0f0f0;
}

.dbg-modal-body {
  flex: 1 1 auto;
  padding: 12px 0;
  overflow: auto;
}

.dbg-loading,
.dbg-empty {
  padding: 40px;
  color: #999;
  text-align: center;
}

/* 表格样式 */
.detail-table {
  width: 100%;
  font-size: 13px;
  border-collapse: collapse;
}

.detail-table thead th {
  padding: 10px 8px;
  font-weight: 600;
  color: #666;
  text-align: left;
  background: #fafafa;
  border-bottom: 2px solid #f0f0f0;
}

.detail-table tbody td {
  padding: 12px 8px;
  vertical-align: top;
  border-bottom: 1px solid #f0f0f0;
}

.detail-table tbody tr:hover {
  background: #fafafa;
}

/* 玩家列表 */
.players-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.player-item {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 4px 6px;
  border-radius: 4px;
}

.player-item.is-current {
  background: #e6f7ff;
}

.player-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
}

.player-name {
  flex: 1;
  font-size: 13px;
}

.player-score {
  font-weight: 600;
  font-size: 13px;
}

/* 分页 */
.dbg-pager {
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
  padding: 16px 0 0;
}

.dbg-pager button {
  padding: 6px 12px;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
}

.dbg-pager button:hover:not(:disabled) {
  color: #1890ff;
  border-color: #1890ff;
}

.dbg-pager button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.dbg-close-btn {
  padding: 6px 12px;
  color: inherit;
  cursor: pointer;
  background: transparent;
  border: 1px solid #d9d9d9;
  border-radius: 4px;
}

.dbg-close-btn:hover {
  color: #1890ff;
  border-color: #1890ff;
}
</style>
