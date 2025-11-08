// src/store/auth.ts
import { defineStore } from 'pinia';
import { useRouter } from 'vue-router';
import axios from '#/utils/http';
import requestAxios from '#/api/request';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';
import { LOGIN_PATH } from '@vben/constants';
import { getAllMenusApi } from '#/api/core/menu';
import { apiJavaPost } from '#/api/auth'; // 导入 apiJavaPost 方法
import CryptoJS from 'crypto-js'; // 需要安装: npm install crypto-js
import { message } from 'ant-design-vue';
// ----- 配置区 -----
// const AGENT_LOGIN_URL = 'http://47.117.179.59:9885/agentLogin';

const JAVA_BASE = import.meta.env.PROD
  ? (import.meta.env.VITE_API_URL as string) || ''
  : '';
console.log('--------------00000 JAVA_BASE:', JAVA_BASE);
export const AGENT_LOGIN_URL = import.meta.env.PROD
  ? `${JAVA_BASE}/agentLogin`
  : '/api/agentLogin';
console.log('-------------- 11111AGENT_LOGIN_URL:', AGENT_LOGIN_URL);


const JAVA_SECRET = '33f77501874dbcd087ed565d9b511117'; // Java 签名密钥
const JAVA_SECRET_KEY_NAME: string | undefined = undefined; // 签名密钥名称

// ----- 类型 -----
type User = {
  avatar?: string;
  id?: number;
  is_admin?: number;
  nickname?: string;
  role_id?: number;
  role_name?: string;
  username?: string;
  [k: string]: any;
};

type UserInfo = any;

/**
 * MD5 加密函数
 * @param str 需要加密的字符串
 * @returns 加密后的字符串
 */
function md5Encrypt(str: string): string {
  return CryptoJS.MD5(str).toString();
}

/**
 * 生成签名
 * @param params 请求参数对象
 * @param secret 签名密钥
 * @returns 签名字符串
 */
function generateSign(params: Record<string, any>, secret: string): string {
  // 1. 按字母顺序排序参数键
  const sortedKeys = Object.keys(params).sort();

  // 2. 构建签名源字符串：key1=value1&key2=value2&...&secret
  let signSource = '';
  for (const key of sortedKeys) {
    if (params[key] !== undefined && params[key] !== null && params[key] !== '') {
      signSource += `${key}=${params[key]}&`;
    }
  }
  signSource += secret;

  console.log('[generateSign] signSource:', signSource);

  // 3. 对签名源进行 MD5 加密
  const sign = CryptoJS.MD5(signSource).toString();
  console.log('[generateSign] sign:', sign);

  return sign;
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    nodeToken: '' as string,
    accountID: '' as string,
    user: {} as Partial<User>,
    menus: [] as any[],
    notices: [] as any[],
    agent: null as null | Record<string, any>,
    site: {} as Record<string, any>,
    loginLoading: false,
  }),
  actions: {
    /**
     * 设置 token
     */
    setToken(t: string) {
      this.token = t || '';
      console.log('[auth.setToken] called, token=', t);
      if (t) {
        localStorage.setItem('TOKEN', t);
        localStorage.setItem('AGENT_TOKEN', t);
      } else {
        localStorage.removeItem('TOKEN');
        localStorage.removeItem('AGENT_TOKEN');
      }
    },

    /**
     * 恢复本地存储的 token（页面刷新时使用）
     */
    restoreToken() {
      const t = localStorage.getItem('TOKEN') || '';
      if (t) {
        this.setToken(t);
      }
      const nt = localStorage.getItem('NODE_TOKEN') || '';
      if (nt) {
        this.nodeToken = nt;
      }
      const aid = localStorage.getItem('ACCOUNT_ID') || '';
      if (aid) this.accountID = aid;
    },

    setUserInfo(u: any) {
      this.user = u || {};
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

    /**
     * 把 menu 数组转换并注册到 router
     */
    async registerMenusAndPush(routerInstance: any) {
      try {
        const menus = await getAllMenusApi();
        this.menus = menus || [];

        // 预构建 views 模块映射（Vite）
        const viewModules = import.meta.glob('/src/views/**/*.vue');

        function findModuleByComponentString(compStr: string) {
          if (!compStr || typeof compStr !== 'string') return null;
          const cleaned = compStr.replace(/^\//, '').replace(/\.vue$/, '');
          const key = Object.keys(viewModules).find(k => k.endsWith(`${cleaned}.vue`));
          if (!key) return null;
          return viewModules[key];
        }

        function menuToRoute(menuItem: any) {
          const route: any = {
            path: menuItem.path,
            name: menuItem.name,
            meta: menuItem.meta || {},
          };
          if (menuItem.redirect) route.redirect = menuItem.redirect;

          if (menuItem.component) {
            if (typeof menuItem.component === 'string') {
              const loader = findModuleByComponentString(menuItem.component);
              if (loader) route.component = loader;
              else {
                console.warn('[registerMenus] view not found for', menuItem.component);
              }
            } else {
              route.component = menuItem.component;
            }
          }

          if (Array.isArray(menuItem.children) && menuItem.children.length) {
            route.children = menuItem.children.map((c: any) => menuToRoute(c));
          }
          return route;
        }

        const parentName = 'Root';
        const router = routerInstance;

        for (const m of menus) {
          const rr = menuToRoute(m);
          const exists = router.getRoutes().some((r: any) => String(r.name) === String(rr.name) || r.path === rr.path);
          if (exists) {
            console.warn('[registerMenus] skip duplicate route', rr.name, rr.path);
            continue;
          }
          try {
            if (router.getRoutes().some((r: any) => r.name === parentName)) {
              router.addRoute(parentName, rr);
              console.log('[registerMenus] addRoute to parent', parentName, rr.path);
            } else {
              router.addRoute(rr);
              console.log('[registerMenus] addRoute global', rr.path);
            }
          } catch (e) {
            console.error('[registerMenus] addRoute error', e, rr.path);
          }
        }

        await new Promise(res => setTimeout(res, 50));
        console.log('[registerMenus] routes registered, now getRoutes length:', router.getRoutes().length);

        const allowedNames = new Set<string>();
        function collectNames(menuList: any[]) {
          for (const it of menuList) {
            if (it.name) allowedNames.add(String(it.name));
            if (Array.isArray(it.children) && it.children.length) collectNames(it.children);
          }
        }
        collectNames(menus);

        const systemKeep = ['Root', 'Authentication', 'Login', 'FallbackNotFound'];
        for (const n of systemKeep) allowedNames.add(n);

        for (const r of router.getRoutes()) {
          const rn = String(r.name ?? '');
          if (!rn) continue;
          if (!allowedNames.has(rn)) {
            (r as any).meta = { ...(r as any).meta, hideInMenu: true };
          } else {
            (r as any).meta = { ...(r as any).meta, hideInMenu: false };
          }
        }

        console.log('[registerMenus] applied hideInMenu flags. allowedNames:', Array.from(allowedNames));
      } catch (e) {
        console.error('[registerMenus] error:', e);
        throw e;
      }
    },

    /**
     * 新的登录方法 - 使用 apiJavaPost 请求
     * @param form 登录表单 { username, password }
     * @param router vue-router 实例
     * @param accessStore Vben 的 accessStore
     * @param userStore Vben 的 userStore
     */
    async authLogin(form: { username: string; password: string }, router: any, accessStore: any, userStore: any) {
      this.loginLoading = true;
      try {
        // 1. MD5 加密密码
        const encryptedPassword = md5Encrypt(form.password);

        console.log('[authLogin] 发送登录请求到:', AGENT_LOGIN_URL);
        console.log('[authLogin] 请求参数:', { userName: form.username, passWord: '***' });

        // 2. 使用 apiJavaPost 方法请求接口（自动生成签名）
        const response = await apiJavaPost(
          AGENT_LOGIN_URL,
          {
            userName: form.username,
            passWord: encryptedPassword,
          },
          JAVA_SECRET,
          {
            contentType: 'form',
            secretKeyName: JAVA_SECRET_KEY_NAME,
          }
        );

        console.log('[authLogin] 登录响应:', response.data);

        // 3. 检查登录是否成功
        const responseData = response.data;
        if (!responseData) {
          throw new Error('没有收到服务器响应');
        }

        // 根据实际接口的返回格式调整判断逻辑
        const code = responseData.Code ?? responseData.code ?? responseData.status;
        const msg = responseData.Msg ?? responseData.msg ?? responseData.message;

        // 假设成功的 code 是 200 或 0
        if (code !== 200 && code !== 0) {
          throw new Error(msg || `登录失败 (Code: ${code})`);
        }

        // 4. 获取返回的 token 和用户信息
        const token = responseData.data?.accountID
          || responseData.accountID
          || responseData.accountID
          || '';
        if (!token) {
          throw new Error('未获取到 token，响应数据: ' + JSON.stringify(responseData));
        }

        const userInfo = {
          id: (responseData.data?.AccountID ?? responseData.data?.accountID) ?? (responseData.AccountID ?? responseData.accountID),
          username: (responseData.data?.name ?? form.username) ?? form.username,
          avatar: responseData.data?.headUrl ?? responseData.headUrl ?? '',
          nickname: responseData.data?.name ?? responseData.name ?? '',
          pid: (responseData.data?.pid ?? responseData.data?.Pid) ?? (responseData.pid ?? responseData.Pid) ?? '',
          ...(responseData.data || responseData),
        };


        // 5. 设置用户角色（如果接口没有返回，默认设置）
        if (!userInfo.roles) {
          userInfo.roles = ['推广员']; // 默认角色
        }
        const pid = userInfo.pid || userInfo.Pid || '';
        if (pid) {
          localStorage.setItem('AGENT_PID', pid);
        }
        // 6. 存储账号、密码和 token 到 localStorage（方便后续 fetchUserInfo 使用）
        localStorage.setItem('AGENT_USERNAME', form.username);
        localStorage.setItem('AGENT_PASSWORD', encryptedPassword); // 存储已加密的密码
        localStorage.setItem('AGENT_PASSWORD_PLAIN', form.password); // 也可以存储明文（根据需求调整）
        localStorage.setItem('AGENT_TOKEN', token);
        localStorage.setItem('cityIdList', responseData.data?.cityIdList);
        localStorage.setItem('recAccountID', responseData.data?.recAccountID);



        // 6. 设置 token 到 store
        this.setToken(token);
        this.user = userInfo;

        // 7. 更新 userStore
        try {
          const us = useUserStore();
          us.setUserInfo(userInfo);
        } catch (_) {}

        // 8. 更新 accessStore
        const access = accessStore ?? useAccessStore();
        const us = userStore ?? useUserStore();

        if (access) {
          if (typeof access.setAccessToken === 'function') {
            access.setAccessToken(token);
          } else {
            (access as any).accessToken = token;
          }
        }

        if (us && typeof us.setUserInfo === 'function') {
          us.setUserInfo(userInfo);
        } else if (us) {
          (us as any).userInfo = userInfo;
        }

        // 9. 注册路由并跳转
        const routerInst = router ?? (typeof window === 'undefined' ? undefined : useRouter());
        if (routerInst) {
          console.log('[authLogin] 跳转到首页...');
          try {
            await routerInst.push('/analytics');
          } catch (e) {
            console.warn('[authLogin] 跳转失败:', e);
          }
        } else {
          console.warn('[authLogin] 没有 router 实例');
        }

        return { success: true, userInfo };
      } catch (err: any) {
        // console.error('[authLogin] 登录错误:', err.message || err);
        message.error(err.message || '登录失败，请重试');


        // 清理
        localStorage.removeItem('AGENT_TOKEN');
        localStorage.removeItem('AGENT_USERNAME');
        localStorage.removeItem('AGENT_PASSWORD');
        localStorage.removeItem('AGENT_PASSWORD_PLAIN');
        this.setToken('');
        throw err;
      } finally {
        this.loginLoading = false;
      }
    },

    /**
     * 获取用户信息 - 使用存储的账号密码，通过 apiJavaPost 请求
     * @returns 用户信息
     */
    async fetchUserInfo() {
      try {
        // 从 localStorage 获取存储的账号和密码
        const username = localStorage.getItem('AGENT_USERNAME');
        const password = localStorage.getItem('AGENT_PASSWORD'); // 如果存的是加密密码

        if (!username || !password) {
          console.warn('[fetchUserInfo] 存储的凭证不完整，执行登出');

          // 检查是否还有有效的 token
          const token = localStorage.getItem('AGENT_TOKEN');
          if (!token) {
            // 完全没有凭证，清理并跳转
            await this.logout(false); // false 表示不需要额外的重定向
            return null;
          }
          // 如果还有 token 但没有账号密码，可能是特殊情况，返回空信息
          return null;

        }

        console.log('[fetchUserInfo] 使用存储的账号信息请求用户数据');

        // 使用 apiJavaPost 方法请求
        const response = await apiJavaPost(
          AGENT_LOGIN_URL,
          {
            userName: username,
            passWord: password, // 使用存储的加密密码
          },
          JAVA_SECRET,
          {
            contentType: 'form',
            secretKeyName: JAVA_SECRET_KEY_NAME,
          }
        );

        console.log('[fetchUserInfo] 响应:', response.data);

        const responseData = response.data;
        if (!responseData) {
          throw new Error('没有收到服务器响应');
        }

        const code = responseData.Code ?? responseData.code ?? responseData.status;
        const msg = responseData.Msg ?? responseData.msg ?? responseData.message;
        if (code === 101 || code === 'INVALID_PASSWORD' || msg?.includes('账号密码错误')) {
          console.error('[fetchUserInfo] 检测到密码错误 (Code: 101)，执行登出');

          // 清理凭证
          localStorage.removeItem('AGENT_TOKEN');
          localStorage.removeItem('AGENT_USERNAME');
          localStorage.removeItem('AGENT_PASSWORD');
          localStorage.removeItem('AGENT_PASSWORD_PLAIN');
          localStorage.removeItem('cityIdList');
          localStorage.removeItem('recAccountID');



          // 弹出提示
          message.error('密码已修改，请重新登录');
          // 执行登出
          // setTimeout(async () => {
          //   await this.logout(false);
          // }, 2000);

          await this.logout(false);
          return null;
        }
        if (code !== 200 && code !== 0) {
          // throw new Error(msg || `请求失败 (Code: ${code})`);
          message.error(msg || `请求失败 (Code: ${code})`);
        }

        const userInfo = {
          id: (responseData.data?.AccountID ?? responseData.data?.accountID) ?? (responseData.AccountID ?? responseData.accountID),
          username: (responseData.data?.name ?? form.username) ?? form.username,
          avatar: responseData.data?.headUrl ?? responseData.headUrl ?? '',
          nickname: responseData.data?.name ?? responseData.name ?? '',
          pid: (responseData.data?.pid ?? responseData.data?.Pid) ?? (responseData.pid ?? responseData.Pid) ?? '',
          ...(responseData.data || responseData),
        };
        if (!userInfo.roles) {
          userInfo.roles = ['推广员']; // 默认角色
        }
        const pid = userInfo.pid || userInfo.Pid || '';
        if (pid) {
          localStorage.setItem('AGENT_PID', pid);
        }
        localStorage.setItem('cityIdList', responseData.data?.cityIdList);
        localStorage.setItem('recAccountID', responseData.data?.recAccountID);
        const userStore = useUserStore();
        if (userStore) {
          userStore.setUserInfo(userInfo);
        } else {
          try {
            const us = useUserStore();
            us.setUserInfo(userInfo);
          } catch (_) {}
        }

        return userInfo;
      } catch (err: any) {
        console.error('[fetchUserInfo] 错误:', err.message || err);
        throw err;
      }
    },

    async collectMenuNames(menus: any[]): string[] {
      const out: string[] = [];
      function walk(list: any[]) {
        for (const it of list) {
          if (it && it.name) out.push(String(it.name));
          if (Array.isArray(it.children) && it.children.length) walk(it.children);
        }
      }
      walk(menus || []);
      return out;
    },

    /**
     * 退出登录
     */
    async logout(arg?: boolean | { redirect?: boolean; router?: any }) {
      let redirect = true;
      let routerInst: any | undefined;

      if (typeof arg === 'boolean') {
        redirect = arg;
      } else if (arg && typeof arg === 'object') {
        redirect = arg.redirect ?? true;
        routerInst = arg.router;
      }

      routerInst = routerInst ?? (typeof window === 'undefined' ? undefined : useRouter());

      try {
        const auth = useAuthStore();
        const menuNames = await this.collectMenuNames(auth.menus || []);
        if (routerInst && Array.isArray(menuNames) && menuNames.length) {
          for (const nm of menuNames) {
            try {
              if (nm && typeof routerInst.hasRoute === 'function' && routerInst.hasRoute(nm)) {
                routerInst.removeRoute(nm);
                console.log('[logout] 移除动态路由:', nm);
              }
            } catch (err) {
              console.warn('[logout] 移除路由出错:', nm, err);
            }
          }
        }
      } catch (e) {
        console.warn('[logout] 动态路由清理出错:', e);
      }

      try {
        resetAllStores();
        const access = useAccessStore();
        access.setLoginExpired(false);
      } catch (e) {
        console.warn('[logout] resetAllStores 出错:', e);
      }

      // 清理 stores
      this.token = '';
      this.nodeToken = '';
      this.accountID = '';
      this.user = {};
      this.menus = [];
      this.notices = [];
      this.agent = null;
      this.site = {};

      // 清理 localStorage
      localStorage.removeItem('AGENT_PID');
      localStorage.removeItem('TOKEN');
      localStorage.removeItem('NODE_TOKEN');
      localStorage.removeItem('ACCOUNT_ID');
      localStorage.removeItem('AGENT_TOKEN');
      localStorage.removeItem('AGENT_USERNAME');
      localStorage.removeItem('AGENT_PASSWORD');
      localStorage.removeItem('AGENT_PASSWORD_PLAIN');
      sessionStorage.removeItem('menusRegistered');
      localStorage.removeItem('cityIdList');
      localStorage.removeItem('recAccountID');

      // const hashPrefix = import.meta.env.DEV ? '' : '#';

      // const router = useRouter();
      // await router.push(LOGIN_PATH);


      // const hasHash = window.location.href.includes('#');
      // const hashPrefix = hasHash ? '#' : '';
      // console.log(window.location.href)
      // console.log(window.location.href.includes('#'))
      // window.location.replace(`${window.location.origin}${LOGIN_PATH}`);
      // console.log('[logout]有没有带:', hashPrefix);
      // console.log('[logout] 登出完成，重定向到:', LOGIN_PATH);
      // window.location.reload();

      if (redirect && routerInst) {
        try {
          await routerInst.replace({ path: LOGIN_PATH });
        } catch (e) {
          console.warn('[logout] 路由跳转失败，使用 location replace', e);
          window.location.replace(LOGIN_PATH);
        }
      } else {
        window.location.replace(LOGIN_PATH);
      }
      // ✅ 如果 router 失败，才用 window.location（不要加 # 号）
      const redirectUrl = `${window.location.origin}/auth/login`;
      console.log('[logout] 重定向 URL:', redirectUrl);
      window.location.replace(redirectUrl);
    },
  },
});
