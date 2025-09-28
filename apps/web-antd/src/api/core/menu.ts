import type { RouteRecordStringComponent } from '@vben/types';

import { requestClient } from '#/api/request';

/**
 * 获取用户所有菜单
 */
export async function getAllMenusApi() {
  // console.log(requestClient.get<RouteRecordStringComponent[]>)
  return requestClient.get<RouteRecordStringComponent[]>('/api/v1/home');
}
