// import {HomeResp} from "#/api/auth";

// 请确保 api/auth.ts 已按前文实现并导出这两个函数
// src/api/member.ts
// import { LAYOUT } from '@/router/constant'
import axios from '#/api/request';
/** 玩家列表响应类型 */
export interface MemberListResp {
  code: number;
  msg: string;
  data?: {
    list: {
      avatar: string;
      beans: number;
      diamonds: number;
      id: number;
      nickname: string;
      role: string;
      vip: number;
    }[];
    total: number;
  };
}
export function apiGetMemberList(params: {
  field?: string;
  keyword?: string;
  page: number;
  pageSize: number;
}) {
  const token = localStorage.getItem('TOKEN'); // 获取存储的 token
  console.log(token);
  return axios.get<MemberListResp>('/api/v1/agent/players', {
    params, // ✅ GET 请求时参数要放在 config.params 里
    headers: {
      Authorization: `Bearer ${token}`, // 添加 Authorization 头
    },
  });
}
