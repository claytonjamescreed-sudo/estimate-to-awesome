import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, CheckCircle2, CircleDashed, Plug, FileText, Users, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getWorkspaceIntegrationStatus } from "@/lib/integrations.functions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/admin/integrations")({
  beforeLoad: async () => {
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) throw redirect({ to: "/auth" });
    const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", userRes.user.id);
    if (!roles?.some((r) => r.role === "admin")) throw redirect({ to: "/dashboard" });
  },
  component: AdminIntegrationsPage,
});

type IntegrationKey = "zoho_books" | "zoho_crm";

interface IntegrationCard {
  key: IntegrationKey;
  name: string;
  tagline: string;
  description: string;
  icon: typeof FileText;
  capabilities: string[];
}

const INTEGRATIONS: IntegrationCard[] = [
  {
    key: "zoho_books",
    name: "Zoho Books",
    tagline: "Pull estimates, push won proposals as invoices",
    description:
      "Import line items from Zoho Books estimates straight into a proposal. When a proposal is won, push the accepted scope back to Zoho Books as a draft invoice — no double entry.",
    icon: FileText,
    capabilities: ["Import estimates", "Push won proposals", "Sync customers"],
  },
  {
    key: "zoho_crm",
    name: "Zoho CRM",
    tagline: "Auto-link proposals to deals and contacts",
    description:
      "When a rep creates a proposal, match it to a CRM deal and pull contact + account details automatically. Won/lost status flows back to the deal record.",
    icon: Users,
    capabilities: ["Link to deals", "Sync contacts", "Update deal stage"],
  },
];

function AdminIntegrationsPage() {
  const fetchStatus = useServerFn(getWorkspaceIntegrationStatus);
  const { data: status, isLoading } = useQuery({
    queryKey: ["workspace_integration_status"],
    queryFn: () => fetchStatus(),
  });

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-10 space-y-8">
      <header>
        <p className="text-sm text-accent inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4" /> Admin
        </p>
        <h1 className="font-display text-4xl mt-1 tracking-tight">Workspace integrations</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          These integrations connect <strong>once for the whole workspace</strong>. Every user on this app inherits
          access — no per-rep linking required. Perfect for shared systems of record like Zoho.
        </p>
      </header>

      <div className="grid gap-5 md:grid-cols-2">
        {INTEGRATIONS.map((i) => {
          const connected = status?.[i.key] ?? false;
          return (
            <Card key={i.key} className="flex flex-col">
              <CardHeader>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="h-11 w-11 rounded-lg bg-accent/10 text-accent grid place-items-center shrink-0">
                      <i.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{i.name}</CardTitle>
                      <CardDescription className="mt-0.5">{i.tagline}</CardDescription>
                    </div>
                  </div>
                  {isLoading ? (
                    <Badge variant="outline" className="gap-1">
                      <CircleDashed className="h-3 w-3 animate-spin" /> Checking
                    </Badge>
                  ) : connected ? (
                    <Badge className="gap-1 bg-emerald-100 text-emerald-900 hover:bg-emerald-100 border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                      <CircleDashed className="h-3 w-3" /> Not connected
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="flex flex-col flex-1 gap-4">
                <p className="text-sm text-muted-foreground">{i.description}</p>
                <ul className="text-xs space-y-1.5">
                  {i.capabilities.map((c) => (
                    <li key={c} className="flex items-center gap-2 text-muted-foreground">
                      <CheckCircle2 className="h-3 w-3 text-accent" /> {c}
                    </li>
                  ))}
                </ul>
                <div className="mt-auto pt-2">
                  {connected ? (
                    <div className="flex items-center justify-between rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                      <span className="inline-flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Live for all workspace users
                      </span>
                    </div>
                  ) : (
                    <Button
                      className="w-full"
                      onClick={() =>
                        window.alert(
                          `Reply "connect ${i.name}" in chat and I'll launch the Lovable connector flow. You'll authorize ${i.name} once and every user on this workspace will inherit access.`,
                        )
                      }
                    >
                      <Plug className="h-4 w-4" /> Connect {i.name}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How workspace integrations work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="flex gap-2">
            <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="text-foreground">One-time OAuth.</strong> An admin authorizes the workspace once via
              Lovable's native connector. Tokens refresh automatically.
            </span>
          </p>
          <p className="flex gap-2">
            <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="text-foreground">Shared by all reps.</strong> Every signed-in user on this workspace
              can use the integration immediately — no per-user linking.
            </span>
          </p>
          <p className="flex gap-2">
            <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="text-foreground">Different from personal Connections.</strong> Use the user{" "}
              <em>Connections</em> page for things each rep links themselves (their own Google Drive, OneDrive, etc.).
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
