<script setup lang="ts">
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, markRaw, ref } from 'vue';
import { useRouter } from 'vue-router';

import { AuthenticationLogin, SliderCaptcha, z } from '@vben/common-ui';
import { $t } from '@vben/locales';
import { useAccessStore, useUserStore } from '@vben/stores';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });

const authStore = useAuthStore();
const router = useRouter(); // 获取 router 实例
const accessStore = useAccessStore();
const userStore = useUserStore();
// await authStore.logout(router);
// const handleLogout = async () => {
//   await authStore.logout(router); // 将 router 传递给 store 中的 logout 方法
// };
// const handleLogout = async () => {
//   await authStore.logout(); // 将 router 传递给 store 中的 logout 方法
// };

const formSchema = computed<VbenFormSchema[]>(() => [
  {
    component: 'VbenInput',
    fieldName: 'username',
    label: $t('authentication.username'),
    componentProps: { placeholder: $t('authentication.usernameTip') },
    rules: z
      .string()
      .min(1, { message: $t('authentication.usernameTip') })
      .optional().default('160607'),

  },
  {
    component: 'VbenInputPassword',
    fieldName: 'password',
    label: $t('authentication.password'),
    componentProps: { placeholder: $t('authentication.password') },
    rules: z
      .string()
      .min(1, { message: $t('authentication.passwordTip') })
      .optional().default('123456'),

  },
  // {
  //   component: markRaw(SliderCaptcha),
  //   fieldName: 'captcha',
  //   rules: z
  //     .boolean()
  //     .refine((v) => v, { message: $t('authentication.verifyRequiredTip') }),
  // },
]);

const loginLoading = ref(false);

// 登录逻辑
const login = async (form: { password: string; username: string }) => {
  loginLoading.value = true;

  try {
    // 调用 store 中的 authLogin 方法并传递 router 实例
    await authStore.authLogin(form, router, accessStore, userStore); // 传递 router 实例


  } catch (error) {
    console.error('Login failed:', error);
  } finally {
    loginLoading.value = false;
  }
};
const handleLogout = async () => {
  await authStore.logout({ redirect: true, router }); // 将 router 传递给 logout 方法
};
</script>

<template>
  <AuthenticationLogin
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    @submit="login"
  />
</template>
