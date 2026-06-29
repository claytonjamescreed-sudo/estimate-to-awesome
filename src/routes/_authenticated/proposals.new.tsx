import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, UploadCloud, Loader2, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { makeDefaultContent } from "@/lib/proposal-defaults";
import type { ClientRow, LineSection } from "@/lib/proposal-types";

export const Route = createFileRoute("/_authenticated/proposals/new")({
  component: NewProposalPage,
});

interface ParsedEstimate {
  project_name?: string;
  reference?: string;
  client_name?: string;
  sections: LineSection[];
}

function NewProposalPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [projectCode, setProjectCode] = useState("");
  const [clientId, setClientId] = useState<string>("");
  const [preparedFor, setPreparedFor] = useState("");
  const [busy, setBusy] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [parsed, setParsed] = useState<ParsedEstimate | null>(null);
  const [pdfText, setPdfText] = useState<string>("");
  const [dragOver, setDragOver] = useState(false);


  const { data: clients = [] } = useQuery({
    queryKey: ["clients", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as unknown as ClientRow[];
    },
  });

  async function handlePdf(file: File) {
    setParsing(true);
    try {
      // Lazy-load pdf.js (legacy build) so the bundle stays slim until first use.
      const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
      const worker = (await import("pdfjs-dist/legacy/build/pdf.worker.mjs?url")).default;
      pdfjs.GlobalWorkerOptions.workerSrc = worker;

      const buf = await file.arrayBuffer();
      const doc = await pdfjs.getDocument({ data: buf }).promise;
      let text = "";
      for (let p = 1; p <= doc.numPages; p++) {
        const page = await doc.getPage(p);
        const content = await page.getTextContent();
        const items = content.items as Array<{ str: string; transform: number[] }>;
        // Group by y to reconstruct lines.
        const lines = new Map<number, string[]>();
        for (const it of items) {
          const y = Math.round(it.transform[5]);
          const arr = lines.get(y) ?? [];
          arr.push(it.str);
          lines.set(y, arr);
        }
        const sortedYs = Array.from(lines.keys()).sort((a, b) => b - a);
        text += sortedYs.map((y) => lines.get(y)!.join(" ").trim()).join("\n") + "\n\n";
      }
      setPdfText(text);
      const result = parseConti(text);
      setParsed(result);
      setPdfText(text);
      const result = parseConti(text);
      setParsed(result);
      // Auto-fill the form from the parsed estimate. Overwrite empty fields;
      // never clobber values the user has already typed.
      if (result.project_name) setTitle((t) => t.trim() ? t : result.project_name!);
      if (result.reference) setProjectCode((c) => c.trim() ? c : result.reference!);
      if (result.client_name) setPreparedFor((p) => p.trim() ? p : result.client_name!);
      const autofilled = [
        result.project_name && "title",
        result.client_name && "prepared-for",
        result.reference && "reference",
      ].filter(Boolean).join(", ");
      toast.success(
        `Parsed ${result.sections.reduce((a, s) => a + s.items.length, 0)} line items` +
        (autofilled ? ` · auto-filled ${autofilled}` : ""),
      );
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "Could not parse the PDF");
    } finally {
      setParsing(false);
    }
  }

  async function createProposal() {
    if (!user) return;
    if (!title.trim()) { toast.error("Give the proposal a title."); return; }
    setBusy(true);
    try {
      const content = makeDefaultContent({
        project_name: title,
        reference: projectCode,
        prepared_for: preparedFor,
        client_name: clients.find((c) => c.id === clientId)?.name || preparedFor,
      });

      if (parsed && parsed.sections.length) {
        content.line_items.sections = parsed.sections;
      }

      const subtotal = content.line_items.sections.reduce(
        (sum, s) => sum + s.items.reduce((a, it) => a + it.qty * it.unit_price, 0),
        0,
      );

      const insert = {
        owner_id: user.id,
        client_id: clientId || null,
        title: title.trim(),
        project_code: projectCode.trim() || null,
        status: "draft" as const,
        currency: "CAD",
        total_amount: subtotal * (1 + content.line_items.tax_rate),
        content: content as never,
      };

      const { data, error } = await supabase
        .from("proposals")
        .insert(insert)
        .select("id")
        .single();
      if (error) throw error;

      // Persist the parsed estimate snapshot alongside the proposal.
      // (file_path stays empty for now — we record the extracted JSON only.)
      if (parsed && data) {
        await supabase.from("estimate_uploads").insert({
          proposal_id: data.id,
          uploaded_by: user.id,
          file_path: `inline:${data.id}`,
          original_name: "Pasted/parsed estimate",
          parsed_json: parsed as never,
        });
      }

      toast.success("Proposal created");
      navigate({ to: "/proposals/$proposalId", params: { proposalId: data!.id } });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not create proposal");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto p-6 lg:p-10">
      <Link to="/proposals" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> All proposals
      </Link>
      <h1 className="font-display text-4xl mt-3">New proposal</h1>
      <p className="text-sm text-muted-foreground mt-1">Start with a blank document, or drop in a CONTI estimate PDF to pre-fill line items.</p>

      <div className="mt-8 space-y-6">
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Proposal title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Tre Altamira — AV Upgrade" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">Project / reference code</Label>
            <Input id="code" value={projectCode} onChange={(e) => setProjectCode(e.target.value)} placeholder="AAAQ15072" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="preparedFor">Prepared for (contact name)</Label>
          <Input id="preparedFor" value={preparedFor} onChange={(e) => setPreparedFor(e.target.value)} placeholder="Jane Smith, Director of Operations" />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="client">Client</Label>
          <select
            id="client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
          >
            <option value="">— Optional, link later —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p className="text-xs text-muted-foreground">Manage clients on the <Link to="/clients" className="underline">Clients</Link> page.</p>
        </div>

        <label
          htmlFor="pdf-upload"
          className={`group relative block cursor-pointer rounded-xl border-2 border-dashed bg-card p-10 text-center transition-all ${dragOver ? "border-accent bg-accent/10 ring-4 ring-accent/20 scale-[1.01]" : "border-border hover:border-accent/60 hover:bg-accent/5"} ${parsing ? "pointer-events-none opacity-70" : ""}`}
          onDragOver={(e) => { e.preventDefault(); if (!parsing) setDragOver(true); }}
          onDragEnter={(e) => { e.preventDefault(); if (!parsing) setDragOver(true); }}
          onDragLeave={(e) => { e.preventDefault(); setDragOver(false); }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (parsing) return;
            const f = Array.from(e.dataTransfer.files).find((file) => file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"));
            if (f) handlePdf(f);
            else if (e.dataTransfer.files.length) toast.error("Drop a PDF file");
          }}
        >
          <div className="flex flex-col items-center gap-3">
            <div className={`h-16 w-16 grid place-items-center rounded-full transition-all ${dragOver ? "bg-accent text-accent-foreground scale-110" : "bg-accent/15 text-accent group-hover:scale-105"}`}>
              <UploadCloud className="h-8 w-8" />
            </div>
            <div>
              <h3 className="font-display text-xl">
                {dragOver ? "Drop your PDF to import" : "Drag & drop your estimate PDF here"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                or <span className="text-accent font-medium underline underline-offset-2">click anywhere to browse</span> · PDF only
              </p>
            </div>
            <p className="text-xs text-muted-foreground max-w-md">
              We'll extract sections and line items (Qty, Make, Model, Description, Unit Price) and pre-load them into your proposal.
            </p>
          </div>
          <input
            id="pdf-upload"
            type="file"
            accept="application/pdf"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handlePdf(f); }}
            disabled={parsing}
            className="sr-only"
          />
        </label>

        {parsing && (
          <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Parsing PDF…
          </p>
        )}
        {parsed && (
          <div className="rounded-md border border-border bg-muted/50 p-4 text-sm">
            <p className="font-medium inline-flex items-center gap-2"><FileText className="h-4 w-4 text-accent" /> Parsed preview</p>
            <ul className="mt-2 space-y-1 text-muted-foreground">
              {parsed.sections.map((s) => (
                <li key={s.id}>· <span className="text-foreground">{s.name}</span> — {s.items.length} item{s.items.length === 1 ? "" : "s"}</li>
              ))}
            </ul>
          </div>
        )}


        <details className="rounded-md border border-border bg-card p-4 open:pb-5">
          <summary className="cursor-pointer text-sm font-medium">Optional pasted text (no PDF)</summary>
          <Textarea
            rows={6}
            placeholder="Paste an estimate's text…"
            value={pdfText}
            onChange={(e) => { setPdfText(e.target.value); const r = parseConti(e.target.value); setParsed(r); }}
            className="mt-3"
          />
        </details>

        <div className="flex justify-end gap-3 pt-2">
          <Button variant="ghost" asChild><Link to="/proposals">Cancel</Link></Button>
          <Button onClick={createProposal} disabled={busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create proposal
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * Best-effort parser for CONTI Electronics estimates. Identifies section
 * headers and detects table rows that start with a quantity integer. Also
 * pulls header metadata (project name, reference code, client/bill-to).
 */
function parseConti(text: string): ParsedEstimate {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const sections: LineSection[] = [];
  let current: LineSection | null = null;
  let project_name: string | undefined;
  let reference: string | undefined;
  let client_name: string | undefined;

  const headerCandidates = /^(Boardroom|Audio|Video|Display|Control|Network|Conference|Meeting Room|Huddle|Training Room|Reception|Lobby|Cabling|Labor|Labour|Programming|Services|Equipment|Mounts?|Cameras?|Microphones?|Speakers?|DSP)/i;
  const refLine = /\b(AAAQ\d+|Q\d{4,}|EST-\d+|ESTIMATE\s*#?\s*\d+)\b/i;
  const moneyTok = /\$?\s?(-?[\d,]+\.\d{2})/g;
  const stopWords = /^(estimate|quote|proposal|date|expires|valid|page|subtotal|total|tax|gst|hst|pst|qty|quantity|description|unit|price|amount|make|model|item|conti|electronics|phone|email|tel|fax|www\.|http)/i;

  // --- Pass 1: header metadata ---
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];

    if (!reference) {
      const m = ln.match(refLine);
      if (m) reference = m[1].replace(/^estimate\s*#?\s*/i, "").trim();
    }

    // Inline "Project: Foo" / "Project Name: Foo" / "RE: Foo" / "Job: Foo"
    if (!project_name && /^(project(\s*name)?|job(\s*name)?|re)\s*[:\-]/i.test(ln)) {
      const after = ln.split(/[:\-]/).slice(1).join(":").trim();
      if (after) project_name = after;
      else if (lines[i + 1] && !stopWords.test(lines[i + 1])) project_name = lines[i + 1];
    }

    // Inline "Client: Foo" / "Customer: Foo" / "Attention: Foo"
    if (!client_name && /^(client|customer|prepared\s*for|attention|attn)\s*[:\-]/i.test(ln)) {
      const after = ln.split(/[:\-]/).slice(1).join(":").trim();
      if (after) client_name = after;
      else if (lines[i + 1] && !stopWords.test(lines[i + 1])) client_name = lines[i + 1];
    }

    // "Bill To" / "Ship To" block — name is usually the first non-empty line below.
    if (!client_name && /^(bill\s*to|ship\s*to|sold\s*to)\s*[:\-]?\s*$/i.test(ln)) {
      for (let j = i + 1; j < Math.min(i + 4, lines.length); j++) {
        const c = lines[j];
        if (c && !stopWords.test(c) && !/^\d/.test(c) && c.length < 80) {
          client_name = c;
          break;
        }
      }
    }
  }

  // Fallback project name: first short, title-cased, non-vendor line near top.
  if (!project_name) {
    for (const ln of lines.slice(0, 25)) {
      if (
        ln.length > 6 && ln.length < 70 &&
        !stopWords.test(ln) &&
        !/conti/i.test(ln) &&
        !/^\d/.test(ln) &&
        !/\$/.test(ln) &&
        /[A-Z]/.test(ln)
      ) { project_name = ln; break; }
    }
  }

  // --- Pass 2: sections + line items ---
  for (const ln of lines) {
    if (headerCandidates.test(ln) && !/^\d/.test(ln) && ln.length < 60 && !/\$/.test(ln)) {
      current = { id: crypto.randomUUID(), name: ln.replace(/\s+\d+$/, "").trim(), items: [] };
      sections.push(current);
      continue;
    }

    const rowMatch = ln.match(/^(\d{1,3})\s+(.+)$/);
    if (rowMatch) {
      const qty = parseInt(rowMatch[1], 10);
      const rest = rowMatch[2];
      const monies = Array.from(rest.matchAll(moneyTok)).map((m) => parseFloat(m[1].replace(/,/g, "")));
      const unit = monies.length >= 2 ? monies[monies.length - 2] : monies[0] ?? 0;
      const stripped = rest.replace(moneyTok, "").trim();
      const tokens = stripped.split(/\s{2,}|\t+/).filter(Boolean);
      const [make = "", model = "", ...descParts] = tokens;
      const description = descParts.join(" ").trim() || tokens.slice(2).join(" ");

      const item = {
        id: crypto.randomUUID(),
        qty,
        make: make || "",
        model: model || "",
        description: description || stripped,
        unit_price: unit || 0,
      };
      if (!current) {
        current = { id: crypto.randomUUID(), name: "Equipment", items: [] };
        sections.push(current);
      }
      current.items.push(item);
    }
  }

  return {
    project_name: project_name?.replace(/\s{2,}/g, " ").trim(),
    reference: reference?.trim(),
    client_name: client_name?.replace(/\s{2,}/g, " ").trim(),
    sections: sections.filter((s) => s.items.length > 0),
  };
}
