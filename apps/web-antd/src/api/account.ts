// src/api/account.ts
import { apiJavaPost } from '#/api/auth';

const JAVA_SECRET =
  (import.meta.env?.VITE_JAVA_SECRET as string) ||
  '33f77501874dbcd087ed565d9b511117';
const JAVA_SECRET_KEY_NAME: string | undefined = undefined;

const JAVA_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL as string) || ''
  : '';
export const AGENT_CHANGE_PASSWORD_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentChangePassWord`
  : '/api/agentChangePassWord';

export interface AgentChangePasswordResp {
  result?: boolean | string; // "success"/"failed" | true/false 等，后端返回形式不固定
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
  pid?: number | string; // 新增：pid（被修改的账号），通常同 AGENT_PID
  requestPid?: number | string;
}) {
  if (!opts || !String(opts.newPassWord).trim()) {
    throw new Error('newPassWord is required');
  }
  const pid = Number(
    opts.pid ??
      localStorage.getItem('AGENT_PID') ??
      localStorage.getItem('ACCOUNT_ID') ??
      0,
  );
  const requestPid = Number(
    opts.requestPid ??
      localStorage.getItem('AGENT_PID') ??
      localStorage.getItem('ACCOUNT_ID') ??
      0,
  );
  //获取用户
  const userName= localStorage.getItem('AGENT_USERNAME') ?? '';

  const body = {
    newPassWord: String(opts.newPassWord),
    pid,
    requestPid,
    userName,
  };

  // 发起 POST（表单形式，与其他接口方式统一）
  const resp = await apiJavaPost(AGENT_CHANGE_PASSWORD_URL, body, JAVA_SECRET, {
    contentType: 'form',
    secretKeyName: JAVA_SECRET_KEY_NAME,
  });

  // 兼容性解析：优先 resp.data，其次 resp，本函数返回解析后的对象
  const payload = resp?.data ?? resp ?? {};
  // 返回标准结构：以后调用方可直接读取 payload.result / payload.message
  return payload as AgentChangePasswordResp;
}

// ===== 首页主信息接口 =====
export const AGENT_MAIN_INFO_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentMainInfo`
  : '/api/agentMainInfo';

// ✅ 响应数据结构定义
export interface DailyNewPlayerItem {
  dateTime: string; // 格式：yyyyMMdd
  newUserCount: number;
}

export interface GameTypeDailyConsumeItem {
  gameType: number;
  dateTime: string; // 格式：yyyyMMdd
  totalConsume: number;
}

export interface FamilyDailyRechargeItem {
  dateTime: string; // 格式：yyyyMMdd
  totalRecharge: number; // 单位：分
}

export interface AgentMainInfoData {
  playerNum: number; // 玩家总数
  agentNum: number; // 推广员总数
  costDiamondNum: number; // 钻石消耗总数（30天累计）
  agentToPlayerNum: number; // 下级推广员数量
  onLineNum: number; // 实时在线人数
  dailyNewPlayerNum: DailyNewPlayerItem[]; // 每日新增用户
  gameTypeDailyConsume: GameTypeDailyConsumeItem[]; // 游戏消耗钻石
  familyDailyRecharge: FamilyDailyRechargeItem[]; // 每日充值金额
}

export interface AgentMainInfoResp {
  code: number;
  msg: string;
  data?: AgentMainInfoData;
  [k: string]: any;
}

/**
* 获取首页主信息
* params:
*  - requestPid: string (必传，当前代理的 PID)
*/
export async function agentMainInfo(opts: {
  requestPid: string | number;
}) {
  if (!opts || !String(opts.requestPid).trim()) {
    throw new Error('requestPid is required');
  }

  const requestPid = String(
    opts.requestPid ??
    localStorage.getItem('AGENT_PID') ??
    localStorage.getItem('ACCOUNT_ID') ??
    '',
  );

  const body = {
    requestPid,
  };

  // 发起 POST（表单形式，与其他接口方式统一）
  const resp = await apiJavaPost(AGENT_MAIN_INFO_URL, body, JAVA_SECRET, {
    contentType: 'form',
    secretKeyName: JAVA_SECRET_KEY_NAME,
  });

  // 兼容性解析：优先 resp.data，其次 resp
  const payload = resp?.data ?? resp ?? {};
  // 返回标准结构
  return payload as AgentMainInfoResp;
}
export default {
  agentChangePassWord,
  agentMainInfo,
};
