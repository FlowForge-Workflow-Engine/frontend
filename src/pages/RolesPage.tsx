/**
 * RolesPage — Role management with card grid and create dialog.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { EmptyState } from "@/components/common/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Shield } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import type { Role } from "@/types/api";

const schema = z.object({
  name: z.string().min(1, "Required"),
  description: z.string().optional(),
});

export default function RolesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: roles, isLoading } = useQuery({
    queryKey: queryKeys.roles.list(),
    queryFn: () => apiClient.get("/api/v1/roles").then((r) => r.data.data as Role[]),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiClient.post("/api/v1/roles", body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["roles"] }); setOpen(false); reset(); toast.success("Role created"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Roles"
        actions={
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Create Role</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Create Role</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
                <div className="space-y-2"><Label>Name <span className="text-destructive">*</span></Label><Input {...register("name")} />{errors.name && <p className="text-xs text-destructive">{String(errors.name.message)}</p>}</div>
                <div className="space-y-2"><Label>Description</Label><Textarea {...register("description")} /></div>
                <p className="text-xs text-muted-foreground">System roles (Admin, Approver, Requestor, Viewer) are created automatically and cannot be deleted.</p>
                <Button type="submit" className="w-full" disabled={createMut.isPending}>{createMut.isPending ? "Creating…" : "Create Role"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      {(roles?.length ?? 0) === 0 ? (
        <EmptyState icon={Shield} title="No roles" description="Roles are created automatically when your tenant is set up." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {roles?.map((role) => (
            <Card key={role.id}>
              <CardContent className="p-5">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold">{role.name}</h3>
                  {role.isSystemRole && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-muted text-muted-foreground">System</span>
                  )}
                </div>
                {role.description && <p className="text-sm text-muted-foreground">{role.description}</p>}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
