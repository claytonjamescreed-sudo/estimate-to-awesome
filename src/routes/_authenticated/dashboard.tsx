import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { FileText, TrendingUp, Trophy, XCircle, Plus, ArrowUpRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { money, shortDate, statusLabel } from "@/lib/format";
import type { ProposalRow } from "@/lib/proposal-types";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { user } = useAuth();

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

  const counts = proposals.reduce(
    (acc, p) => {
      acc.total++;
      acc[p.status] = (acc[p.status] || 0) + 1;
      if (p.status === "won") acc.wonValue += Number(p.total_amount || 0);
      if (p.status === "sent" || p.status === "draft") acc.pipelineValue += Number(p.total_amount || 0);
      return acc;
    },
    { total: 0, draft: 0, sent: 0, won: 0, lost: 0, archived: 0, wonValue: 0, pipelineValue: 0 } as Record<string, number>,
  );

  const tiles = [
    { label: "Open pipeline", value: money(counts.pipelineValue), sub: `${counts.draft || 0} draft · ${counts.sent || 0} sent`, icon: TrendingUp },
    { label: "Won this year", value: money(counts.wonValue), sub: `${counts.won || 0} proposals`, icon: Trophy },
    { label: "Lost", value: String(counts.lost || 0), sub: "Closed out", icon: XCircle },
    { label: "All proposals", value: String(counts.total), sub: "Across all statuses", icon: FileText },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Welcome back</p>
          <h1 className="font-display text-4xl text-foreground mt-1">
            {user?.user_metadata?.full_name?.split(" ")[0] || "There"} — your proposals
          </h1>
        </div>
        <Button asChild>
          <Link to="/proposals/new"><Plus className="h-4 w-4" /> New proposal</Link>
        </Button>
      </header>

      <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.label}</p>
              <t.icon className="h-4 w-4 text-accent" />
            </div>
            <p className="mt-3 font-display text-3xl text-foreground">{t.value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{t.sub}</p>
          </div>
        ))}
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-foreground">Recent proposals</h2>
          <Link to="/proposals" className="text-sm text-accent hover:underline inline-flex items-center gap-1">
            View all <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)]">
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : proposals.length === 0 ? (
            <EmptyState />
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {proposals.slice(0, 8).map((p) => (
                  <tr key={p.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to="/proposals/$proposalId" params={{ proposalId: p.id }} className="font-medium hover:text-accent">
                        {p.title}
                      </Link>
                      {p.project_code && <span className="ml-2 text-xs text-muted-foreground">{p.project_code}</span>}
                    </td>
                    <td className="px-4 py-3"><StatusPill status={p.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(Number(p.total_amount || 0), p.currency)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{shortDate(p.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="p-12 text-center">
      <div className="mx-auto h-12 w-12 rounded-full grid place-items-center bg-accent/15 text-accent">
        <FileText className="h-5 w-5" />
      </div>
      <h3 className="mt-4 font-display text-lg">No proposals yet</h3>
      <p className="mt-1 text-sm text-muted-foreground">Start with a blank document or upload an estimate PDF.</p>
      <Button asChild className="mt-5">
        <Link to="/proposals/new"><Plus className="h-4 w-4" /> Create your first proposal</Link>
      </Button>
    </div>
  );
}

export function StatusPill({ status }: { status: string }) {
  const variants: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    sent: "bg-accent/15 text-accent-foreground border-accent/30",
    won: "bg-success/15 text-success border-success/30",
    lost: "bg-destructive/10 text-destructive border-destructive/30",
    archived: "bg-muted/60 text-muted-foreground border-border",
  };
  return (
    <Badge variant="outline" className={variants[status] || variants.draft}>
      {statusLabel[status] || status}
    </Badge>
  );
}
