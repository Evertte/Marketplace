"use client";

import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/src/components/ui/badge";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Select } from "@/src/components/ui/select";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/src/components/ui/table";
import { apiJson } from "@/src/lib/admin/apiClient";
import type { AdminListingListItem, AdminListingsListResponse } from "@/src/lib/admin/types";
import { cn } from "@/src/lib/utils";

type ListingTypeFilter = "all" | "car" | "building" | "land";
type ListingStatusFilter = "all" | "draft" | "published" | "archived";

function statusBadgeVariant(status: AdminListingListItem["status"]) {
  if (status === "published") return "success" as const;
  if (status === "draft") return "warning" as const;
  return "muted" as const;
}

export default function AdminListingsPage() {
  const [typeFilter, setTypeFilter] = useState<ListingTypeFilter>("all");
  const [statusFilter, setStatusFilter] = useState<ListingStatusFilter>("all");
  const [items, setItems] = useState<AdminListingListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchPage(cursor?: string | null, append = false) {
    const params = new URLSearchParams({ limit: "20" });
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (cursor) params.set("cursor", cursor);

    const response = await apiJson<AdminListingsListResponse>(`/api/v1/admin/listings?${params}`);
    setItems((prev) => (append ? [...prev, ...response.data] : response.data));
    setNextCursor(response.page.next_cursor);
    setHasMore(response.page.has_more);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    fetchPage(null, false)
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load listings");
        setItems([]);
        setNextCursor(null);
        setHasMore(false);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [typeFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <CardTitle>Listings</CardTitle>
            <CardDescription>
              Browse and manage draft, published, and archived listings.
            </CardDescription>
          </div>
          <Link
            href="/admin/listings/new"
            className={cn(buttonVariants({ variant: "default" }), "inline-flex")}
          >
            <Plus className="h-4 w-4" />
            New Listing
          </Link>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <Tabs value={typeFilter} onValueChange={(value) => setTypeFilter(value as ListingTypeFilter)}>
              <TabsList>
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="car">Cars</TabsTrigger>
                <TabsTrigger value="building">Buildings</TabsTrigger>
                <TabsTrigger value="land">Lands</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="w-full md:w-56">
              <Select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value as ListingStatusFilter)}
              >
                <option value="all">All statuses</option>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </Select>
            </div>
          </div>

          {error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Failed to load listings</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
              <Button
                className="mt-3"
                variant="outline"
                onClick={() => {
                  setLoading(true);
                  setError(null);
                  void fetchPage(null, false)
                    .catch((err) => {
                      setError(err instanceof Error ? err.message : "Failed to load listings");
                    })
                    .finally(() => setLoading(false));
                }}
              >
                Retry
              </Button>
            </div>
          ) : loading ? (
            <div className="space-y-2">
              {Array.from({ length: 8 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="rounded-xl border bg-muted/20 p-10 text-center">
              <p className="font-medium">No listings match the current filters</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Try a different type/status filter or create a new listing.
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Title</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Published</TableHead>
                    <TableHead className="w-[120px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item) => (
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
                      <TableCell>
                        {item.locationCity}, {item.locationRegion}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadgeVariant(item.status)}>{item.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {item.publishedAt
                          ? new Date(item.publishedAt).toLocaleString()
                          : <span className="text-muted-foreground">-</span>}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/listings/${item.id}/edit`}
                          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
                        >
                          Edit
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              <div className="flex justify-center">
                {hasMore ? (
                  <Button
                    variant="outline"
                    disabled={loadingMore}
                    onClick={() => {
                      if (!nextCursor) return;
                      setLoadingMore(true);
                      void fetchPage(nextCursor, true)
                        .catch((err) => {
                          toast.error(
                            err instanceof Error ? err.message : "Failed to load more listings",
                          );
                        })
                        .finally(() => setLoadingMore(false));
                    }}
                  >
                    {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    Load more
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">No more listings</p>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
