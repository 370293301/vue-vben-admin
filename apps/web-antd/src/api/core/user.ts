import type { UserInfo } from '@vben/types';

import { requestClient } from '#/api/request';
import { apiJavaPost } from '#/api/auth';

const JAVA_BASE = (import.meta.env.PROD ? (import.meta.env.VITE_API_URL as string) : '');

// 修改密码接口地址
const EXEC_UNION_CHANGE_PASSWORD_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/execUnionChangePassword`
  : '/api/execUnionChangePassword';

const JAVA_SECRET = (import.meta.env?.VITE_JAVA_SECRET as string) || '33f77501874dbcd087ed565d9b511117';
const JAVA_SECRET_KEY_NAME: string | undefined = undefined;

// ===== 类型定义 =====
export interface ChangePasswordParams {
  playerId: number;
  newPassWord: string;
}

export interface ChangePasswordResponse {
  code: string;
  msg: string;
  data: boolean;
}

/**
 * 修改密码
 * params:
 *  - playerId: 玩家ID (从 AGENT_PID 获取)
 *  - newPassWord: 新密码
 */
export async function changePasswordApi(params: {
  oldPassword: string;
  newPassword: string;
}) {
  const agentPid = Number(
    localStorage.getItem('AGENT_PID') ??
    localStorage.getItem('ACCOUNT_ID') ??
    0
  );

  const body = {
    playerId: agentPid,
    newPassWord: params.newPassword,
  };

  console.log('[debug] changePasswordApi sending body=', body);

  const resp = await apiJavaPost(
    EXEC_UNION_CHANGE_PASSWORD_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  console.log('[debug] changePasswordApi resp=', resp);

  // 检查响应
  const response = resp.data as unknown as ChangePasswordResponse;
console.log('[debug] changePasswordApi response=', response.code);
  if (response.code !== 0 || !response.data) {
    throw new Error(response.msg || '密码修改失败');
  }

  return response;
}
/**
 * 获取用户信息
 */
export async function getUserInfoApi() {
  return requestClient.get<UserInfo>('/user/info');
}
export default {
  changePasswordApi,
};
