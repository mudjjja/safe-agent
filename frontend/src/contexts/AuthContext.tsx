import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { login as loginApi, logout as logoutApi, isLoggedIn } from '../api/auth';

interface User {
  username: string;
  role: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  isAuthenticated: false,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 页面刷新时检查是否有 token
    if (isLoggedIn()) {
      // 可以从 token 解码用户信息，或调 /auth/me 接口
      // 简单起见，从 localStorage 恢复一个基本用户对象
      const savedUser = localStorage.getItem('kylin_admin_user');
      if (savedUser) {
        try { setUser(JSON.parse(savedUser)); } catch { /* ignore */ }
      } else {
        setUser({ username: 'admin', role: 'admin' });
      }
    }
    setLoading(false);
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const result = await loginApi({ username, password });
    const userInfo = result.user || { username, role: 'admin' };
    setUser(userInfo);
    localStorage.setItem('kylin_admin_user', JSON.stringify(userInfo));
  }, []);

  const logout = useCallback(() => {
    logoutApi();
    setUser(null);
    localStorage.removeItem('kylin_admin_user');
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
