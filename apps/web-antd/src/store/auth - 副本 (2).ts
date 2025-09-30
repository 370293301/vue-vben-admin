import { useRouter } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';

// src/store/auth.ts
import { defineStore } from 'pinia';

import { logoutApi } from '#/api'; // 你的 axios 实例（带 baseURL/拦截器）
import { apiLogin, apiMe } from '#/api/auth';
import axios from '#/utils/http';
// import type { Router } from 'vue-router';
// import router from '#/router';

type User = {
  avatar?: string;
  id: number;
  is_admin: number;
  nickname?: string;
  role_id?: number;
  role_name?: string;
  username: string;
};
// const router = useRouter();
// const accessStore = useAccessStore();
// const userStore = useUserStore();
export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    user: {} as Partial<User>,
    menus: [] as any[],
    notices: [] as any[],
    agent: null as null | Record<string, any>,
    site: {} as Record<string, any>,
    loginLoading: false,
  }),
  actions: {
    setToken(t: string) {
      this.token = t;
      // 让后续请求自动带上 Bearer
      axios.defaults.headers.common.Authorization = `Bearer ${t}`;
      // 可选：本地持久化
      localStorage.setItem('TOKEN', t);
    },
    restoreToken() {
      const t = localStorage.getItem('TOKEN') || '';
      if (t) {
        this.setToken(t);
      }
    },
    // async fetchUserInfo() {
    //   // 获取用户信息的逻辑
    // },

    // setUserInfo(u: Partial<User>) {
    //   this.user = u;
    // },
    setUserInfo(u: any) {
      this.user = u;
    },
    setMenus(m: any[]) {
      this.menus = m || [];
    },
    setNotices(n: any[]) {
      this.notices = n || [];
    },
    setAgent(a: any) {
      this.agent = a || null;
    },
    setSite(s: any) {
      this.site = s || {};
    },
    // async  fetchUserInfo() {
    //   let userInfo: null | UserInfo = null;
    //   const me = await apiMe();  // 调用 apiMe 获取用户信息
    //   if (me.data?.code === 0) {
    //     const me_user = me.data.data || {};
    //     userInfo = me_user;
    //     userStore.setUserInfo(me_user);  // 更新用户信息到 store
    //   }
    //   return userInfo;  // 返回用户信息
    // },

    async fetchUserInfo() {
      let userInfo: null | UserInfo = null;
      const me = await apiMe(); // 调用 apiMe 获取用户信息
      // console.log(me);return;
      if (me.data?.code === 0) {
        const me_user = me.data.data || {};
        userInfo = me_user;
        // 使用 useUserStore 来设置用户信息
        const userStore = useUserStore();
        userStore.setUserInfo(me_user); // 更新用户信息到 store
      } else {
        // console.log(1111);
        // return;
        const accessStore = useAccessStore();
        resetAllStores();
        accessStore.setLoginExpired(false);
        localStorage.removeItem('TOKEN');
        delete axios.defaults.headers.common.Authorization;
        window.location.replace(LOGIN_PATH);
      }
      return userInfo; // 返回用户信息
    },

    // 登录动作：调用 /api/v1/login，成功后再拉一次 /api/v1/home
    async authLogin(
      form: { password: string; username: string },
      router: any,
      accessStore: any,
      userStore: any,
    ) {
      // console.log(form)
      // return
      // // const router = useRouter();
      // const router = useRouter();  // 获取 router 实例
      // const accessStore = useAccessStore();  // 初始化 accessStore
      // 异步处理用户登录操作并获取 accessToken
      const userInfo: null | UserInfo = null;
      try {
        this.loginLoading = true;
        const res = await apiLogin(form);
        // console.log(232);
        // return;
        if (res.data?.code !== 0) throw new Error(res.data?.msg || '登录失败');

        const { token, user } = res.data.data || {};

        const accessToken = token;

        if (accessToken) {
          accessStore.setAccessToken(accessToken);

          this.setToken(token); // 设置接口token

          // 使用 Promise.all 来并行调用 fetchUserInfo 和 getAccessCodesApi
          const [fetchUserInfoResult] = await Promise.all([
            this.fetchUserInfo(), // 调用 fetchUserInfo
          ]);

          // 处理返回结果
          if (fetchUserInfoResult) {
            userStore.setUserInfo(fetchUserInfoResult); // 设置用户信息
          }

          // console.log(user);return;
          // console.log(userStore);
          // return;

          this.setUserInfo(user || {});
          // console.log(555);
          // return
          // 拉首页数据（菜单/公告/代理/站点）
          // const home = await apiHome();
          // if (home.data?.code === 0) {
          //   const d = home.data.data || {};
          //   this.setMenus(d.menuTree || []);
          //   this.setNotices(d.gonggao || []);
          //   this.setAgent(d.agent || null);
          //   this.setSite(d.site || {});
          // }
          // 跳转到首页（看你的路由命名）
          // router.push({ name: 'Root' });
          if (accessStore.loginExpired) {
            accessStore.setLoginExpired(false);
          } else {
            router.push('/analytics');
          }

          // return;
        }
      } finally {
        this.loginLoading = false;
      }

      return {
        userInfo,
      };
    },

    // async function fetchUserInfo() {
    //   let userInfo: null | UserInfo = null;
    //   userInfo = await getUserInfoApi();
    //   userStore.setUserInfo(userInfo);
    //   return userInfo;
    // }


    async logout(
      arg?: boolean | Router | { redirect?: boolean; router?: Router },
    ) {
      let redirect = true;
      let routerInst: Router | undefined;

      if (typeof arg === 'boolean') {
        redirect = arg;
      } else if (arg && typeof arg === 'object') {
        // 判断是否像 router：有 push/replace 方法
        if ('push' in arg || 'replace' in arg) {
          routerInst = arg as Router;
        } else {
          redirect = arg.redirect ?? true;
          routerInst = arg.router;
        }
      }

      try {
        await logoutApi();
      } catch {
        // 不做任何处理
      }
      const accessStore = useAccessStore();
      resetAllStores();
      accessStore.setLoginExpired(false);
      // router.replace({
      //   path: LOGIN_PATH,
      //   query: {
      //     redirect: encodeURIComponent(router.currentRoute.value.fullPath),
      //   },
      //   replace: true,
      // });
      // await router.replace({ path: LOGIN_PATH });
      // redirect=true;
      // console.log(redirect)
      this.token = '';
      this.user = {};
      this.menus = [];
      this.notices = [];
      this.agent = null;
      this.site = {};
      localStorage.removeItem('TOKEN');
      delete axios.defaults.headers.common.Authorization;
      window.location.replace(LOGIN_PATH);
      if (redirect) {
        // 优先用传入的 router；若没传且在组件环境中，也可兜底 useRouter()
        routerInst =
          routerInst ??
          (typeof window === 'undefined' ? undefined : useRouter());
        if (routerInst) {
          await routerInst.replace({ path: LOGIN_PATH });
        }
      }
    },

    logout1() {
      this.token = '';
      this.user = {};
      this.menus = [];
      this.notices = [];
      this.agent = null;
      this.site = {};
      localStorage.removeItem('TOKEN');
      delete axios.defaults.headers.common.Authorization;
      // router.replace({ name: 'Login' });
    },
  },
});
