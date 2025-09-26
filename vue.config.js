// vue.config.js
console.log('vue.config.js loaded');
module.exports = {
  devServer: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5566',  // 后端接口地址
        changeOrigin: true,
        secure: false,  // 如果后端使用 HTTP 协议，设置为 false
        pathRewrite: {
          '^/api': '',  // 去掉前缀 /api
        },
      },
    },
  },
};
