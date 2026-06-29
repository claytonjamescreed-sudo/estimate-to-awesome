import type { ProposalContent } from "./proposal-types";
import { tenant } from "@/config/tenant";

export const STANDARD_TERMS = tenant.standardTerms;

export function makeDefaultContent(overrides: Partial<ProposalContent["cover"]> = {}): ProposalContent {
  return {
    cover: {
      enabled: true,
      headline: tenant.proposal.coverHeadline,
      subheadline: tenant.proposal.coverSubheadline,
      client_name: overrides.client_name ?? "",
      project_name: overrides.project_name ?? "",
      prepared_for: overrides.prepared_for ?? "",
      prepared_by: overrides.prepared_by ?? tenant.proposal.preparedBy,
      date: new Date().toISOString().slice(0, 10),
      reference: overrides.reference ?? "",
    },
    exec_summary: {
      enabled: true,
      body: tenant.proposal.execSummary,
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
      tax_rate: tenant.proposal.defaultTaxRate,
    },
    investment: {
      enabled: true,
      note: tenant.proposal.investmentNote,
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
