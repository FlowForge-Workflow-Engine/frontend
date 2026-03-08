/**
 * API Client — Axios instance with JWT interceptors and auto-refresh.
 */
import axios, { AxiosHeaders } from "axios";
import { useAuthStore } from "@/stores/auth-store";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

const defaultHeaders = {
  "Content-Type": "application/json",
  // "ngrok-skip-browser-warning": "true",
};

const CSRF_PROTECTED_METHODS = new Set(["post", "put", "patch", "delete"]);

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

// Request interceptor — attach JWT token and CSRF token for mutating requests
apiClient.interceptors.request.use(async (config) => {
  const headers = AxiosHeaders.from(config.headers);
  const token = useAuthStore.getState().accessToken;

  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const method = (config.method ?? "get").toLowerCase();
  if (CSRF_PROTECTED_METHODS.has(method) && !headers.has("X-CSRF-Token")) {
    const csrfHeaders = await getCsrfHeaders();
    headers.set("X-CSRF-Token", csrfHeaders["X-CSRF-Token"]);
  }

  config.headers = headers;
  return config;
});

// Response interceptor — auto refresh on 401
apiClient.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;

    if (!original) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !original._retry && original.url !== "/api/v1/auth/refresh") {
      original._retry = true;

      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await apiClient.post("/api/v1/auth/refresh", { refreshToken });

        // Update tokens from the refresh response
        const newAccess = data.data?.accessToken ?? data.accessToken;
        const newRefresh = data.data?.refreshToken ?? data.refreshToken;
        useAuthStore.getState().setTokens(newAccess, newRefresh);

        const headers = AxiosHeaders.from(original.headers);
        headers.set("Authorization", `Bearer ${newAccess}`);
        original.headers = headers;

        return apiClient(original);
      } catch {
        useAuthStore.getState().logout();
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);
