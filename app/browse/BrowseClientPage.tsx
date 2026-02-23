"use client";

import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { ListingCard } from "@/src/components/site/listing-card";
import { PublicShell } from "@/src/components/site/public-shell";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { Select } from "@/src/components/ui/select";
import { Skeleton } from "@/src/components/ui/skeleton";
import { apiJson } from "@/src/lib/api/client";
import type { ListingsResponse } from "@/src/lib/client/types";

const browseFilterSchema = z.object({
  type: z.enum(["", "car", "building", "land"]),
  q: z.string(),
  min_price: z.string(),
  max_price: z.string(),
  region: z.string(),
  city: z.string(),
});

type BrowseFilterValues = z.infer<typeof browseFilterSchema>;

function searchParamsToFilters(searchParams: URLSearchParams): BrowseFilterValues {
  return {
    type: (searchParams.get("type") as BrowseFilterValues["type"]) || "",
    q: searchParams.get("q") ?? "",
    min_price: searchParams.get("min_price") ?? "",
    max_price: searchParams.get("max_price") ?? "",
    region: searchParams.get("region") ?? "",
    city: searchParams.get("city") ?? "",
  };
}

function buildBrowseApiQuery(filters: BrowseFilterValues, cursor?: string | null): string {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  if (filters.min_price.trim()) params.set("min_price", filters.min_price.trim());
  if (filters.max_price.trim()) params.set("max_price", filters.max_price.trim());
  if (filters.region.trim()) params.set("region", filters.region.trim());
  if (filters.city.trim()) params.set("city", filters.city.trim());
  params.set("limit", "20");
  if (cursor) params.set("cursor", cursor);
  return params.toString();
}

export default function BrowseClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [items, setItems] = useState<ListingsResponse["data"]>([]);
  const [page, setPage] = useState<ListingsResponse["page"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentFilters = useMemo(
    () => searchParamsToFilters(searchParams),
    [searchParams],
  );

  const form = useForm<BrowseFilterValues>({
    resolver: zodResolver(browseFilterSchema),
    defaultValues: currentFilters,
  });

  useEffect(() => {
    form.reset(currentFilters);
  }, [currentFilters, form]);

  async function fetchListings(cursor?: string | null, append = false) {
    const query = buildBrowseApiQuery(currentFilters, cursor);
    const response = await apiJson<ListingsResponse>(`/api/v1/listings?${query}`);
    setItems((prev) => (append ? [...prev, ...response.data] : response.data));
    setPage(response.page);
    setError(null);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchListings()
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load listings");
        setItems([]);
        setPage(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams.toString()]);

  return (
    <PublicShell
      title="Browse Listings"
      subtitle="Search published listings across cars, buildings, and land. Apply filters and load more results with cursor pagination."
    >
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-lg">Filters</CardTitle>
            <CardDescription>Search and narrow the published feed.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit((values) => {
                const params = new URLSearchParams();
                if (values.type) params.set("type", values.type);
                if (values.q.trim()) params.set("q", values.q.trim());
                if (values.min_price.trim()) params.set("min_price", values.min_price.trim());
                if (values.max_price.trim()) params.set("max_price", values.max_price.trim());
                if (values.region.trim()) params.set("region", values.region.trim());
                if (values.city.trim()) params.set("city", values.city.trim());
                router.push(`/browse${params.toString() ? `?${params.toString()}` : ""}`);
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="browse-type">Type</Label>
                <Select id="browse-type" {...form.register("type")}>
                  <option value="">All types</option>
                  <option value="car">Car</option>
                  <option value="building">Building</option>
                  <option value="land">Land</option>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="browse-q">Search</Label>
                <Input id="browse-q" placeholder="Search title/description" {...form.register("q")} />
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="browse-min-price">Min price</Label>
                  <Input
                    id="browse-min-price"
                    inputMode="decimal"
                    placeholder="1000"
                    {...form.register("min_price")}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="browse-max-price">Max price</Label>
                  <Input
                    id="browse-max-price"
                    inputMode="decimal"
                    placeholder="50000"
                    {...form.register("max_price")}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="browse-region">Region</Label>
                <Input id="browse-region" placeholder="Greater Accra" {...form.register("region")} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="browse-city">City</Label>
                <Input id="browse-city" placeholder="Accra" {...form.register("city")} />
              </div>

              <div className="flex flex-wrap gap-2">
                <Button type="submit" className="flex-1">
                  <Search className="h-4 w-4" />
                  Apply Filters
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => router.push("/browse")}
                >
                  Reset
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {error ? (
            <Card>
              <CardContent className="p-6">
                <p className="font-medium">Failed to load listings</p>
                <p className="mt-1 text-sm text-muted-foreground">{error}</p>
                <Button className="mt-4" onClick={() => window.location.reload()}>
                  Retry
                </Button>
              </CardContent>
            </Card>
          ) : loading ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 9 }).map((_, index) => (
                <Skeleton key={index} className="h-80 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="p-10 text-center">
                <p className="font-medium">No listings found</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Try changing your search terms or filters.
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <ListingCard key={item.id} listing={item} />
                ))}
              </div>

              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">
                  Showing {items.length} listing{items.length === 1 ? "" : "s"}
                </p>
                {page?.has_more && page.next_cursor ? (
                  <Button
                    variant="outline"
                    disabled={loadingMore}
                    onClick={() => {
                      setLoadingMore(true);
                      void fetchListings(page.next_cursor, true).finally(() => setLoadingMore(false));
                    }}
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </div>
      </div>
    </PublicShell>
  );
}
