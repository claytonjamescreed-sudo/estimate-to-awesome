import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { money, shortDate } from "@/lib/format";
import { StatusPill } from "./dashboard";
import { useState, useMemo } from "react";
import type { ProposalRow } from "@/lib/proposal-types";

export const Route = createFileRoute("/_authenticated/proposals/")({
  component: ProposalsListPage,
});

function ProposalsListPage() {
  const { user } = useAuth();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");

  const { data: proposals = [], isLoading } = useQuery({
    queryKey: ["proposals", "mine", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposals")
        .select("*")
        .eq("owner_id", user!.id)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProposalRow[];
    },
  });

  const filtered = useMemo(() => {
    return proposals.filter((p) => {
      if (status !== "all" && p.status !== status) return false;
      if (q && !`${p.title} ${p.project_code ?? ""}`.toLowerCase().includes(q.toLowerCase())) return false;
      return true;
    });
  }, [proposals, q, status]);

  const tabs = ["all", "draft", "sent", "won", "lost", "archived"] as const;

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl text-foreground">Proposals</h1>
          <p className="text-sm text-muted-foreground mt-1">Everything you've drafted, sent, won and lost.</p>
        </div>
        <Button asChild><Link to="/proposals/new"><Plus className="h-4 w-4" /> New proposal</Link></Button>
      </header>

      <div className="mt-6 flex flex-wrap items-center gap-3">
        <Input placeholder="Search by title or project code…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <div className="flex flex-wrap gap-1 rounded-md border border-border bg-card p-1">
          {tabs.map((t) => (
            <button
              key={t}
              onClick={() => setStatus(t)}
              className={`px-3 py-1 rounded text-xs uppercase tracking-wider transition-colors ${
                status === t ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)]">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">No proposals match.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Value</th>
                <th className="px-4 py-3 font-medium">Created</th>
                <th className="px-4 py-3 font-medium">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link to="/proposals/$proposalId" params={{ proposalId: p.id }} className="font-medium hover:text-accent">
                      {p.title}
                    </Link>
                    {p.project_code && <span className="ml-2 text-xs text-muted-foreground">{p.project_code}</span>}
                  </td>
                  <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                  <td className="px-4 py-3 text-right tabular-nums">{money(Number(p.total_amount || 0), p.currency)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{shortDate(p.created_at)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{shortDate(p.updated_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
