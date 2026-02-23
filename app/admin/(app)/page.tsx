"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/src/components/ui/badge";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { publicJson } from "@/src/lib/admin/apiClient";
import type { PublicListingCard, PublicListingsResponse } from "@/src/lib/admin/types";
import { cn } from "@/src/lib/utils";

type DashboardState = {
  counts: Record<"car" | "building" | "land", number>;
  recent: PublicListingCard[];
};

async function countPublishedListingsByType(type: "car" | "building" | "land"): Promise<number> {
  let total = 0;
  let cursor: string | null = null;

  while (true) {
    const params = new URLSearchParams({
      type,
      limit: "50",
    });
    if (cursor) params.set("cursor", cursor);

    const response = await publicJson<PublicListingsResponse>(`/api/v1/listings?${params}`);
    total += response.data.length;

    if (!response.page.has_more || !response.page.next_cursor) {
      break;
    }

    cursor = response.page.next_cursor;
  }

  return total;
}

async function loadDashboardData(): Promise<DashboardState> {
  const [cars, buildings, lands, recentResponse] = await Promise.all([
    countPublishedListingsByType("car"),
    countPublishedListingsByType("building"),
    countPublishedListingsByType("land"),
    publicJson<PublicListingsResponse>("/api/v1/listings?limit=10"),
  ]);

  return {
    counts: { car: cars, building: buildings, land: lands },
    recent: recentResponse.data,
  };
}

function StatCard({
  label,
  count,
  loading,
}: {
  label: string;
  count?: number;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-3xl">
          {loading ? <Skeleton className="h-9 w-16" /> : (count ?? 0).toLocaleString()}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">Published listings visible publicly</p>
      </CardContent>
    </Card>
  );
}

export default function AdminDashboardPage() {
  const [state, setState] = useState<DashboardState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    setLoading(true);
    setError(null);
    loadDashboardData()
      .then((data) => {
        if (active) setState(data);
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : "Failed to load dashboard");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 md:grid-cols-3">
        <StatCard label="Published Cars" count={state?.counts.car} loading={loading} />
        <StatCard
          label="Published Buildings"
          count={state?.counts.building}
          loading={loading}
        />
        <StatCard label="Published Lands" count={state?.counts.land} loading={loading} />
      </section>

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Recent Published Listings</CardTitle>
            <CardDescription>Top 10 from the public listings feed.</CardDescription>
          </div>
          <Link href="/admin/listings" className={cn(buttonVariants({ variant: "outline" }))}>
            Open Listings
          </Link>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Dashboard failed to load</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => window.location.reload()}
              >
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : state && state.recent.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Published</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.recent.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {item.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={item.coverImageUrl}
                            alt=""
                            className="h-8 w-8 rounded object-cover"
                          />
                        ) : (
                          <div className="h-8 w-8 rounded bg-muted" />
                        )}
                        <span className="line-clamp-1">{item.title}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="muted">{item.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {item.currency} {item.price}
                    </TableCell>
                    <TableCell>{item.locationCity}, {item.locationRegion}</TableCell>
                    <TableCell>
                      {item.publishedAt
                        ? new Date(item.publishedAt).toLocaleDateString()
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              No published listings yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
