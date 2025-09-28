import { defineOverridesPreferences } from '@vben/preferences';

/**
 * @description 项目配置文件
 * 只需要覆盖项目中的一部分配置，不需要的配置不用覆盖，会自动使用默认配置
 * !!! 更改配置后请清空缓存，否则可能不生效
 */
export const overridesPreferences = defineOverridesPreferences({
  // overrides
  app: {
    name: import.meta.env.VITE_APP_TITLE,
    accessMode: 'backend',
  },
  layout: {
    // 关闭“内容区域定宽”模式
    contentCompact: 'none', // 可选: 'none' | 'center' | 'wide'
    contentCompactWidth: 0, // 设 0 或更小的值，避免 1200 的最小宽度
  },
});
