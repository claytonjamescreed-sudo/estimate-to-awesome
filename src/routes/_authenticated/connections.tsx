import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Cloud, CheckCircle2, Plug, Trash2, Loader2, ExternalLink, Building2, CircleDashed } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { getWorkspaceIntegrationStatus } from "@/lib/integrations.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/connections")({
  component: ConnectionsPage,
});

type Provider = "google_drive" | "onedrive" | "sharepoint";

interface ProviderInfo {
  id: Provider;
  name: string;
  description: string;
  scopes: string;
  status: "available" | "coming_soon";
}

const PROVIDERS: ProviderInfo[] = [
  {
    id: "google_drive",
    name: "Google Drive",
    description: "Browse case studies, testimonials, images, and videos from your Google Drive and embed them directly into proposals.",
    scopes: "Read-only access to files you select",
    status: "available",
  },
  {
    id: "onedrive",
    name: "Microsoft OneDrive",
    description: "Pull personal OneDrive assets — case studies, photos, demo videos — into the proposal builder.",
    scopes: "Read-only access to files you select",
    status: "available",
  },
  {
    id: "sharepoint",
    name: "SharePoint",
    description: "Connect your team's SharePoint sites to source approved marketing assets and customer stories.",
    scopes: "Read-only access to sites you select",
    status: "available",
  },
];

interface UserIntegrationRow {
  id: string;
  provider: Provider;
  account_label: string | null;
  account_email: string | null;
  status: string;
  created_at: string;
}

function ConnectionsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [connecting, setConnecting] = useState<Provider | null>(null);

  const { data: integrations = [], isLoading } = useQuery({
    queryKey: ["user_integrations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_integrations")
        .select("id, provider, account_label, account_email, status, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as UserIntegrationRow[];
    },
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_integrations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user_integrations"] });
      toast.success("Disconnected");
    },
  });

  function byProvider(p: Provider) {
    return integrations.filter((i) => i.provider === p);
  }

  return (
    <div className="p-6 lg:p-10 max-w-5xl mx-auto space-y-8">
      <header>
        <h1 className="font-display text-3xl tracking-tight">Connections</h1>
        <p className="mt-2 text-muted-foreground max-w-2xl">
          Link your own cloud-storage accounts so you can embed case studies, testimonials, product images, and videos directly into proposals. Each connection is private to your account.
        </p>
      </header>

      <div className="grid gap-5">
        {PROVIDERS.map((p) => {
          const linked = byProvider(p.id);
          return (
            <Card key={p.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
                <div className="flex items-start gap-4">
                  <div className="h-11 w-11 rounded-lg bg-accent/10 text-accent grid place-items-center shrink-0">
                    <Cloud className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle className="text-lg flex items-center gap-2">
                      {p.name}
                      {linked.length > 0 && (
                        <Badge variant="secondary" className="gap-1 text-[10px]">
                          <CheckCircle2 className="h-3 w-3" /> {linked.length} connected
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription className="mt-1 max-w-xl">{p.description}</CardDescription>
                    <p className="text-[11px] text-muted-foreground mt-2">Scope: {p.scopes}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => setConnecting(p.id)}>
                  <Plug className="h-4 w-4" /> Connect account
                </Button>
              </CardHeader>
              {linked.length > 0 && (
                <CardContent>
                  <div className="border-t border-border pt-3 space-y-2">
                    {linked.map((i) => (
                      <div key={i.id} className="flex items-center justify-between rounded-md border border-border px-3 py-2">
                        <div className="min-w-0">
                          <p className="text-sm truncate">{i.account_label || i.account_email || "Account"}</p>
                          {i.account_email && i.account_label && (
                            <p className="text-xs text-muted-foreground truncate">{i.account_email}</p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => remove.mutate(i.id)}
                          disabled={remove.isPending}
                          className="text-destructive hover:text-destructive"
                        >
                          {remove.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                          Disconnect
                        </Button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Loading integrations…</p>}

      <ConnectDialog
        provider={connecting}
        onClose={() => setConnecting(null)}
        onSaved={() => qc.invalidateQueries({ queryKey: ["user_integrations"] })}
      />
    </div>
  );
}


function ConnectDialog({
  provider,
  onClose,
  onSaved,
}: {
  provider: Provider | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [label, setLabel] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  if (!provider) return null;
  const activeProvider: Provider = provider;
  const info = PROVIDERS.find((p) => p.id === activeProvider)!;

  async function save() {
    setSaving(true);
    try {
      const { error } = await supabase.from("user_integrations").insert({
        user_id: (await supabase.auth.getUser()).data.user!.id,
        provider: activeProvider,
        account_label: label || null,
        account_email: email || null,
        status: "pending_oauth",
      });
      if (error) throw error;
      toast.success(`${info.name} placeholder saved — OAuth will activate it once configured.`);
      onSaved();
      onClose();
      setLabel("");
      setEmail("");
    } catch (e: any) {
      toast.error(e.message ?? "Could not save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect {info.name}</DialogTitle>
          <DialogDescription>
            The live OAuth flow for {info.name} will launch here once the workspace admin adds the provider's OAuth credentials. For now, you can register the account so it appears in your proposals.
          </DialogDescription>
        </DialogHeader>

        <div className="rounded-md border border-dashed border-border bg-muted/30 p-3 text-xs text-muted-foreground flex gap-2">
          <ExternalLink className="h-3.5 w-3.5 mt-0.5 shrink-0" />
          <span>
            When live, this will open {info.name}'s consent screen and request read-only access to files you pick — no tokens are stored unencrypted.
          </span>
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="acc-label">Display name</Label>
            <Input id="acc-label" placeholder="e.g. Marketing Drive" value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="acc-email">Account email</Label>
            <Input id="acc-email" type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button onClick={save} disabled={saving || (!label && !email)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plug className="h-4 w-4" />}
            Save connection
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
