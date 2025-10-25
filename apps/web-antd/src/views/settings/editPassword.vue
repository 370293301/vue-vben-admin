<script lang="ts" setup>
import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Input, message } from 'ant-design-vue';

import { agentChangePassWord } from '#/api/account';
import CryptoJS from 'crypto-js';
const newPassword = ref('');
function md5Encrypt(str: string): string {
  return CryptoJS.MD5(str).toString();
}
async function onSubmit() {
  if (!newPassword.value || !String(newPassword.value).trim()) {
    return message.warning('请输入新密码');
  }

  try {
    // 可选：禁用按钮 / 展示 loading（略）
    const resp = await agentChangePassWord({
      newPassWord: newPassword.value.trim(),
      // requestPid: Number(localStorage.getItem('AGENT_PID') ?? 0), // 可选显式传
    });

    // 后端返回示例 { result: '成功'/'失败' 或 true/false, message: '...' }
    const result = resp?.result;
    const msg = resp?.message ?? '';
    console.log(' resp', resp.code);
    // 根据后端 result 字段进行判断（兼容字符串或 boolean）
    const ok =
      result === true ||
      String(result).toLowerCase() === 'true' ||
      String(result).includes('成功') ||
      String(result).toLowerCase() === 'success' ||
      resp.code === 0;

    if (ok) {
      message.success(msg || '密码修改成功');
      // ✅ 密码修改成功后，更新 localStorage
      const plainPassword = newPassword.value.trim();
      const encryptedPassword = md5Encrypt(plainPassword);

      // 存储加密密码（用于下次登录）
      localStorage.setItem('AGENT_PASSWORD', encryptedPassword);

      // 存储明文密码（可选，根据你的需求）
      localStorage.setItem('AGENT_PASSWORD_PLAIN', plainPassword);
      // 需要的话可以清空输入并跳转/关闭
      newPassword.value = '';
    } else {
      message.error(msg || '密码修改失败');
    }
  } catch (error: any) {
    console.error('[agentChangePassWord] error', error);
    message.error(error?.message || '请求出错，请稍后重试');
  }
}
</script>

<template>
  <Page auto-content-height>
    <div class="reset-wrap">
      <label class="reset-label">新密码：</label>
      <Input v-model:value="newPassword" class="reset-input" size="large" />
      <Button class="reset-btn" size="large" @click="onSubmit"> 确定 </Button>
    </div>
  </Page>
</template>

<style scoped>
.reset-wrap {
  display: flex;
  align-items: center; /* 垂直居中对齐到一条基线 */
  padding: 32px 16px; /* 顶部留白，和图里接近 */
}

/* 左侧“新密码：”——更大更粗 */
.reset-label {
  margin-right: 20px; /* 文字与输入框的间距 */
  font-size: 22px;
  font-weight: 700;
  color: #222;
}

/* 中间输入框宽度与高度 */
.reset-input {
  width: 240px;
}

/* 右侧按钮：与图里的浅灰描边白底相近 */
.reset-btn {
  margin-left: 80px; /* 输入框与按钮的间隔（图里更开一些） */
  border-radius: 6px;

  /* 默认 type="default" 就是白底灰边，如果你想更圆润可加下面这一行 */

  /* -- keep default styles -- */
}
</style>
