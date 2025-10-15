// src/api/game.ts
import { apiJavaPost } from '#/api/auth';

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

export const AGENT_REQ_GAME_DETAIL_RECORD_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentReqGameDetailRecord`
  : '/api/agentReqGameDetailRecord';

/** types */
export interface AgentGameRecordItem {
  pid: number;
  familyId?: number;
  name?: string;
  headUrl?: string;
  level?: number;
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
 * agentReqGameDetailRecord
 * 参数：{ pid, pagNum, showNum, sortType?, requestPid? }
 * 返回：{ records, totalPages, total }
 */
export async function agentReqGameDetailRecord(opts: {
  pagNum?: number | string;
  pid: number | string;
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
  if (!Number.isFinite(sortType)) sortType = 0;
  const requestPid = Number(
    opts.requestPid ??
      localStorage.getItem('AGENT_PID') ??
      localStorage.getItem('ACCOUNT_ID') ??
      0,
  );

  const body = {
    pid,
    pagNum,
    showNum,
    sortType,
    requestPid,
  };

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

  const result = resp?.data ?? resp ?? {};
  return normalizeGameDetailPayload(result);
}

/**
 * agentReqGameRecord
 * 参数：{ pid?, pagNum?, showNum?, sortType?, requestPid?, field?, keyword?, startDate?, endDate? }
 * 返回：原始 resp，调用方从 resp.data 读取负载（与 member.ts 方式一致）
 */
export async function agentReqGameRecord(opts: {
  [k: string]: any;
  endDate?: string;
  field?: string;
  keyword?: string;
  pagNum?: number | string;
  pid?: number | string;
  requestPid?: number | string;
  showNum?: number | string;
  sortType?: number | string;
  startDate?: string;
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
    } else {
      body.pid = 0;
      body.name = kw;
    }
  } else {
    body.searchType = 0;
    body.pid = pid; // 使用上面计算的 pid（可能是 requestPid 或 caller 指定）
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

export default {
  agentReqGameRecord,
  agentReqGameDetailRecord,
};
