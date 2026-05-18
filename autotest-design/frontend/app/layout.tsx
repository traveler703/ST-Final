import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AutoTestDesign",
  description: "AI-driven requirements analysis, risk assessment, and test design workbench"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
