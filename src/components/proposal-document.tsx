import type { LineItem, LineSection, ProposalContent } from "@/lib/proposal-types";
import { money, shortDate } from "@/lib/format";
import { tenant } from "@/config/tenant";

interface Props {
  content: ProposalContent;
  currency: string;
  totals: { subtotal: number; tax: number; total: number };
}

/**
 * The rendered proposal — used for live preview AND print/PDF export.
 * Two page sizes (cover + body) are letter-sized in CSS so window.print()
 * produces a clean, branded PDF without round-tripping through a server.
 */
export function ProposalDocument({ content, currency, totals }: Props) {
  const investmentPages = paginateInvestmentSections(content.line_items.sections, content.investment.enabled && Boolean(content.investment.note));

  return (
    <div className="space-y-8">
      {content.cover.enabled && <Cover content={content} />}
      {content.exec_summary.enabled && (
        <BodyPage title="Executive Summary" subtitle={content.cover.client_name}>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink/85">{content.exec_summary.body}</p>
        </BodyPage>
      )}
      {content.client_spotlight?.enabled && (
        <BodyPage title="Client Spotlight" subtitle={content.cover.client_name}>
          <ClientSpotlightBlock content={content} />
        </BodyPage>
      )}
      {content.scope.enabled && (
        <BodyPage title="Scope of Work" subtitle={content.cover.client_name}>
          <ul className="space-y-3">
            {content.scope.bullets.filter(Boolean).map((b, i) => (
              <li key={i} className="flex gap-3 text-[15px] text-ink/85">
                <span className="mt-2 h-1.5 w-1.5 rounded-full bg-accent shrink-0" />
                <span>{b}</span>
              </li>
            ))}
          </ul>
        </BodyPage>
      )}
      {content.featured_products?.enabled && content.featured_products.products.length > 0 && (
        <BodyPage title="Featured Products" subtitle={content.cover.client_name}>
          {content.featured_products.intro && (
            <p className="text-[14px] text-ink/75 mb-6 max-w-2xl">{content.featured_products.intro}</p>
          )}
          <div className="space-y-5">
            {content.featured_products.products.map((p) => (
              <div key={p.id} className="rounded-lg border border-ink/15 overflow-hidden p-5">
                <h3 className="font-display text-xl text-ink leading-tight">{p.name}</h3>
                {p.tagline && <p className="text-[11px] uppercase tracking-wider text-accent mt-1">{p.tagline}</p>}
                {p.highlights.filter(Boolean).length > 0 && (
                  <ul className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1.5 text-[13px] text-ink/80">
                    {p.highlights.filter(Boolean).map((h, i) => (
                      <li key={i} className="flex gap-2 min-w-0">
                        <span className="mt-1.5 h-1 w-1 rounded-full bg-accent shrink-0" /><span className="break-words">{h}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {p.link && <p className="mt-3 text-[11px] text-ink/50 break-all">{p.link}</p>}
              </div>
            ))}

          </div>
        </BodyPage>
      )}
      {content.line_items.enabled && investmentPages.map((page, index) => (
        <BodyPage
          key={`investment-${index}`}
          title={index === 0 ? "Investment Detail" : "Investment Detail (continued)"}
          subtitle={content.cover.client_name}
        >
          <InvestmentPageContent
            page={page}
            currency={currency}
            totals={totals}
            taxRate={content.line_items.tax_rate}
            investmentNote={content.investment.enabled ? content.investment.note : ""}
          />
        </BodyPage>
      ))}
      {content.terms.enabled && (
        <BodyPage title="Terms & Conditions" subtitle={content.cover.client_name}>
          <p className="text-[13px] leading-relaxed whitespace-pre-wrap text-ink/80">{content.terms.body}</p>
        </BodyPage>
      )}
      {content.appendix.enabled && (
        <BodyPage title={content.appendix.title || "Appendix"} subtitle={content.cover.client_name}>
          <p className="text-[14px] leading-relaxed whitespace-pre-wrap text-ink/85">{content.appendix.body}</p>
        </BodyPage>
      )}
    </div>
  );
}

type InvestmentPageSection = {
  id: string;
  name: string;
  items: LineItem[];
  total: number;
  continued: boolean;
  showTotal: boolean;
};

type InvestmentPage = {
  sections: InvestmentPageSection[];
  showSummary: boolean;
};

const INVESTMENT_PAGE_UNITS = 16;

function rowUnits(item: LineItem) {
  const textLength = `${item.make} ${item.model} ${item.description}`.length;
  return Math.max(1, Math.ceil(textLength / 115));
}

function paginateInvestmentSections(sections: LineSection[], hasInvestmentNote: boolean): InvestmentPage[] {
  const pages: InvestmentPage[] = [];
  let current: InvestmentPage = { sections: [], showSummary: false };
  let used = 0;

  const commit = () => {
    if (current.sections.length > 0 || current.showSummary) pages.push(current);
    current = { sections: [], showSummary: false };
    used = 0;
  };

  for (const section of sections) {
    const total = section.items.reduce((a, it) => a + it.qty * it.unit_price, 0);

    if (section.items.length === 0) {
      if (used > 0 && used + 3 > INVESTMENT_PAGE_UNITS) commit();
      current.sections.push({ id: section.id, name: section.name, items: [], total, continued: false, showTotal: true });
      used += 3;
      continue;
    }

    let index = 0;
    while (index < section.items.length) {
      const continued = index > 0;
      const headerUnits = 3;
      if (used > 0 && used + headerUnits + rowUnits(section.items[index]) > INVESTMENT_PAGE_UNITS) commit();

      const chunk: LineItem[] = [];
      let chunkUnits = headerUnits;

      while (index < section.items.length) {
        const itemUnits = rowUnits(section.items[index]);
        if (chunk.length > 0 && used + chunkUnits + itemUnits > INVESTMENT_PAGE_UNITS) break;
        chunk.push(section.items[index]);
        chunkUnits += itemUnits;
        index += 1;
      }

      current.sections.push({
        id: `${section.id}-${index}`,
        name: section.name,
        items: chunk,
        total,
        continued,
        showTotal: index >= section.items.length,
      });
      used += chunkUnits;

      if (index < section.items.length) commit();
    }
  }

  const summaryUnits = hasInvestmentNote ? 5 : 4;
  if (used > 0 && used + summaryUnits > INVESTMENT_PAGE_UNITS) commit();
  current.showSummary = true;
  commit();

  return pages.length > 0 ? pages : [{ sections: [], showSummary: true }];
}

function InvestmentPageContent({
  page,
  currency,
  totals,
  taxRate,
  investmentNote,
}: {
  page: InvestmentPage;
  currency: string;
  totals: Props["totals"];
  taxRate: number;
  investmentNote: string;
}) {
  return (
    <div className="space-y-5">
      {page.sections.map((section) => (
        <div key={section.id} data-pdf-section>
          <div className="flex items-baseline justify-between border-b border-ink/15 pb-2 mb-2 gap-6">
            <h3 className="font-display text-lg text-ink leading-tight break-words">
              {section.name}{section.continued ? " (continued)" : ""}
            </h3>
            <span className="text-sm text-ink/60 tabular-nums shrink-0">
              {section.showTotal ? money(section.total, currency) : "continued"}
            </span>
          </div>
          <table className="w-full table-fixed text-[12px] leading-snug">
            <thead>
              <tr className="text-left text-[10px] uppercase tracking-wider text-ink/50">
                <th className="py-1.5 w-[7%]">Qty</th>
                <th className="py-1.5 w-[17%]">Make</th>
                <th className="py-1.5 w-[19%]">Model</th>
                <th className="py-1.5 w-[31%]">Description</th>
                <th className="py-1.5 w-[12%] text-right">Unit</th>
                <th className="py-1.5 w-[14%] text-right">Ext.</th>
              </tr>
            </thead>
            <tbody>
              {section.items.map((it) => (
                <tr key={it.id} className="align-top border-t border-ink/10">
                  <td className="py-1.5 pr-1 tabular-nums break-words">{it.qty}</td>
                  <td className="py-1.5 pr-2 break-words">{it.make}</td>
                  <td className="py-1.5 pr-2 font-mono text-[11px] break-words">{it.model}</td>
                  <td className="py-1.5 pr-2 break-words">{it.description}</td>
                  <td className="py-1.5 pl-1 text-right tabular-nums break-words">{money(it.unit_price, currency)}</td>
                  <td className="py-1.5 pl-1 text-right tabular-nums break-words">{money(it.qty * it.unit_price, currency)}</td>
                </tr>
              ))}
              {section.items.length === 0 && (
                <tr><td colSpan={6} className="py-3 text-center text-ink/40 italic text-xs">No items in this section</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ))}

      {page.showSummary && (
        <div className="pt-2 space-y-4" data-pdf-section>
          <div className="ml-auto w-72 border-t-2 border-ink/80 pt-3 space-y-1.5 text-[13px]">
            <div className="flex justify-between"><span className="text-ink/60">Subtotal</span><span className="tabular-nums">{money(totals.subtotal, currency)}</span></div>
            <div className="flex justify-between"><span className="text-ink/60">Tax ({(taxRate * 100).toFixed(0)}%)</span><span className="tabular-nums">{money(totals.tax, currency)}</span></div>
            <div className="flex justify-between font-display text-lg pt-1 border-t border-ink/20">
              <span>Total</span><span className="tabular-nums">{money(totals.total, currency)}</span>
            </div>
          </div>

          {investmentNote && (
            <p className="text-xs text-ink/60 italic border-l-2 border-accent pl-3">{investmentNote}</p>
          )}
        </div>
      )}
    </div>
  );
}

function Cover({ content }: { content: ProposalContent }) {
  const c = content.cover;
  return (
    <article className="doc-page doc-cover">
      <div className="brand-diagonal" />
      <div className="relative flex flex-col h-full p-14">
        {/* Top: logo */}
        <header className="flex items-center justify-between">
          <BrandMark light />
          <div className="text-right text-xs uppercase tracking-[0.2em] text-paper/60">
            Proposal · {shortDate(c.date)}
          </div>
        </header>

        {/* Middle: title block */}
        <div className="flex-1 flex flex-col justify-center max-w-2xl mt-12">
          <div className="brand-rule mb-8" />
          <p className="text-sm uppercase tracking-[0.25em] text-accent">Prepared for {c.prepared_for || c.client_name || "—"}</p>
          <h1 className="font-display text-[68px] leading-[0.95] tracking-tight mt-4">
            {c.headline}
          </h1>
          <p className="mt-6 text-lg text-paper/80 max-w-xl leading-relaxed">{c.subheadline}</p>

          {c.project_name && (
            <p className="mt-10 font-display text-2xl italic text-paper/90">{c.project_name}</p>
          )}
        </div>

        {/* Bottom: meta */}
        <footer className="grid grid-cols-3 gap-6 pt-8 border-t border-paper/15 text-xs">
          <Meta label="Client" value={c.client_name || "—"} />
          <Meta label="Reference" value={c.reference || "—"} />
          <Meta label="Prepared by" value={c.prepared_by || tenant.legalName} />
        </footer>
      </div>
    </article>
  );
}

function BodyPage({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <article className="doc-page text-ink">
      <div className="flex flex-col h-full px-14 py-12">
        <header className="flex items-center justify-between pb-4 border-b border-ink/15">
          <BrandMark />
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.25em] text-ink/50">{subtitle || "Proposal"}</p>
          </div>
        </header>
        <div className="mt-10 flex-1">
          <div className="brand-rule mb-4" />
          <h2 className="font-display text-4xl tracking-tight mb-8">{title}</h2>
          {children}
        </div>
        <footer className="mt-10 pt-4 border-t border-ink/15 flex items-center justify-between text-[10px] uppercase tracking-[0.2em] text-ink/50">
          <span>{tenant.legalName} · {tenant.website}</span>
          <span>Confidential</span>
        </footer>
      </div>
    </article>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="uppercase tracking-[0.2em] text-paper/50 text-[10px]">{label}</p>
      <p className="mt-1 text-paper text-sm">{value}</p>
    </div>
  );
}

function BrandMark({ light = false }: { light?: boolean }) {
  return (
    <div className="inline-flex items-center gap-2.5">
      <img
        src={tenant.logo}
        alt={tenant.legalName}
        className={`h-8 w-auto ${light ? "brightness-0 invert" : ""}`}
      />
    </div>
  );
}

function ClientSpotlightBlock({ content }: { content: ProposalContent }) {
  const c = content.client_spotlight;
  const facts = [
    { label: "Industry", value: c.industry },
    { label: "Headquarters", value: c.hq },
    { label: "Size", value: c.size },
  ].filter((f) => f.value);
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-6">
        {c.logo_url && (
          <div className="h-20 w-20 rounded-md bg-ink/5 border border-ink/10 overflow-hidden flex items-center justify-center shrink-0">
            <img src={c.logo_url} alt="" className="max-h-full max-w-full object-contain p-2" />
          </div>
        )}
        <div className="flex-1">
          <h3 className="font-display text-2xl text-ink">{content.cover.client_name || "Client"}</h3>
          {c.about && <p className="mt-2 text-[14px] text-ink/80 leading-relaxed">{c.about}</p>}
        </div>
      </div>
      {facts.length > 0 && (
        <div className="grid grid-cols-3 gap-4 border-y border-ink/10 py-4">
          {facts.map((f) => (
            <div key={f.label}>
              <p className="text-[10px] uppercase tracking-[0.2em] text-ink/50">{f.label}</p>
              <p className="text-[14px] text-ink mt-1">{f.value}</p>
            </div>
          ))}
        </div>
      )}
      {c.challenge && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent mb-1.5">The Challenge</p>
          <p className="text-[14px] text-ink/85 leading-relaxed whitespace-pre-wrap">{c.challenge}</p>
        </div>
      )}
      {c.why_us && (
        <div>
          <p className="text-[11px] uppercase tracking-[0.2em] text-accent mb-1.5">{tenant.proposal.whyUsHeading}</p>
          <p className="text-[14px] text-ink/85 leading-relaxed whitespace-pre-wrap">{c.why_us}</p>
        </div>
      )}
    </div>
  );
}
