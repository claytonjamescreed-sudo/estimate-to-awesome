import { createFileRoute, useParams, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { ArrowLeft, Download, Printer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ProposalDocument } from "@/components/proposal-document";
import { calcLineItemsTotal } from "@/lib/proposal-defaults";
import type { ProposalRow } from "@/lib/proposal-types";

export const Route = createFileRoute("/_authenticated/proposals/$proposalId/preview")({
  component: PreviewPage,
});

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

  useEffect(() => { if (data) document.title = `${data.title} — Proposal`; }, [data]);

  if (isLoading || !data) return <div className="p-10 text-center text-muted-foreground">Loading…</div>;
  const totals = calcLineItemsTotal(data.content);

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Floating toolbar — hidden in print */}
      <div className="print-hide sticky top-0 z-50 bg-background/95 backdrop-blur border-b border-border">
        <div className="max-w-5xl mx-auto flex items-center justify-between px-4 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/proposals/$proposalId" params={{ proposalId }}>
              <ArrowLeft className="h-4 w-4" /> Back to editor
            </Link>
          </Button>
          <div className="text-sm text-muted-foreground truncate px-4">{data.title}</div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="h-4 w-4" /> Print
            </Button>
            <Button size="sm" onClick={() => window.print()}>
              <Download className="h-4 w-4" /> Download PDF
            </Button>
          </div>
        </div>
        <div className="max-w-5xl mx-auto px-4 pb-2 text-[11px] text-muted-foreground">
          Tip: in the print dialog choose <span className="font-medium">Save as PDF</span> as the destination, set margins to <span className="font-medium">None</span>, and enable <span className="font-medium">Background graphics</span> for full branding.
        </div>
      </div>

      <div className="py-10 space-y-8 print:py-0 print:space-y-0">
        <ProposalDocument content={data.content} currency={data.currency} totals={totals} />
      </div>
    </div>
  );
}
