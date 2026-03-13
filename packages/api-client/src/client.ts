import axios, { AxiosInstance } from 'axios';

export interface ApiClientConfig {
  baseURL: string;
  timeout?: number;
  onUnauthorized?: () => void;
}

export class ApiClient {
  private client: AxiosInstance;
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: `${config.baseURL}/api`,
      headers: { 'Content-Type': 'application/json' },
      timeout: config.timeout || 30000,
    });

    this.setupInterceptors();
  }

  private setupInterceptors() {
    // Request interceptor — attach JWT token
    this.client.interceptors.request.use((config) => {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    });

    // Response interceptor — handle 401 + extract data
    this.client.interceptors.response.use(
      (response) => response.data,
      async (error) => {
        if (error.response?.status === 401) {
          // Try refresh token
          const refreshToken = localStorage.getItem('refreshToken');
          if (refreshToken && !error.config._retry) {
            error.config._retry = true;
            try {
              const res = await axios.post(`${this.config.baseURL}/auth/refresh`, { refreshToken });
              const { token, refreshToken: newRefresh } = res.data.data;
              localStorage.setItem('token', token);
              localStorage.setItem('refreshToken', newRefresh);
              error.config.headers.Authorization = `Bearer ${token}`;
              return this.client(error.config);
            } catch {
              localStorage.removeItem('token');
              localStorage.removeItem('refreshToken');
              if (this.config.onUnauthorized) {
                this.config.onUnauthorized();
              }
            }
          } else {
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            if (this.config.onUnauthorized) {
              this.config.onUnauthorized();
            }
          }
        }
        return Promise.reject(error.response?.data || error);
      }
    );
  }

  get<T = any>(url: string, params?: any): Promise<T> {
    return this.client.get(url, { params });
  }

  post<T = any>(url: string, data?: any): Promise<T> {
    return this.client.post(url, data);
  }

  put<T = any>(url: string, data?: any): Promise<T> {
    return this.client.put(url, data);
  }

  patch<T = any>(url: string, data?: any): Promise<T> {
    return this.client.patch(url, data);
  }

  delete<T = any>(url: string): Promise<T> {
    return this.client.delete(url);
  }
}
