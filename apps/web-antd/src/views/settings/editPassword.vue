<script lang="ts" setup>
import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Button, Input, message } from 'ant-design-vue';

const newPassword = ref('');

function onSubmit() {
  if (!newPassword.value) return message.warning('请输入新密码');
  // TODO: 调用你的修改密码接口
  message.success('已提交');
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
