// src/api/account.ts
import { apiJavaPost } from '#/api/auth';

const JAVA_SECRET = (import.meta.env?.VITE_JAVA_SECRET as string) || '33f77501874dbcd087ed565d9b511117';
const JAVA_SECRET_KEY_NAME: string | undefined = undefined;

const JAVA_BASE = import.meta.env.PROD ? (import.meta.env.VITE_API_URL as string) || '' : '';
export const AGENT_CHANGE_PASSWORD_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentChangePassWord`
  : '/api/agentChangePassWord';

export interface AgentChangePasswordResp {
  result?: string | boolean; // "success"/"failed" | true/false 等，后端返回形式不固定
  message?: string;
  [k: string]: any;
}

/**
 * 修改密码
 * params:
 *  - newPassWord: string (必传)
 *  - requestPid?: number|string (默认从 localStorage 取 AGENT_PID/ACCOUNT_ID)
 */
export async function agentChangePassWord(opts: {
  newPassWord: string;
  pid?: number | string;        // 新增：pid（被修改的账号），通常同 AGENT_PID
  requestPid?: number | string;
}) {
  if (!opts || !String(opts.newPassWord).trim()) {
    throw new Error('newPassWord is required');
  }
  const pid = Number(opts.pid ?? localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);
  const requestPid = Number(opts.requestPid ?? localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);

  const body = {
    newPassWord: String(opts.newPassWord),
    pid,
    requestPid,
  };

  // 发起 POST（表单形式，与其他接口方式统一）
  const resp = await apiJavaPost(
    AGENT_CHANGE_PASSWORD_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  // 兼容性解析：优先 resp.data，其次 resp，本函数返回解析后的对象
  const payload = (resp?.data ?? resp) ?? {};
  // 返回标准结构：以后调用方可直接读取 payload.result / payload.message
  return payload as AgentChangePasswordResp;
}

export default {
  agentChangePassWord,
};
