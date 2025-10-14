import CryptoJS from 'crypto-js'; // npm i crypto-js

// src/api/auth.ts
import axios from '#/api/request'; // 你的 axios 实例

export interface ApiResp<T = any> {
  code?: number;
  msg?: string;
  data?: T;
  // 或者一些接口返回 Head/AccountID 的格式，使用时按实际解析
}

/** 计算 MD5（小写 hex） */
export function md5Hex(str: string): string {
  return CryptoJS.MD5(str).toString();
}

/**
 * 构造签名字符串并计算 MD5
 * @param params 要参与签名的字段对象（key->value），注意：不会自动排除 sign 字段
 * @param secret 密钥字符串
 * @param options.secretKeyName 如果提供（如 "Charge_Key"），则按 &Charge_Key=<secret> 追加；否则按 &<secret> 追加
 */
export function buildSign(
  params: Record<string, boolean | number | string>,
  secret: string,
  options?: { secretKeyName?: string | undefined },
): { sign: string; signSource: string } {
  // 复制并只保留非空字符串 / number / boolean 的键（避免 undefined/null）
  const safeParams: Record<string, boolean | number | string> = {};
  Object.keys(params || {}).forEach((k) => {
    const v = params[k];
    if (v !== undefined && v !== null) safeParams[k] = v;
  });

  // 按字母顺序排序键
  const keys = Object.keys(safeParams).sort();
  const parts = keys.map((k) => `${k}=${String(safeParams[k])}`);
  // 拼接
  let signSource = parts.join('&');
  signSource +=
    options &&
    typeof options.secretKeyName === 'string' &&
    options.secretKeyName.length > 0
      ? `&${options.secretKeyName}=${secret}`
      : `&${secret}`;
  const sign = md5Hex(signSource);
  return { sign, signSource };
}

/**
 * 通用 Java 接口调用器（会对 params 做签名并把 sign 自动加入请求）
 * @param url 完整的请求 URL（含 host:port）
 * @param params 要发送的参数对象（会作为 body 的字段）
 * @param secret 签名密钥（字符串）
 * @param options 可选配置：
 *   - secretKeyName?: 如果要用 &Charge_Key=xxx 的形式，请设置为 'Charge_Key'
 *   - contentType?: 'form' | 'json' （默认 'form' -> x-www-form-urlencoded）
 *   - useSortedParamsForBody?: boolean （是否把排序后的 key/value 也用在 body 中；默认 true）
 */
export async function apiJavaPost(
  url: string,
  params: Record<string, any>,
  secret: string,
  options?: {
    contentType?: 'form' | 'json';
    secretKeyName?: string | undefined;
    useSortedParamsForBody?: boolean;
  },
) {
  const contentType = options?.contentType ?? 'form';
  const secretKeyName = options?.secretKeyName;
  // 构造签名：签名字段应基于 params 的键值（按字母排序）
  const { sign, signSource } = buildSign(params, secret, { secretKeyName });

  // 可以打印 signSource 方便后端比对（调试时打开）
  // console.log('[apiJavaPost] signSource:', signSource, ' sign:', sign);

  // 构造请求体：form -> application/x-www-form-urlencoded；json -> application/json
  if (contentType === 'form') {
    const body = new URLSearchParams();
    // 如果希望 body 中也按排序写入字段，启用 useSortedParamsForBody = true（默认 true）
    const keys =
      options?.useSortedParamsForBody === false
        ? Object.keys(params)
        : Object.keys(params).sort();
    keys.forEach((k) => {
      const v = params[k];
      if (v === undefined || v === null) return;
      body.append(k, String(v));
    });
    // append sign
    body.append('sign', sign);

    const tokenFromLS =
      typeof window === 'undefined' ? null : localStorage.getItem('TOKEN');
    const headersToSend: Record<string, string> = {
      'Content-Type': 'application/x-www-form-urlencoded',
    };
    if (tokenFromLS) headersToSend.Authorization = `Bearer ${tokenFromLS}`;

    console.log('[apiJavaPost] POST ->', url);
    console.log('[apiJavaPost] headersToSend =', headersToSend);
    console.log('[apiJavaPost] body =', body.toString ? body.toString() : body);

    return axios.post(url, body.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
  } else {
    // JSON body：把 sign 附加到 params 对象
    const bodyObj: Record<string, any> = { ...params };
    bodyObj.sign = sign;
    return axios.post(url, bodyObj, {
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
/**
 * 调用 NodeJS 的 ClientPack 登录（示例 URL，按你项目改）
 * node 接口一般接收 application/json
 * 返回的是 axios 的 Promise（调用处按 resp.data 解析）
 */
export function apiNodeClientLogin(sendPack: Record<string, any>) {
  const url = 'http://47.117.179.59:20002/ClientPack?Sign=ddcat';
  return axios.post(url, sendPack, {
    headers: { 'Content-Type': 'application/json' },
  });
}
/* ---------- 使用示例 ----------

1) 调 agentLogin (form, append secret without keyname)
await apiJavaPost(
  'http://47.117.179.59:9888/agentLogin',
  { accountID: 10607 },
  '33f77501874dbcd087ed565d9b511117',
  { contentType: 'form', secretKeyName: undefined }
);

2) 如果后端要求 &Charge_Key=secret 的形式：
await apiJavaPost(
  'http://47.117.179.59:9888/agentLogin',
  { accountID: 10607 },
  '33f77501874dbcd087ed565d9b511117',
  { contentType: 'form', secretKeyName: 'Charge_Key' }
);

3) JSON body 的 Java 接口（若接口期望 json 且在 body 中包含 sign）：
await apiJavaPost(
  'http://47.117.179.59:9888/someJsonApi',
  { accountID: 10607, otherParam: 'x' },
  'yourSecret',
  { contentType: 'json', secretKeyName: 'Charge_Key' }
);

注意：如果后端验签时也对 body 顺序敏感或需要对 urlencoded 的键顺序一致，请保持 options.useSortedParamsForBody = true（默认），这样生成 body 的键顺序与签名顺序一致。

----------------------------------- */

export default {
  md5Hex,
  buildSign,
  apiJavaPost,
  apiNodeClientLogin,
};
