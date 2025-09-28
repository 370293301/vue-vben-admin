import axios from '#/api/request';

export interface LoginResp {
  code: number;
  msg: string;
  data?: {
    expiresIn: number;
    token: string;
    user: {
      avatar?: string;
      id: number;
      is_admin: number;
      nickname?: string;
      role_id?: number;
      role_name?: string;
      username: string;
    };
  };
}

export interface HomeResp {
  code: number;
  msg: string;
  data?: {
    agent: null | Record<string, any>;
    gonggao: any[];
    menuFlat: any[];
    menuTree: any[];
    site: Record<string, any>;
  };
}
// 设置 Axios 的基础 URL
// axios.defaults.baseURL = 'http://127.0.0.1:5566'; // 替换成实际后端地址
// axios.defaults.baseURL = '/api';
export function apiLogin(data: { password: string; username: string }) {
  // 只发明文；后端自己 md5 一次
  return axios.post<LoginResp>('/api/v1/login', data);
}

// export function apiHome() {
//   return axios.get<HomeResp>('/api/v1/home');
// }
export function apiMe() {
  const token = localStorage.getItem('TOKEN'); // 获取存储的 token
  return axios.get<HomeResp>('/api/v1/me', {
    headers: {
      Authorization: `Bearer ${token}`, // 添加 Authorization 头
    },
  });
}
