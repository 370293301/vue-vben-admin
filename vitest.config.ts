import Vue from '@vitejs/plugin-vue';
import VueJsx from '@vitejs/plugin-vue-jsx';
import { configDefaults, defineConfig } from 'vitest/config';

console.log('vue.vite.js loaded');
export default defineConfig({
  plugins: [Vue(), VueJsx()],
  test: {
    environment: 'happy-dom',
    exclude: [...configDefaults.exclude, '**/e2e/**'],
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5566', // 后端接口地址
        changeOrigin: true, // 修改请求头中的 Origin 字段，解决跨域问题
        secure: false, // 如果后端使用 HTTP 协议，设置为 false
        rewrite: (path) => path.replace(/^\/api/, ''), // 去掉 /api 前缀
      },
    },
  },
});
