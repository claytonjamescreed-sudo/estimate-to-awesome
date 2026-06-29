// Client-only PDF generation. Each rendered `.doc-page` becomes exactly one
// letter PDF page so the download matches the on-screen proposal preview.
// Long sections are paginated by the document component before export; the
// exporter should not slice a page arbitrarily through tables or headings.

const PAGE_W_IN = 8.5;
const PAGE_H_IN = 11;
const PIXEL_RATIO = 2.5; // capture above 2x so dense tables stay readable

export async function generateProposalPdf(root: HTMLElement): Promise<Blob> {
  const [{ toCanvas }, { jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const pages = Array.from(root.querySelectorAll<HTMLElement>(".doc-page"));
  if (pages.length === 0) throw new Error("No .doc-page elements found to export.");

  // During capture, briefly unclip small natural overflows so page content can
  // be scaled onto one PDF page rather than producing a blank sliver page.
  const originals = pages.map((p) => ({
    el: p,
    overflow: p.style.overflow,
    minHeight: p.style.minHeight,
    height: p.style.height,
  }));
  for (const { el } of originals) {
    el.style.overflow = "visible";
    el.style.minHeight = "11in";
    el.style.height = "auto";
  }

  const pdf = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });
  let firstAdded = false;

  try {
    for (const page of pages) {
      // Capture one logical proposal page and fit it onto one PDF page.
      const sourceCanvas = await toCanvas(page, {
        pixelRatio: PIXEL_RATIO,
        backgroundColor: "#ffffff",
        cacheBust: true,
        width: page.offsetWidth,
        height: page.scrollHeight,
        style: { transform: "none" },
      });

      const dataUrl = sourceCanvas.toDataURL("image/png");
      const canvasAspect = sourceCanvas.width / sourceCanvas.height;
      const pageAspect = PAGE_W_IN / PAGE_H_IN;
      const imgW = canvasAspect >= pageAspect ? PAGE_W_IN : PAGE_H_IN * canvasAspect;
      const imgH = canvasAspect >= pageAspect ? PAGE_W_IN / canvasAspect : PAGE_H_IN;
      const x = (PAGE_W_IN - imgW) / 2;
      const y = 0;

      if (firstAdded) pdf.addPage("letter", "portrait");
      firstAdded = true;
      pdf.addImage(dataUrl, "PNG", x, y, imgW, imgH, undefined, "FAST");
    }
  } finally {
    // Restore inline styles.
    for (const o of originals) {
      o.el.style.overflow = o.overflow;
      o.el.style.minHeight = o.minHeight;
      o.el.style.height = o.height;
    }
  }

  return pdf.output("blob");
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
