## GOSAVI Proposal Builder — v1

**Goal:** A beautiful proposal authoring app branded for GOSAVI Meeting Solutions. Users compose proposals from togglable sections, save revisions, track win/loss, and export to PDF. Estimate PDF parsing is stubbed for v1 and built out in v2 once parser accuracy is validated against more samples.

### Brand (pulled from gosavi.ca)
- **Palette:** Deep navy `#1F2440` (primary), sage teal `#7BBFB1` (accent), off-white `#FAFBFB` (background), warm gray text.
- **Type:** Display — Fraunces (elegant near-serif similar to the site's "Tech & AV" headline). Body — Inter. Both via `@fontsource`.
- **Motifs:** Angled diagonal panels (left edge of hero), generous whitespace, thin underlines.
- A logo placeholder is used until you upload the official SVG; structure is ready to swap.

### Auth & roles (Lovable Cloud)
- Email/password + Google sign-in.
- `user_roles` table with `app_role` enum (`admin`, `user`) — security-definer `has_role()` function, never on profiles.
- First user auto-promoted to admin via trigger if they sign up with a verified `@gosavi.ca` email; manual promote from admin dashboard otherwise.
- Protected routes under `_authenticated/`; admin-only under nested `_admin/`.

### Data model
- `profiles` (id ↔ auth.users, full_name, avatar_url)
- `user_roles` (user_id, role)
- `clients` (id, name, contact_name, email, phone, address, website, notes, owner_id)
- `proposals` (id, owner_id, client_id, title, project_code, status [`draft`|`sent`|`won`|`lost`|`archived`], total_amount, currency, sent_at, decided_at, current_revision_id)
- `proposal_revisions` (id, proposal_id, version, snapshot jsonb, created_by, created_at, note) — every save creates a revision
- `proposal_sections` denormalized inside the revision snapshot (cover, exec_summary, scope, line_items, investment, terms, appendix) each with `enabled: bool`, ordered.
- `estimate_uploads` (id, proposal_id, file_path, parsed_json, status) — file stored in Cloud Storage bucket `estimates` (private).
- RLS: owner read/write own; admin read/write all; everything `GRANT`ed properly.

### Screens
1. **/auth** — sign in / sign up (email + Google).
2. **/** (dashboard) — user's KPI cards (Draft / Sent / Won / Lost, win-rate, $ won), proposal list with filters.
3. **/proposals/new** — create proposal: pick/create client, name, optional estimate PDF upload.
4. **/proposals/$id** — split-pane editor:
   - Left: section toggles + form fields per section (cover details, exec summary rich text, scope bullets, line items table, investment summary auto-totaled, terms preset selector, custom appendix).
   - Right: live preview rendered in the final document style (cover page, headered/footered body pages).
   - Header: status pill, "Save revision", "Mark as Sent/Won/Lost", "Export PDF", revision history dropdown.
5. **/proposals/$id/preview** — full-bleed read-only preview, used for export.
6. **/clients** — basic client CRUD.
7. **/admin** (admin-only) — all users, all proposals, win-rate leaderboard, per-user drill-down.

### Estimate parsing (v1 stub, v2 full)
- v1: upload PDF, store in `estimates` bucket, show "Parsing coming soon — line items can be entered manually." Pre-fill from manual entry.
- v2: server function reads the PDF, uses Lovable AI gateway (Gemini) with structured output to extract `{sections:[{name, items:[{qty, make, model, description, unit_price, ext_price}]}]}` and writes into the proposal's line_items section. CONTI's format from your sample (Qty / Make / Model / Description / Unit MSRP / Discount / Unit Price / Ext. Price grouped by section headers) becomes the reference schema.

### PDF export
- Client-side print stylesheet on `/proposals/$id/preview` (page-break rules, header/footer via `@page`). Browser's "Save as PDF" gives a faithful render of the on-screen design with cover page + branded headers/footers. No server PDF rendering in v1.

### Deferred to v2/v3 (called out, not built)
- Real PDF parsing pipeline
- Web search enrichment (Firecrawl) for client info
- Box integration for case studies
- Product highlights library
- Team/manager role
- Email send

### Tech notes
- TanStack Start, TanStack Query for reads, server fns for writes.
- Editor uses controlled React state per section; autosave creates a new revision every 30s if dirty, plus on explicit save.
- Lovable Cloud enabled in this turn; schema + RLS + grants in one migration; storage bucket created via tool.

### Build order this turn
1. Enable Lovable Cloud, migrations, storage bucket.
2. Design system in `src/styles.css` (brand tokens, fonts).
3. Auth route + `_authenticated` layout + `_admin` layout.
4. Dashboard, clients, proposal create.
5. Proposal editor + live preview with cover/header/footer.
6. Revisions + status changes.
7. Admin dashboard.
8. Print stylesheet for export.

Confirm and I'll build it.