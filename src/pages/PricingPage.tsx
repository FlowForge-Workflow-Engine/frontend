/**
 * PricingPage — Subscription plans with current plan indicator and upgrade.
 */
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { apiClient } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { PageHeader } from "@/components/common/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import { Check, ArrowLeft, Sparkles, Zap, Crown } from "lucide-react";
import { decodeJwt } from "@/utils/jwt";

const plans = [
  {
    key: "free",
    name: "Free",
    price: "$0",
    period: "/month",
    description: "Get started with basic workflow automation",
    icon: Sparkles,
    features: [
      "Up to 3 workflow definitions",
      "Up to 5 users",
      "Basic transitions & states",
      "Community support",
      "Email notifications",
    ],
  },
  {
    key: "starter",
    name: "Starter",
    price: "$29",
    period: "/month",
    description: "For growing teams that need more power",
    icon: Zap,
    popular: true,
    features: [
      "Up to 15 workflow definitions",
      "Up to 25 users",
      "Advanced transition rules",
      "Priority support",
      "Webhooks & integrations",
      "Version history",
    ],
  },
  {
    key: "professional",
    name: "Professional",
    price: "$99",
    period: "/month",
    description: "For organizations with complex workflows",
    icon: Crown,
    features: [
      "Unlimited workflow definitions",
      "Unlimited users",
      "Custom rule engine",
      "Dedicated support",
      "SSO & advanced security",
      "Audit log exports",
      "Custom integrations",
    ],
  },
];

export default function PricingPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user, accessToken, setTokens } = useAuthStore();
  const tenantId = user?.tenantId ?? "";
  const currentPlan = user?.plan?.toLowerCase() ?? "free";

  const upgradeMutation = useMutation({
    mutationFn: (plan: string) =>
      apiClient.patch(`/api/v1/tenants/${tenantId}`, { plan }),
    onSuccess: async (_res, plan) => {
      // Invalidate tenant cache so SettingsPage reflects the change
      qc.invalidateQueries({ queryKey: ["tenants"] });

      // Refresh tokens to get updated plan in JWT
      try {
        const refreshToken = useAuthStore.getState().refreshToken;
        const { data } = await apiClient.post("/api/v1/auth/refresh", { refreshToken });
        const newAccess = data.data?.accessToken ?? data.accessToken;
        const newRefresh = data.data?.refreshToken ?? data.refreshToken;
        setTokens(newAccess, newRefresh);

        // Update user info with new plan from refreshed JWT
        const decoded = decodeJwt(newAccess);
        if (decoded) {
          useAuthStore.getState().setSession(newAccess, newRefresh, {
            id: decoded.sub,
            email: decoded.email,
            firstName: decoded.firstName,
            tenantId: decoded.tenantId,
            tenantSlug: decoded.tenantSlug,
            roles: decoded.roles,
            roleIds: decoded.roleIds,
            plan: decoded.plan,
          });
        }
      } catch {
        // Token refresh failed — plan still updated server-side
      }

      toast.success(`Plan updated to ${plan}`);
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div>
      <PageHeader
        title="Choose Your Plan"
        subtitle="Select the plan that best fits your team's needs"
        actions={
          <Button variant="ghost" size="sm" onClick={() => navigate("/settings")}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back to Settings
          </Button>
        }
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl">
        {plans.map((plan) => {
          const isCurrent = currentPlan === plan.key;
          const Icon = plan.icon;

          return (
            <Card
              key={plan.key}
              className={`relative flex flex-col transition-all ${
                plan.popular
                  ? "border-primary shadow-lg ring-2 ring-primary/20"
                  : ""
              } ${isCurrent ? "border-primary/60 bg-primary/5" : ""}`}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  Most Popular
                </div>
              )}

              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
                  <Icon className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription className="text-sm">{plan.description}</CardDescription>
                <div className="mt-4">
                  <span className="text-4xl font-bold tracking-tight">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">{plan.period}</span>
                </div>
              </CardHeader>

              <CardContent className="flex-1 flex flex-col">
                <ul className="space-y-2.5 mb-6 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>
                    Current Plan
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => upgradeMutation.mutate(plan.key)}
                    disabled={upgradeMutation.isPending}
                  >
                    {upgradeMutation.isPending ? "Updating…" : "Select Plan"}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
