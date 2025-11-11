<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import { Modal, Input, InputNumber, message, Dropdown, Menu, Button, Radio, RadioGroup } from 'ant-design-vue';
import type { CompetitionMember } from '#/api/competition';
import { apiUpdateSportsPoint, apiSetExtra,apiDeleteMember,apiBanGameClubMember, type UpdateSportsPointResponse } from '#/api/competition';


// --- 响应式判断是否为手机 / 窄屏 ---
const mobileBreakpoint = 768;
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= mobileBreakpoint : false);

function updateIsMobile() {
  isMobile.value = window.innerWidth <= mobileBreakpoint;
}

const props = defineProps<{
  row: CompetitionMember;
  currentClubId?: number | null;
  currentUnionId?: number | null;
  visibleActions?: {
    scoreManage: boolean;
    setRemark: boolean;
    kickOut: boolean;
    freeze: boolean;
  };
}>();

const emit = defineEmits<{
  (e: 'rowUpdated'): void;
}>();

// 默认显示所有按钮(后备方案)
const defaultVisibleActions = {
  scoreManage: true,
  setRemark: true,
  kickOut: true,
  freeze: true,
};

const visibleActions = computed(() => {
  return props.visibleActions || defaultVisibleActions;
});

// Loading flags
const scoreLoading = ref(false);
const remarkLoading = ref(false);
const kickOutLoading = ref(false);
const freezeLoading = ref(false);

// 是否被冻结
// const isFrozen = ref(false);
const isFrozen = ref(props.row.isBan === true);
onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  updateIsMobile();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile);
});
// ===== 工具函数: 检查是否在限制时间段 =====
function isInRestrictedTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // 凌晨00:00 - 00:30
  return hours === 0 && minutes < 30;
}
// ===== 分数管理弹窗 =====
const scoreModalVisible = ref(false);
const scoreForm = ref({
  operationType: 0 as 0 | 1, // 0-增加，1-减少
  value: undefined as number | undefined,
});

// ===== 备注管理弹窗 =====
const remarkModalVisible = ref(false);
const remarkForm = ref({
  extra: '',
});

function openScoreModal() {
  scoreModalVisible.value = true;
  scoreForm.value = {
    operationType: 0,
    value: undefined,
  };
}

function openRemarkModal() {
  remarkModalVisible.value = true;
  remarkForm.value = {
    extra: props.row.name || '', // 使用当前昵称作为默认值
  };
}

async function handleScoreSubmit() {
  // 验证输入
  if (scoreForm.value.value === undefined || scoreForm.value.value === null) {
    message.warning('请输入分数');
    return;
  }

  const value = Number(scoreForm.value.value);
  if (value <= 0) {
    message.warning('分数必须大于0');
    return;
  }

  if (scoreLoading.value) return;
  scoreLoading.value = true;

  try {
    // 获取俱乐部信息
    const clubId = props.currentClubId;
    const unionId = props.currentUnionId;

    if (!clubId || !unionId) {
      message.error('缺少俱乐部信息,请重新进入页面');
      scoreLoading.value = false;
      return;
    }

    // 获取当前操作者 PID
    const agentPid = Number(
      localStorage.getItem('AGENT_PID') ??
      localStorage.getItem('ACCOUNT_ID') ??
      0
    );

    if (!agentPid) {
      message.error('获取操作者信息失败');
      scoreLoading.value = false;
      return;
    }

    // 调用分数管理 API
    const resp = await apiUpdateSportsPoint({
      clubId: clubId,
      unionId: unionId,
      opClubId: clubId,
      type: scoreForm.value.operationType,
      opPid: props.row.pid || 0,
      value: value,
      timeSec: Math.floor(Date.now() / 1000),
      requestPid: agentPid,
    });

    console.log('[分数管理] 响应:', resp);

    // 根据实际返回结构处理响应
    if (resp.data.code === 0 && resp.data.data) {
      const result = resp.data.data;
      const opType = result.type === 0 ? '增加' : '减少';
      message.success(
        `${opType}成功！操作值: ${result.value}，当前余额: ${result.changedValue}`
      );
      scoreModalVisible.value = false;
      emit('rowUpdated');
    } else {
      message.error(resp.msg || '操作失败');
    }
  } catch (error: any) {
    console.error('[分数管理] 错误:', error);
    message.error(error?.message || '操作失败,请重试');
  } finally {
    scoreLoading.value = false;
  }
}

// ===== 设置备注 - 使用新的弹窗方式 =====
async function handleRemarkSubmit() {
  const extra = remarkForm.value.extra.trim();

  if (!extra) {
    message.warning('备注不能为空');
    return;
  }

  if (remarkLoading.value) return;
  remarkLoading.value = true;

  try {
    // 获取俱乐部ID
    const clubId = props.currentClubId;

    if (!clubId) {
      message.error('缺少俱乐部信息,请重新进入页面');
      remarkLoading.value = false;
      return;
    }

    // 获取当前操作者 PID
    const agentPid = Number(
      localStorage.getItem('AGENT_PID') ??
      localStorage.getItem('ACCOUNT_ID') ??
      0
    );

    if (!agentPid) {
      message.error('获取操作者信息失败');
      remarkLoading.value = false;
      return;
    }

    // 调用备注管理 API
    const resp = await apiSetExtra({
      clubId: clubId,
      pid: props.row.pid || 0,
      extra: extra,
      requestPid: agentPid,
    });

    console.log('[备注管理] 响应:', resp);

    if (resp.data.code === 0 && resp.data.data) {
      message.success('备注设置成功');
      remarkModalVisible.value = false;
      emit('rowUpdated');
    } else {
      message.error(resp.msg || '设置备注失败');
    }
  } catch (error: any) {
    console.error('[备注管理] 错误:', error);
    message.error(error?.message || '设置备注失败,请重试');
  } finally {
    remarkLoading.value = false;
  }
}

// ===== 踢出成员 =====
function handleKickOut() {
  if (kickOutLoading.value) return;

  // 检查时间限制
  if (isInRestrictedTime()) {
    message.warning('凌晨00:00 - 00:30期间不允许踢出操作');
    return;
  }

  Modal.confirm({
    title: '确认踢出',
    content: `确定要踢出成员 "${props.row.name}" 吗？`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      kickOutLoading.value = true;
      try {
        // 获取俱乐部ID
        const clubId = props.currentClubId;

        if (!clubId) {
          message.error('缺少俱乐部信息,请重新进入页面');
          kickOutLoading.value = false;
          return;
        }

        // 获取当前操作者 PID
        const agentPid = Number(
          localStorage.getItem('AGENT_PID') ??
          localStorage.getItem('ACCOUNT_ID') ??
          0
        );

        if (!agentPid) {
          message.error('获取操作者信息失败');
          kickOutLoading.value = false;
          return;
        }

        // 调用踢出 API
        const resp = await apiDeleteMember({
          clubId: clubId,
          pid: props.row.pid || 0,
          requestPid: agentPid,
        });

        console.log('[踢出成员] 响应:', resp);

        if (resp.data.code === 0 && resp.data.data) {
          message.success('踢出成功');
          emit('rowUpdated');
        } else {
          // 根据错误信息提示
          const errorMsg = resp.data.msg || '踢出失败';
          const errorCode = resp.data.code;
          if (errorCode === 6119) {
            message.error('该成员比赛分不为0，不允许踢出');
          } else if (errorMsg.includes('余额') || errorMsg.includes('balance')) {
            message.error('该成员总余额 ≥ 1，不允许踢出');
          } else if (errorMsg.includes('时间') || errorMsg.includes('time')) {
            message.error('当前时间段不允许踢出操作');
          } else {
            message.error(errorMsg);
          }
        }
      } catch (error: any) {
        console.error('[踢出成员] 错误:', error);
        message.error(error?.message || '踢出失败,请重试');
      } finally {
        kickOutLoading.value = false;
      }
    },
  });
}

// ===== 冻结/解冻 =====
function handleFreeze() {
  if (freezeLoading.value) return;
  const action = isFrozen.value ? '解冻' : '冻结';
  Modal.confirm({
    title: `确认${action}`,
    content: `确定要${action}成员 "${props.row.name}" 吗？`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      freezeLoading.value = true;
      try {
        // 获取俱乐部信息
        const clubId = props.currentClubId;
        const unionId = props.currentUnionId;

        if (!clubId || !unionId) {
          message.error('缺少俱乐部信息,请重新进入页面');
          freezeLoading.value = false;
          return;
        }

        // 获取当前操作者 PID
        const agentPid = Number(
          localStorage.getItem('AGENT_PID') ??
          localStorage.getItem('ACCOUNT_ID') ??
          0
        );

        if (!agentPid) {
          message.error('获取操作者信息失败');
          freezeLoading.value = false;
          return;
        }

        // 调用冻结/解冻 API
        const resp = await apiBanGameClubMember({
          clubId: clubId,
          unionId: unionId,
          pid: props.row.pid || 0,
          type: 0, // 0-个人
          value: isFrozen.value ? 0 : 1, // 0-解冻, 1-冻结
          requestPid: agentPid,
        });

        console.log('[冻结/解冻] 响应:', resp);

        if (resp.data.code === 0 && resp.data.data) {
          message.success(`${action}成功`);
          emit('rowUpdated');
        } else {
          message.error(resp.data.msg || `${action}失败`);
        }
      } catch (error: any) {
        console.error('[冻结/解冻] 错误:', error);
        message.error(error?.message || `${action}失败,请重试`);
      } finally {
        freezeLoading.value = false;
      }
    },
  });
}

// ===== 菜单项(手机端下拉菜单) =====
const menuItems = computed(() => {
  const items = [];

  if (visibleActions.value.scoreManage) {
    items.push({
      key: 'score-manage',
      label: '分数管理',
      loading: scoreLoading.value,
    });
  }

  if (visibleActions.value.setRemark) {
    items.push({
      key: 'set-remark',
      label: '设置备注',
      loading: remarkLoading.value,
    });
  }

  if (visibleActions.value.kickOut) {
    items.push({
      key: 'kick-out',
      label: '踢出',
      danger: true,
      loading: kickOutLoading.value,
    });
  }

  if (visibleActions.value.freeze) {
    items.push({
      key: 'freeze-toggle',
      label: isFrozen.value ? '解冻' : '冻结',
      danger: !isFrozen.value,
      loading: freezeLoading.value,
    });
  }

  return items;
});

// 处理菜单点击
function handleMenuClick({ key }: { key: string }) {
  switch (key) {
    case 'score-manage':
      openScoreModal();
      break;
    case 'set-remark':
      openRemarkModal();
      break;
    case 'kick-out':
      handleKickOut();
      break;
    case 'freeze-toggle':
      handleFreeze();
      break;
  }
}
// 监听 row.isBan 变化,自动更新按钮状态
watch(
  () => props.row.isBan,
  (newVal) => {
    isFrozen.value = newVal === true;
  }
);
</script>

<template>
  <!-- 无按钮显示情况 -->
  <div v-if="!Object.values(visibleActions).some(v => v)" class="member-actions">
    <span class="no-action">--</span>
  </div>

  <!-- ✅ 手机端：下拉菜单 -->
  <div v-else-if="isMobile" class="member-actions">
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

  <!-- ✅ PC端：文本链接 -->
  <div v-else class="member-actions">
    <a
      v-if="visibleActions.scoreManage"
      @click="openScoreModal"
      class="action-link"
      :class="{ loading: scoreLoading }"
    >
      分数管理
    </a>
    <a
      v-if="visibleActions.setRemark"
      @click="openRemarkModal"
      class="action-link"
      :class="{ loading: remarkLoading }"
    >
      设置备注
    </a>
    <a
      v-if="visibleActions.kickOut"
      @click="handleKickOut"
      class="action-link danger"
      :class="{ loading: kickOutLoading }"
    >
      踢出
    </a>
    <a
      v-if="visibleActions.freeze"
      @click="handleFreeze"
      class="action-link warning"
      :class="{ loading: freezeLoading }"
    >
      {{ isFrozen ? '解冻' : '冻结' }}
    </a>
  </div>

  <!-- ===== 分数管理弹窗 ===== -->
  <Modal
    v-model:open="scoreModalVisible"
    title="分数管理"
    :confirm-loading="scoreLoading"
    @ok="handleScoreSubmit"
    @cancel="scoreModalVisible = false"
    :width="480"
  >
    <div class="score-form">
      <!-- 玩家信息 -->
      <div class="form-item">
        <div class="form-label">操作对象：</div>
        <div class="player-info">
          <span class="player-name">{{ row.name }}</span>
          <span class="player-score">当前比赛分: {{ row.sportsPoint }}</span>
        </div>
      </div>

      <!-- 操作类型 -->
      <div class="form-item">
        <div class="form-label">操作类型：</div>
        <RadioGroup v-model:value="scoreForm.operationType">
          <Radio :value="0">增加</Radio>
          <Radio :value="1">减少</Radio>
        </RadioGroup>
      </div>

      <!-- 调整分数 -->
      <div class="form-item">
        <div class="form-label">
          <span class="required">*</span>
          调整分数：
        </div>
        <InputNumber
          v-model:value="scoreForm.value"
          :min="0.01"
          :max="999999"
          :precision="2"
          placeholder="请输入分数(正数)"
          style="width: 100%"
        />
        <div class="form-hint">
          {{ scoreForm.operationType === 0 ? '增加后' : '减少后' }}的预计余额:
          <span class="highlight">
            {{
              scoreForm.value
                ? (scoreForm.operationType === 0
                    ? (row.sportsPoint || 0) + scoreForm.value
                    : (row.sportsPoint || 0) - scoreForm.value
                ).toFixed(2)
                : (row.sportsPoint || 0).toFixed(2)
            }}
          </span>
        </div>
      </div>
    </div>
  </Modal>

  <!-- ===== 备注管理弹窗 ===== -->
  <Modal
    v-model:open="remarkModalVisible"
    title="设置备注"
    :confirm-loading="remarkLoading"
    @ok="handleRemarkSubmit"
    @cancel="remarkModalVisible = false"
    :width="480"
  >
    <div class="remark-form">
      <!-- 玩家信息 -->
      <div class="form-item">
        <div class="form-label">操作对象：</div>
        <div class="player-info">
          <span class="player-name">{{ row.name }}</span>
          <span class="player-id">PID: {{ row.pid }}</span>
        </div>
      </div>

      <!-- 备注输入 -->
      <div class="form-item">
        <div class="form-label">
          <span class="required">*</span>
          备注信息：
        </div>
        <Input.TextArea
          v-model:value="remarkForm.extra"
          placeholder="请输入备注信息"
          :rows="4"
          :maxlength="100"
          show-count
        />
        <div class="form-hint">
          备注信息将显示为该成员的昵称
        </div>
      </div>
    </div>
  </Modal>
</template>

<style scoped>
.member-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
}

.no-action {
  color: #999;
}

.action-link {
  color: #1890ff;
  cursor: pointer;
  white-space: nowrap;
  padding: 0 4px;
  transition: all 0.2s;
}

.action-link:hover {
  color: #40a9ff;
  text-decoration: underline;
}

.action-link.loading {
  opacity: 0.6;
  cursor: not-allowed;
}

.action-link.danger {
  color: #ff4d4f;
}

.action-link.danger:hover {
  color: #ff7875;
}

.action-link.warning {
  color: #faad14;
}

.action-link.warning:hover {
  color: #ffc53d;
}

/* 分数管理弹窗样式 */
.score-form {
  padding: 8px 0;
}

/* 备注管理弹窗样式 */
.remark-form {
  padding: 8px 0;
}

.form-item {
  margin-bottom: 20px;
}

.form-item:last-child {
  margin-bottom: 0;
}

.form-label {
  margin-bottom: 8px;
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.form-label .required {
  color: #ff4d4f;
  margin-right: 4px;
}

.player-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px;
}

.player-name {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.player-score,
.player-id {
  font-size: 13px;
  color: #666;
}

.form-hint {
  margin-top: 8px;
  font-size: 12px;
  color: #666;
}

.form-hint .highlight {
  color: #1890ff;
  font-weight: 600;
  font-size: 14px;
}

@media (max-width: 600px) {
  .member-actions {
    font-size: 11px;
    gap: 6px;
  }

  .action-link {
    padding: 0 2px;
  }

  .player-info {
    padding: 10px;
  }

  .player-name {
    font-size: 14px;
  }

  .player-score {
    font-size: 12px;
  }
}
</style>
