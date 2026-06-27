import type { ProposalContent } from "@/lib/proposal-types";
import { money, shortDate } from "@/lib/format";
import gosaviLogo from "@/assets/gosavi-logo.png";

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
  return (
    <div className="space-y-8">
      {content.cover.enabled && <Cover content={content} />}
      {content.exec_summary.enabled && (
        <BodyPage title="Executive Summary" subtitle={content.cover.client_name}>
          <p className="text-[15px] leading-relaxed whitespace-pre-wrap text-ink/85">{content.exec_summary.body}</p>
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
      {content.line_items.enabled && (
        <BodyPage title="Investment Detail" subtitle={content.cover.client_name}>
          <div className="space-y-6">
            {content.line_items.sections.map((s) => {
              const sectionTotal = s.items.reduce((a, it) => a + it.qty * it.unit_price, 0);
              return (
                <div key={s.id}>
                  <div className="flex items-baseline justify-between border-b border-ink/15 pb-2 mb-2">
                    <h3 className="font-display text-lg text-ink">{s.name}</h3>
                    <span className="text-sm text-ink/60 tabular-nums">{money(sectionTotal, currency)}</span>
                  </div>
                  <table className="w-full text-[13px]">
                    <thead>
                      <tr className="text-left text-[11px] uppercase tracking-wider text-ink/50">
                        <th className="py-1.5 w-10">Qty</th>
                        <th className="py-1.5 w-24">Make</th>
                        <th className="py-1.5 w-28">Model</th>
                        <th className="py-1.5">Description</th>
                        <th className="py-1.5 w-20 text-right">Unit</th>
                        <th className="py-1.5 w-24 text-right">Ext.</th>
                      </tr>
                    </thead>
                    <tbody>
                      {s.items.map((it) => (
                        <tr key={it.id} className="align-top border-t border-ink/10">
                          <td className="py-1.5 tabular-nums">{it.qty}</td>
                          <td className="py-1.5">{it.make}</td>
                          <td className="py-1.5 font-mono text-[12px]">{it.model}</td>
                          <td className="py-1.5 pr-2">{it.description}</td>
                          <td className="py-1.5 text-right tabular-nums">{money(it.unit_price, currency)}</td>
                          <td className="py-1.5 text-right tabular-nums">{money(it.qty * it.unit_price, currency)}</td>
                        </tr>
                      ))}
                      {s.items.length === 0 && (
                        <tr><td colSpan={6} className="py-3 text-center text-ink/40 italic text-xs">No items in this section</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              );
            })}

            <div className="ml-auto w-72 border-t-2 border-ink/80 pt-3 space-y-1.5 text-[13px]">
              <div className="flex justify-between"><span className="text-ink/60">Subtotal</span><span className="tabular-nums">{money(totals.subtotal, currency)}</span></div>
              <div className="flex justify-between"><span className="text-ink/60">Tax ({(content.line_items.tax_rate * 100).toFixed(0)}%)</span><span className="tabular-nums">{money(totals.tax, currency)}</span></div>
              <div className="flex justify-between font-display text-lg pt-1 border-t border-ink/20">
                <span>Total</span><span className="tabular-nums">{money(totals.total, currency)}</span>
              </div>
            </div>

            {content.investment.enabled && (
              <p className="text-xs text-ink/60 italic border-l-2 border-accent pl-3">{content.investment.note}</p>
            )}
          </div>
        </BodyPage>
      )}
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
          <Meta label="Prepared by" value={c.prepared_by || "GOSAVI Meeting Solutions"} />
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
          <span>GOSAVI Meeting Solutions · gosavi.ca</span>
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
      <span
        className="grid place-items-center h-9 w-9 rounded-md font-display text-lg font-semibold"
        style={{ background: "var(--gradient-brand)", color: "oklch(0.2 0.04 270)" }}
      >
        G
      </span>
      <span className={`font-display text-xl tracking-tight ${light ? "text-paper" : "text-ink"}`}>
        GOSAVI<span className="text-accent">.</span>
      </span>
    </div>
  );
}
