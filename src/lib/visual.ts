// Stub: visual page rasterization needs pdftoppm + LibreOffice which Vercel
// serverless cannot run. We return null so detection falls back to text-only
// (still produces a valid report, just without original-page images).

export interface VisualDoc {
  pages: { png: string; width: number; height: number }[];
}

export async function buildVisualDoc(_buf: Buffer, _fileName: string, _source: "pdf" | "docx" | "txt"): Promise<VisualDoc | null> {
  return null;
}
