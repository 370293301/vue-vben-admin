<script lang="ts" setup>
import { ref,  onMounted, onBeforeUnmount,computed } from 'vue';
import { Button, Input, message, Modal, Dropdown, Menu } from 'ant-design-vue';


import {
  apiBanGame,
  apiSetPromoter,
  apiSetRate,
  apiSetRecommend,
  apiSetRemark,
  apiTestRecharge
} from '#/api/member';
// --- 响应式判断是否为手机 / 窄屏 ---
const mobileBreakpoint = 768; // <= 480px 视为手机端（你可以改成 360 / 600 等）
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= mobileBreakpoint : false);

function updateIsMobile() {
  isMobile.value = window.innerWidth <= mobileBreakpoint;
}

type RowLike = {
  [k: string]: any;
  _raw?: Record<string, any>;
  isBanned?: boolean;
  // 其他你需要的字段
  pid?: number;
  rate?: number;
  remark?: string;
  level?: number; // ✅ 新增：身份等级
};

const props = defineProps<{
  row: RowLike;
}>();

// const emit = defineEmits<{
//   (e: 'view-children', row: RowLike): void;
//   (e: 'row-updated', updated: Partial<RowLike>): void;
// }>();
const emit = defineEmits(['view-children', 'row-updated']) as {
  (e: 'view-children', row: RowLike): void;
  (e: 'row-updated', updated: Partial<RowLike>): void;
};

// loading flags
const promoterLoading = ref(false);
const remarkLoading = ref(false);
const changeBelongLoading = ref(false);
const freezeLoading = ref(false);
const rateLoading = ref(false);

// recommend modal state
const showRecommendModal = ref(false);
const recommendIdInput = ref('');

// rate modal state
const showRateModal = ref(false);
const rateInput = ref('');
// recharge modal state (新增)
const showRechargeModal = ref(false);
const rechargeIdInput = ref('');
const appPriceInput = ref('');
const rechargeLoading = ref(false);
// ✅ 修改 menuItems，去掉 icon 字段
const menuItems = computed(() => {
  const items = [];

  if (isPromoter()) {
    items.push({
      key: 'view-children',
      label: '查看下级',
    });
  }

  if (!isPromoter()) {
    items.push({
      key: 'set-promoter',
      label: '设为推广员',
      loading: promoterLoading.value,
    });
  }

  items.push({
    key: 'set-remark',
    label: '设置备注',
    loading: remarkLoading.value,
  });

  items.push({
    key: 'change-belong',
    label: '从属修改',
    loading: changeBelongLoading.value,
  });

  items.push({
    key: 'freeze-toggle',
    label: props.row._raw?.isBanned ? '解冻' : '冻结',
    danger: !(props.row._raw?.isBanned === true),
    loading: freezeLoading.value,
  });

  if (isPromoter() && !isSelfAgent()) {
    items.push({
      key: 'adjust-rate',
      label: '调整充值分成比例',
    });
  }

  items.push({
    key: 'recharge-test',
    label: '充值测试',
    loading: rechargeLoading.value,
  });

  return items;
});
// helper to get current row pid
function getRowPid() {
  return Number(props.row._raw?.pid ?? props.row.id ?? 0);
}
// 如果请求者 pid 与当前行 pid 相同，则认为是玩家自己
function isSelfAgent() {
  const req = getRequestPid();
  const rowPid = getRowPid();
  return req !== 0 && req === rowPid;
}

// helper to get requestPid
function getRequestPid() {
  return Number(
    localStorage.getItem('AGENT_PID') ??
      localStorage.getItem('ACCOUNT_ID') ??
      0,
  );
}
// ✅ 检查是否已是推广员（level = 1 表示推广员）
function isPromoter() {
  const level = Number(props.row._raw?.level ?? props.row.level ?? 0);
  return level === 1;
}

/* ---------- 操作实现 ---------- */

async function onViewChildren() {
  emit('view-children', props.row);
}

// 设为推广员
async function onSetPromoter() {
  if (promoterLoading.value) return;
  promoterLoading.value = true;
  try {
    const pid = Number(props.row._raw?.pid ?? props.row.id ?? 0);
    if (!pid) {
      message.warning('无效 pid');
      return;
    }
    const requestPid = getRequestPid();
    const resp = await apiSetPromoter({ pid, type: 1, requestPid });
    const data = resp?.data ?? resp;
    const ok = data?.setResult === true || data?.code === 0 || data === true;
    if (ok) {
      message.success('设置为推广员成功');
      // 发送局部更新给父组件（父组件负责合并与刷新）
      emit('row-updated', {
        level: 1,
        _raw: {
          ...props.row._raw,
          level: 1,
          isPromoter: true,
          role_name: '推广员',
        },
      });
    } else {
      message.error(data?.msg ?? data?.message ?? '设置推广员失败');
    }
  } catch (error: any) {
    console.error(error);
    message.error(error?.message ?? '设置推广员出错');
  } finally {
    promoterLoading.value = false;
  }
}

// 设置备注（用 prompt 简化）
async function onSetRemark() {
  if (remarkLoading.value) return;
  remarkLoading.value = true;
  try {
    const pid = Number(props.row._raw?.pid ?? props.row.id ?? 0);
    if (!pid) {
      message.warning('无效 pid');
      return;
    }
    const current = props.row._raw?.remark ?? props.row.remark ?? '';
    const remark = window.prompt('请输入备注内容：', String(current));
    if (remark === null) {
      return;
    }
    const trimmed = String(remark).trim();
    if (!trimmed) {
      message.warning('备注不能为空');
      return;
    }
    const requestPid = getRequestPid();
    const resp = await apiSetRemark({ pid, remark: trimmed, requestPid });
    const data = resp?.data ?? resp;
    const ok = data?.setResult === true || data?.code === 0 || data === true;
    if (ok) {
      message.success('设置备注成功');
      emit('row-updated', {
        remark: data?.setRemark ?? trimmed,
        _raw: { ...props.row._raw, remark: data?.setRemark ?? trimmed },
      });
    } else {
      message.error(data?.msg ?? data?.message ?? '设置备注失败');
    }
  } catch (error: any) {
    console.error(error);
    message.error(error?.message ?? '设置备注出错');
  } finally {
    remarkLoading.value = false;
  }
}

/* 从属修改（弹窗） */
function openRecommendModal() {
  recommendIdInput.value = props.row._raw?.recommendId
    ? String(props.row._raw.recommendId)
    : '';
  showRecommendModal.value = true;
}
function cancelRecommend() {
  showRecommendModal.value = false;
  recommendIdInput.value = '';
}
async function confirmRecommend() {
  if (changeBelongLoading.value) return;
  changeBelongLoading.value = true;
  try {
    const pid = Number(props.row._raw?.pid ?? props.row.id ?? 0);
    if (!pid) {
      message.warning('无效 pid');
      return;
    }
    const rec = String(recommendIdInput.value ?? '').trim();
    if (!rec) {
      message.warning('请输入推荐者 ID');
      return;
    }
    const recommendId = Number(rec);
    if (Number.isNaN(recommendId) || recommendId <= 0) {
      message.warning('推荐者 ID 非法');
      return;
    }

    const requestPid = getRequestPid();
    const resp = await apiSetRecommend({ pid, recommendId, requestPid });
    const data = resp?.data ?? resp;
    const ok = data?.setResult === true || data?.code === 0 || data === true;
    if (ok) {
      message.success('从属修改成功');
      emit('row-updated', {
        _raw: { ...props.row._raw, recommendId, familyId: recommendId },
      });
      cancelRecommend();
    } else {
      message.error(data?.msg ?? data?.message ?? '从属修改失败');
    }
  } catch (error: any) {
    console.error(error);
    message.error(error?.message ?? '从属修改出错');
  } finally {
    changeBelongLoading.value = false;
  }
}

/* 冻结 / 解冻 */
async function onFreezeToggle() {
  if (freezeLoading.value) return;
  freezeLoading.value = true;
  try {
    const pid = Number(props.row._raw?.pid ?? props.row.id ?? 0);
    if (!pid) {
      message.warning('无效 pid');
      return;
    }
    const currentlyBanned = !!(
      props.row._raw?.isBanned ??
      props.row.isBanned ??
      false
    );
    const type = currentlyBanned ? 0 : 1; // 1 冻结，0 解冻
    const requestPid = getRequestPid();
    const resp = await apiBanGame({ pid, type, requestPid });
    const data = resp?.data ?? resp;
    const ok = data?.setResult === true || data?.code === 0 || data === true;
    if (ok) {
      const newState = type === 1;
      message.success(newState ? '冻结成功' : '解冻成功');
      emit('row-updated', {
        _raw: { ...props.row._raw, isBanned: newState },
        isBanned: newState,
      });
    } else {
      message.error(data?.msg ?? data?.message ?? '冻结/解冻失败');
    }
  } catch (error: any) {
    console.error(error);
    message.error(error?.message ?? '冻结/解冻出错');
  } finally {
    freezeLoading.value = false;
  }
}

/* 调整分成比例（弹窗） */
function openRateModal() {
  rateInput.value = String(props.row._raw?.rate ?? props.row.rate ?? '');
  showRateModal.value = true;
}
function cancelRateModal() {
  showRateModal.value = false;
  rateInput.value = '';
}
async function confirmRate() {
  if (rateLoading.value) return;
  rateLoading.value = true;
  try {
    const pid = Number(props.row._raw?.pid ?? props.row.id ?? 0);
    if (!pid) {
      message.warning('无效 pid');
      return;
    }

    const r = String(rateInput.value ?? '').trim();
    if (!r) {
      message.warning('请输入比例值');
      return;
    }
    const rateNum = Number(r);
    if (Number.isNaN(rateNum) || rateNum < 0 || rateNum > 100) {
      message.warning('比例必须在 0-100');
      return;
    }

    const requestPid = getRequestPid();
    const resp = await apiSetRate({ pid, rate: rateNum, requestPid });
    const data = resp?.data ?? resp;
    const ok = data?.setResult === true || data?.code === 0 || data === true;

    // **先构造明确类型的 payload**
    const payload: Partial<RowLike> = {
      _raw: { ...props.row._raw, rate: rateNum },
      rate: rateNum,
    };
    console.log('confirmRate payload:', payload);

    if (ok) {
      message.success('设置分成比例成功');

      // 发出已更新事件（编辑器和 TS 都能正确推断）
      emit('row-updated', payload);

      // 关闭并清理弹窗
      cancelRateModal();
    } else {
      message.error(data?.msg ?? data?.message ?? '设置失败');
    }
  } catch (error: any) {
    console.error(error);
    message.error(error?.message ?? '设置分成比例出错');
  } finally {
    rateLoading.value = false;
  }
}
function openRechargeModal() {
  rechargeIdInput.value = '';
  appPriceInput.value = '';
  showRechargeModal.value = true;
}
function cancelRechargeModal() {
  showRechargeModal.value = false;
  rechargeIdInput.value = '';
  appPriceInput.value = '';
}

async function confirmRecharge() {
  if (rechargeLoading.value) return;
  rechargeLoading.value = true;
  try {

    const rid = String(rechargeIdInput.value ?? '').trim();
    if (!rid) {
      message.warning('请输入 rechargeId');
      return;
    }
    const rechargeId = Number(rid);
    if (Number.isNaN(rechargeId) || rechargeId <= 0 || !Number.isInteger(rechargeId)) {
      message.warning('rechargeId 必须为正整数');
      return;
    }

    const priceRaw = String(appPriceInput.value ?? '').trim();
    if (!priceRaw) {
      message.warning('请输入 AppPrice');
      return;
    }
    const appPrice = Number(priceRaw);
    if (Number.isNaN(appPrice) || appPrice <= 0) {
      message.warning('AppPrice 必须为大于 0 的数字');
      return;
    }

    const resp = await apiTestRecharge({
      rechargeId,
      appPrice,
    });

    const data = resp?.data ?? resp;
    const ok = data?.success === true || data?.setResult === true || data?.code === 0 || data === true;

    if (ok) {
      message.success('充值测试成功');

      // 如果后端返回了更新的字段（例如 balance），合并并通知父组件更新
      const updated: Partial<RowLike> = {};
      if (data?.balance != null) {
        updated._raw = { ...props.row._raw, balance: data.balance };
        (updated as any).balance = data.balance;
      }
      if (Object.keys(updated).length > 0) {
        emit('row-updated', updated);
      }

      // 关闭并清理
      cancelRechargeModal();
    } else {
      message.error(data?.msg ?? data?.message ?? '充值测试失败');
    }
  } catch (error: any) {
    console.error('confirmRecharge error =>', error);
    message.error(error?.message ?? '充值测试出错');
  } finally {
    rechargeLoading.value = false;
  }
}
// ✅ 下拉菜单点击处理（添加这个函数）
function handleMenuClick({ key }: { key: string }) {
  switch (key) {
    case 'view-children':
      onViewChildren();
      break;
    case 'set-promoter':
      onSetPromoter();
      break;
    case 'set-remark':
      onSetRemark();
      break;
    case 'change-belong':
      openRecommendModal();
      break;
    case 'freeze-toggle':
      onFreezeToggle();
      break;
    case 'adjust-rate':
      openRateModal();
      break;
    case 'recharge-test':
      openRechargeModal();
      break;
  }
}
onMounted(() => {
  // 监听窗口尺寸变化
  window.addEventListener('resize', updateIsMobile);
  // 也兼容首次判断
  updateIsMobile();
});
onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile);
});

</script>
<template>
  <!-- ✅ 手机端：下拉菜单 -->
  <div v-if="isMobile">
    <Dropdown trigger="click">
      <Button type="primary" size="small">
        操作 ▼
      </Button>
      <template #overlay>
        <Menu @click="handleMenuClick">
          <Menu.Item
            v-for="item in menuItems"
            :key="item.key"
            :disabled="item.loading"
            :danger="item.danger"
          >
            {{ item.label }}
            <span v-if="item.loading" style="margin-left: 8px">...</span>
          </Menu.Item>
        </Menu>
      </template>
    </Dropdown>
  </div>

  <!-- ✅ PC端：按钮组 -->
  <div v-else style="display: flex; flex-wrap: wrap; gap: 8px">
    <Button v-if="isPromoter()" size="small" type="primary" ghost @click="onViewChildren">
      查看下级
    </Button>
    <Button
      v-if="!isPromoter()"
      size="small"
      type="primary"
      ghost
      :loading="promoterLoading"
      @click="onSetPromoter"
    >
      设为推广员
    </Button>
    <Button size="small" @click="onSetRemark" :loading="remarkLoading">
      设置备注
    </Button>
    <Button size="small" @click="openRecommendModal" :loading="changeBelongLoading">
      从属修改
    </Button>
    <Button
      size="small"
      :danger="!(props.row._raw?.isBanned === true)"
      :loading="freezeLoading"
      @click="onFreezeToggle"
    >
      {{ props.row._raw?.isBanned ? '解冻' : '冻结' }}
    </Button>
    <Button v-if="isPromoter() && !isSelfAgent()" size="small" @click="openRateModal">
      调整充值分成比例
    </Button>
    <Button size="small" type="primary" :loading="rechargeLoading" @click="openRechargeModal">
      充值测试
    </Button>
  </div>

  <!-- ... Modal 部分保持不变 ... -->
  <!-- 从属修改 Modal -->
  <Modal
    v-model:open="showRecommendModal"
    title="从属修改 - 输入推荐者ID"
    :confirm-loading="changeBelongLoading"
    @ok="confirmRecommend"
    @cancel="cancelRecommend"
  >
    <div style="display: flex; flex-direction: column; gap: 8px">
      <div>请输入新的推荐者ID（recommendId）：</div>
      <Input
        v-model:value="recommendIdInput"
        placeholder="推荐者ID（数字）"
      />
    </div>
  </Modal>

  <!-- 分成比例 Modal -->
  <Modal
    v-model:open="showRateModal"
    title="调整充值分成比例"
    :confirm-loading="rateLoading"
    @ok="confirmRate"
    @cancel="cancelRateModal"
  >
    <div style="display: flex; flex-direction: column; gap: 8px">
      <div>请输入新的分成比例（0 - 100）：</div>
      <Input v-model:value="rateInput" placeholder="例如：10 表示 10%" />
    </div>
  </Modal>
  <Modal
    v-model:open="showRechargeModal"
    title="充值测试"
    :confirm-loading="rechargeLoading"
    @ok="confirmRecharge"
    @cancel="cancelRechargeModal"
  >
    <div style="display: flex; flex-direction: column; gap: 8px">
      <div>请输入 rechargeId（正整数）：</div>
      <Input v-model:value="rechargeIdInput" placeholder="例如：12345" />
      <div>请输入 AppPrice（数值，大于 0）：</div>
      <Input v-model:value="appPriceInput" placeholder="例如：9.99" />
    </div>
  </Modal>
</template>




