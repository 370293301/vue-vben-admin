<script lang="ts" setup>
import { defineEmits, defineProps, ref } from 'vue';

import { Button, Input, message, Modal } from 'ant-design-vue';

import {
  apiBanGame,
  apiSetPromoter,
  apiSetRate,
  apiSetRecommend,
  apiSetRemark,
} from '#/api/member';

type RowLike = {
  [k: string]: any;
  _raw?: Record<string, any>;
  isBanned?: boolean;
  // 其他你需要的字段
  pid?: number;
  rate?: number;
  remark?: string;
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

// helper to get requestPid
function getRequestPid() {
  return Number(
    localStorage.getItem('AGENT_PID') ??
      localStorage.getItem('ACCOUNT_ID') ??
      0,
  );
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
    const resp = await apiSetPromoter({ pid, type: 0, requestPid });
    const data = resp?.data ?? resp;
    const ok = data?.setResult === true || data?.code === 0 || data === true;
    if (ok) {
      message.success('设置为推广员成功');
      // 发送局部更新给父组件（父组件负责合并与刷新）
      emit('row-updated', {
        _raw: {
          ...props.row._raw,
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
</script>

<template>
  <div style="display: flex; flex-wrap: wrap; gap: 8px">
    <Button size="small" type="primary" ghost @click="onViewChildren">
      查看下级
    </Button>
    <Button
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
    <Button
      size="small"
      @click="openRecommendModal"
      :loading="changeBelongLoading"
    >
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
    <Button size="small" @click="openRateModal">调整充值分成比例</Button>

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
  </div>
</template>
