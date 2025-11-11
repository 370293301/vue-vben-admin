<template>
  <Teleport to="body">
    <Modal
      v-model:open="modalStore.isChangePasswordOpen"
      title="修改密码"
      :width="500"
      :confirm-loading="loading"
      ok-text="确定"
      cancel-text="取消"
      @ok="handleSubmit"
      @cancel="handleCancel"
    >
      <Form
        ref="formRef"
        :model="formData"
        :rules="rules"
        :label-col="{ span: 6 }"
        :wrapper-col="{ span: 16 }"
      >
        <FormItem label="新密码" name="newPassword">
          <InputPassword
            v-model:value="formData.newPassword"
            placeholder="请输入新密码(至少6位)"
            autocomplete="new-password"
          />
        </FormItem>

        <FormItem label="确认密码" name="confirmPassword">
          <InputPassword
            v-model:value="formData.confirmPassword"
            placeholder="请再次输入新密码"
            autocomplete="new-password"
          />
        </FormItem>
      </Form>
    </Modal>
  </Teleport>
</template>

<script lang="ts" setup>
import { ref, reactive, watch, onMounted, Teleport } from 'vue';
import { Modal, Form, FormItem, InputPassword, message } from 'ant-design-vue';
import { useModalStore } from '#/store/modal';
import { changePasswordApi } from '#/api/core/user';

const modalStore = useModalStore();
const loading = ref(false);
const formRef = ref();

const formData = reactive({
  newPassword: '',
  confirmPassword: ''
});

// 添加监听来调试
watch(() => modalStore.isChangePasswordOpen, (newVal, oldVal) => {
  console.log('[change-password-modal] isChangePasswordOpen changed:', {
    from: oldVal,
    to: newVal
  });
});

onMounted(() => {
  console.log('[change-password-modal] 组件已挂载');
  console.log('[change-password-modal] modalStore:', modalStore);
  console.log('[change-password-modal] isChangePasswordOpen:', modalStore.isChangePasswordOpen);
});

const validateConfirmPassword = async (_rule: any, value: string) => {
  if (value === '') {
    return Promise.reject('请确认新密码');
  } else if (value !== formData.newPassword) {
    return Promise.reject('两次输入的密码不一致');
  } else {
    return Promise.resolve();
  }
};

const rules = {
  newPassword: [
    { required: true, message: '请输入新密码', trigger: 'blur' },
    { min: 6, message: '密码长度不能少于6位', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, validator: validateConfirmPassword, trigger: 'blur' }
  ]
};

const handleSubmit = async () => {
  try {
    await formRef.value?.validate();
    loading.value = true;

    console.log('[修改密码] 开始调用接口');
    await changePasswordApi({
      oldPassword: '',
      newPassword: formData.newPassword
    });

    message.success('密码修改成功');
    modalStore.closeChangePassword();
    resetForm();

  } catch (error: any) {
    if (error.errorFields) {
      return;
    }
    console.error('[修改密码] 失败:', error);
    message.error(error.message || '密码修改失败');
  } finally {
    loading.value = false;
  }
};

const handleCancel = () => {
  modalStore.closeChangePassword();
  resetForm();
};

const resetForm = () => {
  Object.assign(formData, {
    newPassword: '',
    confirmPassword: ''
  });
  formRef.value?.clearValidate();
};
</script>
