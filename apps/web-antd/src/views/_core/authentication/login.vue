<script setup lang="ts">
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, markRaw, ref, onMounted } from 'vue';
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
// 获取当前端口
const currentPort = ref(window.location.port || '80');

// 判断是否隐藏密码框（例如：5667 端口隐藏密码框）
const hidePassword = computed(() => {
  return currentPort.value === '5667'; // 或者其他端口
});

onMounted(() => {
  console.log('[Login] 当前端口:', currentPort.value);
  console.log('[Login] 是否隐藏密码框:', hidePassword.value);
});

// const formSchema = computed<VbenFormSchema[]>(() => [
//   {
//     component: 'VbenInput',
//     fieldName: 'username',
//     label: $t('authentication.username'),
//     componentProps: { placeholder: $t('authentication.usernameTip') },
//     rules: z
//       .string()
//       .min(1, { message: $t('authentication.usernameTip') })
//       .optional()
//
//   },
//   {
//     component: 'VbenInputPassword',
//     fieldName: 'password',
//     label: $t('authentication.password'),
//     componentProps: { placeholder: $t('authentication.password') },
//     rules: z
//       .string()
//       .min(1, { message: $t('authentication.passwordTip') })
//       .optional(),
//
//   },
//
// ]);
const formSchema = computed<VbenFormSchema[]>(() => {
  const schema: VbenFormSchema[] = [
    {
      component: 'VbenInput',
      fieldName: 'username',
      label: $t('authentication.username'),
      componentProps: { placeholder: $t('authentication.usernameTip') },
      rules: z
        .string()
        .min(1, { message: $t('authentication.usernameTip') })
        .optional()
    },
  ];

  // 只有在不隐藏密码时才添加密码字段
  if (!hidePassword.value) {
    schema.push({
      component: 'VbenInputPassword',
      fieldName: 'password',
      label: $t('authentication.password'),
      componentProps: { placeholder: $t('authentication.password') },
      rules: z
        .string()
        .min(1, { message: $t('authentication.passwordTip') })
        .optional(),
    });
  }

  return schema;
});
const loginLoading = ref(false);

// 登录逻辑
const login = async (form: { password?: string; username: string }) => {
  loginLoading.value = true;

  try {
    // 如果隐藏了密码框，使用默认密码
    const loginForm = {
      username: form.username,
      password: hidePassword.value ? '123456' : (form.password || ''),
    };
    console.log('[Login] 提交表单:', loginForm);

    // 调用 store 中的 authLogin 方法并传递 router 实例
    await authStore.authLogin(loginForm, router, accessStore, userStore); // 传递 router 实例


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
