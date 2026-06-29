// Client-only PDF generation. Each rendered `.doc-page` becomes one PDF page,
// sized to the actual content height so we don't ship pages with large blank
// areas at the bottom. Cover stays full letter (8.5x11); body pages collapse
// to their real content height.

const PAGE_W_IN = 8.5;
const PAGE_H_IN = 11;
const MIN_PAGE_H_IN = 2.5;
const BOTTOM_PADDING_IN = 0.4;
const PIXEL_RATIO = 2.5;

export async function generateProposalPdf(root: HTMLElement): Promise<Blob> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const pages = Array.from(root.querySelectorAll<HTMLElement>(".doc-page"));
  if (pages.length === 0) throw new Error("No .doc-page elements found to export.");

  type Snap = { el: HTMLElement; props: Record<string, string> };
  const snaps: Snap[] = [];
  const stash = (el: HTMLElement, props: string[]) => {
    const saved: Record<string, string> = {};
    for (const p of props) saved[p] = el.style.getPropertyValue(p);
    snaps.push({ el, props: saved });
  };

  // Force every page (and its inner flex column) to collapse to content height.
  for (const page of pages) {
    stash(page, ["overflow", "min-height", "height"]);
    page.style.overflow = "visible";
    page.style.minHeight = "0";
    page.style.height = "auto";
    const inner = page.firstElementChild as HTMLElement | null;
    if (inner) {
      stash(inner, ["height", "min-height"]);
      inner.style.height = "auto";
      inner.style.minHeight = "0";
      // Stop the `flex-1` middle slot from stretching to fill nothing useful.
      const middles = inner.querySelectorAll<HTMLElement>(".flex-1");
      for (const m of middles) {
        stash(m, ["flex", "flex-grow"]);
        m.style.flex = "0 0 auto";
        m.style.flexGrow = "0";
      }
    }
  }

  let pdf: import("jspdf").jsPDF | null = null;

  try {
    for (const page of pages) {
      const isCover = page.classList.contains("doc-cover");
      const widthPx = page.offsetWidth;
      const pxPerInch = widthPx / PAGE_W_IN;
      let heightIn: number;

      if (isCover) {
        heightIn = PAGE_H_IN;
      } else {
        const naturalHeightPx = Math.max(page.scrollHeight, page.offsetHeight);
        heightIn = naturalHeightPx / pxPerInch + BOTTOM_PADDING_IN;
        heightIn = Math.min(PAGE_H_IN, Math.max(MIN_PAGE_H_IN, heightIn));
      }

      page.style.height = `${heightIn}in`;
      page.style.minHeight = `${heightIn}in`;

      const heightPx = Math.round(heightIn * pxPerInch);
      const canvas = await toCanvas(page, {
        pixelRatio: PIXEL_RATIO,
        backgroundColor: "#ffffff",
        cacheBust: true,
        width: widthPx,
        height: heightPx,
        style: { transform: "none" },
      });
      const dataUrl = canvas.toDataURL("image/png");

      if (!pdf) {
        pdf = new jsPDF({ unit: "in", format: [PAGE_W_IN, heightIn], orientation: "portrait" });
      } else {
        pdf.addPage([PAGE_W_IN, heightIn], "portrait");
      }
      pdf.addImage(dataUrl, "PNG", 0, 0, PAGE_W_IN, heightIn, undefined, "FAST");
    }
  } finally {
    for (const s of snaps) {
      for (const [prop, val] of Object.entries(s.props)) {
        if (val) s.el.style.setProperty(prop, val);
        else s.el.style.removeProperty(prop);
      }
    }
  }

  return pdf!.output("blob");
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
