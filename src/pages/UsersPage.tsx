/**
 * UsersPage — User management with add, role assignment, and deactivation.
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
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Shield, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import { formatDate } from "@/utils/format-date";
import type { ColumnDef } from "@tanstack/react-table";
import type { User, Role } from "@/types/api";

const createUserSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

export default function UsersPage() {
  const qc = useQueryClient();
  const [page, setPage] = useState(1);
  const [addOpen, setAddOpen] = useState(false);
  const [roleDialogUser, setRoleDialogUser] = useState<User | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const limit = 20;

  const queryParams = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.users.list({ page, limit }),
    queryFn: () => apiClient.get(`/api/v1/users?${queryParams}`),
    select: (res) => ({ items: res.data.data as User[], count: res.data.count as number }),
  });

  const { data: roles } = useQuery({
    queryKey: queryKeys.roles.list(),
    queryFn: () => apiClient.get("/api/v1/roles").then((r) => r.data.data as Role[]),
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(createUserSchema),
  });

  const createMut = useMutation({
    mutationFn: (body: any) => apiClient.post("/api/v1/users", body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setAddOpen(false);
      reset();
      toast.success("User created");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deactivateMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deactivated");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const assignRoleMut = useMutation({
    mutationFn: ({ userId, roleId }: { userId: string; roleId: string }) =>
      apiClient.post(`/api/v1/users/${userId}/roles`, { roleId }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      setRoleDialogUser(null);
      toast.success("Role assigned");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const columns: ColumnDef<User>[] = [
    { header: "Name", cell: ({ row }) => `${row.original.firstName} ${row.original.lastName}` },
    { accessorKey: "email", header: "Email" },
    {
      header: "Roles",
      cell: ({ row }) => (
        <div className="flex gap-1 flex-wrap">
          {row.original.roles?.map((r) => (
            <span key={r.id} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
              {r.name}
            </span>
          ))}
        </div>
      ),
    },
    {
      header: "Status",
      cell: ({ row }) => (
        <span
          className={`inline-flex items-center gap-1.5 text-xs ${row.original.isActive ? "text-status-active" : "text-muted-foreground"}`}
        >
          <span
            className={`w-2 h-2 rounded-full ${row.original.isActive ? "bg-status-active" : "bg-muted-foreground"}`}
          />
          {row.original.isActive ? "Active" : "Inactive"}
        </span>
      ),
    },
    {
      header: "Last Login",
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground">
          {row.original.lastLoginAt ? formatDate(row.original.lastLoginAt) : "Never"}
        </span>
      ),
    },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setRoleDialogUser(row.original);
              setSelectedRoleId("");
            }}
          >
            <Shield className="h-4 w-4" />
          </Button>
          <ConfirmDialog
            title="Deactivate User"
            description={`Deactivate ${row.original.firstName} ${row.original.lastName}? They will no longer be able to log in.`}
            confirmLabel="Deactivate"
            onConfirm={() => deactivateMut.mutate(row.original.id)}
            trigger={
              <Button size="sm" variant="ghost">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            }
          />
        </div>
      ),
    },
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader
        title="Users"
        actions={
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add User</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit((d) => createMut.mutate(d))} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>First Name <span className="text-destructive">*</span></Label>
                    <Input {...register("firstName")} />
                    {errors.firstName && (
                      <p className="text-xs text-destructive">{String(errors.firstName.message)}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Last Name <span className="text-destructive">*</span></Label>
                    <Input {...register("lastName")} />
                    {errors.lastName && (
                      <p className="text-xs text-destructive">{String(errors.lastName.message)}</p>
                    )}
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" {...register("email")} />
                  {errors.email && <p className="text-xs text-destructive">{String(errors.email.message)}</p>}
                </div>
                <div className="space-y-2">
                  <Label>Password</Label>
                  <Input type="password" {...register("password")} />
                  {errors.password && (
                    <p className="text-xs text-destructive">{String(errors.password.message)}</p>
                  )}
                </div>
                <Button type="submit" className="w-full" disabled={createMut.isPending}>
                  {createMut.isPending ? "Creating…" : "Create User"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        }
      />

      <DataTable
        columns={columns}
        data={data?.items ?? []}
        totalCount={data?.count}
        page={page}
        pageSize={limit}
        onPageChange={setPage}
      />

      {/* Assign Role Dialog */}
      <Dialog open={!!roleDialogUser} onOpenChange={(open) => !open && setRoleDialogUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Role to {roleDialogUser?.firstName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex gap-1 flex-wrap">
              {roleDialogUser?.roles?.map((r) => (
                <span key={r.id} className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                  {r.name}
                </span>
              ))}
            </div>
            <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles?.map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              className="w-full"
              disabled={!selectedRoleId || assignRoleMut.isPending}
              onClick={() => assignRoleMut.mutate({ userId: roleDialogUser!.id, roleId: selectedRoleId })}
            >
              {assignRoleMut.isPending ? "Assigning…" : "Assign Role"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
