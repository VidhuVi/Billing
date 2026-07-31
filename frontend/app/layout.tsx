import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Taxor AI Eval - Handwritten Bill Evaluator",
  description: "AI Model Evaluation Dashboard for Handwritten Receipt Extraction & Zoho Books Integration",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark h-full" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-[#0B0E14] text-[#e1e2ec] font-sans antialiased overflow-hidden" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
