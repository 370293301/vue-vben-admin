import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useModalStore = defineStore('modal', () => {
  const isChangePasswordOpen = ref(false);

  const openChangePassword = () => {
    console.log('[modal store] 打开修改密码对话框');
    isChangePasswordOpen.value = true;
  };

  const closeChangePassword = () => {
    console.log('[modal store] 关闭修改密码对话框');
    isChangePasswordOpen.value = false;
  };

  return {
    isChangePasswordOpen,
    openChangePassword,
    closeChangePassword,
  };
});
