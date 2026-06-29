import { createFileRoute, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ShieldCheck, CheckCircle2, CircleDashed, Plug, FileText, Users, ExternalLink, Cloud, FolderOpen, Building } from "lucide-react";
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

type IntegrationKey = "zoho_books" | "zoho_crm" | "google_drive" | "microsoft_onedrive" | "microsoft_sharepoint";

interface IntegrationCard {
  key: IntegrationKey;
  name: string;
  group: "CRM & Accounting" | "Shared Asset Storage";
  tagline: string;
  description: string;
  icon: typeof FileText;
  capabilities: string[];
}

const INTEGRATIONS: IntegrationCard[] = [
  {
    key: "zoho_books",
    name: "Zoho Books",
    group: "CRM & Accounting",
    tagline: "Pull estimates, push won proposals as invoices",
    description:
      "Import line items from Zoho Books estimates straight into a proposal. When a proposal is won, push the accepted scope back to Zoho Books as a draft invoice — no double entry.",
    icon: FileText,
    capabilities: ["Import estimates", "Push won proposals", "Sync customers"],
  },
  {
    key: "zoho_crm",
    name: "Zoho CRM",
    group: "CRM & Accounting",
    tagline: "Auto-link proposals to deals and contacts",
    description:
      "When a rep creates a proposal, match it to a CRM deal and pull contact + account details automatically. Won/lost status flows back to the deal record.",
    icon: Users,
    capabilities: ["Link to deals", "Sync contacts", "Update deal stage"],
  },
  {
    key: "google_drive",
    name: "Google Drive",
    group: "Shared Asset Storage",
    tagline: "Shared company folder of case studies & testimonials",
    description:
      "Connect one company Google Drive folder. Every rep can browse approved case studies, testimonials, product imagery, and demo videos to embed into proposals — no personal Drive linking needed.",
    icon: Cloud,
    capabilities: ["Browse shared folder", "Embed PDFs & images", "Auto-refresh access"],
  },
  {
    key: "microsoft_onedrive",
    name: "Microsoft OneDrive",
    group: "Shared Asset Storage",
    tagline: "Shared OneDrive library for marketing assets",
    description:
      "Connect a single company OneDrive account. The whole workspace pulls from the same shared library of approved sales content.",
    icon: FolderOpen,
    capabilities: ["Browse shared library", "Embed assets", "Centrally managed"],
  },
  {
    key: "microsoft_sharepoint",
    name: "Microsoft SharePoint",
    group: "Shared Asset Storage",
    tagline: "Pull from your team's SharePoint sites",
    description:
      "Connect SharePoint document libraries containing approved sales collateral. Reps embed assets directly into proposals from your governed content source.",
    icon: Building,
    capabilities: ["Browse SharePoint sites", "Embed approved assets", "Read-only access"],
  },
];

function AdminIntegrationsPage() {
  const fetchStatus = useServerFn(getWorkspaceIntegrationStatus);
  const { data: status, isLoading } = useQuery({
    queryKey: ["workspace_integration_status"],
    queryFn: () => fetchStatus(),
  });

  const groups = ["CRM & Accounting", "Shared Asset Storage"] as const;

  return (
    <div className="max-w-5xl mx-auto p-6 lg:p-10 space-y-10">
      <header>
        <p className="text-sm text-accent inline-flex items-center gap-1.5">
          <ShieldCheck className="h-4 w-4" /> Admin
        </p>
        <h1 className="font-display text-4xl mt-1 tracking-tight">Workspace integrations</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-2xl">
          Configured <strong>once for the whole workspace</strong>. Every rep inherits access — no per-user linking. Use
          this for shared systems of record (Zoho) and shared content libraries (one company Drive/OneDrive/SharePoint folder).
        </p>
      </header>

      {groups.map((group) => (
        <section key={group} className="space-y-4">
          <h2 className="font-display text-xl tracking-tight">{group}</h2>
          <div className="grid gap-5 md:grid-cols-2">
            {INTEGRATIONS.filter((i) => i.group === group).map((i) => {
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
                              `Reply "connect ${i.name}" in chat and I'll launch the Lovable connector flow. Sign in with the company account that owns the shared folder — every rep on this workspace will inherit access.`,
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
        </section>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">How workspace integrations work</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p className="flex gap-2">
            <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="text-foreground">One-time auth.</strong> An admin authorizes once via Lovable's native
              connector. Tokens refresh automatically — no OAuth app registration, no callback URLs.
            </span>
          </p>
          <p className="flex gap-2">
            <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="text-foreground">Shared by all reps.</strong> Every signed-in user on this workspace
              can use the integration immediately. For storage, point it at one shared company folder.
            </span>
          </p>
          <p className="flex gap-2">
            <ExternalLink className="h-4 w-4 mt-0.5 shrink-0 text-accent" />
            <span>
              <strong className="text-foreground">Per-client isolation.</strong> Each remix of this app is its own
              workspace with its own credentials — no cross-contamination between client deployments.
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
