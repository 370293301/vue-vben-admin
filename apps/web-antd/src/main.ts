import { initPreferences } from '@vben/preferences';
import { unmountGlobalLoading } from '@vben/utils';

import { overridesPreferences } from './preferences';

import '#/adapter/vxe-table'; // 你的 setupVbenVxeTable()

import 'vxe-table/styles/cssvar.scss'; // v4 样式
import './styles/variables.css';
// -------- 在 main.ts 中（在 app.use(router) 之后，app.mount 之前） --------
import { router } from '#/router'; // <- 注意：如果你的 router 是 named export，请改为 `import { router } from '@/router';`


// 暴露 router 到 window（便于调试）
;(window as any).__VUE_ROUTER__ = router;
console.log('[DEBUG main] router exposed to window.__VUE_ROUTER__');

// 打印现有路由
try {
  console.log('[DEBUG main] existing routes:', router.getRoutes().map((r: any) => ({ name: r.name, path: r.path })));
} catch (e) {
  console.warn('[DEBUG main] getRoutes() failed', e);
}

// 如果没有 RecordList 路由则添加（静默路由，不显示在菜单）
// if (!router.hasRoute('RecordList')) {
//   router.addRoute({
//     path: '/member/record-list',
//     name: 'RecordList',
//     component: () => import('#/views/member/RecordList.vue'),
//     meta: { title: '战绩记录', hideMenu: true, hidden: true, ignoreRoute: true, noBasicLayout: false
//
//     },
//   });
//   console.log('[DEBUG main] addRoute: RecordList added');
// } else {
//   console.log('[DEBUG main] RecordList already exists');
// }
/**
 * 应用初始化完成之后再进行页面加载渲染
 */
async function initApplication() {
  // name用于指定项目唯一标识
  // 用于区分不同项目的偏好设置以及存储数据的key前缀以及其他一些需要隔离的数据
  const env = import.meta.env.PROD ? 'prod' : 'dev';
  const appVersion = import.meta.env.VITE_APP_VERSION;
  const namespace = `${import.meta.env.VITE_APP_NAMESPACE}-${appVersion}-${env}`;

  // app偏好设置初始化
  await initPreferences({
    namespace,
    overrides: overridesPreferences,
  });

  // 启动应用并挂载
  // vue应用主要逻辑及视图
  const { bootstrap } = await import('./bootstrap');
  await bootstrap(namespace);

  // 移除并销毁loading
  unmountGlobalLoading();
}

initApplication();
