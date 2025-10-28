import { defineConfig } from '@vben/vite-config';

export default defineConfig(async () => {
  return {
    application: {},
    vite: {
      server: {
        // 端口按你本地 dev server 使用的端口设（你的页面是 localhost:5666）
        port: 5666,
        proxy: {
          // 所有以 /api 开头的请求转发到真实 Java 服务
          '/api': {
            target: 'http://47.117.179.59:9885',
            changeOrigin: true,
            secure: false,
            // 把 /api 前缀去掉（/api/agentPlayerList -> /agentPlayerList）
            rewrite: (path) => path.replace(/^\/api/, ''),
            // 在转发时把浏览器发来的 Authorization header 一并转发给目标服务器
            configure: (proxy) => {
              proxy.on('proxyReq', (proxyReq, req) => {
                // try {
                //   const auth = (req.headers['authorization'] || req.headers['Authorization']) as string | undefined;
                //   if (auth) proxyReq.setHeader('Authorization', auth);
                // } catch (e) {
                //   // 忽略错误
                // }
              });
            },
          },
        },
      },



      esbuild: { sourcemap: true },
    },
  };
});
