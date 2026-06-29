import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ProposalDocument } from "@/components/proposal-document";
import { calcLineItemsTotal } from "@/lib/proposal-defaults";
import { generateProposalPdf, downloadBlob } from "@/lib/generate-pdf";
import type { ProposalRow } from "@/lib/proposal-types";

export const Route = createFileRoute("/_authenticated/proposals/$proposalId/preview")({
  component: PreviewPage,
});

function safeFilename(s: string) {
  return (s || "proposal").replace(/[^a-z0-9-_]+/gi, "_").replace(/^_+|_+$/g, "") + ".pdf";
}

function PreviewPage() {
  const { proposalId } = useParams({ from: "/_authenticated/proposals/$proposalId/preview" });
  const { data, isLoading } = useQuery({
    queryKey: ["proposal", proposalId],
    queryFn: async () => {
      const { data, error } = await supabase.from("proposals").select("*").eq("id", proposalId).single();
      if (error) throw error;
      return data as unknown as ProposalRow;
    },
  });

  const docRef = useRef<HTMLDivElement>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [building, setBuilding] = useState(false);

  useEffect(() => { if (data) document.title = `${data.title} — Proposal`; }, [data]);

  // Generate PDF as soon as the document is rendered
  useEffect(() => {
    if (!data || !docRef.current || pdfUrl) return;
    let cancelled = false;
    setBuilding(true);
    // Defer one tick so fonts & images settle
    const t = setTimeout(async () => {
      try {
        await (document as Document & { fonts?: { ready: Promise<unknown> } }).fonts?.ready;
        const blob = await generateProposalPdf(docRef.current!);
        if (cancelled) return;
        const url = URL.createObjectURL(blob);
        setPdfBlob(blob);
        setPdfUrl(url);
      } catch (e) {
        console.error(e);
        toast.error("Couldn't build the PDF preview. Try again.");
      } finally {
        if (!cancelled) setBuilding(false);
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(t); };
  }, [data, pdfUrl]);

  useEffect(() => () => { if (pdfUrl) URL.revokeObjectURL(pdfUrl); }, [pdfUrl]);

  const handleDownload = () => {
    if (!pdfBlob || !data) return;
    downloadBlob(pdfBlob, safeFilename(data.title));
  };

  if (isLoading || !data) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  const totals = calcLineItemsTotal(data.content);

  return (
    <div className="min-h-screen bg-muted/40 flex flex-col">
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/proposals/$proposalId" params={{ proposalId }}>
              <ArrowLeft className="h-4 w-4" /> Back to editor
            </Link>
          </Button>
          <div className="text-sm text-muted-foreground truncate px-4">{data.title}</div>
          <div className="flex items-center gap-2">
            <Button size="sm" onClick={handleDownload} disabled={!pdfBlob || building}>
              {building ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {building ? "Building PDF…" : "Download PDF"}
            </Button>
          </div>
        </div>
      </div>

      {/* In-browser PDF viewer */}
      <div className="flex-1 relative">
        {pdfUrl ? (
          <iframe title="Proposal PDF" src={pdfUrl} className="w-full h-[calc(100vh-57px)] border-0 bg-white" />
        ) : (
          <div className="flex items-center justify-center py-20 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Building PDF preview…
          </div>
        )}
      </div>

      {/* Off-screen render source — used by html2canvas, not shown to the user */}
      <div
        aria-hidden
        style={{ position: "fixed", left: "-10000px", top: 0, width: "8.5in", pointerEvents: "none" }}
      >
        <div ref={docRef}>
          <ProposalDocument content={data.content} currency={data.currency} totals={totals} />
        </div>
      </div>
    </div>
  );
}
