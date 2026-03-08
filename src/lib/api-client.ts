/**
 * API Client — Axios instance with JWT interceptors and auto-refresh.
 */
import axios from "axios";
import { useAuthStore } from "@/stores/auth-store";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "",
  headers: {
    "Content-Type": "application/json",
    // "ngrok-skip-browser-warning": "true",
  },
});

// Request interceptor — attach JWT token
apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Response interceptor — auto refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      original._retry = true;
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await apiClient.post(
          "/api/v1/auth/refresh",
          { refreshToken },
          // { headers: { "ngrok-skip-browser-warning": "true" } },
        );
        // Update tokens from the refresh response
        const newAccess = data.data?.accessToken ?? data.accessToken;
        const newRefresh = data.data?.refreshToken ?? data.refreshToken;
        useAuthStore.getState().setTokens(newAccess, newRefresh);
        original.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
