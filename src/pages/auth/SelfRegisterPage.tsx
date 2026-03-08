/**
 * SelfRegisterPage — An employee joins an existing tenant by slug.
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiClient, getCsrfHeaders } from "@/lib/api-client";
import { unwrap } from "@/lib/api-helpers";
import { useAuthStore } from "@/stores/auth-store";
import { decodeJwt } from "@/utils/jwt";
import { getErrorMessage } from "@/utils/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import type { RegisterUserResponse } from "@/types/api";

const schema = z
  .object({
    firstName: z.string().min(1).max(50),
    lastName: z.string().min(1).max(50),
    email: z.string().email(),
    password: z.string().min(8).max(32),
    confirmPassword: z.string(),
    tenantSlug: z.string().min(3).max(50),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

type FormData = z.infer<typeof schema>;

export default function SelfRegisterPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const mutation = useMutation({
    mutationFn: async (data: FormData) => {
      const { confirmPassword, ...body } = data;
      const csrfHeaders = await getCsrfHeaders();
      return unwrap<RegisterUserResponse>(
        await apiClient.post("/api/v1/auth/register", body, { headers: csrfHeaders }),
      );
    },
    onSuccess: (res) => {
      const jwt = decodeJwt(res.accessToken);
      localStorage.setItem("flowforge-tenantId", res.tenant.id);
      setSession(res.accessToken, res.refreshToken, {
        id: jwt.sub,
        email: jwt.email,
        firstName: jwt.firstName,
        tenantId: jwt.tenantId,
        tenantSlug: jwt.tenantSlug,
        roles: jwt.roles,
        roleIds: jwt.roleIds,
        plan: jwt.plan,
      });
      toast.success(`Welcome to FlowForge, ${res.user.firstName}! 🎉`);
      navigate("/dashboard");
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold text-lg mb-4">
            FF
          </div>
          <h1 className="text-2xl font-bold">Join your company</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Register as an employee of an existing workspace
          </p>
        </div>

        <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="space-y-4">
          {serverError && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              {serverError}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>First Name</Label>
              <Input {...register("firstName")} />
              {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
            </div>
            <div className="space-y-2">
              <Label>Last Name</Label>
              <Input {...register("lastName")} />
              {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Company Slug</Label>
            <Input {...register("tenantSlug")} placeholder="acme-corp" />
            <p className="text-xs text-muted-foreground">Ask your admin for this value</p>
            {errors.tenantSlug && <p className="text-xs text-destructive">{errors.tenantSlug.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...register("email")} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" {...register("password")} />
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <Input type="password" {...register("confirmPassword")} />
            {errors.confirmPassword && (
              <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>
            )}
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Joining…" : "Join Company"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
          <p>
            Creating a new company?{" "}
            <Link to="/register" className="text-primary hover:underline font-medium">
              Register
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
