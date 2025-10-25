// src/api/member.ts
import { apiJavaPost } from '#/api/auth'; // 使用你已有的 apiJavaPost 实现

/** Java 接口地址与签名配置 */
// const JAVA_BASE = 'http://47.117.179.59:9888';
// const AGENT_PLAYER_LIST_URL = `${JAVA_BASE}/agentPlayerList`;
// const AGENT_PLAYER_LIST_URL = 'http://47.117.179.59:9888/agentPlayerList'; // 改为相对路径
const JAVA_BASE = (import.meta.env.PROD ? (import.meta.env.VITE_API_URL as string) : '');
export const AGENT_PLAYER_LIST_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentPlayerList`    // 生产直接调用后端真实路径（无 /api 前缀）
  : '/api/agentPlayerList';           // 开发走 vite proxy（/api -> dev proxy）
// const AGENT_PLAYER_LIST_URL = '/api/agentPlayerList';
/** 推荐把实际 secret / keyname 放在环境变量里（Vite .env），调试时可临时写死 */
const JAVA_SECRET = (import.meta.env?.VITE_JAVA_SECRET as string) || '33f77501874dbcd087ed565d9b511117';
// 如果后端期望以 Charge_Key=xxxx 拼接，请把下面改为 'Charge_Key'
const JAVA_SECRET_KEY_NAME: string | undefined = undefined;

/** Java 返回项的类型（根据截图推断） */
export interface AgentPlayerListItem {
  pid: number; // 玩家 id
  familyId?: number;
  name?: string;
  headUrl?: string;
  level?: number;
  nobleLevel?: number;
  diamond?: number;
  gold?: number;
  markStr?: string; // ✅ 新增：备注字
}

export interface AgentPlayerListResp {
  code: number;
  msg?: string;
  data?: {
    listInfo?: AgentPlayerListItem[]; // 截图里有 listInfo
    sumDiamond?: number;
    sumGold?: number;
    totalPages?: number;
  };
}

/**
 * 通过 Java 接口查询玩家列表（会做签名）
 * params:
 *  - page, pageSize: 分页
 *  - field, keyword: 搜索
 *  - extra: 额外透传参数
 */
console.log('[debug] AGENT_PLAYER_LIST_URL =', AGENT_PLAYER_LIST_URL);
// src/api/member.ts （替换原来的 apiGetMemberList 实现）
export async function apiGetMemberList(params: {
  field?: string;
  keyword?: string;
  page: number;
  pageSize: number;
  extra?: Record<string, any>;
}) {
  console.log('[debug] apiGetMemberList called, params=', params);
  console.log('[debug] AGENT_PLAYER_LIST_URL =', AGENT_PLAYER_LIST_URL);

  // 请求者 ID（谁在请求）——始终传 requestPid（从 localStorage 读取）
  const requestPid = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);

  const isSearching = !!(params.keyword && params.keyword.trim());
  const field = params.field ?? '';
  const keyword = (params.keyword ?? '').trim();

  // 支持 caller 传入 targetPid（比如查看下级时传入 row.pid）
  const targetPidFromExtra = params.extra?.targetPid ?? null;
// 支持 caller 传入 sortType（优先使用 extra 提供的）
  const sortTypeFromExtra = params.extra?.sortType;
  // 强制为数字，若未传则默认 0
  const sortType = typeof sortTypeFromExtra === 'number' ? sortTypeFromExtra : Number(sortTypeFromExtra ?? 0);
  // 默认 body（注意：这里先不覆盖 pid，后面按逻辑设置）
  const body: Record<string, any> = {
    pagNum: params.page,
    showNum: params.pageSize,
    sortType: sortType ?? 0,
    requestPid: requestPid, // 谁在请求
    mark: '',
    ...(params.extra || {}),
  };

  if (isSearching) {
    // 搜索场景：按 field 决定 pid/name
    body.searchType = 1;
    if (field === 'uid') {
      const maybeNum = Number(keyword);
      body.pid = Number.isFinite(maybeNum) ? maybeNum : 0;
      body.name = '';
      body.mark = '';
    } else if (field === 'mark') {
      // ✅ 按备注搜索：pid=0, name="", mark=keyword
      body.pid = 0;
      body.name = '';
      body.mark = keyword;
      console.log('[debug] 按备注搜索:', body);
    } else {
      // name 搜索：pid 必须传 0，name=keyword
      body.pid = 0;
      body.name = keyword;
      body.mark = '';
    }
  } else {
    // 非搜索（列表）场景
    body.searchType = 0;
    // 优先使用 caller 指定的 targetPid（例如查看下级），否则使用 requestPid（默认展示当前代理下列表）
    if (targetPidFromExtra !== null && typeof targetPidFromExtra !== 'undefined') {
      body.pid = Number(targetPidFromExtra) || 0;
    } else {
      body.pid = requestPid;
    }
    body.name = '';
    body.mark = '';
  }
  // 确保 body.sortType 最终是 number 且落在 0-4 之间（防错）
  body.sortType = Number.isFinite(Number(body.sortType)) ? Number(body.sortType) : 0;
  if (body.sortType < 0 || body.sortType > 4) body.sortType = 0;
  console.log('[debug] apiGetMemberList sending body=', body);

  const resp = await apiJavaPost(
    AGENT_PLAYER_LIST_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  return resp as unknown as { data?: any; status?: number };
}

/**
 * 设置玩家推广员身份（agentSetFamilyLevel）
 * params:
 *  - pid: 目标玩家 pid
 *  - type: 0 = 设为推广员, 其它按后端定义
 *  - requestPid: 请求者 pid（一般从 localStorage.AGENT_PID 或 ACCOUNT_ID 读取）
 */
export async function apiSetPromoter(opts: {
  pid: number | string;
  type?: number;
  requestPid?: number | string;
}) {
  const pid = Number(opts.pid || 0);
  const type = typeof opts.type === 'number' ? opts.type : 0;
  const requestPid = Number(opts.requestPid ?? localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);

  const body: Record<string, any> = {
    pid,
    type,
    requestPid,
  };

  console.log('[debug] apiSetPromoter sending body=', body);

  // 假设后端接口路径为 /agentSetFamilyLevel 与其他 Java 接口同域名规则一致
  const AGENT_SET_FAMILY_LEVEL_URL = import.meta.env.PROD
    ? `${(import.meta.env.VITE_API_URL as string) || ''}/agentSetFamilyLevel`
    : '/api/agentSetFamilyLevel';

  const resp = await apiJavaPost(
    AGENT_SET_FAMILY_LEVEL_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  // resp 结构依后端而定，返回示例 { setResult: true } 或 { code:0, data: { setResult: true } }
  console.log('[debug] apiSetPromoter resp=', resp);
  return resp as unknown as { data?: any; status?: number };
}
/**
 * 设置玩家备注（agentSetRemark）
 * body:
 *  - pid: 目标玩家 pid
 *  - remark: 备注字符串
 *  - requestPid: 请求者 pid（AGENT_PID / ACCOUNT_ID）
 *
 * 返回示例（后端）：{ setResult: true, setId: 123, setRemark: "xxx" }
 */
export async function apiSetRemark(opts: {
  pid: number | string;
  remark: string;
  requestPid?: number | string;
}) {
  const pid = Number(opts.pid || 0);
  const remark = String(opts.remark ?? '');
  const requestPid = Number(opts.requestPid ?? localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);

  const body: Record<string, any> = {
    pid,
    remark,
    requestPid,
  };

  console.log('[debug] apiSetRemark sending body=', body);

  const AGENT_SET_REMARK_URL = import.meta.env.PROD
    ? `${(import.meta.env.VITE_API_URL as string) || ''}/agentSetRemark`
    : '/api/agentSetRemark';

  const resp = await apiJavaPost(
    AGENT_SET_REMARK_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  console.log('[debug] apiSetRemark resp=', resp);
  return resp as unknown as { data?: any; status?: number };
}
// 新增：agentSetRecommend 接口调用
// params: { pid, recommendId, requestPid }
export async function apiSetRecommend(params: { pid: number; recommendId: number; requestPid: number }) {
  // 生产/开发地址复用之前 AGENT_PLAYER_LIST_URL 的写法风格（只替换 endpoint）
  const JAVA_BASE = (import.meta.env.PROD ? (import.meta.env.VITE_API_URL as string) : '');
  const URL = import.meta.env.PROD
    ? `${JAVA_BASE}/agentSetRecommend`
    : '/api/agentSetRecommend';

  const body = {
    pid: params.pid,
    recommendId: params.recommendId,
    requestPid: params.requestPid,
  };

  const resp = await apiJavaPost(
    URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  return resp as unknown as { data?: any; status?: number };
}
/**
 * 冻结/解冻玩家 (agentBanGame)
 * params:
 *  - pid: 目标玩家 pid
 *  - type: 0 = 解冻, 1 = 冻结
 *  - requestPid: 请求者 pid（AGENT_PID / ACCOUNT_ID）
 * 返回：{ setResult: true/false, setId: ..., ... }
 */
export async function apiBanGame(opts: {
  pid: number | string;
  type: number;
  requestPid?: number | string;
}) {
  const pid = Number(opts.pid || 0);
  const type = Number(opts.type || 0);
  const requestPid = Number(opts.requestPid ?? localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);

  const body = {
    pid,
    type,
    requestPid,
  };

  console.log('[debug] apiBanGame sending body=', body);

  const AGENT_BAN_GAME_URL = import.meta.env.PROD
    ? `${(import.meta.env.VITE_API_URL as string) || ''}/agentBanGame`
    : '/api/agentBanGame';

  const resp = await apiJavaPost(
    AGENT_BAN_GAME_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  console.log('[debug] apiBanGame resp=', resp);
  return resp as unknown as { data?: any; status?: number };
}
export async function apiSetRate(params: { pid: number; rate: number; requestPid: number }) {
  const JAVA_BASE = (import.meta.env.PROD ? (import.meta.env.VITE_API_URL as string) : '');
  const URL = import.meta.env.PROD ? `${JAVA_BASE}/agentSetRate` : '/api/agentSetRate';

  const body = {
    pid: params.pid,
    rate: params.rate,       // 0-100
    requestPid: params.requestPid,
  };

  console.log('[debug] apiSetRate sending body=', body);

  const resp = await apiJavaPost(
    URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  console.log('[debug] apiSetRate resp=', resp);
  return resp as unknown as { data?: any; status?: number };
}

export default {
  apiGetMemberList,
  apiSetPromoter,
  apiSetRemark,
  apiSetRecommend,
  apiBanGame,
  apiSetRate,
};
