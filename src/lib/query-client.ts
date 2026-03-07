/**
 * TanStack Query Client — Global query configuration.
 */
import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2, // 2 minutes
      retry: (count, err: any) => {
        if (err?.response?.status === 401) return false;
        if (err?.response?.status === 403) return false;
        if (err?.response?.status === 404) return false;
        return count < 2;
      },
    },
  },
});
