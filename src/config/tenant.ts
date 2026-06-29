/**
 * TENANT CONFIG — single source of truth for white-label branding.
 *
 * When remixing this app for a new client, edit ONLY this file (plus the
 * logo asset import below) to rebrand. Everything visible to end users —
 * app title, proposal defaults, footer, terms — reads from here.
 *
 * For colors/fonts, see src/styles.css (`@theme` block) which is the
 * other half of the brand surface. Keep this file's `colors` values in
 * sync with the CSS variables there.
 *
 * See MASTER_TEMPLATE.md at the repo root for the full remix checklist.
 */

import gosaviLogo from "@/assets/gosavi-logo.png";

export const tenant = {
  // ─── Identity ────────────────────────────────────────────────────────
  /** Short brand name used in copy ("GOSAVI is pleased to present…") */
  brand: "GOSAVI",
  /** Legal / full company name shown in footers and prepared-by lines */
  legalName: "GOSAVI Meeting Solutions",
  /** Public website (no protocol) shown in document footer */
  website: "gosavi.ca",
  /** Browser tab title */
  appTitle: "GOSAVI Proposal Builder",
  /** Meta description for the app shell */
  appDescription:
    "Beautiful AV proposals for GOSAVI Meeting Solutions — drafted in minutes.",
  /** Logo shown in proposal document header + cover. Import the asset above. */
  logo: gosaviLogo,

  // ─── Brand colors (mirror src/styles.css @theme tokens) ──────────────
  // Edit these AND the matching `--color-*` vars in src/styles.css together.
  colors: {
    ink: "#1F2440", // Deep Navy — primary text / dark surfaces
    paper: "#FAF8F3", // Warm off-white — light surfaces
    accent: "#7BBFB1", // Sage Teal — highlights, rules, accents
  },

  // ─── Proposal defaults ───────────────────────────────────────────────
  proposal: {
    /** Default "Prepared by" line on new proposals */
    preparedBy: "GOSAVI Meeting Solutions",
    /** Default cover headline */
    coverHeadline: "A Proposal for Connected Work",
    /** Default cover subheadline */
    coverSubheadline:
      "Audio-visual and meeting-room solutions, designed and delivered.",
    /** Default executive summary body */
    execSummary:
      "GOSAVI is pleased to present this proposal for the design, supply, and installation of meeting-room technology tailored to your team's workflow. Our approach combines best-in-class hardware with discreet, durable installation and ongoing managed support.",
    /** Default investment / pricing note */
    investmentNote:
      "Pricing is in Canadian dollars and excludes applicable taxes. A 50% deposit confirms project scheduling.",
    /** Default tax rate applied to line items (0.12 = 12%) */
    defaultTaxRate: 0.12,
    /** Heading shown above the "Why us" client-spotlight block */
    whyUsHeading: "Why GOSAVI",
  },

  // ─── Terms & Conditions ──────────────────────────────────────────────
  /** Full standard terms body. Edit per-tenant. */
  standardTerms: `1. Estimate Validity
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
This proposal and its contents are confidential between GOSAVI Meeting Solutions and the named client.`,

  // ─── Feature toggles (tenant-level) ──────────────────────────────────
  // Hide entire capabilities per tenant. Section-level toggles on
  // individual proposals are separate (see proposal-types.ts).
  features: {
    clientSpotlight: true,
    featuredProducts: true,
    productLibrary: true,
    aiClientLookup: true,
    aiProductEnrichment: true,
    estimatePdfUpload: true,
    feedbackWidget: true,
  },

  // ─── Admin domain auto-grant ─────────────────────────────────────────
  // Email domain whose confirmed users are auto-promoted to admin.
  // See public.grant_admin_for_gosavi() in the database — keep in sync.
  adminEmailDomain: "gosavi.ca",
} as const;

export type TenantConfig = typeof tenant;
