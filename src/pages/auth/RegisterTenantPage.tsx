/**
 * RegisterTenantPage — Onboard a new company and its first admin user.
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
import type { RegisterTenantResponse } from "@/types/api";

const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*[\d\W]).{8,32}$/;

const registerSchema = z
  .object({
    tenantName: z.string().min(2, "Min 2 chars").max(100),
    tenantSlug: z
      .string()
      .min(3, "Min 3 chars")
      .max(50)
      .regex(/^[a-z0-9-]+$/, "Lowercase, numbers, hyphens only"),
    firstName: z.string().min(1, "Required").max(50),
    lastName: z.string().min(1, "Required").max(50),
    email: z.string().email("Enter a valid email"),
    password: z.string().regex(passwordRegex, "8–32 chars, upper + lower + number/special"),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords must match",
    path: ["confirmPassword"],
  });

type RegisterForm = z.infer<typeof registerSchema>;

export default function RegisterTenantPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
  });

  const slug = watch("tenantSlug");
  const password = watch("password");

  // Simple password strength
  const getStrength = (p: string): { label: string; width: string; color: string } => {
    if (!p) return { label: "", width: "0%", color: "" };
    let score = 0;
    if (p.length >= 8) score++;
    if (/[A-Z]/.test(p)) score++;
    if (/[a-z]/.test(p)) score++;
    if (/[\d\W]/.test(p)) score++;
    if (score <= 1) return { label: "Weak", width: "25%", color: "bg-destructive" };
    if (score === 2) return { label: "Fair", width: "50%", color: "bg-status-draft" };
    if (score === 3) return { label: "Good", width: "75%", color: "bg-status-completed" };
    return { label: "Strong", width: "100%", color: "bg-status-active" };
  };

  const strength = getStrength(password || "");

  const mutation = useMutation({
    mutationFn: async (data: RegisterForm) => {
      const { confirmPassword, ...body } = data;
      return unwrap<RegisterTenantResponse>(
        await apiClient.post("/api/v1/auth/register/tenant", body)
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
          <h1 className="text-2xl font-bold">Create your company</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Set up a new FlowForge workspace
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
            <Label>Company Name</Label>
            <Input {...register("tenantName")} placeholder="Acme Corporation" />
            {errors.tenantName && <p className="text-xs text-destructive">{errors.tenantName.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Company Slug</Label>
            <Input {...register("tenantSlug")} placeholder="acme-corp" />
            {slug && (
              <p className="text-xs text-muted-foreground">
                your-app.flowforge.io/<span className="font-medium text-foreground">{slug}</span>
              </p>
            )}
            {errors.tenantSlug && <p className="text-xs text-destructive">{errors.tenantSlug.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Email</Label>
            <Input type="email" {...register("email")} placeholder="you@company.com" />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Password</Label>
            <Input type="password" {...register("password")} />
            {password && (
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${strength.color}`}
                    style={{ width: strength.width }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">{strength.label}</p>
              </div>
            )}
            {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
          </div>

          <div className="space-y-2">
            <Label>Confirm Password</Label>
            <Input type="password" {...register("confirmPassword")} />
            {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword.message}</p>}
          </div>

          <Button type="submit" className="w-full" disabled={mutation.isPending}>
            {mutation.isPending ? "Creating…" : "Create Company"}
          </Button>
        </form>

        <div className="text-center text-sm text-muted-foreground space-y-1">
          <p>
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
          <p>
            Joining an existing company?{" "}
            <Link to="/register/join" className="text-primary hover:underline font-medium">Join here</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
