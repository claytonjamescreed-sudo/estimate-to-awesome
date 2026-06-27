import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ShieldCheck, FileText, Trophy, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { money, shortDate } from "@/lib/format";
import { StatusPill } from "./dashboard";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userRes.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: AdminPage,
});

interface AdminRow {
  id: string;
  title: string;
  status: string;
  currency: string;
  total_amount: number;
  updated_at: string;
  owner_id: string;
  owner_name?: string | null;
  owner_email?: string | null;
}

function AdminPage() {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["admin", "proposals"],
    queryFn: async () => {
      // RLS allows admins to read all rows.
      const { data: proposals, error } = await supabase
        .from("proposals")
        .select("id, title, status, currency, total_amount, updated_at, owner_id")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const ownerIds = Array.from(new Set((proposals ?? []).map((p) => p.owner_id)));
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, email").in("id", ownerIds);
      const map = new Map<string, { full_name: string | null; email: string | null }>();
      profiles?.forEach((p) => map.set(p.id, { full_name: p.full_name, email: p.email }));
      return (proposals ?? []).map((p) => ({
        ...p,
        owner_name: map.get(p.owner_id)?.full_name ?? null,
        owner_email: map.get(p.owner_id)?.email ?? null,
      })) as AdminRow[];
    },
  });

  const totals = rows.reduce(
    (acc, r) => {
      acc.count++;
      if (r.status === "won") { acc.won++; acc.wonValue += Number(r.total_amount || 0); }
      if (r.status === "sent" || r.status === "draft") acc.pipeline += Number(r.total_amount || 0);
      return acc;
    },
    { count: 0, won: 0, wonValue: 0, pipeline: 0 } as Record<string, number>,
  );

  const byUser = new Map<string, { name: string; email: string; count: number; won: number; value: number }>();
  rows.forEach((r) => {
    const key = r.owner_id;
    const cur = byUser.get(key) ?? { name: r.owner_name || "—", email: r.owner_email || "", count: 0, won: 0, value: 0 };
    cur.count++;
    if (r.status === "won") { cur.won++; cur.value += Number(r.total_amount || 0); }
    byUser.set(key, cur);
  });

  const tiles = [
    { label: "Proposals", value: String(totals.count), icon: FileText },
    { label: "Won", value: String(totals.won), icon: Trophy },
    { label: "Won value", value: money(totals.wonValue), icon: ShieldCheck },
    { label: "Open pipeline", value: money(totals.pipeline), icon: TrendingUp },
  ];

  return (
    <div className="max-w-7xl mx-auto p-6 lg:p-10">
      <header>
        <p className="text-sm text-accent inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" /> Admin</p>
        <h1 className="font-display text-4xl mt-1">Organisation dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">All proposals, all users, across GOSAVI.</p>
      </header>

      <section className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-xl border border-border bg-card p-5 shadow-[var(--shadow-soft)]">
            <div className="flex items-center justify-between">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{t.label}</p>
              <t.icon className="h-4 w-4 text-accent" />
            </div>
            <p className="mt-3 font-display text-3xl">{t.value}</p>
          </div>
        ))}
      </section>

      <section className="mt-10 grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)]">
          <div className="px-4 py-3 border-b border-border"><h2 className="font-display text-lg">All proposals</h2></div>
          {isLoading ? (
            <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Title</th>
                  <th className="px-4 py-3 font-medium">Owner</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium text-right">Value</th>
                  <th className="px-4 py-3 font-medium">Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-t border-border hover:bg-muted/30">
                    <td className="px-4 py-3">
                      <Link to="/proposals/$proposalId" params={{ proposalId: r.id }} className="font-medium hover:text-accent">{r.title}</Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.owner_name || r.owner_email || "—"}</td>
                    <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(Number(r.total_amount || 0), r.currency)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{shortDate(r.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card overflow-hidden shadow-[var(--shadow-soft)]">
          <div className="px-4 py-3 border-b border-border"><h2 className="font-display text-lg">By user</h2></div>
          <ul className="divide-y divide-border">
            {Array.from(byUser.entries()).map(([id, u]) => (
              <li key={id} className="p-4">
                <p className="font-medium">{u.name}</p>
                <p className="text-xs text-muted-foreground">{u.email}</p>
                <div className="mt-2 flex justify-between text-xs">
                  <span className="text-muted-foreground">{u.count} total · {u.won} won</span>
                  <span className="tabular-nums">{money(u.value)}</span>
                </div>
              </li>
            ))}
            {byUser.size === 0 && <li className="p-6 text-sm text-muted-foreground text-center">No data yet.</li>}
          </ul>
        </div>
      </section>
    </div>
  );
}
