import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces, Outfit } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Technobirds // Dark Document Forensics",
  description:
    "Upload any .docx. We extract every hidden metadata field, run AI-generation heuristics, and let you sanitize — all in your browser.",
  keywords: [
    "docx forensics",
    "metadata extractor",
    "AI detection",
    "document sanitizer",
    "Technobirds",
  ],
  authors: [{ name: "Technobirds" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${outfit.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster
          position="bottom-right"
          theme="dark"
          toastOptions={{
            style: {
              background: "rgba(10, 10, 14, 0.95)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#e6e7ee",
              backdropFilter: "blur(20px)",
            },
          }}
        />
      </body>
    </html>
  );
}
