import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Printer } from "lucide-react";
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
    <div className="min-h-screen bg-muted/40 py-10">
      <div className="print-hide fixed top-4 right-4 z-50">
        <Button onClick={() => window.print()}><Printer className="h-4 w-4" /> Print / Save as PDF</Button>
      </div>
      <ProposalDocument content={data.content} currency={data.currency} totals={totals} />
    </div>
  );
}
