// Client-only PDF generation. We rasterize each `.doc-page` at its full
// natural height (overflow temporarily unclipped) and then slice the result
// into 8.5x11 letter-sized pages. This avoids two failure modes we hit
// previously:
//   1. content past 11in being clipped by `overflow: hidden` on .doc-page
//   2. arbitrary tiny slivers when the document wasn't a clean multiple of 11in
//
// Returns a Blob suitable for download or iframe preview.

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

  // Force every page to render at its natural height so nothing is clipped
  // by `overflow: hidden` / `min-height: 11in` while we capture.
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
      // Capture the entire (potentially > 11in) page to a canvas.
      const sourceCanvas = await toCanvas(page, {
        pixelRatio: PIXEL_RATIO,
        backgroundColor: "#ffffff",
        cacheBust: true,
        width: page.offsetWidth,
        height: page.scrollHeight,
        style: { transform: "none" },
      });

      const pxPerInch = sourceCanvas.width / PAGE_W_IN;
      const pageHeightPx = Math.round(PAGE_H_IN * pxPerInch);
      const totalHeightPx = sourceCanvas.height;
      // Always emit at least one page; round up partial trailing content.
      const sliceCount = Math.max(1, Math.ceil(totalHeightPx / pageHeightPx));

      const slices = sliceCount;

      for (let i = 0; i < slices; i++) {
        const isLast = i === slices - 1;
        const sy = i * pageHeightPx;
        const sh = isLast ? totalHeightPx - sy : pageHeightPx;

        const sliceCanvas = document.createElement("canvas");
        sliceCanvas.width = sourceCanvas.width;
        sliceCanvas.height = pageHeightPx; // pad short last slice with white
        const ctx = sliceCanvas.getContext("2d")!;
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
        ctx.drawImage(
          sourceCanvas,
          0, sy, sourceCanvas.width, sh,
          0, 0, sourceCanvas.width, sh,
        );

        const dataUrl = sliceCanvas.toDataURL("image/png");
        if (firstAdded) pdf.addPage("letter", "portrait");
        firstAdded = true;
        pdf.addImage(dataUrl, "PNG", 0, 0, PAGE_W_IN, PAGE_H_IN, undefined, "FAST");
      }
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
