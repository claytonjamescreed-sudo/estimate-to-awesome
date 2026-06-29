import type { ProposalContent } from "./proposal-types";

export const STANDARD_TERMS = `1. Estimate Validity
Pricing herein is valid for thirty (30) days from the date of issue. Onsite conditions and supply-chain fluctuations may impact final pricing.

2. Payment Terms
50% deposit due on acceptance. Balance due net 30 from substantial completion. All amounts in CAD unless otherwise noted; applicable taxes are extra.

3. Scope
This proposal covers the equipment, programming, and labour described above. Items outside this scope (network configuration, account provisioning, third-party software, structural modifications) are billable as change orders.

4. Warranty
Manufacturer warranties are passed through to the client. GOSAVI provides a one (1) year workmanship warranty on installation labour from date of project sign-off.

5. Site Readiness
Client is responsible for providing power, network connectivity, and unobstructed access at scheduled install times. Delays caused by site conditions are billed at prevailing rates.

6. Confidentiality
This proposal and its contents are confidential between GOSAVI Meeting Solutions and the named client.`;

export function makeDefaultContent(overrides: Partial<ProposalContent["cover"]> = {}): ProposalContent {
  return {
    cover: {
      enabled: true,
      headline: "A Proposal for Connected Work",
      subheadline: "Audio-visual and meeting-room solutions, designed and delivered.",
      client_name: overrides.client_name ?? "",
      project_name: overrides.project_name ?? "",
      prepared_for: overrides.prepared_for ?? "",
      prepared_by: overrides.prepared_by ?? "GOSAVI Meeting Solutions",
      date: new Date().toISOString().slice(0, 10),
      reference: overrides.reference ?? "",
    },
    exec_summary: {
      enabled: true,
      body:
        "GOSAVI is pleased to present this proposal for the design, supply, and installation of meeting-room technology tailored to your team's workflow. Our approach combines best-in-class hardware with discreet, durable installation and ongoing managed support.",
    },
    scope: {
      enabled: true,
      bullets: [
        "Discovery workshop and room walkthrough",
        "Equipment supply and project management",
        "Professional installation and commissioning",
        "End-user training and handover documentation",
      ],
    },
    client_spotlight: {
      enabled: false,
      logo_url: "",
      industry: "",
      hq: "",
      size: "",
      about: "",
      challenge: "",
      why_us: "",
    },
    featured_products: {
      enabled: false,
      intro: "Hand-picked solutions central to this design.",
      products: [],
    },
    line_items: {
      enabled: true,
      sections: [
        {
          id: crypto.randomUUID(),
          name: "Display & Mounts",
          items: [],
        },
      ],
      tax_rate: 0.12,
    },
    investment: {
      enabled: true,
      note: "Pricing is in Canadian dollars and excludes applicable taxes. A 50% deposit confirms project scheduling.",
    },
    terms: { enabled: true, preset: "standard", body: STANDARD_TERMS },
    appendix: { enabled: false, title: "Case Studies & References", body: "" },
  };
}

export function calcLineItemsTotal(content: ProposalContent): { subtotal: number; tax: number; total: number } {
  const subtotal = content.line_items.enabled
    ? content.line_items.sections.reduce(
        (sum, s) => sum + s.items.reduce((a, it) => a + (Number(it.qty) || 0) * (Number(it.unit_price) || 0), 0),
        0,
      )
    : 0;
  const tax = subtotal * (content.line_items.tax_rate || 0);
  return { subtotal, tax, total: subtotal + tax };
}
