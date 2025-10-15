<!-- DetailModalContent.vue -->
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { agentReqGameDetailRecord } from '#/api/game';
import { message } from 'ant-design-vue';

const props = defineProps<{
  pid: number;                     // 要查看战绩的 PID（必须）
  pageSize?: number;               // 每页数量，默认 10
  initialPage?: number;            // 初始页，默认 1
  onClose: () => void;             // 关闭回调（父组件传入）
}>();

// 内部状态
const page = ref<number>(props.initialPage ?? 1);
const pageSize =  10;
const loading = ref(false);
const records = ref<any[]>([]);
const totalPages = ref<number>(1);

// helper: 从一条 record 中根据 pid 找到该玩家的分数（points / score / points）
function getScoreForPid(rec: any, pid: number) {
  const players = rec.players ?? rec.listInfo ?? rec.playerList ?? [];
  if (!Array.isArray(players)) return 0;
  const p = players.find((x: any) => Number(x.pid ?? x.id ?? 0) === Number(pid));
  if (p) return Number(p.points ?? p.score ?? 0);
  // 如果没找到 pid 对应玩家，尝试返回第一个玩家的分数（降级展示）
  const first = players[0];
  return first ? Number(first.points ?? first.score ?? 0) : 0;
}

// 加载某一页
async function loadPage(p = 1) {
  if (!props.pid) return;
  loading.value = true;
  try {
    const resp = await agentReqGameDetailRecord({
      pid: props.pid,
      pagNum: p,
      showNum: pageSize,
      requestPid: Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0),
    });

    // 你的 agentReqGameDetailRecord 已经返回 normalized { records, totalPages, total }（若实现如前所述）
    if (resp && Array.isArray((resp as any).records)) {
      records.value = (resp as any).records;
      totalPages.value = Number((resp as any).totalPages ?? 1);
    } else {
      // 兼容旧返回形式
      const maybe = (resp?.data ?? resp) ?? {};
      const rawList = maybe.listInfo ?? maybe.list ?? [];
      records.value = Array.isArray(rawList) ? rawList : [];
      totalPages.value = Number(maybe.totalPages ?? maybe.total ?? 1);
    }
    page.value = p;
  } catch (err) {
    console.error('[DetailModalContent] loadPage error', err);
    message.error('获取战绩明细失败');
  } finally {
    loading.value = false;
  }
}

// 生命周期：初始加载 & pid 变化自动刷新
onMounted(() => loadPage(page.value));
watch(() => props.pid, (newPid, oldPid) => {
  if (!newPid) return;
  page.value = 1;
  loadPage(1);
});

// 简单翻页函数
function prev() { if (page.value > 1) loadPage(page.value - 1); }
function next() { if (page.value < (totalPages.value || 1)) loadPage(page.value + 1); }

function close() {
  // 触发父组件回调，父组件负责卸载或隐藏
  props.onClose && props.onClose();
}
</script>

<template>
  <div class="dbg-modal-root" role="dialog" aria-modal="true">
    <!-- 背景遮罩 -->
    <div class="dbg-modal-mask" @click="close"></div>

    <!-- 面板（宽度更小 600px） -->
    <div class="dbg-modal-panel">
      <div class="dbg-modal-header">
        <div style="font-weight:700">战绩明细 - PID: {{ props.pid }}</div>
        <div><button class="dbg-close-btn" @click="close">关闭</button></div>
      </div>

      <div class="dbg-modal-body">
        <div v-if="loading" class="dbg-loading">加载中…</div>

        <div v-else>
          <div v-if="!records || records.length === 0" class="dbg-empty">暂无数据</div>

          <div v-else>
            <table style="width:100%; margin-top:8px; border-collapse:collapse;">
              <thead>
              <tr style="text-align:left; color:var(--vben-text-3); font-weight:600;">
                <th style="padding:6px 8px; width:200px">时间</th>
                <th style="padding:6px 8px; width:200px">得分</th>
                <th style="padding:6px 8px; width:200px">回放码</th>
              </tr>
              </thead>
              <tbody>
              <tr v-for="rec in records" :key="rec.recordCode + rec.time">
                <td style="padding:6px 8px">{{ rec.time || '—' }}</td>
                <td style="padding:6px 8px">
                  <!-- 优先显示 props.pid 的得分 -->
                  {{
                    (rec.players && rec.players.find(p => Number(p.pid) === Number(props.pid))?.points)
                    ?? /* fallback：把所有玩家得分加起来 */ (Array.isArray(rec.players) ? rec.players.reduce((s,p)=> s + Number(p.points||0), 0) : 0)
                  }}
                </td>
                <td style="padding:6px 8px">
                  <a v-if="rec.recordCode" :href="`/replay/${rec.recordCode}`" target="_blank">{{ rec.recordCode }}</a>
                  <span v-else>—</span>
                </td>
              </tr>
              </tbody>
            </table>

            <!-- 分页控件（简单） -->
            <div class="dbg-pager">
              <button v-if="page>1" @click="prev">上一页</button>
              <div>第 {{ page }} / {{ totalPages || 1 }} 页</div>
              <button v-if="page < (totalPages || 1)" @click="next">下一页</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.dbg-modal-root { position: fixed; inset:0; z-index:5000; display:block; }
.dbg-modal-mask { position:absolute; inset:0; background: rgba(0,0,0,0.45); }

/* 面板改为 600px 宽度，更小更不容易遮挡内容 */
.dbg-modal-panel {
  position: absolute;
  left: 50%;
  top: 12%;
  transform: translateX(-50%);
  width: 600px;
  max-width: calc(100% - 32px);
  background: var(--vben-bg, #0f1720);
  color: var(--vben-text, #fff);
  border-radius: 8px;
  padding: 10px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.6);
  max-height: 72vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

/* header */
.dbg-modal-header { display:flex; justify-content:space-between; align-items:center; padding:4px 6px; }

/* body 滚动区域 */
.dbg-modal-body { margin-top:6px; overflow:auto; padding-right:8px; flex: 1 1 auto; }

/* loading / empty */
.dbg-loading, .dbg-empty { text-align:center; padding:20px; color: var(--vben-text-3, #9aa0a6); }

/* 简单表格 */
.dbg-table { width:100%; border-collapse: collapse; font-size: 13px; }
.dbg-table thead th { text-align:left; padding:8px 6px; color: var(--vben-text-3, #9aa0a6); border-bottom: 1px solid rgba(255,255,255,0.03); }
.dbg-table tbody td { padding:10px 6px; border-bottom: 1px dashed rgba(255,255,255,0.03); vertical-align: middle; }

/* pager */
.dbg-pager { display:flex; justify-content:center; align-items:center; gap:12px; padding:12px 0; }

/* 关闭按钮样式 */
.dbg-close-btn { background: transparent; border: 1px solid rgba(255,255,255,0.06); color: inherit; padding:4px 8px; border-radius:4px; cursor:pointer; }
.dbg-close-btn:hover { opacity:0.9; }

/* 小屏时缩小宽度 */
@media (max-width:700px) {
  .dbg-modal-panel { width: calc(100% - 20px); left: 50%; top: 8%; transform: translateX(-50%); }
}
</style>
