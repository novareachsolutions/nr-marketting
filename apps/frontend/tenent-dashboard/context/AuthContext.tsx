import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { apiClient, setAccessToken, clearAccessToken } from '@repo/shared-frontend';

interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  plan: string;
  isEmailVerified: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<string>;
  logout: () => Promise<void>;
  forgotPassword: (email: string) => Promise<string>;
  resetPassword: (token: string, newPassword: string) => Promise<string>;
  resendVerification: (email: string) => Promise<string>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchMe = useCallback(async () => {
    try {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsLoading(false);
        return;
      }
      const { data } = await apiClient.get('/auth/me');
      if (data.success) {
        setUser(data.data);
      }
    } catch {
      clearAccessToken();
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const login = async (email: string, password: string) => {
    const { data } = await apiClient.post('/auth/login', { email, password });
    if (data.success) {
      setAccessToken(data.data.accessToken);
      setUser(data.data.user);
    } else {
      throw new Error(data.message || 'Login failed');
    }
  };

  const register = async (email: string, password: string, name?: string) => {
    const { data } = await apiClient.post('/auth/register', { email, password, name });
    if (data.success) {
      return data.data.message;
    }
    throw new Error(data.message || 'Registration failed');
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // logout even if API fails
    } finally {
      clearAccessToken();
      setUser(null);
    }
  };

  const forgotPassword = async (email: string) => {
    const { data } = await apiClient.post('/auth/forgot-password', { email });
    if (data.success) return data.data.message;
    throw new Error(data.message || 'Request failed');
  };

  const resetPassword = async (token: string, newPassword: string) => {
    const { data } = await apiClient.post('/auth/reset-password', { token, newPassword });
    if (data.success) return data.data.message;
    throw new Error(data.message || 'Reset failed');
  };

  const resendVerification = async (email: string) => {
    const { data } = await apiClient.post('/auth/resend-verification', { email });
    if (data.success) return data.data.message;
    throw new Error(data.message || 'Request failed');
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        forgotPassword,
        resetPassword,
        resendVerification,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
