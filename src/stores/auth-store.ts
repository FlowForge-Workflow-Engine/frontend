/**
 * Auth Store — Zustand store for authentication state.
 * Persists tokens and user info to localStorage.
 */
import { create } from "zustand";
import { persist } from "zustand/middleware";

/** Shape of the authenticated user extracted from JWT */
export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  tenantId: string;
  tenantSlug: string;
  roles: string[];
  roleIds: string[];
  plan: string;
}

interface AuthStore {
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;
  /** Sets the full session after login/register */
  setSession: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  /** Updates only the token pair (used by refresh interceptor) */
  setTokens: (accessToken: string, refreshToken: string) => void;
  /** Clears session and redirects to login */
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      setSession: (accessToken, refreshToken, user) =>
        set({ accessToken, refreshToken, user, isAuthenticated: true }),

      setTokens: (accessToken, refreshToken) =>
        set({ accessToken, refreshToken }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: "flowforge-auth",
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
