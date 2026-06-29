// Client-only PDF generation using html2pdf.js (html2canvas + jsPDF).
// Renders a given DOM element (the proposal document) into a multi-page
// letter-sized PDF, returning a Blob suitable for download or iframe preview.

export async function generateProposalPdf(element: HTMLElement, filename: string): Promise<Blob> {
  const html2pdf = (await import("html2pdf.js")).default;
  const worker = html2pdf()
    .set({
      margin: 0,
      filename,
      image: { type: "jpeg", quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        windowWidth: element.scrollWidth,
      },
      jsPDF: { unit: "in", format: "letter", orientation: "portrait" },
      pagebreak: { mode: ["css", "legacy"], avoid: ".doc-page" },
    })
    .from(element);
  return (await worker.outputPdf("blob")) as Blob;
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
