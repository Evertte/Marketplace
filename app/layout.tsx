import type { Metadata } from "next";
import type { ReactNode } from "react";

import { AppProviders } from "@/src/components/providers/app-providers";

import "./globals.css";

export const metadata: Metadata = {
  title: "Classifieds API",
  description: "Minimal Next.js App Router scaffold for auth API routes",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
