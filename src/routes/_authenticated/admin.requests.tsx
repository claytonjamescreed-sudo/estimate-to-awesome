import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Bug, Sparkles, HelpCircle, Trash2, ExternalLink, CheckCircle2, GitCommit, Copy } from "lucide-react";

function buildPrompt(r: Req): string {
  return [
    `Build this request from the board:`,
    ``,
    `Request #${r.id} — [${r.type}] ${r.title}`,
    `Status: ${r.status}${r.shipped_at ? " (shipped)" : ""}`,
    `Submitted by: ${r.submitter_name} <${r.submitter_email}>`,
    `Submitted: ${new Date(r.created_at).toLocaleString()}`,
    r.page_url ? `Page: ${r.page_url}` : null,
    ``,
    `Details:`,
    r.description,
    r.admin_notes ? `\nAdmin notes:\n${r.admin_notes}` : null,
    ``,
    `Please implement this, then I'll mark it shipped on /admin/requests with the commit SHA.`,
  ].filter(Boolean).join("\n");
}

export const Route = createFileRoute("/_authenticated/admin/requests")({
  component: RequestsPage,
});

type Status = "new" | "in_progress" | "resolved" | "wont_fix";
type ReqType = "bug" | "feature" | "other";

interface Req {
  id: string;
  submitter_name: string;
  submitter_email: string;
  type: ReqType;
  title: string;
  description: string;
  page_url: string | null;
  status: Status;
  admin_notes: string | null;
  shipped_at: string | null;
  commit_ref: string | null;
  created_at: string;
}

const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  in_progress: "In progress",
  resolved: "Resolved",
  wont_fix: "Won't fix",
};

const STATUS_COLOR: Record<Status, string> = {
  new: "bg-accent/20 text-accent-foreground border-accent/40",
  in_progress: "bg-amber-500/15 text-amber-700 border-amber-500/40",
  resolved: "bg-emerald-500/15 text-emerald-700 border-emerald-500/40",
  wont_fix: "bg-muted text-muted-foreground border-border",
};

const TYPE_ICON: Record<ReqType, typeof Bug> = {
  bug: Bug,
  feature: Sparkles,
  other: HelpCircle,
};

function RequestsPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Status | "all" | "shipped">("all");

  const { data, isLoading } = useQuery({
    queryKey: ["client_requests"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("client_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Req[];
    },
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Req> }) => {
      const { error } = await supabase.from("client_requests").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_requests"] }),
    onError: () => toast.error("Update failed"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("client_requests").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["client_requests"] });
    },
    onError: () => toast.error("Delete failed"),
  });

  if (loading) return <div className="p-10 text-muted-foreground">Loading…</div>;
  if (!isAdmin) {
    return (
      <div className="p-10">
        <Card className="p-8 max-w-md">
          <h2 className="font-display text-xl">Not authorized</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This page is restricted to administrators.
          </p>
        </Card>
      </div>
    );
  }

  const items = data ?? [];
  const filtered =
    filter === "all"
      ? items
      : filter === "shipped"
        ? items.filter((r) => !!r.shipped_at)
        : items.filter((r) => r.status === filter);
  const counts = {
    all: items.length,
    new: items.filter((r) => r.status === "new").length,
    in_progress: items.filter((r) => r.status === "in_progress").length,
    resolved: items.filter((r) => r.status === "resolved").length,
    wont_fix: items.filter((r) => r.status === "wont_fix").length,
    shipped: items.filter((r) => !!r.shipped_at).length,
  };

  return (
    <div className="p-6 lg:p-10 max-w-6xl mx-auto space-y-6">
      <header>
        <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground">Admin</p>
        <h1 className="font-display text-4xl tracking-tight mt-1">Client requests</h1>
        <p className="text-muted-foreground mt-2">
          Bug reports and feature requests from the team. Mark items as shipped and attach the commit or PR that delivered the fix.
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {(["all", "new", "in_progress", "resolved", "shipped", "wont_fix"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
              filter === s
                ? "bg-foreground text-background border-foreground"
                : "bg-card text-foreground border-border hover:bg-muted"
            }`}
          >
            {s === "all" ? "All" : s === "shipped" ? "Shipped" : STATUS_LABEL[s]} · {counts[s]}
          </button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Loading requests…</p>
      ) : filtered.length === 0 ? (
        <Card className="p-10 text-center text-muted-foreground">
          {items.length === 0
            ? "No requests yet. Use the feedback button (bottom-right of any page) to file the first one."
            : "No requests in this view."}
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((r) => {
            const Icon = TYPE_ICON[r.type];
            return (
              <Card key={r.id} className="p-5">
                <div className="flex items-start gap-4">
                  <div className="grid place-items-center h-9 w-9 rounded-md bg-muted text-foreground shrink-0">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-medium">{r.title}</h3>
                      <Badge variant="outline" className={STATUS_COLOR[r.status]}>
                        {STATUS_LABEL[r.status]}
                      </Badge>
                      <Badge variant="outline" className="text-xs">{r.type}</Badge>
                      {r.shipped_at && (
                        <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 border-emerald-500/40 text-xs inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3" /> Shipped {new Date(r.shipped_at).toLocaleDateString()}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground whitespace-pre-wrap">
                      {r.description}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span>{r.submitter_name} · <a className="hover:underline" href={`mailto:${r.submitter_email}`}>{r.submitter_email}</a></span>
                      <span>{new Date(r.created_at).toLocaleString()}</span>
                      {r.page_url && (
                        <a
                          href={r.page_url}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 hover:text-foreground"
                        >
                          <ExternalLink className="h-3 w-3" /> Page
                        </a>
                      )}
                    </div>

                    <div className="mt-4 grid sm:grid-cols-[180px_1fr_auto] gap-3 items-start">
                      <Select
                        value={r.status}
                        onValueChange={(v) =>
                          updateMut.mutate({ id: r.id, patch: { status: v as Status } })
                        }
                      >
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                            <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Textarea
                        defaultValue={r.admin_notes ?? ""}
                        placeholder="Internal notes…"
                        rows={2}
                        onBlur={(e) => {
                          const v = e.target.value;
                          if (v !== (r.admin_notes ?? "")) {
                            updateMut.mutate({ id: r.id, patch: { admin_notes: v || null } });
                          }
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          if (confirm("Delete this request?")) deleteMut.mutate(r.id);
                        }}
                        aria-label="Delete"
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>

                    <div className="mt-3 grid sm:grid-cols-[1fr_auto] gap-3 items-center">
                      <div className="relative">
                        <GitCommit className="h-3.5 w-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          defaultValue={r.commit_ref ?? ""}
                          placeholder="Commit SHA, PR link, or deploy ref…"
                          className="h-9 pl-9 text-xs"
                          onBlur={(e) => {
                            const v = e.target.value.trim();
                            if (v !== (r.commit_ref ?? "")) {
                              updateMut.mutate({ id: r.id, patch: { commit_ref: v || null } });
                            }
                          }}
                        />
                      </div>
                      <Button
                        variant={r.shipped_at ? "outline" : "default"}
                        size="sm"
                        onClick={() =>
                          updateMut.mutate({
                            id: r.id,
                            patch: {
                              shipped_at: r.shipped_at ? null : new Date().toISOString(),
                              status: r.shipped_at ? r.status : "resolved",
                            },
                          })
                        }
                      >
                        <CheckCircle2 className="h-4 w-4 mr-1.5" />
                        {r.shipped_at ? "Unmark shipped" : "Mark as shipped"}
                      </Button>
                    </div>
                    {r.commit_ref && /^https?:\/\//.test(r.commit_ref) && (
                      <a
                        href={r.commit_ref}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="h-3 w-3" /> Open commit/PR
                      </a>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
