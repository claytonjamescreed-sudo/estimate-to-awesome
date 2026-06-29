// Client-only PDF generation. Each `.doc-page` (8.5x11in) in the rendered
// proposal is rasterized via html2canvas and placed as a single page in a
// letter-sized jsPDF document — giving exact page boundaries and no awkward
// content splits. Returns a Blob suitable for download or iframe preview.

export async function generateProposalPdf(root: HTMLElement): Promise<Blob> {
  const [{ toPng }, { jsPDF }] = await Promise.all([
    import("html-to-image"),
    import("jspdf"),
  ]);

  const pages = Array.from(root.querySelectorAll<HTMLElement>(".doc-page"));
  if (pages.length === 0) throw new Error("No .doc-page elements found to export.");

  const pdf = new jsPDF({ unit: "in", format: "letter", orientation: "portrait" });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const dataUrl = await toPng(page, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      cacheBust: true,
    });
    if (i > 0) pdf.addPage("letter", "portrait");
    pdf.addImage(dataUrl, "PNG", 0, 0, 8.5, 11, undefined, "FAST");
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
