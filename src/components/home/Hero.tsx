"use client";

import Link from "next/link";
import { MapPin, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { cn } from "@/src/lib/utils";

const CATEGORY_CHIPS = [
  { label: "Cars", href: "/browse?type=car" },
  { label: "Buildings", href: "/browse?type=building" },
  { label: "Lands", href: "/browse?type=land" },
] as const;

export function Hero() {
  const router = useRouter();
  const [query, setQuery] = useState("");

  function submitSearch() {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    router.push(`/browse${params.toString() ? `?${params.toString()}` : ""}`);
  }

  return (
    <section className="relative isolate">
      <div className="absolute left-1/2 top-1/2 -z-10 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-300/15 opacity-30 blur-3xl sm:h-80 sm:w-80" />

      <div className="relative overflow-hidden rounded-[2rem] border border-black/5 bg-gradient-to-b from-white via-white to-slate-50 px-6 py-16 shadow-[0_28px_72px_-34px_rgba(15,23,42,0.18)] sm:px-10 lg:px-14 lg:py-24">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.06),_transparent_32%)]" />
        <div className="absolute inset-0 opacity-[0.05] [background-image:radial-gradient(circle_at_1px_1px,rgba(15,23,42,0.9)_1px,transparent_0)] [background-size:24px_24px]" />
        <div className="absolute -left-24 top-10 h-64 w-64 rounded-full bg-slate-200/40 blur-3xl" />
        <div className="absolute -bottom-28 right-0 h-72 w-72 rounded-full bg-slate-100/70 blur-3xl" />

        <div className="relative mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.34em] text-slate-500">Marketplace</p>
          <h1 className="mt-4 bg-gradient-to-b from-slate-950 to-slate-700 bg-clip-text text-4xl font-semibold tracking-tight text-transparent sm:text-5xl lg:text-6xl">
            Find your next car, building, or land
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg">
            Browse published listings and message sellers directly.
          </p>

          <form
            className="mx-auto mt-10 flex max-w-3xl flex-col gap-3 rounded-[1.6rem] border border-white/80 bg-white/92 p-3 shadow-xl ring-1 ring-slate-900/5 backdrop-blur transition focus-within:ring-2 focus-within:ring-slate-900/10 sm:flex-row sm:items-center"
            onSubmit={(event) => {
              event.preventDefault();
              submitSearch();
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search cars, lands, buildings..."
                aria-label="Search listings"
                className="h-14 rounded-2xl border-0 bg-slate-50 pl-11 text-base shadow-none focus-visible:bg-white focus-visible:ring-0"
              />
            </div>
            <Button
              type="button"
              variant="outline"
              className="h-14 rounded-2xl border-slate-200 bg-white px-5 text-slate-700 shadow-sm"
            >
              <MapPin className="h-4 w-4" />
              Location
            </Button>
            <Button type="submit" className="h-14 rounded-2xl px-7 text-base shadow-lg shadow-primary/25">
              <Search className="h-4 w-4" />
              Search
            </Button>
          </form>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            {CATEGORY_CHIPS.map((chip) => (
              <Link
                key={chip.href}
                href={chip.href}
                className={cn(
                  "rounded-full border border-slate-200 bg-white/72 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm backdrop-blur transition hover:-translate-y-0.5 hover:bg-white hover:text-slate-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                )}
              >
                {chip.label}
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
