import request from './request';

export interface SysUser {
  id: number;
  username: string;
  role: string;
  email: string;
  phone: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UserListParams {
  page?: number;
  size?: number;
  role?: string;
  status?: string;
}

export interface UserListResult {
  list: SysUser[];
  total: number;
}

export interface CreateUserParams {
  username: string;
  password: string;
  role?: string;
  email?: string;
  phone?: string;
}

export interface UpdateUserParams {
  username?: string;
  role?: string;
  email?: string;
  phone?: string;
  status?: string;
  password?: string;
}

/** 获取用户列表 */
export async function getUsers(params?: UserListParams): Promise<UserListResult> {
  const res = await request.get('/users', { params });
  const body = res as any;
  const data = body?.data || body;
  return {
    list: data?.list || [],
    total: data?.total || 0,
  };
}

/** 创建用户 */
export async function createUser(params: CreateUserParams): Promise<void> {
  await request.post('/users', params);
}

/** 更新用户 */
export async function updateUser(id: number, params: UpdateUserParams): Promise<void> {
  await request.put(`/users/${id}`, params);
}

/** 删除用户 */
export async function deleteUser(id: number): Promise<void> {
  await request.delete(`/users/${id}`);
}
