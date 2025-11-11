// src/api/competition.ts
import { apiJavaPost } from '#/api/auth';

const JAVA_BASE = (import.meta.env.PROD ? (import.meta.env.VITE_API_URL as string) : '');

// 生产/开发地址配置
const EXEC_UNION_PROMOTION_LEVEL_LIST_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/execUnionPromotionLevelList`
  : '/api/execUnionPromotionLevelList';

const EXEC_UNION_SPORTS_POINT_MEMBER_DYNAMIC_BY_PID_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/execUnionSportsPointMemberDynamicByPid`
  : '/api/execUnionSportsPointMemberDynamicByPid';
// ✨ 新增: 比赛分更新接口
const EXEC_UNION_SPORTS_POINT_UPDATE_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/execUnionSportsPointUpdate`
  : '/api/execUnionSportsPointUpdate';
// ✨ 新增: 备注管理接口
const EXEC_UNION_SET_EXTRA_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/execUnionSetExtra`
  : '/api/execUnionSetExtra';
// ✨ 新增: 踢出成员接口
const EXEC_UNION_SUBORDINATE_LEVEL_DELETE_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/execUnionSubordinateLevelDelete`
  : '/api/execUnionSubordinateLevelDelete';
// ✨ 新增: 冻结/解冻接口
const EXEC_UNION_BAN_GAME_CLUB_MEMBER_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/execUnionBanGameClubMember`
  : '/api/execUnionBanGameClubMember';
// ✨ 新增: 查询玩家余额接口
const EXEC_UNION_SUBORDINATE_LEVEL_SPORTS_POINT_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/execUnionSubordinateLevelSportsPoint`
  : '/api/execUnionSubordinateLevelSportsPoint';

const JAVA_SECRET = (import.meta.env?.VITE_JAVA_SECRET as string) || '33f77501874dbcd087ed565d9b511117';
const JAVA_SECRET_KEY_NAME: string | undefined = undefined;

// ===== 类型定义 =====
export interface CompetitionMember {
  name: string; // 昵称
  iconUrl: string; // 头像
  setCount: number; // 局数
  winner: number; // 大赢家
  sportsPoint: number; // 比赛分
  scorePoint: number; // 奖励
  actualEntryFee: number; // 贡献
  sportsPointConsume: number; // 战绩
  pid?: number; // 玩家ID(可选)
  minister?: number; // 职位: 0=普通成员 1=俱乐部管理员 2=俱乐部创建者 3=赛事管理员
  isPromotionManag?: number; // 推广员: 0=普通 1=推广员
  isBan?: boolean; // ✨ 新增: 是否被冻结
}

export interface CompetitionSummary {
  setCount: number; // 总局数
  winner: number; // 总大赢家
  sportsPoint: number; // 总比赛分
  scorePoint: number; // 总奖励
  actualEntryFee: number; // 总贡献
  sportsPointConsume: number; // 总战绩
}

export interface ExecUnionPromotionLevelListResp {
  code: number;
  msg?: string;
  data?: {
    clubPromotionLevelItemList?: CompetitionMember[];
    newItem?: CompetitionSummary;
  };
}

export interface CompetitionDetailItem {
  id: number | string;
  execType: number; // 记录类型
  name: string; // 游戏名称/被执行人
  execName: string; // 执行人
  value: number; // 分数变化(正数为增加,负数为减少)
  curValue: number; // 当前余额
  execTime: number; // 执行时间戳
  roomKey?: string; // 房间号(推广奖励专用)
  [key: string]: any;
}

export interface ExecUnionSportsPointMemberDynamicByPidResp {
  code: number;
  msg?: string;
  data?: {
    list?: CompetitionDetailItem[];
    total?: number;
    hasMore?: boolean;
  };
}
// ✨ 新增: 比赛分更新相关类型
export interface UpdateSportsPointParams {
  clubId: number;
  unionId: number;
  opClubId: number;
  type: 0 | 1; // 0-增加, 1-减少
  opPid: number;
  value: number;
  timeSec: number;
  requestPid: number;
}
export interface UpdateSportsPointResponse {
  code: number;
  msg?: string;
  data?: {
    type: 0 | 1;
    value: number;
    pidCurValue: number;
  };
}

// ✨ 新增: 备注管理相关类型
export interface SetExtraParams {
  clubId: number;
  pid: number;
  extra: string;
  requestPid: number;
}

export interface SetExtraResponse {
  code: number;
  msg?: string;
  data?: {
    clubId: number;
    pid: number;
    extra: string;
  };
}
// ✨ 新增: 踢出成员相关类型
export interface DeleteMemberParams {
  clubId: number;
  pid: number;
  requestPid: number;
}

export interface DeleteMemberResponse {
  code: number;
  msg?: string;
  data?: boolean;
}
// ✨ 新增: 冻结/解冻相关类型
export interface BanGameParams {
  clubId: number;
  unionId: number;
  pid: number;
  type: 0 | 1; // 0-个人, 1-操作整条线(包含下级)
  value: 0 | 1; // 0-解冻, 1-冻结
  requestPid: number;
}

export interface BanGameResponse {
  code: number;
  msg?: string;
  data?: boolean;
}
// ✨ 新增: 查询玩家余额相关类型
export interface GetPlayerBalanceParams {
  clubId: number;
  opPid: number;
  type: number; // 默认 0
  value: number; // 默认 0
  requestPid: number;
}

export interface GetPlayerBalanceResponse {
  code: number;
  msg?: string;
  data?: {
    sportsPoint: number; // 竞技点余额
    allowSportsPoint: number; // 可操作竞技点额度
    caseSportsPoint: number; // 保险柜竞技点
    prizePoint: number; // 奖励点数
    timestamp: number; // 操作时间戳(秒)
  };
}
/**
 * 获取赛事成员列表
 * params:
 *  - clubId: 俱乐部ID(从 clubsign 获取)
 *  - pageNum: 页码,默认 1
 *  - type: 0-6 (今天、昨天、近3天、近7天、近30天、近90天、全部)
 *  - orderBy: 排序方式
 *    - 十位数值: 1升序 2降序
 *    - 个位数值: 1比赛分 2局数 3大赢家 4奖励 5贡献 6战绩
 *    - 例如: 11=比赛分升序 21=比赛分降序 12=局数升序
 *  - query: 搜索查询字符串(默认空字符串)
 */
export async function apiGetCompetitionMembers(params: {
  clubId: number | string;
  pageNum?: number;
  type?: number;
  orderBy?: number;
  query?: string;
}) {
  const agentPid = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);

  const body = {
    clubId: Number(params.clubId || 0),
    pageNum: Number(params.pageNum || 1),
    type: Number(params.type ?? 0),
    orderBy: Number(params.orderBy ?? 11), // 默认比赛分升序
    isNewMode: false,
    pid: 0,
    requestPid: agentPid,
    query: String(params.query ?? '').trim(), // 查询参数,默认空字符串
  };

  console.log('[debug] apiGetCompetitionMembers sending body=', body);

  const resp = await apiJavaPost(
    EXEC_UNION_PROMOTION_LEVEL_LIST_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  console.log('[debug] apiGetCompetitionMembers resp=', resp);
  return resp as unknown as ExecUnionPromotionLevelListResp;
}

/**
 * 获取赛事明细
 * params:
 *  - clubId: 俱乐部ID(从 clubsign 获取)
 *  - pid: 成员pid,从左侧菜单点击的是0,从成员列表进来的就是接口列表里的pid
 *  - getType: 获取时间类型,0-6对应今天到七天前
 *  - chooseType: 筛选类型
 *    - 0: 全部
 *    - 1: 比赛分
 *    - 2: 比赛玩牌
 *    - 6: 保险柜
 *    - 7: 推广奖励
 *  - pageNum: 页码,默认 1
 */
export async function apiGetCompetitionDetails(params: {
  clubId: number | string;
  pid: number;
  getType?: number;
  chooseType?: number;
  pageNum?: number;
}) {
  const agentPid = Number(localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0);

  // 从 localStorage 获取 clubList
  const clubListStr = localStorage.getItem('clubList');
  let unionId = 0;

  if (clubListStr) {
    try {
      const clubList = JSON.parse(clubListStr);
      const currentClub = Array.isArray(clubList)
        ? clubList.find((club: any) => club.clubsign === Number(params.clubId))
        : null;
      if (currentClub) {
        unionId = currentClub.unionId || 0;
      }
    } catch (e) {
      console.error('[debug] parse clubList error:', e);
    }
  }

  const body = {
    clubId: Number(params.clubId || 0),
    unionId: unionId,
    getType: Number(params.getType ?? 6), // 默认七天前
    chooseType: Number(params.chooseType ?? 0), // 默认全部
    pageNum: Number(params.pageNum || 1),
    pid: Number(params.pid || 0),
    execPid: 0,
    requestPid: agentPid,
  };

  console.log('[debug] apiGetCompetitionDetails sending body=', body);

  const resp = await apiJavaPost(
    EXEC_UNION_SPORTS_POINT_MEMBER_DYNAMIC_BY_PID_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  console.log('[debug] apiGetCompetitionDetails resp=', resp);
  return resp as unknown as ExecUnionSportsPointMemberDynamicByPidResp;
}
/**
 * ✨ 新增: 执行联盟比赛分更新
 * params:
 *  - clubId: 俱乐部ID
 *  - unionId: 联盟ID
 *  - opClubId: 操作俱乐部ID(通常与clubId相同)
 *  - type: 操作类型 0-增加, 1-减少
 *  - opPid: 目标玩家PID
 *  - value: 操作数值(正数)
 *  - timeSec: 当前时间戳(秒)
 *  - requestPid: 请求者PID
 */
export async function apiUpdateSportsPoint(params: UpdateSportsPointParams) {
  const body = {
    clubId: Number(params.clubId),
    unionId: Number(params.unionId),
    opClubId: Number(params.opClubId),
    type: Number(params.type),
    opPid: Number(params.opPid),
    value: Number(params.value),
    timeSec: Number(params.timeSec),
    requestPid: Number(params.requestPid),
  };

  console.log('[debug] apiUpdateSportsPoint sending body=', body);

  const resp = await apiJavaPost(
    EXEC_UNION_SPORTS_POINT_UPDATE_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  console.log('[debug] apiUpdateSportsPoint resp=', resp);
  return resp as unknown as UpdateSportsPointResponse;
}
/**
 * ✨ 新增: 设置成员备注
 * params:
 *  - clubId: 俱乐部ID
 *  - pid: 成员PID
 *  - extra: 备注信息
 *  - requestPid: 请求者PID
 */
export async function apiSetExtra(params: SetExtraParams) {
  const body = {
    clubId: Number(params.clubId),
    pid: Number(params.pid),
    extra: String(params.extra).trim(),
    requestPid: Number(params.requestPid),
  };

  console.log('[debug] apiSetExtra sending body=', body);

  const resp = await apiJavaPost(
    EXEC_UNION_SET_EXTRA_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  console.log('[debug] apiSetExtra resp=', resp);
  return resp as unknown as SetExtraResponse;
}
/**
 * ✨ 新增: 踢出俱乐部成员
 * params:
 *  - clubId: 俱乐部ID
 *  - pid: 成员PID
 *  - requestPid: 请求者PID
 *
 * 限制条件:
 *  - 凌晨00:00 - 00:30 不允许踢出操作
 *  - 如果总余额 ≥ 1，则不允许踢出
 */
export async function apiDeleteMember(params: DeleteMemberParams) {
  const body = {
    clubId: Number(params.clubId),
    pid: Number(params.pid),
    requestPid: Number(params.requestPid),
  };

  console.log('[debug] apiDeleteMember sending body=', body);

  const resp = await apiJavaPost(
    EXEC_UNION_SUBORDINATE_LEVEL_DELETE_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  console.log('[debug] apiDeleteMember resp=', resp);
  return resp as unknown as DeleteMemberResponse;
}
/**
 * ✨ 新增: 冻结/解冻俱乐部成员
 * params:
 *  - clubId: 俱乐部ID
 *  - unionId: 联盟ID
 *  - pid: 成员PID
 *  - type: 操作类型 0-个人, 1-操作整条线(包含下级)
 *  - value: 操作值 0-解冻, 1-冻结
 *  - requestPid: 请求者PID
 */
export async function apiBanGameClubMember(params: BanGameParams) {
  const body = {
    clubId: Number(params.clubId),
    unionId: Number(params.unionId),
    pid: Number(params.pid),
    type: Number(params.type),
    value: Number(params.value),
    requestPid: Number(params.requestPid),
  };

  console.log('[debug] apiBanGameClubMember sending body=', body);

  const resp = await apiJavaPost(
    EXEC_UNION_BAN_GAME_CLUB_MEMBER_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  console.log('[debug] apiBanGameClubMember resp=', resp);
  return resp as unknown as BanGameResponse;
}

/**
 * ✨ 新增: 查询玩家余额
 * params:
 *  - clubId: 俱乐部ID
 *  - opPid: 目标玩家PID
 *  - type: 默认 0
 *  - value: 默认 0
 *  - requestPid: 请求者PID (AGENT_PID)
 */
export async function apiGetPlayerBalance(params: GetPlayerBalanceParams) {
  const body = {
    clubId: Number(params.clubId),
    opPid: Number(params.opPid),
    type: Number(params.type),
    value: Number(params.value),
    requestPid: Number(params.requestPid),
  };

  console.log('[debug] apiGetPlayerBalance sending body=', body);

  const resp = await apiJavaPost(
    EXEC_UNION_SUBORDINATE_LEVEL_SPORTS_POINT_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    }
  );

  console.log('[debug] apiGetPlayerBalance resp=', resp);
  return resp as unknown as GetPlayerBalanceResponse;
}
export default {
  apiGetCompetitionMembers,
  apiGetCompetitionDetails,
  apiUpdateSportsPoint,
  apiSetExtra,
  apiDeleteMember,
  apiBanGameClubMember,
  apiGetPlayerBalance,
};
