/**
 * NotificationsPage — Manage notification templates.
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiClient } from "@/lib/api-client";
import { queryKeys } from "@/lib/query-keys";
import { PageHeader } from "@/components/common/PageHeader";
import { LoadingSpinner } from "@/components/common/LoadingSpinner";
import { ConfirmDialog } from "@/components/common/ConfirmDialog";
import { DataTable } from "@/components/common/DataTable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Edit } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import type { ColumnDef } from "@tanstack/react-table";
import type { NotificationTemplate } from "@/types/api";

const EVENT_TRIGGERS = [
  "workflow-execution.instance.created",
  "workflow-execution.transition.completed",
  "workflow-execution.instance.completed",
  "workflow-execution.instance.cancelled",
];

export default function NotificationsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<NotificationTemplate | null>(null);
  const [eventTrigger, setEventTrigger] = useState(EVENT_TRIGGERS[0]);
  const [channel, setChannel] = useState<"email" | "webhook">("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: templates, isLoading } = useQuery({
    queryKey: queryKeys.notificationTemplates.list(),
    queryFn: () => apiClient.get("/api/v1/notification-templates").then((r) => r.data.data as NotificationTemplate[]),
  });

  const resetForm = () => { setEventTrigger(EVENT_TRIGGERS[0]); setChannel("email"); setSubject(""); setBody(""); setIsActive(true); setEditing(null); };

  const createMut = useMutation({
    mutationFn: (data: any) => editing
      ? apiClient.put(`/api/v1/notification-templates/${editing.id}`, data)
      : apiClient.post("/api/v1/notification-templates", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notification-templates"] }); setOpen(false); resetForm(); toast.success(editing ? "Updated" : "Created"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/notification-templates/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["notification-templates"] }); toast.success("Deleted"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleEdit = (t: NotificationTemplate) => {
    setEditing(t); setEventTrigger(t.eventTrigger); setChannel(t.channel); setSubject(t.subjectTemplate || ""); setBody(t.bodyTemplate); setIsActive(t.isActive); setOpen(true);
  };

  const columns: ColumnDef<NotificationTemplate>[] = [
    { accessorKey: "eventTrigger", header: "Event Trigger" },
    {
      header: "Channel",
      cell: ({ row }) => <span className="text-xs px-2 py-0.5 rounded bg-muted capitalize">{row.original.channel}</span>,
    },
    {
      header: "Active",
      cell: ({ row }) => <span className={`text-xs ${row.original.isActive ? "text-status-active" : "text-muted-foreground"}`}>{row.original.isActive ? "Yes" : "No"}</span>,
    },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => handleEdit(row.original)}><Edit className="h-4 w-4" /></Button>
          <ConfirmDialog title="Delete Template" description="Delete this notification template?" confirmLabel="Delete" onConfirm={() => deleteMut.mutate(row.original.id)} trigger={<Button size="sm" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>} />
        </div>
      ),
    },
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Notification Templates" actions={
        <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); setOpen(o); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Template</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Template</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Event Trigger <span className="text-destructive">*</span></Label>
                <Select value={eventTrigger} onValueChange={setEventTrigger}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{EVENT_TRIGGERS.map((e) => <SelectItem key={e} value={e}>{e}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2"><Label>Channel</Label>
                <Select value={channel} onValueChange={(v) => setChannel(v as any)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="webhook">Webhook</SelectItem></SelectContent>
                </Select>
              </div>
              {channel === "email" && <div className="space-y-2"><Label>Subject Template</Label><Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Workflow moved to {{toState}}" /></div>}
              <div className="space-y-2"><Label>Body Template</Label><Textarea value={body} onChange={(e) => setBody(e.target.value)} className="font-mono text-sm" rows={5} /></div>
              <div className="flex items-center gap-2"><Label>Active</Label><Switch checked={isActive} onCheckedChange={setIsActive} /></div>
              <Button className="w-full" disabled={createMut.isPending || !body} onClick={() => createMut.mutate({ eventTrigger, channel, subjectTemplate: channel === "email" ? subject : undefined, bodyTemplate: body, isActive })}>
                {createMut.isPending ? "Saving…" : editing ? "Update" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      } />
      <DataTable columns={columns} data={templates ?? []} />
    </div>
  );
}
