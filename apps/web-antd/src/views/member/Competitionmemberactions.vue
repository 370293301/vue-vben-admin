<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { Modal, Input, InputNumber, message, Dropdown, Menu, Button } from 'ant-design-vue';
import type { CompetitionMember } from '#/api/competition';
import { apiBanGame, apiSetRemark } from '#/api/member';

// --- 响应式判断是否为手机 / 窄屏 ---
const mobileBreakpoint = 768;
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= mobileBreakpoint : false);

function updateIsMobile() {
  isMobile.value = window.innerWidth <= mobileBreakpoint;
}

const props = defineProps<{
  row: CompetitionMember;
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

// 默认显示所有按钮（后备方案）
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
const isFrozen = ref(false);

onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
  updateIsMobile();
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', updateIsMobile);
});

// ===== 分数管理弹窗 =====
const scoreModalVisible = ref(false);
const scoreForm = ref({
  score: 0,
  reason: '',
});

function openScoreModal() {
  scoreModalVisible.value = true;
  scoreForm.value = {
    score: 0,
    reason: '',
  };
}

async function handleScoreSubmit() {
  if (!scoreForm.value.score) {
    message.warning('请输入分数');
    return;
  }
  if (scoreLoading.value) return;
  scoreLoading.value = true;
  try {
    // TODO: 调用分数管理 API
    // await apiUpdateMemberScore({
    //   pid: props.row.pid,
    //   score: scoreForm.value.score,
    //   reason: scoreForm.value.reason,
    // });
    console.log('分数提交:', scoreForm.value);
    message.success('分数修改成功');
    scoreModalVisible.value = false;
    emit('rowUpdated');
  } catch (error) {
    message.error('操作失败');
  } finally {
    scoreLoading.value = false;
  }
}

// ===== 设置备注 =====
async function onSetRemark() {
  if (remarkLoading.value) return;
  remarkLoading.value = true;
  try {
    const current = props.row.name ?? '';
    const remark = window.prompt('请输入备注内容：', String(current));
    if (remark === null) {
      remarkLoading.value = false;
      return;
    }
    const trimmed = String(remark).trim();
    if (!trimmed) {
      message.warning('备注不能为空');
      remarkLoading.value = false;
      return;
    }

    // 调用 API 设置备注
    const agentPid = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);
    await apiSetRemark({
      pid: props.row.pid || 0,
      remark: trimmed,
      requestPid: agentPid,
    });

    message.success('备注设置成功');
    emit('rowUpdated');
  } catch (error: any) {
    console.error(error);
    message.error(error?.message ?? '设置备注出错');
  } finally {
    remarkLoading.value = false;
  }
}

// ===== 踢出成员 =====
function handleKickOut() {
  if (kickOutLoading.value) return;
  Modal.confirm({
    title: '确认踢出',
    content: `确定要踢出成员 "${props.row.name}" 吗？`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      kickOutLoading.value = true;
      try {
        // TODO: 调用踢出 API
        console.log('踢出成员:', props.row.name);
        message.success('踢出成功');
        emit('rowUpdated');
      } catch (error) {
        message.error('操作失败');
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
        const agentPid = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);
        await apiBanGame({
          pid: props.row.pid || 0,
          type: isFrozen.value ? 0 : 1, // 0=解冻 1=冻结
          requestPid: agentPid,
        });

        message.success(`${action}成功`);
        isFrozen.value = !isFrozen.value;
        emit('rowUpdated');
      } catch (error) {
        message.error('操作失败');
      } finally {
        freezeLoading.value = false;
      }
    },
  });
}

// ===== 菜单项（手机端下拉菜单） =====
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
      onSetRemark();
      break;
    case 'kick-out':
      handleKickOut();
      break;
    case 'freeze-toggle':
      handleFreeze();
      break;
  }
}
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
      @click="onSetRemark"
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
  >
    <div class="form-item">
      <div class="form-label">调整分数：</div>
      <InputNumber
        v-model:value="scoreForm.score"
        :min="-999999"
        :max="999999"
        placeholder="输入分数，正数为增加，负数为减少"
        style="width: 100%"
      />
    </div>
    <div class="form-item">
      <div class="form-label">原因说明：</div>
      <Input.TextArea
        v-model:value="scoreForm.reason"
        placeholder="请输入调整原因"
        :rows="3"
      />
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

.form-item {
  margin-bottom: 16px;
}

.form-label {
  margin-bottom: 8px;
  font-weight: 500;
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
}
</style>
