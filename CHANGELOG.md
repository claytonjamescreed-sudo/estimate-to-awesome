# Changelog

All notable features and fixes to the **master template**. Update this every
time you ship something here, so you know what's available to port to client
instances. See `MASTER_TEMPLATE.md` for the porting workflow.

Format: each entry lists the date, a short feature name, the files touched
(so a port is targeted, not a hunt), and any DB migration involved.

---

## [Unreleased]

## [2026-06-29]

### Added
- **Tenant config + remix checklist.** Single source of truth for white-label
  branding moved into `src/config/tenant.ts`. New `MASTER_TEMPLATE.md` at repo
  root documents every customization point for a client remix.
  - Files: `src/config/tenant.ts` (new), `MASTER_TEMPLATE.md` (new),
    `CHANGELOG.md` (new), `src/lib/proposal-defaults.ts`,
    `src/routes/__root.tsx`, `src/components/proposal-document.tsx`
  - DB: none

## [Earlier — backfilled]

### Added
- **Featured Products: full-width horizontal card layout** — image panel +
  two-column highlights grid for better page utilization.
  - Files: `src/components/proposal-document.tsx`
- **Product enrichment from estimate** — AI identifies products from a parsed
  estimate, finds manufacturer pages, generates featured-product cards with
  images and highlights.
  - Files: `src/lib/product-enrich.functions.ts`
- **AI client lookup** — server function that scrapes a client's website via
  Gemini and auto-fills the Client Spotlight section.
  - Files: `src/lib/client-lookup.functions.ts`
- **Product library** — admin-managed reusable product catalog.
  - Files: `src/routes/_authenticated/products.tsx` and related
  - DB migration: `product_library` table + RLS
- **Feedback / client requests system** — floating button on every page,
  admin-only `/admin/requests` triage page.
  - Files: `src/components/feedback-form.tsx`, `src/routes/_authenticated/admin/requests.tsx`
  - DB migration: `client_requests` table + RLS
- **Client Spotlight + Featured Products sections** — toggleable, AI-enriched.
  - Files: `src/lib/proposal-types.ts`, `src/components/proposal-document.tsx`
- **PDF estimate parser** for CONTI Electronics format.
  - Files: `src/routes/_authenticated/proposals.new.tsx` (uses `pdfjs-dist`)
- **Proposal editor** — split-pane with live document preview.
  - Files: `src/routes/_authenticated/proposals.$proposalId.tsx`
- **User + Admin dashboards** — per-user pipeline metrics + master admin view.
- **Auth** — Email/Password + Google OAuth.
- **Branded design system** — Deep Navy / Sage Teal palette, Fraunces +
  Inter typography, print stylesheet for PDF export.
  - Files: `src/styles.css`
- **Schema foundation** — `profiles`, `user_roles`, `clients`, `proposals`,
  `proposal_revisions`, `estimate_uploads`, `estimates` storage bucket, RLS
  policies, `has_role()` security-definer function, auto-admin-grant for
  `gosavi.ca` domain.
