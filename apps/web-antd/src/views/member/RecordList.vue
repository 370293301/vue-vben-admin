<!-- RecordList.vue - 战绩记录页面 -->
<script setup lang="ts">
import { createVNode, onMounted, reactive, ref, render, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Button, DatePicker, message, Select, Table } from 'ant-design-vue';
import dayjs from 'dayjs';
import { agentReqPlayerGameRecord } from '#/api/game';
import DetailModalContent from './DetailModalContent.vue';
import gameTypeMap from '#/data/gametype.json';
const route = useRoute();
const router = useRouter();

const gameTypeOptions = ref<Array<{ value: number; label: string }>>([]);

// 生成下拉选项（Id -> value，Name_1 -> label）
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
const page = ref(1);
const pageSize = ref(10);
const totalPages = ref(1);

// 筛选条件
const filters = reactive({
  timeType: 0 as number,
  specificDate: null as any,
  gameType: 0 as number,
});

// 表格列定义
const columns = [
  { title: '时间', dataIndex: 'createTime', key: 'createTime' },
  { title: '房间号', dataIndex: 'roomKey', key: 'roomKey' },
  { title: '局数', dataIndex: 'setCount', key: 'setCount' },
  { title: '人数', dataIndex: 'playerNum', key: 'playerNum' },
  { title: '游戏类型', dataIndex: 'gameType', key: 'gameType' },
  { title: '房费', dataIndex: 'roomSportsConsume', key: 'roomSportsConsume' },
  { title: '操作', key: 'action', width: 160 },
];

const rowKey = (record: any) =>
  record?.roomId ?? record?.roomID ?? record?.roomKey ?? JSON.stringify(record);

// 规范化后端返回数据
function normalizeListFromResp(resp: any) {
  const maybe = resp?.data ?? resp ?? {};
  const payload = (maybe.data ?? maybe) ?? maybe;
  const rawList = payload.listInfo ?? payload.list ?? payload.items ?? [];
  const list = Array.isArray(rawList) ? rawList : [];
  const total = Number(payload.totalPages ?? payload.total ?? 1);
  return { list, total };
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
      showNum: pageSize.value,
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
    const { list, total } = normalizeListFromResp(resp);
    records.value = list;
    totalPages.value = Number(total || 1);
    page.value = p;
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

      <div
        v-if="manualInputVisible"
        style="text-align: center; margin-top: 12px"
      >
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
      <!-- 筛选条件 -->
      <div
        style="
          display: flex;
          gap: 12px;
          align-items: center;
          margin-bottom: 12px;
        "
      >
        <div>
          查询玩家 PID: <strong>{{ targetPid }}</strong>
        </div>

        <Select v-model:value="filters.timeType" style="width: 140px">
          <Select.Option :value="0">今天</Select.Option>
          <Select.Option :value="1">昨天</Select.Option>
          <Select.Option :value="2">七天内</Select.Option>
          <Select.Option :value="3">指定日期</Select.Option>
        </Select>

        <DatePicker
          v-if="filters.timeType === 3"
          v-model:value="filters.specificDate"
          placeholder="选择日期"
          style="width: 160px"
        />

        <Select v-model:value="filters.gameType" style="width: 220px" placeholder="选择游戏">
          <Select.Option :value="0">全部游戏</Select.Option>
          <Select.Option
            v-for="opt in gameTypeOptions"
            :key="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </Select.Option>
        </Select>

        <Button type="primary" @click="() => loadList(1)">查询</Button>
      </div>

      <!-- 数据表格 -->
      <Table
        :dataSource="records"
        :columns="columns"
        :loading="loading"
        :rowKey="rowKey"
        :pagination="false"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'action'">
            <a @click.prevent="() => openDetailForRoom(record)">查看明细</a>
          </template>
        </template>
      </Table>

      <!-- 分页控件 -->
      <div style="display: flex; justify-content: center; margin-top: 12px">
        <Button :disabled="page <= 1" @click="() => loadList(page - 1)">
          上一页
        </Button>
        <div style="padding: 0 12px; line-height: 32px">
          第 {{ page }} / {{ totalPages }} 页
        </div>
        <Button :disabled="page >= totalPages" @click="() => loadList(page + 1)">
          下一页
        </Button>
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
</style>
