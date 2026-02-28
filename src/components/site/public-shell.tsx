"use client";

import type React from "react";

import { Footer } from "@/src/components/layout/Footer";
import { Navbar } from "@/src/components/layout/Navbar";

export function PublicShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  return (
    <div className="min-h-[100dvh] bg-[#f5f1e8] text-slate-950">
      <Navbar />
      <main className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        {title ? (
          <section className="mb-8 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Marketplace</p>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 md:text-4xl">{title}</h1>
            {subtitle ? (
              <p className="max-w-3xl text-sm leading-7 text-slate-600 md:text-base">{subtitle}</p>
            ) : null}
          </section>
        ) : null}
        {children}
      </main>
      <Footer />
    </div>
  );
}
