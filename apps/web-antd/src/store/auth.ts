// src/store/auth.ts
import { defineStore } from 'pinia';
import { useRouter } from 'vue-router';
import axios from '#/utils/http'; // 你的 axios 实例（用于在 setToken 中设置默认 header）
import requestAxios from '#/api/request';
import { resetAllStores, useAccessStore, useUserStore } from '@vben/stores';
import { LOGIN_PATH } from '@vben/constants';
import { getAllMenusApi } from '#/api/core/menu';
import { apiNodeClientLogin, apiJavaPost } from '#/api/auth'; // 请确保 api/auth.ts 已按前文实现并导出这两个函数

// ----- 配置区（按需修改） -----
// Java 签名密钥（示例值）——生产不要硬编码在前端！
const JAVA_SECRET = '33f77501874dbcd087ed565d9b511117';
// 如果后端期望以 Charge_Key=xxxx 拼接，请把下面改为 'Charge_Key'
const JAVA_SECRET_KEY_NAME: string | undefined = undefined;

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

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: '' as string,
    nodeToken: '' as string,
    accountID: '' as string, // 存储 AccountID（来自 Node / Java）
    user: {} as Partial<User>,
    menus: [] as any[],
    notices: [] as any[],
    agent: null as null | Record<string, any>,
    site: {} as Record<string, any>,
    loginLoading: false,
  }),
  actions: {
    /**
     * 设置 token（用于后续请求）
     */
    // setToken(t: string) {
    //   this.token = t || '';
    //   if (t) {
    //     axios.defaults.headers.common.Authorization = `Bearer ${t}`;
    //     localStorage.setItem('TOKEN', t);
    //   } else {
    //     delete axios.defaults.headers.common.Authorization;
    //     localStorage.removeItem('TOKEN');
    //   }
    // },
    // 替换原有 setToken 实现为：
    // 替换 setToken 实现：
    setToken(t: string) {
      this.token = t || '';
      console.log('[auth.setToken] called, token=', t);
      if (t) {
        // utils/http 实例（你的 axios）
        // axios.defaults.headers.common.Authorization = `Bearer ${t}`;
        // // api/request 实例（可能用于 Java 请求）
        // try {
        //   requestAxios.defaults.headers.common.Authorization = `Bearer ${t}`;
        //   console.log('[auth.setToken] set requestAxios header ok');
        // } catch (e) {
        //   console.warn('[auth.setToken] set requestAxios header failed', e);
        // }
        localStorage.setItem('TOKEN', t);
      } else {
        // delete axios.defaults.headers.common.Authorization;
        // try { delete requestAxios.defaults.headers.common.Authorization; } catch (_) {}
        localStorage.removeItem('TOKEN');
      }

      // 输出当前两个实例的 header（便于验证）
      // try {
      //   console.log('[auth.setToken] utils/http header =', axios.defaults.headers.common.Authorization);
      //   console.log('[auth.setToken] api/request header =', requestAxios.defaults.headers.common.Authorization);
      // } catch (e) {
      //   console.warn('[auth.setToken] print headers failed', e);
      // }
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
     * 把 menu 数组转换并注册到 router。
     * 约定：menu.component 是以 / 开头的字符串，比如 '/dashboard/analytics/index'
     * 对应文件位置：src/views/dashboard/analytics/index.vue
     */
    // ---------- 替换版 registerMenusAndPush ----------
    async registerMenusAndPush(routerInstance: any) {
      try {
        const menus = await getAllMenusApi(); // 你的后台菜单
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
                // 找不到视图时，保留 meta 但不报错
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

        // 添加后台菜单为路由（注册到 Root 下）
        for (const m of menus) {
          const rr = menuToRoute(m);
          // 如果已经有同名或同 path 的 route，跳过
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

        // 等短暂时间确保路由生效
        await new Promise(res => setTimeout(res, 50));
        console.log('[registerMenus] routes registered, now getRoutes length:', router.getRoutes().length);

        // ---------- 将非白名单路由隐藏（只影响菜单显示） ----------
        // 构造白名单：所有你 menus 的 name + 常驻路由名（保留 Root/Authentication/Login/404）
        const allowedNames = new Set<string>();
        // flatten menus to extract names (递归)
        function collectNames(menuList: any[]) {
          for (const it of menuList) {
            if (it.name) allowedNames.add(String(it.name));
            if (Array.isArray(it.children) && it.children.length) collectNames(it.children);
          }
        }
        collectNames(menus);

        // 保留的系统/基础路由名（必保留）
        const systemKeep = ['Root', 'Authentication', 'Login', 'FallbackNotFound'];
        for (const n of systemKeep) allowedNames.add(n);

        // 遍历 router，把不在白名单的打上 hideInMenu
        for (const r of router.getRoutes()) {
          const rn = String(r.name ?? '');
          if (!rn) continue;
          if (!allowedNames.has(rn)) {
            // 给 route 的 meta 打标记：hideInMenu (前端菜单组件在渲染时应检查此字段)
            // 注意：route.meta 是可修改的对象
            (r as any).meta = { ...(r as any).meta, hideInMenu: true };
          } else {
            (r as any).meta = { ...(r as any).meta, hideInMenu: false };
          }
        }

        console.log('[registerMenus] applied hideInMenu flags. allowedNames:', Array.from(allowedNames));

        // 触发侧边栏/菜单重新读取（如果你的菜单组件基于 accessStore 或 router.getRoutes()，确保刷新）
        // 如果你的菜单是基于 getAllMenusApi()/accessStore 来渲染，这一步可以确保它使用 this.menus

        // 最后尝试跳转后台首页
        try {
          // await router.push('/analytics');
          router.push('/analytics');
          console.log('[registerMenus] pushed /analytics, currentRoute:', router.currentRoute.value);
        } catch (e) {
          console.warn('[registerMenus] push /analytics failed or intercepted', e);
        }
      } catch (e) {
        console.error('[registerMenus] failed', e);
      }
    },
// ---------- end registerMenusAndPush ----------


    /**
     * fetchUserInfo（Java agentLogin）:
     */
    async fetchUserInfo(): Promise<null | UserInfo> {

      // if (!this.accountID) return null;
      const storedAccountId = this.accountID || (typeof window !== 'undefined' ? localStorage.getItem('ACCOUNT_ID') : null);
      if (!storedAccountId) return null;
      // 把回退到的 accountID 写回 store，保证后续逻辑有它
      this.accountID = String(storedAccountId);
      // 同理恢复 nodeToken / token header（如果有）
      // const storedNodeToken = this.nodeToken || (typeof window !== 'undefined' ? localStorage.getItem('NODE_TOKEN') : null);
      // if (storedNodeToken) this.nodeToken = String(storedNodeToken);
      //
      // const storedToken = (this.token && this.token.length) ? this.token : (typeof window !== 'undefined' ? localStorage.getItem('TOKEN') : null);
      // if (storedToken) {
      //   this.setToken(String(storedToken)); // setToken 会设置 axios header 与 localStorage
      // }
      try {
        const javaUrl = 'http://47.117.179.59:9888/agentLogin';
        const resp = await apiJavaPost(
          javaUrl,
          { accountID: this.accountID },
          JAVA_SECRET,
          {
            contentType: 'form',
            secretKeyName: JAVA_SECRET_KEY_NAME,
          }
        );

        const data = resp?.data ?? null;

        if (!data) return null;
        const ok = data.Head === 0 || data.code === 0 || data.Code === 0 || !!data.AccountID;
        if (!ok) return null;
        data.roles = ['推广员'];
        // console.log('-------------------2222')
        // console.log(data)
        // const userInfo = {
        //   id: data.AccountID ?? data.accountID ?? undefined,
        //   username: data.CharAccount ?? data.charAccount ?? undefined,
        //   avatar: data.HeadImageUrl ?? '',
        //   nickname: data.NickName ?? '',
        //
        //   ...data,
        // };
        const userInfo = {
          id: data.data.AccountID ?? data.data.accountID,
          username: data.data.name ?? data.data.name ?? form.username,
          avatar: data.data.headUrl ?? '',
          nickname: data.data.name ?? '',
          ...data,
        };
        // console.log('-------------------3333')
        console.log(userInfo)
        this.setUserInfo(userInfo);
        const userStore = useUserStore();
        if (userStore) {
          userStore.setUserInfo(userInfo);
        } else {
          try {
            const us = useUserStore();
            us.setUserInfo(userInfo);
          } catch (_) {}
        }


        const pid = data.data.pid ?? null;
        if (pid) {
          this.agent = { ...(this.agent || {}), pid };
          localStorage.setItem('AGENT_PID', String(pid));
        }
        const jToken = data.Token ?? data.token;
        if (jToken) {
          this.setToken(jToken);
        }


        return userInfo;
      } catch (err) {
        console.error('[fetchUserInfo] error', err);
        return null;
      }
    },

    /**
     * 登录主流程
     */
    async authLogin(
      form: { username: string; password: string },
      router?: any,
      accessStore?: any,
      userStore?: any
    ) {
      this.loginLoading = true;
      try {
        // 1) Node 登录
        const sendPack: Record<string, any> = {
          Head: parseInt('0xff03', 16), // 65283
          CharAccount: form.username,
          CharAccountPsw: form.password,
          IsToken: 0,
          deviceID: 'web-client',
          deviceModel: 'web',
          clientPackageName: 'web-app',
          SDKType: 0,
        };

        const nodeResp = await apiNodeClientLogin(sendPack);
        const nodeData = nodeResp?.data ?? null;

        const nodeSuccess = nodeData && (nodeData.Head === 0 || nodeData.code === 0);
        if (!nodeSuccess) {
          const alt = nodeResp?.data?.data ?? null;
          if (!alt || (alt.Head !== 0 && alt.code !== 0)) {
            throw new Error(nodeResp?.data?.msg || 'Node login failed');
          }
        }

        const nodeBody = nodeData?.data ? nodeData.data : nodeData;
        const accountID = nodeBody?.AccountID ?? nodeBody?.accountID ?? nodeBody?.AccountId;
        const nodeToken = nodeBody?.Token ?? nodeBody?.token ?? nodeBody?.SDKToken;

        if (!accountID) throw new Error('Node login succeeded but no AccountID returned');

        this.accountID = String(accountID);
        localStorage.setItem('ACCOUNT_ID', String(accountID));
        if (nodeToken) {
          this.nodeToken = String(nodeToken);
          localStorage.setItem('NODE_TOKEN', this.nodeToken);
        }

        // 2) Java agentLogin 获取玩家信息
        const javaUrl = 'http://47.117.179.59:9888/agentLogin';


        const javaResp = await apiJavaPost(
          javaUrl,
          { accountID: this.accountID },
          JAVA_SECRET,
          { contentType: 'form', secretKeyName: JAVA_SECRET_KEY_NAME }
        );

        const jdata = javaResp?.data ?? null;
        if (!jdata) throw new Error('Java agentLogin no response');

        const javaOk = jdata.Head === 0 || jdata.code === 0 || !!jdata.AccountID;
        if (!javaOk) {
          const msg = jdata?.Msg || jdata?.msg || jdata?.message || 'Java login failed';
          throw new Error(msg);
        }
        // if (!Array.isArray(jdata.roles)) {
        //   jdata.roles = ['推广员88'];
        // }
        jdata.roles = ['推广员'];
        const userInfo = {
          id: jdata.data.AccountID ?? jdata.data.accountID,
          username: jdata.data.name ?? jdata.data.name ?? form.username,
          avatar: jdata.data.headUrl ?? '',
          nickname: jdata.data.name ?? '',
          ...jdata,
        };
        console.log(userInfo)
        this.setUserInfo(userInfo);
        // console.log('-------------------333')
        // // --------- 新增：提取并保存 pid ---------
        // console.log('-------------------44444')
        console.log(jdata)
        // console.log(jdata.data.pid)
        const pid =
          jdata.data.pid ??
          null;

        if (pid !== null && pid !== undefined) {
          // 写入 Pinia store 字段（方便在组件内读取）
          // 我这里用 this.agent 保存示例，你也可以新增 this.agentPid 字段
          try {
            this.agent = { ...(this.agent || {}), pid };
          } catch (e) {
            // 忽略
          }
          console.log('-------------------99998888')
          console.log(pid)
          // 写入 localStorage，key 可以自定义（建议使用 AGENT_PID）
          try {
            localStorage.setItem('AGENT_PID', String(pid));
          } catch (e) {
            console.warn('保存 AGENT_PID 失败', e);
          }
        }
        if (userStore) {
          userStore.setUserInfo(userInfo);
        } else {
          try {
            const us = useUserStore();
            us.setUserInfo(userInfo);
          } catch (_) {}
        }

        // final token 优先取 Java 的
        const finalToken = jdata.Token ?? jdata.token ?? this.nodeToken;
        if (finalToken) {
          this.setToken(finalToken);
        }

        // ---- 关键：把 accessStore 状态写入（守卫依赖这些字段） ----
        const access = accessStore ?? useAccessStore();
        const us = userStore ?? useUserStore();

        // 写 token 到 accessStore（支持 setAccessToken 或直接赋值）
        if (access) {
          if (typeof access.setAccessToken === 'function') {
            access.setAccessToken(finalToken);
          } else {
            (access as any).accessToken = finalToken;
          }
        }

        // 设置 userStore 信息（再确认一遍）
        if (us && typeof us.setUserInfo === 'function') {
          us.setUserInfo(userInfo);
        } else if (us) {
          (us as any).userInfo = userInfo;
        }

        // 注册路由并跳转（通过 this 调用 store 内方法）
        const routerInst = router ?? (typeof window === 'undefined' ? undefined : useRouter());
        if (routerInst) {
          // // 先注册菜单（会尝试 push /analytics），registerMenusAndPush 内部已做 addRoute
          // await (this as any).registerMenusAndPush(routerInst);
          //
          // // 写入 accessStore 的 menu / 标识，告诉守卫我们已经准备好了
          // try {
          //   const menus = this.menus && this.menus.length ? this.menus : await getAllMenusApi();
          //   if (access) {
          //     if (typeof (access as any).setAccessMenus === 'function') {
          //       (access as any).setAccessMenus(menus);
          //     } else {
          //       (access as any).accessMenus = menus;
          //     }
          //
          //     if (typeof (access as any).setIsAccessChecked === 'function') {
          //       (access as any).setIsAccessChecked(true);
          //     } else {
          //       (access as any).isAccessChecked = true;
          //     }
          //   }
          // } catch (e) {
          //   console.warn('[authLogin] set access menus/check flag failed', e);
          // }

          // 最后确保跳转到首页（路由守卫看到 accessToken/isAccessChecked 后应该放行）
          console.log(routerInst)
          try {
            await routerInst.push('/analytics');
            // router.push('/analytics');
            // console.log('[authLogin] router.push -> /analytics successful', routerInst.currentRoute.value);


          } catch (e) {
            console.warn('[authLogin] final push /analytics failed or intercepted', e);
          }

          (function printRoutes(router) {
            const routes = router.getRoutes();
            const out = routes.map(r => ({
              name: r.name,
              path: r.path,
              // meta 可能包含 layout 标识或 title
              meta: r.meta || {},
              // children 数量
              childrenCount: Array.isArray((r as any).children) ? (r as any).children.length : 0,
              // 为了观察 component 类型，打印 type 或字符串化
              componentType: r.component ? (typeof r.component) : undefined,
            }));
            console.log('>>> router.getRoutes() (count=' + routes.length + ')', out);
          })(router);

        } else {
          console.warn('[authLogin] no router instance available, cannot register routes or push');
        }

        // 更新 accessStore 登录状态标记（如果存在 loginExpired）
        try {
          if (access && typeof access.setLoginExpired === 'function' && access.loginExpired) {
            access.setLoginExpired(false);
          }
        } catch (_) {}

        return { success: true, userInfo };
      } catch (err: any) {
        console.error('[authLogin] error:', err);
        // 清理
        localStorage.removeItem('NODE_TOKEN');
        localStorage.removeItem('ACCOUNT_ID');
        localStorage.removeItem('TOKEN');
        this.nodeToken = '';
        this.accountID = '';
        this.setToken('');
        throw err;
      } finally {
        this.loginLoading = false;
      }
    },
    async  collectMenuNames(menus: any[]): string[] {
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
     * 退出登录（并跳转到登录页）
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

      // optional: call backend logout API
      // try {
      //   await logoutApi();
      // } catch (e) {
      //   console.warn('logoutApi failed', e);
      // }

      // 如果没有传 router，则尝试从环境拿
      routerInst = routerInst ?? (typeof window === 'undefined' ? undefined : useRouter());

      // 1) 先把那些动态注册过的 route 移除（推荐：当你注册 route 时把名字保存到 store 或 sessionStorage）
      try {
        // 优先方式：如果 auth store 保存了菜单名数组（this.menus），用它移除
        const auth = useAuthStore();
        const menuNames = await this.collectMenuNames(auth.menus || []); // 采集 name 字段
        if (routerInst && Array.isArray(menuNames) && menuNames.length) {
          for (const nm of menuNames) {
            try {
              if (nm && typeof routerInst.hasRoute === 'function' && routerInst.hasRoute(nm)) {
                routerInst.removeRoute(nm);
                console.log('[logout] removed dynamic route', nm);
              }
            } catch (err) {
              // ignore single remove errors
              console.warn('[logout] removeRoute error for', nm, err);
            }
          }
        }
      } catch (e) {
        console.warn('[logout] dynamic route cleanup error', e);
      }

      // 2) 清理 stores/localStorage/axios header
      try {
        resetAllStores();
        const access = useAccessStore();
        access.setLoginExpired(false);
      } catch (e) {
        console.warn('[logout] resetAllStores error', e);
      }

      // 清 token/账号信息
      this.token = '';
      this.nodeToken = '';
      this.accountID = '';
      this.pid = '';
      this.user = {};
      this.menus = [];
      this.notices = [];
      this.agent = null;
      this.site = {};
      // delete axios.defaults.headers.common.Authorization;

      localStorage.removeItem('TOKEN');
      localStorage.removeItem('NODE_TOKEN');
      localStorage.removeItem('ACCOUNT_ID');
      sessionStorage.removeItem('menusRegistered'); // 如果你用过这个标记，也清理掉
      window.location.replace(LOGIN_PATH);
      // 3) SPA 内部跳转到登陆页（不刷新）
      if (redirect && routerInst) {
        console.log(77788888999);
        try {
          console.log(11111666222333);
          await routerInst.replace({ path: LOGIN_PATH });
        } catch (e) {
          console.warn('[logout] router replace failed, fallback to location replace', e);
          // 最后一招：如果 router.replace 失败再强制刷新
          window.location.replace(LOGIN_PATH);
        }
      } else {
        // 如果没有 router，则直接用 location
        console.log(222333);
        window.location.replace(LOGIN_PATH);
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
      // delete axios.defaults.headers.common.Authorization;
    },
  },
});
