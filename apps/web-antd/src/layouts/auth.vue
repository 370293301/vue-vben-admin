<script lang="ts" setup>
import { computed } from 'vue';

import { AuthPageLayout } from '@vben/layouts';

import { $t } from '#/locales';

const appName = computed(() => '老王麻将推广员');
const logo = '';
</script>

<template>
  <AuthPageLayout
    :app-name="appName"
    :page-description="$t('authentication.pageDesc')"
    :page-title="$t('authentication.pageTitle')"
  >
    <!-- 自定义工具栏 -->
    <!-- <template #toolbar></template> -->
  </AuthPageLayout>
</template>
