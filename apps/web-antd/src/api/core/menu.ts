// src/api/core/menu.ts

// 如果需要可导入类型：
// import type { RouteRecordRaw } from 'vue-router';

export async function getAllMenusApi(): Promise<any[]> {
  const routes = [

    // ✅ 修复：成员列表 - 注意文件名大小写
    {
      name: 'competitionMemberList',  // 改成驼峰命名
      path: '/competition/members',   // 改成更规范的路径
      component: '/member/Competitionmemberlist',  // 匹配实际文件名（首字母大写）
      meta: {
        title: '成员列表',
        icon: 'gridicons:multiple-users',
        noBasicLayout: false,
      },
    },

    // ✅ 修复：赛事明细
    {
      name: 'competitionDetails',     // 改成驼峰命名
      path: '/competition/details',   // 改成更规范的路径
      component: '/member/Competitiondetails',  // 匹配实际文件名（首字母大写）
      meta: {
        title: '赛事明细',
        icon: 'mdi:clipboard-list',
        hideInMenu: false,  // 隐藏在侧边栏
        noBasicLayout: false,
      },
    },






  ];

  // 这里模拟异步接口，实际你可以把 routes 直接返回或包一层 Promise
  return Promise.resolve(routes);
}
