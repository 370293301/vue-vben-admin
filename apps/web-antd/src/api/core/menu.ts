// src/api/core/menu.ts

// 如果需要可导入类型：
// import type { RouteRecordRaw } from 'vue-router';

export async function getAllMenusApi(): Promise<any[]> {
  const routes = [
    {
      meta: {
        order: -1,
        title: 'page.dashboard.title',
      },
      name: '00000',
      path: '/',
      redirect: '/0000',
      children: [
        {
          name: 'home',
          path: '/analytics',
          // 保留为字符串路径（如果你需要动态 import 可改成 () => import('...')）
          component: '/dashboard/analytics/index',
          meta: {
            affixTab: true,
            icon: 'mdi:home',
            title: 'page.dashboard.analytics',
            noBasicLayout : false,
          },
        },
      ],
    },
    {
      name: 'member',
      path: '/member',
      component: '/member/MemberList',
      meta: {
        title: '玩家列表',
        icon: 'gridicons:multiple-users',
        noBasicLayout: false,
      },
    },
    {
      name: 'memberRecord',
      path: '/memberRecord',
      component: '/member/warRecord',
      meta: {
        title: '玩家战绩',
        icon: 'carbon:badge',
        noBasicLayout: false,
      },
    },
    {
      name: 'memberIncome',
      path: '/memberIncome',
      component: '/member/income',
      meta: {
        title: '玩家收益',
        icon: 'gridicons:money',
        noBasicLayout: false,
      },
    },
    {
      meta: {
        title: '设置',
        icon: 'gridicons:cog',
      },
      name: 'shezhi',
      path: '/333333',
      redirect: '/333333',
      children: [
        {
          name: 'editPassword',
          path: '/editPassword',
          component: '/settings/editPassword',
          meta: {
            icon: 'mdi:lock',
            title: '修改密码',
          },
        },
      ],
    },
    {
      name: 'tixian',
      path: '/tixian',
      component: '/tixian/index',
      meta: {
        title: '提现申请',
        icon: 'mdi:bank-transfer-in',
        noBasicLayout: false,
      },
    },
    {
      meta: {
        title: '数据分析',
        icon: 'mdi:chart-box',
      },
      name: 'shuju',
      path: '/shuju',
      redirect: '/shuju',
      children: [
        {
          name: 'kaifang',
          path: '/kaifang',
          component: '/shuju/kaifang',
          meta: {
            icon: 'mdi:home-modern',
            title: '开房数据',
          },
        },
        {
          name: 'jichu',
          path: '/jichu',
          component: '/shuju/jichu',
          meta: {
            icon: 'mdi:database',
            title: '玩家基础数据',
          },
        },
      ],
    },
  ];

  // 这里模拟异步接口，实际你可以把 routes 直接返回或包一层 Promise
  return Promise.resolve(routes);
}
