/**
 * API Client — Axios instance with JWT interceptors and auto-refresh.
 */
import axios from "axios";
import { useAuthStore } from "@/stores/auth-store";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const defaultHeaders = {
  "Content-Type": "application/json",
  // "ngrok-skip-browser-warning": "true",
};

const csrfClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: defaultHeaders,
});

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: defaultHeaders,
});

const extractCsrfToken = (responseData: unknown) => {
  if (!responseData || typeof responseData !== "object") return null;

  const payload = responseData as {
    csrfToken?: unknown;
    token?: unknown;
    data?: {
      csrfToken?: unknown;
      token?: unknown;
    };
  };

  const token = payload.data?.csrfToken ?? payload.data?.token ?? payload.csrfToken ?? payload.token;
  return typeof token === "string" && token.trim() ? token : null;
};

export const getCsrfHeaders = async () => {
  const response = await csrfClient.get("/api/v1/csrf-token", {
    headers: {
      "Cache-Control": "no-cache",
    },
  });

  const csrfToken = extractCsrfToken(response.data);
  if (!csrfToken) {
    throw new Error("CSRF token was not returned by /api/v1/csrf-token");
  }

  return {
    "X-CSRF-Token": csrfToken,
  };
};

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
        const csrfHeaders = await getCsrfHeaders();
        const { data } = await apiClient.post(
          "/api/v1/auth/refresh",
          { refreshToken },
          { headers: csrfHeaders },
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
