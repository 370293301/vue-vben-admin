<script lang="ts" setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { Modal, Input, InputNumber, message, Dropdown, Menu, Button } from 'ant-design-vue';

// --- 响应式判断是否为手机 / 窄屏 ---
const mobileBreakpoint = 768;
const isMobile = ref(typeof window !== 'undefined' ? window.innerWidth <= mobileBreakpoint : false);

function updateIsMobile() {
  isMobile.value = window.innerWidth <= mobileBreakpoint;
}

const props = defineProps<{
  row: any;
}>();

const emit = defineEmits<{
  (e: 'rowUpdated'): void;
}>();

// loading flags
const scoreLoading = ref(false);
const remarkLoading = ref(false);
const kickOutLoading = ref(false);
const freezeLoading = ref(false);
const promoterLoading = ref(false);
const managerLoading = ref(false);

// 计算菜单项（用于手机端下拉菜单）
const menuItems = computed(() => {
  return [
    { key: 'score-manage', label: '分数管理', loading: scoreLoading.value },
    { key: 'set-remark', label: '设置备注', loading: remarkLoading.value },
    { key: 'kick-out', label: '踢出', danger: true, loading: kickOutLoading.value },
    {
      key: 'freeze-toggle',
      label: props.row.frozen ? '解冻' : '冻结',
      danger: !props.row.frozen,
      loading: freezeLoading.value
    },
    { key: 'set-promoter', label: '设置推广员', loading: promoterLoading.value },
    { key: 'set-manager', label: '设置赛事管理', loading: managerLoading.value },
  ];
});

// 分数管理弹窗
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
    // 调用API
    // await updateMemberScore({
    //   memberId: props.row.id,
    //   score: scoreForm.value.score,
    //   reason: scoreForm.value.reason,
    // });
    message.success('分数修改成功');
    scoreModalVisible.value = false;
    emit('rowUpdated');
  } catch (error) {
    message.error('操作失败');
  } finally {
    scoreLoading.value = false;
  }
}

// 设置备注
async function onSetRemark() {
  if (remarkLoading.value) return;
  remarkLoading.value = true;
  try {
    const current = props.row.markStr ?? '';
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
    // 调用API
    // await updateMemberRemark({
    //   memberId: props.row.id,
    //   remark: trimmed,
    // });
    message.success('备注设置成功');
    emit('rowUpdated');
  } catch (error: any) {
    console.error(error);
    message.error(error?.message ?? '设置备注出错');
  } finally {
    remarkLoading.value = false;
  }
}

// 踢出确认
function handleKickOut() {
  if (kickOutLoading.value) return;
  Modal.confirm({
    title: '确认踢出',
    content: `确定要踢出成员 "${props.row.nickname}" 吗？`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      kickOutLoading.value = true;
      try {
        // 调用API
        // await kickOutMember({ memberId: props.row.id });
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

// 冻结确认
function handleFreeze() {
  if (freezeLoading.value) return;
  const action = props.row.frozen ? '解冻' : '冻结';
  Modal.confirm({
    title: `确认${action}`,
    content: `确定要${action}成员 "${props.row.nickname}" 吗？`,
    okText: '确认',
    cancelText: '取消',
    onOk: async () => {
      freezeLoading.value = true;
      try {
        // 调用API
        // await freezeMember({
        //   memberId: props.row.id,
        //   frozen: !props.row.frozen,
        // });
        message.success(`${action}成功`);
        emit('rowUpdated');
      } catch (error) {
        message.error('操作失败');
      } finally {
        freezeLoading.value = false;
      }
    },
  });
}

// 设置推广员弹窗
const promoterModalVisible = ref(false);
const promoterForm = ref({
  isPromoter: false,
});

function openPromoterModal() {
  promoterModalVisible.value = true;
  promoterForm.value = {
    isPromoter: props.row.isPromoter || false,
  };
}

async function handlePromoterSubmit() {
  if (promoterLoading.value) return;
  promoterLoading.value = true;
  try {
    // 调用API
    // await setMemberPromoter({
    //   memberId: props.row.id,
    //   isPromoter: promoterForm.value.isPromoter,
    // });
    message.success('推广员设置成功');
    promoterModalVisible.value = false;
    emit('rowUpdated');
  } catch (error) {
    message.error('操作失败');
  } finally {
    promoterLoading.value = false;
  }
}

// 设置赛事管理弹窗
const managerModalVisible = ref(false);
const managerForm = ref({
  isManager: false,
});

function openManagerModal() {
  managerModalVisible.value = true;
  managerForm.value = {
    isManager: props.row.isManager || false,
  };
}

async function handleManagerSubmit() {
  if (managerLoading.value) return;
  managerLoading.value = true;
  try {
    // 调用API
    // await setCompetitionManager({
    //   memberId: props.row.id,
    //   isManager: managerForm.value.isManager,
    // });
    message.success('赛事管理设置成功');
    managerModalVisible.value = false;
    emit('rowUpdated');
  } catch (error) {
    message.error('操作失败');
  } finally {
    managerLoading.value = false;
  }
}

// 处理下拉菜单点击
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
    case 'set-promoter':
      openPromoterModal();
      break;
    case 'set-manager':
      openManagerModal();
      break;
  }
}

onMounted(() => {
  window.addEventListener('resize', updateIsMobile);
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

  <!-- ✅ PC端：文本链接 -->
  <div v-else class="member-actions">
    <a @click="openScoreModal" class="action-link">分数管理</a>
    <a @click="onSetRemark" class="action-link">设置备注</a>
    <a @click="handleKickOut" class="action-link danger">踢出</a>
    <a @click="handleFreeze" class="action-link warning">
      {{ row.frozen ? '解冻' : '冻结' }}
    </a>
    <a @click="openPromoterModal" class="action-link">设置推广员</a>
    <a @click="openManagerModal" class="action-link">设置赛事管理</a>
  </div>

  <!-- 分数管理弹窗 -->
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

  <!-- 设置推广员弹窗 -->
  <Modal
    v-model:open="promoterModalVisible"
    title="设置推广员"
    :confirm-loading="promoterLoading"
    @ok="handlePromoterSubmit"
    @cancel="promoterModalVisible = false"
  >
    <div class="form-item">
      <div class="form-label">是否设为推广员：</div>
      <Input.TextArea
        v-model:value="promoterForm.isPromoter"
        placeholder="输入 true 或 false"
        :rows="2"
      />
    </div>
  </Modal>

  <!-- 设置赛事管理弹窗 -->
  <Modal
    v-model:open="managerModalVisible"
    title="设置赛事管理"
    :confirm-loading="managerLoading"
    @ok="handleManagerSubmit"
    @cancel="managerModalVisible = false"
  >
    <div class="form-item">
      <div class="form-label">是否设为赛事管理员：</div>
      <Input.TextArea
        v-model:value="managerForm.isManager"
        placeholder="输入 true 或 false"
        :rows="2"
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

.action-link {
  color: #1890ff;
  cursor: pointer;
  white-space: nowrap;
  padding: 0 4px;
}

.action-link:hover {
  color: #40a9ff;
  text-decoration: underline;
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
