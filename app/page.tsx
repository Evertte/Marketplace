"use client";

import { AlertTriangle, BadgeCheck, Lock } from "lucide-react";
import { useEffect, useState } from "react";

import { CategoryTiles } from "@/src/components/home/CategoryTiles";
import { Hero } from "@/src/components/home/Hero";
import { ListingSection } from "@/src/components/home/ListingSection";
import { PublicShell } from "@/src/components/site/public-shell";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import { apiJson } from "@/src/lib/api/client";
import type { HomeResponse } from "@/src/lib/client/types";

type HomeState = HomeResponse["data"] | null;

const TRUST_ITEMS = [
  {
    title: "Secure messaging",
    description: "Connect with sellers directly in-app without exposing personal contact details.",
    icon: Lock,
  },
  {
    title: "Report scams",
    description: "Built-in reporting and moderation tools help keep risky behaviour out of the marketplace.",
    icon: AlertTriangle,
  },
  {
    title: "Verified listings",
    description: "Published inventory is managed through an admin-reviewed workflow for cleaner discovery.",
    icon: BadgeCheck,
  },
] as const;

export default function HomePage() {
  const [data, setData] = useState<HomeState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    apiJson<HomeResponse>("/api/v1/home")
      .then((response) => {
        if (!active) return;
        setData(response.data);
        setError(null);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load home");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <PublicShell>
      <div className="space-y-10 md:space-y-14">
        <div className="relative">
          <div className="pointer-events-none absolute inset-x-8 top-4 -z-10 h-48 rounded-full bg-slate-200/50 blur-3xl sm:inset-x-20 sm:h-56" />
          <Hero />
        </div>
        <CategoryTiles />

        {error ? (
          <Card className="rounded-[1.75rem] border-destructive/20 bg-destructive/5">
            <CardContent className="p-6">
              <p className="font-medium text-destructive">Failed to load marketplace home</p>
              <p className="mt-1 text-sm text-slate-600">{error}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <ListingSection
          type="car"
          title="Cars"
          subtitle="Recently added"
          items={data?.cars.items ?? []}
          loading={loading}
        />
        <ListingSection
          type="building"
          title="Buildings"
          subtitle="Recently added"
          items={data?.buildings.items ?? []}
          loading={loading}
        />
        <ListingSection
          type="land"
          title="Lands"
          subtitle="Recently added"
          items={data?.lands.items ?? []}
          loading={loading}
        />

        <section className="rounded-[1.75rem] border border-slate-200 bg-white px-6 py-8 shadow-sm sm:px-8">
          <div className="mb-6 max-w-2xl space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">Trust & safety</p>
            <h2 className="text-2xl font-semibold tracking-tight text-slate-950">Marketplace protections that keep conversations focused and secure</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {TRUST_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-50/70 text-blue-700 shadow-sm">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-4 text-lg font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
