import axios from '#/api/request';

export interface LoginResp {
  code: number;
  msg: string;
  data?: {
    token: string;
    expiresIn: number;
    user: {
      id: number;
      username: string;
      nickname?: string;
      avatar?: string;
      is_admin: number;
      role_id?: number;
      role_name?: string;
    };
  };
}

export interface HomeResp {
  code: number;
  msg: string;
  data?: {
    menuTree: any[];
    menuFlat: any[];
    gonggao: any[];
    agent: Record<string, any> | null;
    site: Record<string, any>;
  };
}
// 设置 Axios 的基础 URL
// axios.defaults.baseURL = 'http://127.0.0.1:5566'; // 替换成实际后端地址
// axios.defaults.baseURL = '/api';
export function apiLogin(data: { username: string; password: string }) {
  // 只发明文；后端自己 md5 一次
  return axios.post<LoginResp>('/api/v1/login', data);
}

// export function apiHome() {
//   return axios.get<HomeResp>('/api/v1/home');
// }
export function apiMe() {
  const token = localStorage.getItem('TOKEN');  // 获取存储的 token
  return axios.get<HomeResp>('/api/v1/me', {
    headers: {
      Authorization: `Bearer ${token}`, // 添加 Authorization 头
    },
  });
}
