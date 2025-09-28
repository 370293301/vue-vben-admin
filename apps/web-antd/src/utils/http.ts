// src/utils/http.ts
import axios from 'axios';

import { useAuthStore } from '#/store';

axios.interceptors.request.use((cfg) => {
  const token = useAuthStore().token;
  if (token) cfg.headers = { ...cfg.headers, Authorization: `Bearer ${token}` };
  return cfg;
});

export default axios;
