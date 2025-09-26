// src/api/member.ts
// import { LAYOUT } from '@/router/constant'
import axios from '#/api/request'
// import {HomeResp} from "#/api/auth";
import type { HomeResp } from '#/api/auth';
/** 玩家列表响应类型 */
export interface MemberListResp {
  code: number
  msg: string
  data?: {
    list: {
      id: number
      avatar: string
      role: string
      nickname: string
      vip: number
      diamonds: number
      beans: number
    }[]
    total: number
  }
}

/** 获取玩家列表（带分页） */
// export function apiGetMemberList(params: {
//   page: number
//   pageSize: number
//   field?: string
//   keyword?: string
// }) {
//   return axios.post<MemberListResp>('api/agent/players', params)
// }
export function apiGetMemberList(params: {
  page: number
  pageSize: number
  field?: string
  keyword?: string
}) {
  const token = localStorage.getItem('TOKEN');  // 获取存储的 token
  console.log(token)
  return axios.get<MemberListResp>('/api/v1/agent/players', {
    params,   // ✅ GET 请求时参数要放在 config.params 里
    headers: {
      Authorization: `Bearer ${token}`, // 添加 Authorization 头
    },
  })
}
// export function apiMe() {
//   const token = localStorage.getItem('TOKEN');  // 获取存储的 token
//   return axios.get<HomeResp>('/api/v1/me', {
//     headers: {
//       Authorization: `Bearer ${token}`, // 添加 Authorization 头
//     },
//   });
// }
