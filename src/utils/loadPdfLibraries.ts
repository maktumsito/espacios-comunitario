type PdfLibraries = {
  jsPDF: typeof import('jspdf').jsPDF;
  autoTable: typeof import('jspdf-autotable').default;
};

let pending: Promise<PdfLibraries> | undefined;

/** Load only after a document action; share concurrent loads without caching failures. */
export function loadPdfLibraries(): Promise<PdfLibraries> {
  pending ??= Promise.all([import('jspdf'), import('jspdf-autotable')])
    .then(([pdf, table]) => ({ jsPDF: pdf.jsPDF, autoTable: table.default }))
    .catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
