import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig, AxiosHeaders } from 'axios';

export interface ToastInstance {
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

let globalToast: ToastInstance | null = null;

export const setGlobalToast = (toastInstance: ToastInstance | null) => {
  globalToast = toastInstance;
};

const getBaseURL = () => {
  if (typeof window !== 'undefined') {
    return process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
  }
  return process.env.API_URL || 'http://localhost:4000';
};

const apiClient: AxiosInstance = axios.create({
  baseURL: getBaseURL(),
  headers: { Accept: 'application/json' },
  timeout: 30_000,
  withCredentials: true,
});

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];
let hasRedirectedToLogin = false;

const REFRESH_ENDPOINT = '/auth/refresh-token';

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('accessToken');
      if (token) {
        if (!config.headers) config.headers = new AxiosHeaders();
        config.headers.set('Authorization', `Bearer ${token}`);
      }
    }
    if (!(config.data instanceof FormData)) {
      if (!config.headers) config.headers = new AxiosHeaders();
      config.headers.set('Content-Type', 'application/json');
    }
    return config;
  },
  err => Promise.reject(err)
);

apiClient.interceptors.response.use(
  res => res,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !originalRequest._retry && originalRequest.url !== REFRESH_ENDPOINT) {
      originalRequest._retry = true;
      if (!isRefreshing) {
        isRefreshing = true;
        try {
          const { data } = await apiClient.post<{ accessToken: string }>(REFRESH_ENDPOINT);
          localStorage.setItem('accessToken', data.accessToken);
          apiClient.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`;
          refreshSubscribers.forEach(cb => cb(data.accessToken));
          refreshSubscribers = [];
          if (!originalRequest.headers) originalRequest.headers = new AxiosHeaders();
          originalRequest.headers.set('Authorization', `Bearer ${data.accessToken}`);
          return apiClient(originalRequest);
        } catch (refreshError) {
          localStorage.removeItem('accessToken');
          delete apiClient.defaults.headers.common['Authorization'];
          if (!hasRedirectedToLogin) {
            hasRedirectedToLogin = true;
            if (globalToast) globalToast.warning('Session Expired', 'Please log in again.');
            setTimeout(() => { window.location.href = '/login'; }, 100);
          }
          return Promise.reject(refreshError);
        } finally {
          isRefreshing = false;
        }
      }
    }
    if (globalToast && error.response?.status !== 401) {
      const msg = (error.response?.data as any)?.message || 'An error occurred';
      globalToast.error('Error', msg);
    }
    return Promise.reject(error);
  }
);

export function setAccessToken(token: string) {
  localStorage.setItem('accessToken', token);
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  hasRedirectedToLogin = false;
}

export function clearAccessToken() {
  localStorage.removeItem('accessToken');
  delete apiClient.defaults.headers.common['Authorization'];
}

export function showSuccessToast(title: string, message?: string) {
  if (globalToast) globalToast.success(title, message);
}

export function showWarningToast(title: string, message?: string) {
  if (globalToast) globalToast.warning(title, message);
}

export function showInfoToast(title: string, message?: string) {
  if (globalToast) globalToast.info(title, message);
}

export default apiClient;