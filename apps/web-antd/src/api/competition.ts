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

export default {
  apiGetCompetitionMembers,
  apiGetCompetitionDetails,
};
