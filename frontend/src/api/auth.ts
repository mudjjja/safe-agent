import request, { setToken } from './request';

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user?: {
    username: string;
    role: string;
  };
}

export async function login(params: LoginParams): Promise<LoginResult> {
  const res = await request.post('/login', params);
  // 兼容不同返回格式: { code:0, data: { token } } 或 { token }
  const data = (res as any)?.data || res;
  if (data.token) {
    setToken(data.token);
  }
  return data;
}

export async function logout(): Promise<void> {
  localStorage.removeItem('kylin_admin_token');
}

export function isLoggedIn(): boolean {
  return !!localStorage.getItem('kylin_admin_token');
}
