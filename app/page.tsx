"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useEffect, useState } from "react";

import { ListingCard } from "@/src/components/site/listing-card";
import { PublicShell } from "@/src/components/site/public-shell";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { apiJson } from "@/src/lib/api/client";
import type { HomeResponse, ListingType } from "@/src/lib/client/types";
import { cn } from "@/src/lib/utils";

type HomeState = HomeResponse["data"] | null;

function Section({
  type,
  title,
  items,
  loading,
}: {
  type: ListingType;
  title: string;
  items: HomeResponse["data"]["cars"]["items"];
  loading: boolean;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">
            Recently published {title.toLowerCase()} listings
          </p>
        </div>
        <Link
          href={`/browse?type=${type}`}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          View all
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-80 w-full" />
          ))}
        </div>
      ) : items.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
          {items.map((item) => (
            <ListingCard key={item.id} listing={item} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            No published {title.toLowerCase()} listings yet.
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export default function HomePage() {
  const [data, setData] = useState<HomeState>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    apiJson<HomeResponse>("/api/v1/home")
      .then((response) => {
        if (active) {
          setData(response.data);
          setError(null);
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load home");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <PublicShell
      title="Find your next car, building, or land"
      subtitle="Browse published listings and message sellers directly after signing in. Start with curated sections below or jump into filtered search."
    >
      <div className="space-y-8">
        <Card className="overflow-hidden bg-gradient-to-br from-primary/10 via-background to-accent/30">
          <CardHeader>
            <CardTitle className="text-xl md:text-2xl">
              Browse the marketplace with search, filters, and direct messaging
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Link href="/browse" className={cn(buttonVariants({ size: "sm" }))}>
              Start Browsing
            </Link>
            <Link
              href="/messages"
              className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
            >
              Open Messages
            </Link>
          </CardContent>
        </Card>

        {error ? (
          <Card>
            <CardContent className="p-6">
              <p className="font-medium">Failed to load marketplace home</p>
              <p className="mt-1 text-sm text-muted-foreground">{error}</p>
              <Button className="mt-4" onClick={() => window.location.reload()}>
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : null}

        <Section
          type="car"
          title="Cars"
          items={data?.cars.items ?? []}
          loading={loading}
        />
        <Section
          type="building"
          title="Buildings"
          items={data?.buildings.items ?? []}
          loading={loading}
        />
        <Section
          type="land"
          title="Lands"
          items={data?.lands.items ?? []}
          loading={loading}
        />
      </div>
    </PublicShell>
  );
}

