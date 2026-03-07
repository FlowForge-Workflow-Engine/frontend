/**
 * SettingsPage — Tenant settings, plan info, and feature flags.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { apiClient } from "@/lib/api-client";
import { unwrap } from "@/lib/api-helpers";
import { queryKeys } from "@/lib/query-keys";
import { useAuthStore } from "@/stores/auth-store";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import type { Tenant, TenantSettings, FeatureFlag } from "@/types/api";

export default function SettingsPage() {
  const qc = useQueryClient();
  const tenantId = useAuthStore((s) => s.user?.tenantId) ?? "";

  // Tenant info
  const { data: tenant, isLoading: tLoading } = useQuery({
    queryKey: queryKeys.tenants.detail(tenantId),
    queryFn: () => apiClient.get(`/api/v1/tenants/${tenantId}`).then((r) => unwrap<Tenant>(r)),
    enabled: !!tenantId,
  });

  // Settings
  const { data: settings, isLoading: sLoading } = useQuery({
    queryKey: queryKeys.tenants.settings(tenantId),
    queryFn: () => apiClient.get(`/api/v1/tenants/${tenantId}/settings`).then((r) => unwrap<TenantSettings>(r)),
    enabled: !!tenantId,
  });

  // Feature flags
  const { data: flags } = useQuery({
    queryKey: queryKeys.tenants.featureFlags(tenantId),
    queryFn: () => apiClient.get(`/api/v1/tenants/${tenantId}/feature-flags`).then((r) => r.data.data as FeatureFlag[]),
    enabled: !!tenantId,
  });

  const [tenantName, setTenantName] = useState("");
  const [maxDefs, setMaxDefs] = useState(0);
  const [maxUsers, setMaxUsers] = useState(0);
  const [timezone, setTimezone] = useState("");
  const [newFlagKey, setNewFlagKey] = useState("");

  useEffect(() => { if (tenant) setTenantName(tenant.name); }, [tenant]);
  useEffect(() => {
    if (settings) {
      setMaxDefs(settings.maxWorkflowDefinitions);
      setMaxUsers(settings.maxUsers);
      setTimezone(settings.timezone);
    }
  }, [settings]);

  const updateTenant = useMutation({
    mutationFn: () => apiClient.patch(`/api/v1/tenants/${tenantId}`, { name: tenantName }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenants"] }); toast.success("Tenant updated"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateSettings = useMutation({
    mutationFn: () => apiClient.patch(`/api/v1/tenants/${tenantId}/settings`, { maxWorkflowDefinitions: maxDefs, maxUsers, timezone }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["tenants"] }); toast.success("Settings saved"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const toggleFlag = useMutation({
    mutationFn: ({ key, isEnabled }: { key: string; isEnabled: boolean }) =>
      apiClient.patch(`/api/v1/tenants/${tenantId}/feature-flags/${key}`, { isEnabled }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.tenants.featureFlags(tenantId) }),
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (tLoading || sLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Settings" />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 max-w-4xl">
        {/* Tenant Info */}
        <Card>
          <CardHeader><CardTitle className="text-base">Tenant Info</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant Name</Label>
              <Input value={tenantName} onChange={(e) => setTenantName(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Label>Plan</Label>
              <span className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary capitalize">{tenant?.plan || "free"}</span>
            </div>
            <Button size="sm" onClick={() => updateTenant.mutate()} disabled={updateTenant.isPending}>
              {updateTenant.isPending ? "Saving…" : "Save"}
            </Button>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card>
          <CardHeader><CardTitle className="text-base">Settings</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Max Workflow Definitions</Label>
              <Input type="number" value={maxDefs} onChange={(e) => setMaxDefs(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Max Users</Label>
              <Input type="number" value={maxUsers} onChange={(e) => setMaxUsers(Number(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Input value={timezone} onChange={(e) => setTimezone(e.target.value)} placeholder="UTC" />
            </div>
            <Button size="sm" onClick={() => updateSettings.mutate()} disabled={updateSettings.isPending}>
              {updateSettings.isPending ? "Saving…" : "Save Settings"}
            </Button>
          </CardContent>
        </Card>

        {/* Feature Flags */}
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Feature Flags</CardTitle></CardHeader>
          <CardContent>
            {(flags?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground mb-4">No feature flags yet.</p>
            ) : (
              <div className="space-y-3 mb-4">
                {flags?.map((f) => (
                  <div key={f.id} className="flex items-center justify-between py-2 border-b last:border-0">
                    <span className="text-sm font-mono">{f.key}</span>
                    <Switch checked={f.isEnabled} onCheckedChange={(v) => toggleFlag.mutate({ key: f.key, isEnabled: v })} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
