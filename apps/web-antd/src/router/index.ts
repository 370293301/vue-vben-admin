import {
  createRouter,
  createWebHashHistory,
  createWebHistory,
} from 'vue-router';

import { resetStaticRoutes } from '@vben/utils';

import { createRouterGuard } from './guard';
import { routes } from './routes';

/**
 *  @zh_CN 创建vue-router实例
 */
const router = createRouter({
  history: (() => {
    // ✅ 修改这里：检查环境变量
    const routerHistory = import.meta.env.VITE_ROUTER_HISTORY ?? 'history';

    console.log('[Router] 使用的路由模式:', routerHistory);

    // ✅ 改为 'history'（默认值）
    if (routerHistory === 'hash') {
      return createWebHashHistory(import.meta.env.VITE_BASE);
    } else {
      // ✅ 默认使用 History 模式
      return createWebHistory(import.meta.env.VITE_BASE);
    }
  })(),
  // 应该添加到路由的初始路由列表。
  routes,
  scrollBehavior: (to, _from, savedPosition) => {
    if (savedPosition) {
      return savedPosition;
    }
    return to.hash ? { behavior: 'smooth', el: to.hash } : { left: 0, top: 0 };
  },
  // 是否应该禁止尾部斜杠。
  // strict: true,
});
// const router = createRouter({
//   history:
//     import.meta.env.VITE_ROUTER_HISTORY === 'hash'
//       ? createWebHashHistory(import.meta.env.VITE_BASE)
//       : createWebHistory(import.meta.env.VITE_BASE),
//   // 应该添加到路由的初始路由列表。
//   routes,
//   scrollBehavior: (to, _from, savedPosition) => {
//     if (savedPosition) {
//       return savedPosition;
//     }
//     return to.hash ? { behavior: 'smooth', el: to.hash } : { left: 0, top: 0 };
//   },
//   // 是否应该禁止尾部斜杠。
//   // strict: true,
// });

const resetRoutes = () => resetStaticRoutes(router, routes);

// 创建路由守卫
createRouterGuard(router);

export { resetRoutes, router };
