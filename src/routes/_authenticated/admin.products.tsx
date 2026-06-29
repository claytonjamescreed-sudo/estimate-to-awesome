import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Plus, Trash2, Save, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/admin/products")({
  component: AdminProductsPage,
});

interface ProductRow {
  id: string;
  name: string;
  category: string | null;
  tagline: string;
  image_url: string;
  link: string;
  highlights: string[];
}

function AdminProductsPage() {
  const { isAdmin, loading } = useAuth();
  if (!loading && !isAdmin) return <Navigate to="/dashboard" replace />;

  const qc = useQueryClient();
  const { data: products = [], isLoading } = useQuery({
    queryKey: ["product-library", "admin"],
    queryFn: async () => {
      const { data, error } = await supabase.from("product_library").select("*").order("name");
      if (error) throw error;
      return (data ?? []).map((p) => ({
        ...p,
        highlights: Array.isArray(p.highlights) ? (p.highlights as string[]) : [],
      })) as ProductRow[];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_library").insert({
        name: "New product", category: "", tagline: "", image_url: "", link: "", highlights: [],
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product-library"] }); toast.success("Product added"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl">Product library</h1>
          <p className="text-sm text-muted-foreground">Curated solutions any user can drop into a proposal.</p>
        </div>
        <Button onClick={() => create.mutate()} disabled={create.isPending}><Plus className="h-4 w-4" /> Add product</Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : products.length === 0 ? (
        <div className="border border-dashed border-border rounded-lg p-10 text-center">
          <Package className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="mt-2 text-sm text-muted-foreground">No products yet.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {products.map((p) => <ProductCard key={p.id} initial={p} />)}
        </div>
      )}
    </div>
  );
}

function ProductCard({ initial }: { initial: ProductRow }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<ProductRow>(initial);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_library").update({
        name: draft.name,
        category: draft.category,
        tagline: draft.tagline,
        image_url: draft.image_url,
        link: draft.link,
        highlights: draft.highlights,
      }).eq("id", draft.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product-library"] }); toast.success("Saved"); },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("product_library").delete().eq("id", draft.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["product-library"] }); toast.success("Deleted"); },
  });

  return (
    <div className="rounded-lg border border-border bg-card p-4 grid md:grid-cols-[120px_1fr] gap-4">
      <div>
        {draft.image_url ? (
          <img src={draft.image_url} alt="" className="h-28 w-28 object-contain rounded bg-muted" />
        ) : <div className="h-28 w-28 rounded bg-muted" />}
      </div>
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Name</Label><Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></div>
          <div><Label className="text-xs">Category</Label><Input value={draft.category ?? ""} onChange={(e) => setDraft({ ...draft, category: e.target.value })} /></div>
        </div>
        <div><Label className="text-xs">Tagline</Label><Input value={draft.tagline} onChange={(e) => setDraft({ ...draft, tagline: e.target.value })} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><Label className="text-xs">Image URL</Label><Input value={draft.image_url} onChange={(e) => setDraft({ ...draft, image_url: e.target.value })} /></div>
          <div><Label className="text-xs">Product link</Label><Input value={draft.link} onChange={(e) => setDraft({ ...draft, link: e.target.value })} /></div>
        </div>
        <div>
          <Label className="text-xs">Highlights (one per line)</Label>
          <Textarea
            rows={4}
            value={draft.highlights.join("\n")}
            onChange={(e) => setDraft({ ...draft, highlights: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) })}
          />
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" className="text-destructive" onClick={() => { if (confirm("Delete?")) del.mutate(); }}>
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}><Save className="h-4 w-4" /> Save</Button>
        </div>
      </div>
    </div>
  );
}
