<script lang="ts" setup>
import type { NotificationItem } from '@vben/layouts';

import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLoginExpiredModal } from '@vben/common-ui';
import { VBEN_DOC_URL, VBEN_GITHUB_URL } from '@vben/constants';
import { useWatermark } from '@vben/hooks';
import { BookOpenText, CircleHelp, MdiGithub } from '@vben/icons';
import {
  BasicLayout,
  LockScreen,
  UserDropdown,
} from '@vben/layouts';
import { preferences } from '@vben/preferences';
import { useAccessStore, useUserStore } from '@vben/stores';
import { openWindow } from '@vben/utils';

import { $t } from '#/locales';
import { useAuthStore } from '#/store';
import LoginForm from '#/views/_core/authentication/login.vue';
import ChangePasswordModal from '#/views/_core/authentication/change-password-modal.vue';
import { useModalStore } from '#/store/modal';

const userStore = useUserStore();
const authStore = useAuthStore();
const accessStore = useAccessStore();
const router = useRouter();
const { destroyWatermark, updateWatermark } = useWatermark();
const changePasswordModalRef = ref();
const modalStore = useModalStore();
// 获取当前端口
const currentPort = ref(window.location.port || '80');

// 判断是否显示修改密码按钮（5667 端口隐藏）
const showChangePassword = computed(() => {
  return currentPort.value !== '5667';
});

// 动态生成菜单
const menus = computed(() => {
  const menuItems = [];

  // 只有当不是 5667 端口时才显示修改密码按钮
  if (showChangePassword.value) {
    menuItems.push({
      handler: () => {
        console.log('[basic.vue] 点击修改密码按钮');
        console.log('[basic.vue] modalStore:', modalStore);
        console.log('[basic.vue] isChangePasswordOpen before:', modalStore.isChangePasswordOpen);
        modalStore.openChangePassword();
        console.log('[basic.vue] isChangePasswordOpen after:', modalStore.isChangePasswordOpen);
      },
      text: '修改密码',
    });
  }

  return menuItems;
});

const avatar = computed(() => {
  return userStore.userInfo?.avatar ?? preferences.app.defaultAvatar;
});

async function handleLogout() {
  await authStore.logout({ redirect: true, router });
}

function handleNoticeClear() {
  notifications.value = [];
}

function handleMakeAll() {
  notifications.value.forEach((item) => (item.isRead = true));
}
watch(
  () => preferences.app.watermark,
  async (enable) => {
    if (enable) {
      await updateWatermark({
        content: `${userStore.userInfo?.username} - ${userStore.userInfo?.realName}`,
      });
    } else {
      destroyWatermark();
    }
  },
  {
    immediate: true,
  },
);
</script>

<template>
  <BasicLayout @clear-preferences-and-logout="handleLogout">
    <template #user-dropdown>
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.username"
        description=""
        :tag-text=userStore.userInfo?.roles[0]
        @logout="handleLogout"
      />
    </template>

<!--    <template #notification>-->
<!--      <Notification-->
<!--        :dot="showDot"-->
<!--        :notifications="notifications"-->
<!--        @clear="handleNoticeClear"-->
<!--        @make-all="handleMakeAll"-->
<!--      />-->
<!--    </template>-->
    <template #extra>
      <AuthenticationLoginExpiredModal
        v-model:open="accessStore.loginExpired"
        :avatar
      >
        <LoginForm />
      </AuthenticationLoginExpiredModal>
      <ChangePasswordModal v-if="showChangePassword" />
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
    <!-- 修改：把对话框移到 BasicLayout 标签内，不使用 #extra -->

  </BasicLayout>
</template>

<style>
/* 隐藏语言切换按钮 */
/* 只隐藏包含语言图标的按钮 */
button:has(.lucide-languages-icon),
button:has(.lucide-languages) {
  display: none !important;
}

/* 或者更精确 */
button[id*="radix-vue-dropdown-menu-trigger"]:has(svg.lucide-languages) {
  display: none !important;
}
</style>
