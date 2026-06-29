import { createFileRoute, useNavigate, Link, useParams } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft, Save, Eye, Printer, History, Trash2, Plus, GripVertical, X, Sparkles, Library, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ProposalDocument } from "@/components/proposal-document";
import { calcLineItemsTotal, STANDARD_TERMS } from "@/lib/proposal-defaults";
import { money } from "@/lib/format";
import { lookupClient } from "@/lib/client-lookup.functions";
import type { ProposalContent, ProposalRow, ProposalStatus, LineItem, LineSection, FeaturedProduct } from "@/lib/proposal-types";

export const Route = createFileRoute("/_authenticated/proposals/$proposalId")({
  component: EditorPage,
});

function EditorPage() {
  const { proposalId } = useParams({ from: "/_authenticated/proposals/$proposalId" });
  const { user } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: proposal, isLoading } = useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("proposals").select("*").eq("id", proposalId).single();
      if (error) throw error;
      return data as unknown as ProposalRow;
    },
  });

  const [draft, setDraft] = useState<ProposalRow | null>(null);
  const [dirty, setDirty] = useState(false);
  const lastSaved = useRef<string>("");

  useEffect(() => {
    if (proposal && !draft) {
      const hydrated: ProposalRow = {
        ...proposal,
        content: {
          ...proposal.content,
          client_spotlight: proposal.content.client_spotlight ?? {
            enabled: false, logo_url: "", industry: "", hq: "", size: "",
            about: "", challenge: "", why_us: "",
          },
          featured_products: proposal.content.featured_products ?? {
            enabled: false, intro: "Hand-picked solutions central to this design.", products: [],
          },
        },
      };
      setDraft(hydrated);
      lastSaved.current = JSON.stringify(hydrated);
    }
  }, [proposal, draft]);

  useEffect(() => {
    if (!draft) return;
    setDirty(JSON.stringify(draft) !== lastSaved.current);
  }, [draft]);

  const save = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      const totals = calcLineItemsTotal(draft.content);
      const { error } = await supabase
        .from("proposals")
        .update({
          title: draft.title,
          project_code: draft.project_code,
          status: draft.status,
          client_id: draft.client_id,
          total_amount: totals.total,
          content: draft.content as never,
        })
        .eq("id", draft.id);
      if (error) throw error;

      // Snapshot revision — bump version based on existing count
      const { count } = await supabase
        .from("proposal_revisions")
        .select("id", { count: "exact", head: true })
        .eq("proposal_id", draft.id);
      await supabase.from("proposal_revisions").insert({
        proposal_id: draft.id,
        created_by: user!.id,
        version: (count ?? 0) + 1,
        snapshot: { ...draft, total_amount: totals.total } as never,
      });
    },
    onSuccess: () => {
      lastSaved.current = JSON.stringify(draft);
      setDirty(false);
      toast.success("Saved & revision logged");
      qc.invalidateQueries({ queryKey: ["proposal", proposalId] });
      qc.invalidateQueries({ queryKey: ["proposals", "mine"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Save failed"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("proposals").delete().eq("id", proposalId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Proposal deleted");
      qc.invalidateQueries({ queryKey: ["proposals", "mine"] });
      navigate({ to: "/proposals" });
    },
  });

  if (isLoading || !draft) {
    return <div className="p-10 text-sm text-muted-foreground">Loading proposal…</div>;
  }

  const totals = calcLineItemsTotal(draft.content);
  const update = (fn: (d: ProposalRow) => void) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const next = structuredClone(prev);
      fn(next);
      return next;
    });
  };

  const updateContent = (fn: (c: ProposalContent) => void) => update((d) => fn(d.content));

  return (
    <div className="flex flex-col h-screen">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-4 border-b border-border bg-card px-4 lg:px-6 py-3">
        <div className="min-w-0 flex items-center gap-3">
          <Link to="/proposals" className="text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /></Link>
          <div className="min-w-0">
            <Input
              value={draft.title}
              onChange={(e) => update((d) => { d.title = e.target.value; })}
              className="h-8 border-0 bg-transparent px-0 font-display text-lg shadow-none focus-visible:ring-0"
            />
            <p className="text-xs text-muted-foreground">{dirty ? "Unsaved changes" : "All changes saved"} · {money(totals.total, draft.currency)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={draft.status}
            onChange={(e) => update((d) => { d.status = e.target.value as ProposalStatus; })}
            className="h-9 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="draft">Draft</option>
            <option value="sent">Sent</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
            <option value="archived">Archived</option>
          </select>
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1.5"><History className="h-4 w-4" /> History</Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader><SheetTitle>Revision history</SheetTitle></SheetHeader>
              <RevisionList proposalId={proposalId} />
            </SheetContent>
          </Sheet>
          <Button variant="outline" size="sm" asChild><Link to="/proposals/$proposalId/preview" params={{ proposalId }} target="_blank"><Eye className="h-4 w-4" /> Preview</Link></Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={!dirty || save.isPending}>
            <Save className="h-4 w-4" /> Save
          </Button>
        </div>
      </div>

      {/* Split editor */}
      <div className="flex-1 min-h-0 grid lg:grid-cols-[420px_1fr]">
        <aside className="overflow-y-auto border-r border-border bg-card p-4 lg:p-5">
          <Accordion type="multiple" defaultValue={["cover", "exec", "scope", "items", "terms"]} className="space-y-3">
            <Section id="cover" title="Cover page" enabled={draft.content.cover.enabled} onToggle={(v) => updateContent((c) => { c.cover.enabled = v; })}>
              <Field label="Headline"><Input value={draft.content.cover.headline} onChange={(e) => updateContent((c) => { c.cover.headline = e.target.value; })} /></Field>
              <Field label="Subheadline"><Input value={draft.content.cover.subheadline} onChange={(e) => updateContent((c) => { c.cover.subheadline = e.target.value; })} /></Field>
              <Field label="Client name"><Input value={draft.content.cover.client_name} onChange={(e) => updateContent((c) => { c.cover.client_name = e.target.value; })} /></Field>
              <Field label="Project name"><Input value={draft.content.cover.project_name} onChange={(e) => updateContent((c) => { c.cover.project_name = e.target.value; })} /></Field>
              <Field label="Prepared for"><Input value={draft.content.cover.prepared_for} onChange={(e) => updateContent((c) => { c.cover.prepared_for = e.target.value; })} /></Field>
              <Field label="Prepared by"><Input value={draft.content.cover.prepared_by} onChange={(e) => updateContent((c) => { c.cover.prepared_by = e.target.value; })} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Date"><Input type="date" value={draft.content.cover.date} onChange={(e) => updateContent((c) => { c.cover.date = e.target.value; })} /></Field>
                <Field label="Reference"><Input value={draft.content.cover.reference} onChange={(e) => updateContent((c) => { c.cover.reference = e.target.value; })} /></Field>
              </div>
            </Section>

            <Section id="exec" title="Executive summary" enabled={draft.content.exec_summary.enabled} onToggle={(v) => updateContent((c) => { c.exec_summary.enabled = v; })}>
              <Textarea rows={6} value={draft.content.exec_summary.body} onChange={(e) => updateContent((c) => { c.exec_summary.body = e.target.value; })} />
            </Section>

            <Section id="scope" title="Scope of work" enabled={draft.content.scope.enabled} onToggle={(v) => updateContent((c) => { c.scope.enabled = v; })}>
              <div className="space-y-2">
                {draft.content.scope.bullets.map((b, i) => (
                  <div key={i} className="flex gap-2">
                    <GripVertical className="h-4 w-4 mt-2.5 text-muted-foreground" />
                    <Input value={b} onChange={(e) => updateContent((c) => { c.scope.bullets[i] = e.target.value; })} />
                    <Button variant="ghost" size="icon" onClick={() => updateContent((c) => { c.scope.bullets.splice(i, 1); })}><X className="h-4 w-4" /></Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => updateContent((c) => { c.scope.bullets.push(""); })}><Plus className="h-4 w-4" /> Add bullet</Button>
              </div>
            </Section>

            <Section id="client" title="Client spotlight" enabled={draft.content.client_spotlight.enabled} onToggle={(v) => updateContent((c) => { c.client_spotlight.enabled = v; })}>
              <ClientLookup
                fallbackUrl={draft.content.client_spotlight.logo_url}
                clientName={draft.content.cover.client_name}
                onResult={(r) => updateContent((c) => {
                  if (r.logo_url) c.client_spotlight.logo_url = r.logo_url;
                  if (r.industry) c.client_spotlight.industry = r.industry;
                  if (r.hq) c.client_spotlight.hq = r.hq;
                  if (r.size) c.client_spotlight.size = r.size;
                  if (r.about) c.client_spotlight.about = r.about;
                  if (r.challenge) c.client_spotlight.challenge = r.challenge;
                  if (r.why_us) c.client_spotlight.why_us = r.why_us;
                  c.client_spotlight.enabled = true;
                })}
              />
              <Field label="Logo URL"><Input placeholder="https://…" value={draft.content.client_spotlight.logo_url} onChange={(e) => updateContent((c) => { c.client_spotlight.logo_url = e.target.value; })} /></Field>
              <div className="grid grid-cols-3 gap-2">
                <Field label="Industry"><Input value={draft.content.client_spotlight.industry} onChange={(e) => updateContent((c) => { c.client_spotlight.industry = e.target.value; })} /></Field>
                <Field label="HQ"><Input value={draft.content.client_spotlight.hq} onChange={(e) => updateContent((c) => { c.client_spotlight.hq = e.target.value; })} /></Field>
                <Field label="Size"><Input value={draft.content.client_spotlight.size} onChange={(e) => updateContent((c) => { c.client_spotlight.size = e.target.value; })} /></Field>
              </div>
              <Field label="About"><Textarea rows={3} value={draft.content.client_spotlight.about} onChange={(e) => updateContent((c) => { c.client_spotlight.about = e.target.value; })} /></Field>
              <Field label="The challenge"><Textarea rows={3} value={draft.content.client_spotlight.challenge} onChange={(e) => updateContent((c) => { c.client_spotlight.challenge = e.target.value; })} /></Field>
              <Field label="Why GOSAVI"><Textarea rows={3} value={draft.content.client_spotlight.why_us} onChange={(e) => updateContent((c) => { c.client_spotlight.why_us = e.target.value; })} /></Field>
            </Section>

            <Section id="featured" title="Featured products" enabled={draft.content.featured_products.enabled} onToggle={(v) => updateContent((c) => { c.featured_products.enabled = v; })}>
              <Field label="Intro"><Textarea rows={2} value={draft.content.featured_products.intro} onChange={(e) => updateContent((c) => { c.featured_products.intro = e.target.value; })} /></Field>
              <div className="space-y-3">
                {draft.content.featured_products.products.map((p, i) => (
                  <div key={p.id} className="rounded-md border border-border p-2 space-y-2 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <Input className="h-8 font-medium" placeholder="Product name" value={p.name} onChange={(e) => updateContent((c) => { c.featured_products.products[i].name = e.target.value; })} />
                      <Button variant="ghost" size="icon" onClick={() => updateContent((c) => { c.featured_products.products.splice(i, 1); })}><X className="h-4 w-4" /></Button>
                    </div>
                    <Input className="h-8" placeholder="Tagline" value={p.tagline} onChange={(e) => updateContent((c) => { c.featured_products.products[i].tagline = e.target.value; })} />
                    <Input className="h-8" placeholder="Image URL" value={p.image_url} onChange={(e) => updateContent((c) => { c.featured_products.products[i].image_url = e.target.value; })} />
                    <Input className="h-8" placeholder="Product link" value={p.link} onChange={(e) => updateContent((c) => { c.featured_products.products[i].link = e.target.value; })} />
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Highlights</Label>
                      {p.highlights.map((h, hi) => (
                        <div key={hi} className="flex gap-1.5">
                          <Input className="h-8" value={h} onChange={(e) => updateContent((c) => { c.featured_products.products[i].highlights[hi] = e.target.value; })} />
                          <Button variant="ghost" size="icon" onClick={() => updateContent((c) => { c.featured_products.products[i].highlights.splice(hi, 1); })}><X className="h-4 w-4" /></Button>
                        </div>
                      ))}
                      <Button variant="outline" size="sm" onClick={() => updateContent((c) => { c.featured_products.products[i].highlights.push(""); })}><Plus className="h-4 w-4" /> Highlight</Button>
                    </div>
                  </div>
                ))}
                <div className="flex gap-2">
                  <ProductLibraryPicker
                    onPick={(prod) => updateContent((c) => {
                      c.featured_products.products.push({ ...prod, id: crypto.randomUUID() });
                      c.featured_products.enabled = true;
                    })}
                  />
                  <Button variant="outline" size="sm" onClick={() => updateContent((c) => {
                    c.featured_products.products.push({ id: crypto.randomUUID(), name: "", tagline: "", image_url: "", link: "", highlights: [""] });
                  })}><Plus className="h-4 w-4" /> Blank</Button>
                </div>
              </div>
            </Section>



            <Section id="items" title="Line items" enabled={draft.content.line_items.enabled} onToggle={(v) => updateContent((c) => { c.line_items.enabled = v; })}>
              <LineItemsEditor content={draft.content} updateContent={updateContent} />
            </Section>

            <Section id="investment" title="Investment note" enabled={draft.content.investment.enabled} onToggle={(v) => updateContent((c) => { c.investment.enabled = v; })}>
              <Textarea rows={3} value={draft.content.investment.note} onChange={(e) => updateContent((c) => { c.investment.note = e.target.value; })} />
            </Section>

            <Section id="terms" title="Terms & conditions" enabled={draft.content.terms.enabled} onToggle={(v) => updateContent((c) => { c.terms.enabled = v; })}>
              <div className="flex gap-2 mb-2">
                <Button variant="outline" size="sm" onClick={() => updateContent((c) => { c.terms.preset = "standard"; c.terms.body = STANDARD_TERMS; })}>Reset to standard</Button>
              </div>
              <Textarea rows={10} value={draft.content.terms.body} onChange={(e) => updateContent((c) => { c.terms.body = e.target.value; c.terms.preset = "custom"; })} />
            </Section>

            <Section id="appendix" title="Appendix" enabled={draft.content.appendix.enabled} onToggle={(v) => updateContent((c) => { c.appendix.enabled = v; })}>
              <Field label="Title"><Input value={draft.content.appendix.title} onChange={(e) => updateContent((c) => { c.appendix.title = e.target.value; })} /></Field>
              <Textarea rows={6} value={draft.content.appendix.body} onChange={(e) => updateContent((c) => { c.appendix.body = e.target.value; })} placeholder="Case studies, references, or supporting material…" />
            </Section>
          </Accordion>

          <div className="mt-8 border-t border-border pt-4">
            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("Delete this proposal? This cannot be undone.")) del.mutate(); }}>
              <Trash2 className="h-4 w-4" /> Delete proposal
            </Button>
          </div>
        </aside>

        <div className="overflow-y-auto bg-muted/30 p-6 lg:p-10">
          <ProposalDocument content={draft.content} currency={draft.currency} totals={totals} />
        </div>
      </div>
    </div>
  );
}

function Section({
  id, title, enabled, onToggle, children,
}: { id: string; title: string; enabled: boolean; onToggle: (v: boolean) => void; children: React.ReactNode }) {
  return (
    <AccordionItem value={id} className="border border-border rounded-lg bg-background data-[state=open]:bg-background overflow-hidden">
      <div className="flex items-center justify-between pr-3">
        <AccordionTrigger className="px-3 py-3 flex-1 hover:no-underline">
          <span className="text-sm font-medium">{title}</span>
        </AccordionTrigger>
        <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`Toggle ${title}`} />
      </div>
      <AccordionContent className="px-3 pb-3 space-y-3">{children}</AccordionContent>
    </AccordionItem>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function LineItemsEditor({
  content, updateContent,
}: { content: ProposalContent; updateContent: (fn: (c: ProposalContent) => void) => void }) {
  const totals = useMemo(() => calcLineItemsTotal(content), [content]);
  return (
    <div className="space-y-4">
      {content.line_items.sections.map((section, si) => (
        <div key={section.id} className="rounded-md border border-border">
          <div className="flex items-center gap-2 p-2 border-b border-border bg-muted/30">
            <Input
              value={section.name}
              onChange={(e) => updateContent((c) => { c.line_items.sections[si].name = e.target.value; })}
              className="h-8 font-medium"
            />
            <Button variant="ghost" size="icon" onClick={() => updateContent((c) => { c.line_items.sections.splice(si, 1); })}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="p-2 space-y-2">
            {section.items.map((item, ii) => (
              <ItemRow
                key={item.id}
                item={item}
                onChange={(patch) => updateContent((c) => { Object.assign(c.line_items.sections[si].items[ii], patch); })}
                onDelete={() => updateContent((c) => { c.line_items.sections[si].items.splice(ii, 1); })}
              />
            ))}
            <Button variant="outline" size="sm" onClick={() => updateContent((c) => {
              c.line_items.sections[si].items.push({ id: crypto.randomUUID(), qty: 1, make: "", model: "", description: "", unit_price: 0 });
            })}><Plus className="h-4 w-4" /> Add item</Button>
          </div>
        </div>
      ))}
      <Button variant="outline" size="sm" onClick={() => updateContent((c) => {
        c.line_items.sections.push({ id: crypto.randomUUID(), name: "New section", items: [] } as LineSection);
      })}><Plus className="h-4 w-4" /> Add section</Button>

      <div className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Tax rate</Label>
          <Input
            type="number" step="0.01" min="0" max="1"
            value={content.line_items.tax_rate}
            onChange={(e) => updateContent((c) => { c.line_items.tax_rate = parseFloat(e.target.value) || 0; })}
            className="h-8 w-24"
          />
          <span className="text-xs text-muted-foreground">({(content.line_items.tax_rate * 100).toFixed(0)}%)</span>
        </div>
        <div className="text-xs text-muted-foreground flex justify-between"><span>Subtotal</span><span className="tabular-nums">{money(totals.subtotal)}</span></div>
        <div className="text-xs text-muted-foreground flex justify-between"><span>Tax</span><span className="tabular-nums">{money(totals.tax)}</span></div>
        <div className="text-sm font-medium flex justify-between"><span>Total</span><span className="tabular-nums">{money(totals.total)}</span></div>
      </div>
    </div>
  );
}

function ItemRow({
  item, onChange, onDelete,
}: { item: LineItem; onChange: (patch: Partial<LineItem>) => void; onDelete: () => void }) {
  return (
    <div className="grid grid-cols-[40px_70px_70px_1fr_80px_20px] gap-1.5 items-center">
      <Input className="h-8" type="number" min={0} value={item.qty} onChange={(e) => onChange({ qty: parseInt(e.target.value, 10) || 0 })} />
      <Input className="h-8" placeholder="Make" value={item.make} onChange={(e) => onChange({ make: e.target.value })} />
      <Input className="h-8" placeholder="Model" value={item.model} onChange={(e) => onChange({ model: e.target.value })} />
      <Input className="h-8" placeholder="Description" value={item.description} onChange={(e) => onChange({ description: e.target.value })} />
      <Input className="h-8 tabular-nums" type="number" step="0.01" value={item.unit_price} onChange={(e) => onChange({ unit_price: parseFloat(e.target.value) || 0 })} />
      <button onClick={onDelete} className="text-muted-foreground hover:text-destructive"><X className="h-3.5 w-3.5" /></button>
    </div>
  );
}

function RevisionList({ proposalId }: { proposalId: string }) {
  const { data: revs = [] } = useQuery({
    queryKey: ["revisions", proposalId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("proposal_revisions")
        .select("id, created_at, version, created_by")
        .eq("proposal_id", proposalId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  return (
    <div className="mt-4 space-y-2">
      {revs.length === 0 && <p className="text-sm text-muted-foreground">No revisions yet. Saving creates a snapshot.</p>}
      {revs.map((r) => (
        <div key={r.id} className="rounded-md border border-border p-3 text-sm">
          <p className="font-medium">v{r.version} · {new Date(r.created_at).toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Snapshot · {r.id.slice(0, 8)}</p>
        </div>
      ))}
    </div>
  );
}

type LookupResult = Awaited<ReturnType<typeof lookupClient>>;

function ClientLookup({
  fallbackUrl, clientName, onResult,
}: { fallbackUrl: string; clientName: string; onResult: (r: LookupResult) => void }) {
  const fn = useServerFn(lookupClient);
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);

  async function run() {
    const target = url.trim() || fallbackUrl;
    if (!target) {
      toast.error("Enter a client website URL");
      return;
    }
    setLoading(true);
    try {
      const r = await fn({ data: { url: target, client_name: clientName } });
      onResult(r);
      toast.success("Client profile generated");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-md border border-dashed border-border bg-muted/30 p-2 space-y-2">
      <Label className="text-xs text-muted-foreground flex items-center gap-1"><Sparkles className="h-3 w-3" /> Auto-fill from website</Label>
      <div className="flex gap-1.5">
        <Input className="h-8" placeholder="company.com" value={url} onChange={(e) => setUrl(e.target.value)} />
        <Button size="sm" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Lookup
        </Button>
      </div>
    </div>
  );
}

interface LibraryProduct {
  id: string;
  name: string;
  category: string | null;
  tagline: string;
  image_url: string;
  link: string;
  highlights: string[];
}

function ProductLibraryPicker({ onPick }: { onPick: (p: Omit<FeaturedProduct, "id">) => void }) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["product-library"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_library").select("*").order("name");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        highlights: Array.isArray(p.highlights) ? (p.highlights as string[]) : [],
      })) as LibraryProduct[];
    },
    enabled: open,
  });

  const filtered = products.filter((p) =>
    !q || [p.name, p.category, p.tagline].join(" ").toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm"><Library className="h-4 w-4" /> From library</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>Product library</DialogTitle></DialogHeader>
        <Input placeholder="Search products…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="max-h-[60vh] overflow-y-auto space-y-2 pr-1">
          {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!isLoading && filtered.length === 0 && <p className="text-sm text-muted-foreground">No products. Admins can add some under Admin → Products.</p>}
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onPick({
                  name: p.name,
                  tagline: p.tagline,
                  image_url: p.image_url,
                  link: p.link,
                  highlights: p.highlights,
                });
                setOpen(false);
              }}
              className="w-full text-left rounded-md border border-border p-3 hover:border-primary/60 hover:bg-accent/30 flex gap-3"
            >
              {p.image_url ? (
                <img src={p.image_url} alt="" className="h-14 w-14 object-contain rounded bg-muted" />
              ) : <div className="h-14 w-14 rounded bg-muted" />}
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm">{p.name} {p.category && <span className="text-xs text-muted-foreground">· {p.category}</span>}</p>
                <p className="text-xs text-muted-foreground truncate">{p.tagline}</p>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{p.highlights.slice(0, 2).join(" • ")}</p>
              </div>
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

