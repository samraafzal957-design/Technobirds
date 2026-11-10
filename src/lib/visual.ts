// Stub: visual page rasterization needs pdftoppm + LibreOffice which Vercel
// serverless cannot run. We return null so detection falls back to text-only
// (still produces a valid report, just without original-page images).

export interface VisualPageItem {
  str: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VisualPage {
  width: number;
  height: number;
  image: Buffer | null;
  items: VisualPageItem[];
}

export interface VisualDoc {
  pages: VisualPage[];
}

export async function buildVisualDoc(_buf: Buffer, _fileName: string, _source: "pdf" | "docx" | "txt"): Promise<VisualDoc | null> {
  return null;
}
