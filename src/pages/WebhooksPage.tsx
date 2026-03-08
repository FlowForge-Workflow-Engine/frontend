/**
 * WebhooksPage — Manage webhook configurations.
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2, Edit, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { getErrorMessage } from "@/utils/error-messages";
import type { ColumnDef } from "@tanstack/react-table";
import type { WebhookConfig } from "@/types/api";

const EVENTS = [
  "workflow-execution.instance.created",
  "workflow-execution.transition.completed",
  "workflow-execution.instance.completed",
  "workflow-execution.instance.cancelled",
];

export default function WebhooksPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WebhookConfig | null>(null);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [secret, setSecret] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [events, setEvents] = useState<string[]>([]);
  const [isActive, setIsActive] = useState(true);

  const { data: webhooks, isLoading } = useQuery({
    queryKey: queryKeys.webhookConfigs.list(),
    queryFn: () => apiClient.get("/api/v1/webhook-configs").then((r) => r.data.data as WebhookConfig[]),
  });

  const resetForm = () => { setName(""); setUrl(""); setSecret(""); setEvents([]); setIsActive(true); setEditing(null); setShowSecret(false); };

  const saveMut = useMutation({
    mutationFn: (data: any) => editing
      ? apiClient.put(`/api/v1/webhook-configs/${editing.id}`, data)
      : apiClient.post("/api/v1/webhook-configs", data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhook-configs"] }); setOpen(false); resetForm(); toast.success(editing ? "Updated" : "Created"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => apiClient.delete(`/api/v1/webhook-configs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["webhook-configs"] }); toast.success("Deleted"); },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const handleEdit = (w: WebhookConfig) => {
    setEditing(w); setName(w.name); setUrl(w.url); setSecret(w.secret); setEvents(w.eventTriggers); setIsActive(w.isActive); setOpen(true);
  };

  const toggleEvent = (ev: string) => {
    setEvents((prev) => prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev]);
  };

  const columns: ColumnDef<WebhookConfig>[] = [
    { accessorKey: "name", header: "Name" },
    { header: "URL", cell: ({ row }) => <span className="text-xs font-mono truncate max-w-[200px] block">{row.original.url}</span> },
    { header: "Events", cell: ({ row }) => <span className="text-xs px-2 py-0.5 rounded bg-muted">{row.original.eventTriggers?.length ?? 0}</span> },
    { header: "Active", cell: ({ row }) => <span className={`text-xs ${row.original.isActive ? "text-status-active" : "text-muted-foreground"}`}>{row.original.isActive ? "Yes" : "No"}</span> },
    {
      header: "Actions",
      cell: ({ row }) => (
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => handleEdit(row.original)}><Edit className="h-4 w-4" /></Button>
          <ConfirmDialog title="Delete Webhook" description="Delete this webhook config?" confirmLabel="Delete" onConfirm={() => deleteMut.mutate(row.original.id)} trigger={<Button size="sm" variant="ghost"><Trash2 className="h-4 w-4 text-destructive" /></Button>} />
        </div>
      ),
    },
  ];

  if (isLoading) return <LoadingSpinner />;

  return (
    <div>
      <PageHeader title="Webhook Configs" actions={
        <Dialog open={open} onOpenChange={(o) => { if (!o) resetForm(); setOpen(o); }}>
          <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Webhook</Button></DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>{editing ? "Edit" : "Add"} Webhook</DialogTitle></DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2"><Label>Name <span className="text-destructive">*</span></Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
              <div className="space-y-2"><Label>URL <span className="text-destructive">*</span></Label><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://..." /></div>
              <div className="space-y-2">
                <Label>Secret <span className="text-destructive">*</span></Label>
                <div className="relative">
                  <Input type={showSecret ? "text" : "password"} value={secret} onChange={(e) => setSecret(e.target.value)} />
                  <button type="button" className="absolute right-2 top-1/2 -translate-y-1/2" onClick={() => setShowSecret(!showSecret)}>
                    {showSecret ? <EyeOff className="h-4 w-4 text-muted-foreground" /> : <Eye className="h-4 w-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Event Triggers</Label>
                {EVENTS.map((ev) => (
                  <label key={ev} className="flex items-center gap-2 text-sm">
                    <Checkbox checked={events.includes(ev)} onCheckedChange={() => toggleEvent(ev)} />
                    {ev}
                  </label>
                ))}
              </div>
              <div className="flex items-center gap-2"><Label>Active</Label><Switch checked={isActive} onCheckedChange={setIsActive} /></div>
              <Button className="w-full" disabled={saveMut.isPending || !name || !url || !secret} onClick={() => saveMut.mutate({ name, url, secret, eventTriggers: events, isActive })}>
                {saveMut.isPending ? "Saving…" : editing ? "Update" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      } />
      <DataTable columns={columns} data={webhooks ?? []} />
    </div>
  );
}
