// src/api/game.ts
import { apiJavaPost } from '#/api/auth';
import dayjs from 'dayjs';
/** Java 签名配置（和 member.ts 一致） */
const JAVA_SECRET =
  (import.meta.env?.VITE_JAVA_SECRET as string) ||
  '33f77501874dbcd087ed565d9b511117';
const JAVA_SECRET_KEY_NAME: string | undefined = undefined;

/** 与 member.ts 保持一致的 URL 策略（生产拼 VITE_API_URL，开发走 /api proxy） */
const JAVA_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL as string) || ''
  : '';
export const AGENT_REQ_GAME_RECORD_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentReqGameRecord`
  : '/api/agentReqGameRecord';
export const AGENT_REQ_PLAYER_GAME_RECORD_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentReqPlayerGameRecord`
  : '/api/agentReqPlayerGameRecord'; /* === MOD: 新接口 URL */

export const AGENT_REQ_GAME_DETAIL_RECORD_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentReqGameDetailRecord`
  : '/api/agentReqGameDetailRecord';

export const AGENT_REQ_PAY_BACK_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentReqPayBack`
  : '/api/agentReqPayBack';

export const AGENT_GAME_ROOM_INFO_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentGameRoomInfo`
  : '/api/agentGameRoomInfo';
export const AGENT_PLAYER_BASE_INFO_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentPlayerBaseInfo`
  : '/api/agentPlayerBaseInfo';


/** types */
export interface AgentGameRecordItem {
  pid: number;
  familyId?: number;
  name?: string;
  headUrl?: string;
  level?: number;
  markStr?: string; // ✅ 新增：备注标记
  setCount?: number;
  bigWinnerCount?: number;
  points?: number;
  [k: string]: any;
}

export interface AgentGameRecordResp {
  code?: number;
  msg?: string;
  listInfo?: AgentGameRecordItem[];
  sumSetCount?: number;
  sumBigWinnerCount?: number;
  sumPoints?: number;
  totalPages?: number;
  total?: number;
  [k: string]: any;
}

export interface GameDetailPlayer {
  pid: number;
  name?: string;
  headUrl?: string;
  points?: number;
}

export interface GameDetailRecord {
  time?: string;
  roomKey?: string;
  recordCode?: string;
  players: GameDetailPlayer[];
}

export interface AgentGameDetailResp {
  listInfo?: any[];
  totalPages?: number;
  total?: number;
  [k: string]: any;
}
/**
 * 游戏详情记录 - 玩家信息
 */
export interface PlayerPointInfo {
  pid: number;        // 玩家ID
  headUrl: string;    // 头像地址
  name: string;       // 姓名
  point: number;      // 分数
}

/**
 * 游戏详情记录 - 单条记录
 */
export interface GameDetailRecordItem {
  listInfo: PlayerPointInfo[];  // 玩家列表
  roomID: number;                // 房间号
  setID: number;                 // 小局数
  endTime: number;               // 结束时间（秒级时间戳）
  playbackCode: number;          // 回放码
}

/**
 * 游戏详情记录 - 响应
 */
export interface AgentGameDetailRecordResp {
  code?: number;
  msg?: string;
  data?: GameDetailRecordItem[];
}


/**
 * 游戏开房统计接口类型定义
 */
export interface GameStatItem {
  gameType: number;
  roundCount: number;
  totalSetCount: number;
}

export interface DailyStat {
  date: string;
  dailyRoomCount: number;
  gameStats: GameStatItem[];
}

export interface AgentGameRoomInfoResp {
  code?: number;
  msg?: string;
  data?: {
    totalRoomCount: number;
    startDate: string;
    endDate: string;
    totalDays: number;
    queryGameTypes: string;
    dailyStats: DailyStat[];
  };
}
/**
 * 玩家基础信息统计 - 每日统计数据
 */
export interface DailyPlayerStat {
  date: string;                    // 统计日期（yyyyMMdd）
  newRegUserCount: number;         // 新注册用户：下级增加多少人
  dailyActiveUserCount: number;    // 日活跃用户：下级有多少活跃（登录数量）
  roomCount: number;               // 开房次数：下级产生的开房次数
  totalGameSetCount: number;       // 游戏总局数：下级产生的总局数
  trialPlayRatio: number;          // 试玩比例：新注册用户参与开局的比例（0-1）
  oldPlayerLoginCount: number;     // 老玩家登录人数：除去新注册用户后的下级人数
  oldPlayerRatio: number;          // 老玩家比例：老玩家在日活用户中的比例（0-1）
  nextDayRetention: number;        // 次日留存：昨天的新注册用户在今天的登录数
  sevenDayRetention: number;       // 7日留存：前第7天注册的用户在今天的登录数
  thirtyDayRetention: number;      // 30日留存：前第30天注册的用户在今天的登录数
  totalMemberCount: number;        // 总成员数量：当前家族总成员数
}

/**
 * 玩家基础信息统计 - 响应数据
 */
export interface AgentPlayerBaseInfoResp {
  code?: number;
  msg?: string;
  data?: {
    startDate: string;             // 查询开始日期（yyyyMMdd）
    endDate: string;               // 查询结束日期（yyyyMMdd）
    totalDays: number;             // 总天数
    dailyStats: DailyPlayerStat[]; // 每日统计数据
  };
}



/** normalize detail payload（兼容各种命名） */
function normalizeGameDetailPayload(payload: any) {
  const maybe = payload?.data ?? payload ?? {};
  const rawList =
    maybe.listInfo ??
    maybe.list ??
    maybe.data?.listInfo ??
    maybe.data?.list ??
    (Array.isArray(maybe) ? maybe : []);

  const records: GameDetailRecord[] = (
    Array.isArray(rawList) ? rawList : []
  ).map((rec: any) => {
    // players 可能在 rec.listInfo / rec.players / rec.playerList 等
    const playersRaw =
      rec.listInfo ?? rec.players ?? rec.playerList ?? rec.playersInfo ?? [];
    const players: GameDetailPlayer[] = (
      Array.isArray(playersRaw) ? playersRaw : []
    ).map((p: any) => ({
      pid: Number(p.pid ?? p.id ?? 0),
      name: p.name ?? p.nickname ?? '',
      headUrl: p.headUrl ?? p.avatar ?? p.headImageUrl ?? '',
      // points 字段兼容多种可能命名
      points: Number(p.points ?? p.score ?? p.point ?? p.scoreValue ?? 0),
    }));

    return {
      // 兼容不同命名的时间字段
      time:
        rec.time ??
        rec.createTime ??
        rec.dt ??
        rec.create_time ??
        rec.date ??
        '',
      // 房间号/roomKey 兼容
      roomKey: rec.roomKey ?? rec.roomNo ?? rec.roomId ?? rec.room_key ?? '',
      // 回放码
      recordCode:
        rec.recordCode ??
        rec.replayCode ??
        rec.record_code ??
        rec.replay_code ??
        '',
      players,
    };
  });

  const totalPages = Number(
    maybe.totalPages ??
      maybe.total_pages ??
      maybe.totalPage ??
      maybe.total ??
      1,
  );
  const total = Number(maybe.total ?? maybe.totalCount ?? 0);

  return { records, totalPages, total };
}


/**
 * agentReqGameDetailRecord - 游戏详情记录
 * 参数：{ pid, pagNum, showNum, requestPid, roomID? }
 * 返回：原始响应
 */
export async function agentReqGameDetailRecord(opts: {
  pid: number | string;
  pagNum?: number | string;
  showNum?: number | string;
  requestPid?: number | string;
  rooID?: string | number;
}) {
  const pid = Number(
    opts.pid ??
    localStorage.getItem('AGENT_PID') ??
    localStorage.getItem('ACCOUNT_ID') ??
    0,
  );
  const pagNum = Number(opts.pagNum ?? 1);
  const showNum = Number(opts.showNum ?? 10);
  const requestPid = Number(
    opts.requestPid ??
    localStorage.getItem('AGENT_PID') ??
    localStorage.getItem('ACCOUNT_ID') ??
    0,
  );

  const body: Record<string, any> = {
    pid,
    pagNum,
    showNum,
    requestPid,
  };

  // 如果提供了 roomID，则传给后端
  if (opts.rooID !== undefined && opts.rooID !== null) {
    body.rooID = opts.rooID;
  }

  console.log(
    '[debug] agentReqGameDetailRecord ->',
    AGENT_REQ_GAME_DETAIL_RECORD_URL,
    body,
  );

  const resp = await apiJavaPost(
    AGENT_REQ_GAME_DETAIL_RECORD_URL,
    body,
    JAVA_SECRET,
    {
      contentType: 'form',
      secretKeyName: JAVA_SECRET_KEY_NAME,
    },
  );

  console.log('[debug] agentReqGameDetailRecord resp=', resp);
  return resp as unknown as AgentGameDetailRecordResp;
}

/**
 * agentReqGameRecord
 * 参数：{ pid?, pagNum?, showNum?, sortType?, requestPid?, field?, keyword?, startDate?, endDate? }
 * 返回：原始 resp，调用方从 resp.data 读取负载（与 member.ts 方式一致）
 */
export async function agentReqGameRecord(opts: {
  [k: string]: any;

  field?: string;
  keyword?: string;
  startTime?: number; // ✅ 秒级时间戳
  endTime?: number;   // ✅ 秒级时间戳
  pagNum?: number | string;
  pid?: number | string;
  requestPid?: number | string;
  showNum?: number | string;
  sortType?: number | string;

}) {
  const pid = Number(
    opts.pid ??
      localStorage.getItem('AGENT_PID') ??
      localStorage.getItem('ACCOUNT_ID') ??
      0,
  );
  const pagNum = Number(opts.pagNum ?? 1);
  const showNum = Number(opts.showNum ?? 10);
  let sortType = Number(opts.sortType ?? 0);
  // 容错并限定取值范围（0-4）
  if (!Number.isFinite(sortType) || sortType < 0 || sortType > 4) sortType = 0;
  const requestPid = Number(
    opts.requestPid ??
      localStorage.getItem('AGENT_PID') ??
      localStorage.getItem('ACCOUNT_ID') ??
      0,
  );

  const body: Record<string, any> = {
    pid,
    pagNum,
    showNum,
    sortType,
    mark: '', // ✅ 新增：备注字段，默认空
    startTime: opts.startTime ?? 0, // ✅ 秒级时间戳
    endTime: opts.endTime ?? 0,     // ✅ 秒级时间戳
    requestPid,
  };

  // 搜索兼容：keyword + field -> searchType / pid / name
  if (opts.keyword && String(opts.keyword).trim()) {
    const kw = String(opts.keyword).trim();
    body.searchType = 1;
    if ((opts.field ?? '') === 'uid') {
      const maybeNum = Number(kw);
      body.pid = Number.isFinite(maybeNum) ? maybeNum : 0;
      body.name = '';
      body.mark = '';
    }else if ((opts.field ?? '') === 'mark') {
      // ✅ 按备注搜索
      body.pid = 0;
      body.name = '';
      body.mark = kw;
      console.log('[debug] 按备注搜索 GameRecord:', body);
    } else {
      body.pid = 0;
      body.name = kw;
      body.mark = '';
    }
  } else {
    body.searchType = 0;
    body.pid = pid; // 使用上面计算的 pid（可能是 requestPid 或 caller 指定）
    body.name = '';
    body.mark = '';
  }

  if (opts.startDate) body.startDate = opts.startDate;
  if (opts.endDate) body.endDate = opts.endDate;

  console.log(
    '[debug] agentReqGameRecord body=',
    body,
    'endpoint=',
    AGENT_REQ_GAME_RECORD_URL,
  );

  const resp = await apiJavaPost(AGENT_REQ_GAME_RECORD_URL, body, JAVA_SECRET, {
    contentType: 'form',
    secretKeyName: JAVA_SECRET_KEY_NAME,
  });

  console.log('[debug] agentReqGameRecord resp=', resp);
  return resp as unknown as {
    [k: string]: any;
    data?: AgentGameRecordResp;
    status?: number;
  };
}

/**
 * agentReqPlayerGameRecord（战绩记录：room 列表）
 * 参数说明（按后端约定简化为单 pid）:
 * - pid: 单个玩家 pid（必传或回退到 AGENT_PID）
 * - pagNum, showNum
 * - timeType: 0 今天, 1 昨天, 2 七天内（可选）
 * - specificDate: 字符串或 Date（若提供则格式化为 YYYYMMDD 并放到 time 字段）
 * - gameType: 0 所有游戏 或 具体 gameType（可选）
 * - requestPid: AGENT_PID（可选）
 */
export async function agentReqPlayerGameRecord(opts: {
  pid?: number | string;
  pagNum?: number | string;
  showNum?: number | string;
  timeType?: number | string;
  specificDate?: string | Date;
  gameType?: number | string;
  requestPid?: number | string;
}) {
  const pagNum = Number(opts.pagNum ?? 1);
  const showNum = Number(opts.showNum ?? 10);
  const pid = Number(
    opts.pid ??
    localStorage.getItem('AGENT_PID') ??
    localStorage.getItem('ACCOUNT_ID') ??
    0,
  );
  if (!Number.isFinite(pid) || pid <= 0) {
    console.warn('[agentReqPlayerGameRecord] invalid pid, fallback to 0', opts);
  }

  const requestPid = Number(
    opts.requestPid ??
    localStorage.getItem('AGENT_PID') ??
    localStorage.getItem('ACCOUNT_ID') ??
    0,
  );

  const body: Record<string, any> = {
    pid,
    pagNum,
    showNum,
    requestPid,
  };

  // 可选：timeType 优先（0/1/2），若要指定具体某日则传 specificDate -> 转为 time=YYYYMMDD
  if (opts.timeType !== undefined && opts.timeType !== null) {
    body.timeType = Number(opts.timeType);
  }
  if (opts.specificDate) {
    const d = opts.specificDate;
    // 后端期望 YYYYMMDD，例如 '20251010'
    body.time = typeof d === 'string' ? d : dayjs(d).format('YYYYMMDD');
  }

  if (opts.gameType !== undefined && opts.gameType !== null) {
    body.gameType = Number(opts.gameType);
  }

  console.log('[debug] agentReqPlayerGameRecord body=', body, 'endpoint=', AGENT_REQ_PLAYER_GAME_RECORD_URL);

  const resp = await apiJavaPost(AGENT_REQ_PLAYER_GAME_RECORD_URL, body, JAVA_SECRET, {
    contentType: 'form',
    secretKeyName: JAVA_SECRET_KEY_NAME,
  });

  console.log('[debug] agentReqPlayerGameRecord resp=', resp);
  return resp as unknown as { [k: string]: any; data?: any; status?: number; };
}
/**
 * 玩家收益列表（agentReqPayBack）
 * body:
 *  - pid:            当前查询ID（列表时 = 目标 pid；搜索按规则见下）
 *  - pagNum:         页码
 *  - showNum:        每页数
 *  - sortType:       0默认 1贡献↓ 2贡献↑ 3收益↓ 4收益↑
 *  - searchType:     玩家列表发0  查询发1
 *  - name:           姓名（必填，字符串；没有就空字符串）
 *  - timeSpace:      某天 0 点时间戳（long；毫秒）
 *  - requestPid:     请求者ID（AGENT_PID / ACCOUNT_ID）
 * 搜索：
 *  - id 搜索：searchType=1, pid=数值, name=''
 *  - 姓名搜索：searchType=1, pid=0（或保持上下文 pid，具体后端要求二选一），name=关键字
 */
export async function agentReqPayBack(params: {
  page: number;
  pageSize: number;
  sortType?: number;                 // 0默认 1贡献↓ 2贡献↑ 3我的收益↓ 4我的收益↑
  field?: 'uid' | 'nickname';
  keyword?: string;
  targetPid?: number | string;       // 列表上下文 pid
  startTime?: number; // ✅ 秒级时间戳
  endTime?: number;   // ✅ 秒级时间戳
  date?: Date | string | number | null;
}) {
  const requestPid = Number(
    localStorage.getItem('AGENT_PID') ?? localStorage.getItem('ACCOUNT_ID') ?? 0,
  );

  const pagNum = Number(params.page ?? 1);
  const showNum = Number(params.pageSize ?? 10);

  let sortType = Number(params.sortType ?? 0);
  if (!Number.isFinite(sortType) || sortType < 0 || sortType > 4) sortType = 0;

  const field = (params.field ?? 'uid') as 'uid' | 'nickname';
  const keyword = String(params.keyword ?? '').trim();
  const isSearching = !!keyword;

  const targetPid =
    params.targetPid !== undefined && params.targetPid !== null
      ? Number(params.targetPid)
      : requestPid;

  // ✅ 处理时间戳
  let startTime = params.startTime ?? 0;
  let endTime = params.endTime ?? 0;
  // 必发：当天 0 点（毫秒 Long）
  const timeSpace = dayjs(params.date ?? new Date()).startOf('day').valueOf();
// 如果传入 date 对象，则转换为秒级时间戳
//   if (params.date && !params.startTime && !params.endTime) {
//     const dateObj = new Date(params.date);
//     startTime = Math.floor(dateObj.setHours(0, 0, 0, 0) / 1000);
//     endTime = Math.floor(dateObj.setHours(23, 59, 59, 999) / 1000);
//   }
  const body: Record<string, any> = {
    pagNum,
    showNum,
    sortType,
    requestPid,
    pid: targetPid,    // 默认列表上下文 pid
    searchType: 0,
    name: '',          // 后端要求必传字符串
    startTime: startTime, // ✅ 秒级时间戳
    endTime: endTime,     // ✅ 秒级时间戳
    // timeSpace,        // 某天 0 点时间戳（毫秒）
  };

  if (isSearching) {
    body.searchType = 1;
    if (field === 'uid') {
      const maybe = Number(keyword);
      body.pid = Number.isFinite(maybe) ? maybe : 0;
      body.name = ''; // ID 搜索时 name 仍必须是空字符串
      body.mark = '';
    }else if (field === 'mark') {
      // ✅ 按备注搜索
      body.pid = 0;
      body.name = '';
      body.mark = keyword;
      // console.log('[debug] 按备注搜索 PayBack:', body);
    } else {
      body.pid = 0;            // 姓名搜索按你描述传 0
      body.name = keyword;     // name 赋为关键词
      body.mark = '';
    }
  }else {
    body.searchType = 0;
    if (targetPid !== null && typeof targetPid !== 'undefined') {
      body.pid = Number(targetPid) || 0;
    } else {
      body.pid = requestPid;
    }
    body.name = '';
    body.mark = '';;
  }

  console.log('[debug] agentReqPayBack body =', body);

  const resp = await apiJavaPost(
    AGENT_REQ_PAY_BACK_URL,
    body,
    JAVA_SECRET,
    { contentType: 'form', secretKeyName: JAVA_SECRET_KEY_NAME },
  );

  return resp as unknown as { data?: any; status?: number };
}
/**
* agentGameRoomInfo - 游戏开房统计
* 参数：{ startTime, endTime, requestPid? }
* startTime/endTime: 毫秒级时间戳
*/
export async function agentGameRoomInfo(opts: {
  startTime?: number;
  endTime?: number;
  requestPid?: number | string;
}) {
  const requestPid = Number(
    opts.requestPid ??
    localStorage.getItem('AGENT_PID') ??
    localStorage.getItem('ACCOUNT_ID') ??
    0,
  );

  // 默认今天的开始和结束时间（毫秒）
  const today = new Date();
  const defaultStart = new Date(today.setHours(0, 0, 0, 0)).getTime();
  const defaultEnd = new Date(today.setHours(23, 59, 59, 999)).getTime();

  const body = {
    requestPid,
    startTime: opts.startTime ?? defaultStart,
    endTime: opts.endTime ?? defaultEnd,
    gameType: opts.gameType ?? '', // 默认空字符串表示全部游戏
  };

  console.log('[debug] agentGameRoomInfo body=', body, 'endpoint=', AGENT_GAME_ROOM_INFO_URL);

  const resp = await apiJavaPost(AGENT_GAME_ROOM_INFO_URL, body, JAVA_SECRET, {
    contentType: 'form',
    secretKeyName: JAVA_SECRET_KEY_NAME,
  });

  console.log('[debug] agentGameRoomInfo resp=', resp);
  return resp as unknown as AgentGameRoomInfoResp;
}
/**
 * agentPlayerBaseInfo - 玩家基础信息统计
 * 参数：{ startTime, endTime, requestPid? }
 * startTime/endTime: 毫秒级时间戳
 */
export async function agentPlayerBaseInfo(opts: {
  startTime?: number;
  endTime?: number;
  requestPid?: number | string;
}) {
  const requestPid = Number(
    opts.requestPid ??
    localStorage.getItem('AGENT_PID') ??
    localStorage.getItem('ACCOUNT_ID') ??
    0,
  );

  // 默认一个月前到昨天（毫秒）
  const now = new Date();
  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const defaultStart = new Date(oneMonthAgo.setHours(0, 0, 0, 0)).getTime();
  const defaultEnd = new Date(yesterday.setHours(23, 59, 59, 999)).getTime();

  const body = {
    requestPid,
    startTime: opts.startTime ?? defaultStart,
    endTime: opts.endTime ?? defaultEnd,
  };

  console.log('[debug] agentPlayerBaseInfo body=', body, 'endpoint=', AGENT_PLAYER_BASE_INFO_URL);

  const resp = await apiJavaPost(AGENT_PLAYER_BASE_INFO_URL, body, JAVA_SECRET, {
    contentType: 'form',
    secretKeyName: JAVA_SECRET_KEY_NAME,
  });

  console.log('[debug] agentPlayerBaseInfo resp=', resp);
  return resp as unknown as AgentPlayerBaseInfoResp;
}

export default {
  agentReqGameRecord,
  agentReqPlayerGameRecord,
  agentReqGameDetailRecord,
  agentReqPayBack,
  agentGameRoomInfo,
  agentPlayerBaseInfo,
};
