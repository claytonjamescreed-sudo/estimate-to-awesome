# MASTER TEMPLATE — Remix Checklist

This project is the **master template** for the GOSAVI Proposal Builder.
When you remix it for a new client, work through this checklist top-to-bottom.
Estimated time for a clean remix: **30–60 minutes**.

---

## 1. Branding & Identity (5 min)

Edit **`src/config/tenant.ts`** — single source of truth for white-label copy.

- [ ] `brand` — short name (e.g. "ACME")
- [ ] `legalName` — full company name (footers, prepared-by)
- [ ] `website` — domain without protocol
- [ ] `appTitle` — browser tab title
- [ ] `appDescription` — meta description
- [ ] `proposal.preparedBy`, `coverHeadline`, `coverSubheadline`, `execSummary`, `investmentNote`, `whyUsHeading`
- [ ] `standardTerms` — full legal body, including warranty/jurisdiction
- [ ] `adminEmailDomain` — email domain to auto-promote to admin

## 2. Logo (5 min)

- [ ] Replace `src/assets/gosavi-logo.png` with the client's logo (keep filename **or** update the import in `src/config/tenant.ts`)
- [ ] Replace `public/favicon.ico` with the client's favicon

## 3. Colors & Fonts (10 min)

Brand colors live in **two synchronized places** — update both.

- [ ] `src/config/tenant.ts` → `colors` block (ink / paper / accent)
- [ ] `src/styles.css` → `@theme` block — update the matching `--color-ink`, `--color-paper`, `--color-accent` CSS variables
- [ ] If swapping fonts: update the Google Fonts `<link>` in `src/routes/__root.tsx` and the `--font-display` / `--font-sans` tokens in `src/styles.css`

## 4. Database — Admin Auto-Grant (5 min)

The DB function `public.grant_admin_for_gosavi()` auto-promotes confirmed users from a specific email domain to admin.

- [ ] Run a migration to update the function: rename it and change the hard-coded domain `'gosavi.ca'` to the new tenant's domain (must match `tenant.adminEmailDomain`)
- [ ] Create at least one admin account for the client during onboarding

## 5. Feature Toggles (2 min)

In `src/config/tenant.ts` → `features` block, disable anything this tenant didn't pay for or doesn't want:

- [ ] `clientSpotlight`, `featuredProducts`, `productLibrary`
- [ ] `aiClientLookup`, `aiProductEnrichment`
- [ ] `estimatePdfUpload`
- [ ] `feedbackWidget`

## 6. Integrations (variable — 0 to several hours)

Most tenants want one or more of these. Each is an opt-in plugin.

- [ ] **Zoho Books/Invoice** — connect via Lovable connector (Settings → Connectors)
- [ ] **QuoteWerks / Q360 / on-prem estimating tools** — custom server function per client (~3–5 hrs)
- [ ] **CRM sync** (HubSpot / Salesforce / Pipedrive) — all native connectors

### 6a. Per-user cloud storage OAuth (Google Drive / OneDrive / SharePoint)

The OAuth code is **already wired** (see `src/lib/oauth.functions.ts` + `src/routes/api/public/oauth/*`). It activates the moment the 4 secrets below are added. **Do this AFTER the custom domain is live** so the redirect URI is stable.

**Redirect URIs to register** (using the client's custom domain, e.g. `proposals.client.com`):
- Google: `https://proposals.client.com/api/public/oauth/google/callback`
- Microsoft (handles both OneDrive + SharePoint): `https://proposals.client.com/api/public/oauth/microsoft/callback`

**Google Cloud Console** ([console.cloud.google.com](https://console.cloud.google.com/apis/credentials)):
1. Enable the Google Drive API
2. Configure OAuth consent screen → add scope `https://www.googleapis.com/auth/drive.readonly`
3. Create OAuth Client ID → Web application → add redirect URI above
4. Copy Client ID + Client Secret

**Microsoft Entra / Azure** ([portal.azure.com](https://portal.azure.com/#blade/Microsoft_AAD_RegisteredApps/ApplicationsListBlade)):
1. New registration → "Accounts in any organizational directory and personal Microsoft accounts"
2. Add Web redirect URI above
3. API permissions → Microsoft Graph → Delegated: `Files.Read`, `Files.Read.All`, `Sites.Read.All`, `offline_access`, `User.Read`
4. Certificates & secrets → New client secret → copy the **value** (not the ID)

**Add 4 secrets to the project** (via the Cloud secrets manager):
- [ ] `GOOGLE_OAUTH_CLIENT_ID`
- [ ] `GOOGLE_OAUTH_CLIENT_SECRET`
- [ ] `MICROSOFT_OAUTH_CLIENT_ID`
- [ ] `MICROSOFT_OAUTH_CLIENT_SECRET`

Once added, the Connect buttons on `/connections` go live for every end user — no code changes needed.

## 7. Defaults to Sanity-Check (5 min)

- [ ] `tax_rate` in `tenant.proposal.defaultTaxRate` — match client's province/region
- [ ] Currency — codebase assumes CAD; search for `"CAD"` and `$` if changing
- [ ] Email-from address if transactional emails are enabled

## 8. Pre-Launch Verification (10 min)

- [ ] Sign up with a test account → confirm role assignment works
- [ ] Create a sample proposal → render the PDF → check logo, colors, footer
- [ ] Upload a sample estimate PDF → confirm parsing
- [ ] If AI features enabled: trigger client lookup + product enrichment once
- [ ] Confirm admin dashboard shows the test proposal

## 9. Hand-off

- [ ] Create the client's admin user, share credentials securely
- [ ] Set custom domain in Lovable project settings (e.g. `proposals.clientdomain.com`)
- [ ] Add this remix's name + date to your internal client tracker
- [ ] Bookmark the project so cross-project ports from the master template are one search away

---

## When porting features FROM the master template

When you ship a new feature in the master, propagate it to existing client instances:

1. Open the client project in Lovable
2. Ask the agent: *"From @master-template, pull in [feature name] (see CHANGELOG entry [date])"*
3. The agent uses cross-project file reading to copy the relevant files
4. Review the diff, test, ship

Track everything you ship in **`CHANGELOG.md`** so you know what's available to port.
