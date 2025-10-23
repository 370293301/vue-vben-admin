// src/api/wallet.ts
import { apiJavaPost } from '#/api/auth';

const JAVA_SECRET =
  (import.meta.env?.VITE_JAVA_SECRET as string) ||
  '33f77501874dbcd087ed565d9b511117';
const JAVA_SECRET_KEY_NAME: string | undefined = undefined;

const JAVA_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL as string) || ''
  : '';

const AGENT_GET_DRAW_MONEY_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentGetDrawMoney`
  : '/api/agentGetDrawMoney';

const AGENT_CASH_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentCash`
  : '/api/agentCash';

const AGENT_CASH_RECORD_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentCashRecord`
  : '/api/agentCashRecord';

const AGENT_SET_CASH_ACCOUNT_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentSetCashAccount`
  : '/api/agentSetCashAccount';

function getRequestPid() {
  return Number(
    localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0,
  );
}

/** 1) 查询余额 */
export async function agentGetDrawMoney() {
  const body = { requestPid: getRequestPid() };
  return apiJavaPost(AGENT_GET_DRAW_MONEY_URL, body, JAVA_SECRET, {
    contentType: 'form',
    secretKeyName: JAVA_SECRET_KEY_NAME,
  }) as unknown as Promise<{ data?: { drawMoney?: number } }>;
}

/** 2) 申请提现 */
export async function agentCash(opts: { cashNum: number }) {
  const body = {
    cashNum: Number(opts.cashNum || 0),
    requestPid: getRequestPid(),
  };
  return apiJavaPost(AGENT_CASH_URL, body, JAVA_SECRET, {
    contentType: 'form',
    secretKeyName: JAVA_SECRET_KEY_NAME,
  }) as unknown as Promise<{ data?: { result?: boolean; message?: string } }>;
}

/** 3) 提现记录 */
export async function agentCashRecord(opts: {
  pagNum?: number;
  showNum?: number;
  sortType?: 0 | 1 | 2 | 3 | 4 | 5 | 6;
}) {
  const body = {
    requestPid: getRequestPid(),
    pagNum: Number(opts.pagNum ?? 1),
    showNum: Number(opts.showNum ?? 10),
    sortType: Number(opts.sortType ?? 0),
  };
  return apiJavaPost(AGENT_CASH_RECORD_URL, body, JAVA_SECRET, {
    contentType: 'form',
    secretKeyName: JAVA_SECRET_KEY_NAME,
  }) as unknown as Promise<{
    data?: {
      listInfo?: Array<{
        id: number;
        time: string | number;
        cashNum: number;
        status: 0 | 1 | 2;
        cashAccount: string;
      }>;
      totalPages?: number;
      total?: number;
    };
  }>;
}

/** 4) 设置收款账号 */
export async function agentSetCashAccount(opts: { cashAccount: string }) {
  const body = {
    requestPid: getRequestPid(),
    cashAccount: String(opts.cashAccount ?? ''),
  };
  return apiJavaPost(AGENT_SET_CASH_ACCOUNT_URL, body, JAVA_SECRET, {
    contentType: 'form',
    secretKeyName: JAVA_SECRET_KEY_NAME,
  }) as unknown as Promise<{
    data?: { result?: boolean; cashAccount?: string; message?: string };
  }>;
}

export default {
  agentGetDrawMoney,
  agentCash,
  agentCashRecord,
  agentSetCashAccount,
};
