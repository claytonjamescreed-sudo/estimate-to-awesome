import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { CheckCircle2, CircleDashed, ExternalLink, Building2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { getWorkspaceIntegrationStatus } from "@/lib/integrations.functions";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/connections")({
  component: ConnectionsPage,
});

const PROVIDERS: { key: keyof Awaited<ReturnType<typeof getWorkspaceIntegrationStatus>>; name: string; blurb: string }[] = [
  { key: "zoho_books", name: "Zoho Books", blurb: "Import estimates, push won proposals as invoices" },
  { key: "zoho_crm", name: "Zoho CRM", blurb: "Link proposals to deals; sync contacts" },
  { key: "google_drive", name: "Google Drive", blurb: "Embed shared case studies, testimonials, images" },
  { key: "microsoft_onedrive", name: "OneDrive", blurb: "Embed assets from the shared company OneDrive" },
  { key: "microsoft_sharepoint", name: "SharePoint", blurb: "Embed approved assets from SharePoint libraries" },
];

function ConnectionsPage() {
  const { isAdmin } = useAuth();
  const fetchWorkspace = useServerFn(getWorkspaceIntegrationStatus);
  const { data: workspace, isLoading } = useQuery({
    queryKey: ["workspace_integration_status"],
    queryFn: () => fetchWorkspace(),
  });

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Shared connections</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Every integration is shared by the whole workspace — your admin connects company accounts once, and you
          inherit access. There are no personal connections to set up.
        </p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-accent/10 text-accent grid place-items-center shrink-0">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Workspace integrations</CardTitle>
              <CardDescription className="mt-0.5">
                Status of every system this workspace can pull from.
              </CardDescription>
            </div>
          </div>
          {isAdmin && (
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/integrations">
                Manage <ExternalLink className="h-3 w-3" />
              </Link>
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <ul className="divide-y divide-border">
            {PROVIDERS.map((p) => {
              const connected = workspace?.[p.key] ?? false;
              return (
                <li key={p.key} className="flex items-center justify-between py-3 gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{p.name}</p>
                    <p className="text-xs text-muted-foreground">{p.blurb}</p>
                  </div>
                  {isLoading ? (
                    <Badge variant="outline" className="gap-1 shrink-0">
                      <CircleDashed className="h-3 w-3 animate-spin" /> Checking
                    </Badge>
                  ) : connected ? (
                    <Badge className="gap-1 shrink-0 bg-emerald-100 text-emerald-900 hover:bg-emerald-100 border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> Connected
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="gap-1 shrink-0 text-muted-foreground">
                      <CircleDashed className="h-3 w-3" /> Not connected
                    </Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>

      {!isAdmin && (
        <p className="text-xs text-muted-foreground">
          Need a new integration connected? Ask your workspace admin.
        </p>
      )}
    </div>
  );
}
