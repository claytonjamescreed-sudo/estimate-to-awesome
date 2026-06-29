// Client-only PDF generation. Each rendered `.doc-page` becomes one PDF page,
// sized to the actual content height so we don't ship pages with large blank
// areas at the bottom. Width stays at letter (8.5in); height shrinks down to
// the content (capped at 11in so a full page stays letter-sized).

const PAGE_W_IN = 8.5;
const PAGE_H_IN = 11;
const MIN_PAGE_H_IN = 4; // never produce a sliver page shorter than this
const PIXEL_RATIO = 2.5;

export async function generateProposalPdf(root: HTMLElement): Promise<Blob> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const pages = Array.from(root.querySelectorAll<HTMLElement>(".doc-page"));
  if (pages.length === 0) throw new Error("No .doc-page elements found to export.");

  // Snapshot inline styles so we can restore after capture.
  const originals = pages.map((p) => ({
    el: p,
    overflow: p.style.overflow,
    minHeight: p.style.minHeight,
    height: p.style.height,
  }));

  // Let each page collapse to its natural content height during capture.
  for (const { el } of originals) {
    el.style.overflow = "visible";
    el.style.minHeight = "0";
    el.style.height = "auto";
  }

  let pdf: import("jspdf").jsPDF | null = null;

  try {
    for (const page of pages) {
      const isCover = page.classList.contains("doc-cover");
      const widthPx = page.offsetWidth;
      // Measure the real content bottom (covers use the full 11in stage).
      const naturalHeightPx = Math.max(page.scrollHeight, page.offsetHeight);
      const pxPerInch = widthPx / PAGE_W_IN;
      let heightIn = naturalHeightPx / pxPerInch;
      if (isCover) heightIn = PAGE_H_IN;
      heightIn = Math.min(PAGE_H_IN, Math.max(MIN_PAGE_H_IN, heightIn));

      // Lock the page to the target height so backgrounds (gradients, rules)
      // render edge-to-edge inside the capture.
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
    for (const o of originals) {
      o.el.style.overflow = o.overflow;
      o.el.style.minHeight = o.minHeight;
      o.el.style.height = o.height;
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
