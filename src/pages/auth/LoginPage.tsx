/**
 * LoginPage — Authenticate a returning user.
 * Requires email, password, and tenantId (UUID).
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { unwrap } from "@/lib/api-helpers";
import { useAuthStore } from "@/stores/auth-store";
import { decodeJwt } from "@/utils/jwt";
import { getErrorMessage } from "@/utils/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Info } from "lucide-react";
import type { LoginResponse } from "@/types/api";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
  tenantId: z.string().uuid("Must be a valid UUID"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      tenantId: localStorage.getItem("flowforge-tenantId") || "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginForm) => {
      // Login
      const loginRes = unwrap<LoginResponse>(await apiClient.post("/api/v1/auth/login", data));

      // Save tenantId for future logins
      localStorage.setItem("flowforge-tenantId", data.tenantId);

      // Fetch user profile
      const meRes = unwrap<any>(
        await apiClient.get("/api/v1/auth/me", {
          headers: { Authorization: `Bearer ${loginRes.accessToken}` },
        }),
      );

      return { tokens: loginRes, profile: meRes };
    },
    onSuccess: ({ tokens }) => {
      const jwt = decodeJwt(tokens.accessToken);
      setSession(tokens.accessToken, tokens.refreshToken, {
        id: jwt.sub,
        email: jwt.email,
        firstName: jwt.firstName,
        tenantId: jwt.tenantId,
        tenantSlug: jwt.tenantSlug,
        roles: jwt.roles,
        roleIds: jwt.roleIds,
        plan: jwt.plan,
      });
      toast.success(`Welcome back, ${jwt.firstName}!`);
      navigate("/dashboard");
    },
    onError: (err) => {
      setServerError(getErrorMessage(err));
    },
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Logo */}
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg mb-4">
            FF
          </div>
          <h1 className="text-2xl font-bold">Sign in to FlowForge</h1>
          <p className="text-sm text-muted-foreground mt-1">Enter your credentials to continue</p>
        </div>

        <form onSubmit={handleSubmit((data) => loginMutation.mutate(data))} className="space-y-4">
          {serverError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
            <Input id="email" type="email" placeholder="you@company.com" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="tenantId">Tenant ID <span className="text-destructive">*</span></Label>
            <Input id="tenantId" placeholder="Your company's Tenant ID (UUID)" {...register("tenantId")} />
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Info className="h-6 w-6" />
              Admins receive this when their account is created. For other roles, please contact your admin to
              get the Tenant ID.
            </div>
            {errors.tenantId && <p className="text-xs text-destructive">{errors.tenantId.message}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" placeholder="••••••••" {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={loginMutation.isPending}>
            {loginMutation.isPending ? "Signing in…" : "Sign In"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>
            Don't have an account?{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Register
            </Link>
          </p>
          <p>
            Joining a company?{" "}
            <Link to="/register/join" className="text-primary hover:underline font-medium">
              Join existing
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
