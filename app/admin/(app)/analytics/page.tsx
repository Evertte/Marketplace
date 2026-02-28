"use client";

import Link from "next/link";
import { ArrowUpRight, BarChart3, Eye, MessageSquareText, RefreshCw, Users } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";

import { apiJson } from "@/src/lib/admin/apiClient";
import type {
  AdminAnalyticsListingsResponse,
  AdminAnalyticsOverviewResponse,
} from "@/src/lib/admin/types";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Select } from "@/src/components/ui/select";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";

const RANGE_PRESETS = [
  { label: "7d", days: 7 },
  { label: "30d", days: 30 },
  { label: "90d", days: 90 },
] as const;

type SortMode = "views" | "inquiries" | "conversion";

type AnalyticsState = {
  overview: AdminAnalyticsOverviewResponse["data"];
  listings: AdminAnalyticsListingsResponse["data"];
};

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function buildPreset(days: number): { from: string; to: string } {
  const to = new Date();
  const end = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate()));
  const start = new Date(end);
  start.setUTCDate(end.getUTCDate() - (days - 1));
  return {
    from: toDateOnly(start),
    to: toDateOnly(end),
  };
}

function formatCompactNumber(value: number): string {
  return new Intl.NumberFormat(undefined, {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: value >= 1000 ? 1 : 0,
  }).format(value);
}

function formatPercent(rate: number): string {
  return new Intl.NumberFormat(undefined, {
    style: "percent",
    maximumFractionDigits: 1,
  }).format(rate);
}

function formatDateLabel(value: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function StatCard({
  label,
  value,
  detail,
  icon: Icon,
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ComponentType<{ className?: string }>;
  loading: boolean;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardDescription>{label}</CardDescription>
            <CardTitle className="mt-2 text-3xl">
              {loading ? <Skeleton className="h-9 w-24" /> : value}
            </CardTitle>
          </div>
          <div className="rounded-xl border bg-muted/20 p-2 text-muted-foreground">
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground">{detail}</p>
      </CardContent>
    </Card>
  );
}

function AnalyticsChart({
  data,
  loading,
}: {
  data: AdminAnalyticsOverviewResponse["data"]["series"];
  loading: boolean;
}) {
  if (loading) {
    return <Skeleton className="h-72 w-full" />;
  }

  if (data.length === 0) {
    return (
      <div className="grid h-72 place-items-center rounded-xl border bg-muted/20 text-sm text-muted-foreground">
        No analytics data for this range yet.
      </div>
    );
  }

  const width = 760;
  const height = 240;
  const padding = 24;
  const values = data.flatMap((item) => [item.viewsTotal, item.inquiriesTotal]);
  const maxValue = Math.max(...values, 1);
  const stepX = data.length === 1 ? 0 : (width - padding * 2) / (data.length - 1);

  const buildPath = (selector: (item: AdminAnalyticsOverviewResponse["data"]["series"][number]) => number) =>
    data
      .map((item, index) => {
        const x = padding + stepX * index;
        const y = height - padding - (selector(item) / maxValue) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"}${x},${y}`;
      })
      .join(" ");

  const viewsPath = buildPath((item) => item.viewsTotal);
  const inquiriesPath = buildPath((item) => item.inquiriesTotal);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-primary" />
          Views
        </span>
        <span className="inline-flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          Inquiries
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border bg-muted/10 p-4">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full" role="img" aria-label="Views and inquiries over time chart">
          {Array.from({ length: 4 }).map((_, index) => {
            const y = padding + ((height - padding * 2) / 3) * index;
            return (
              <line
                key={index}
                x1={padding}
                y1={y}
                x2={width - padding}
                y2={y}
                stroke="currentColor"
                strokeOpacity="0.08"
              />
            );
          })}
          <path d={viewsPath} fill="none" stroke="currentColor" strokeWidth="3" className="text-primary" strokeLinecap="round" strokeLinejoin="round" />
          <path d={inquiriesPath} fill="none" stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          {data.map((item, index) => {
            const x = padding + stepX * index;
            const viewsY = height - padding - (item.viewsTotal / maxValue) * (height - padding * 2);
            const inquiriesY = height - padding - (item.inquiriesTotal / maxValue) * (height - padding * 2);
            return (
              <g key={item.date}>
                <circle cx={x} cy={viewsY} r="3.5" className="fill-primary" />
                <circle cx={x} cy={inquiriesY} r="3.5" fill="#10b981" />
              </g>
            );
          })}
        </svg>
      </div>
      <div className="grid grid-cols-2 gap-2 text-[11px] text-muted-foreground sm:grid-cols-4 lg:grid-cols-7">
        {data.map((item) => (
          <div key={item.date} className="rounded-lg border bg-muted/10 px-2 py-2 text-center">
            {formatDateLabel(item.date)}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminAnalyticsPage() {
  const defaultRange = useMemo(() => buildPreset(7), []);
  const [from, setFrom] = useState(defaultRange.from);
  const [to, setTo] = useState(defaultRange.to);
  const [sort, setSort] = useState<SortMode>("views");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<AnalyticsState | null>(null);

  async function loadAnalytics(next?: { from: string; to: string; sort: SortMode }) {
    const activeRange = next ?? { from, to, sort };
    const params = new URLSearchParams({
      from: activeRange.from,
      to: activeRange.to,
    });
    const listingParams = new URLSearchParams({
      from: activeRange.from,
      to: activeRange.to,
      sort: activeRange.sort,
      limit: "20",
    });

    const [overview, listings] = await Promise.all([
      apiJson<AdminAnalyticsOverviewResponse>(`/api/v1/admin/analytics/overview?${params}`),
      apiJson<AdminAnalyticsListingsResponse>(`/api/v1/admin/analytics/listings?${listingParams}`),
    ]);

    setState({
      overview: overview.data,
      listings: listings.data,
    });
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    loadAnalytics({ from, to, sort })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : "Failed to load analytics");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [from, to, sort]);

  async function refresh() {
    setRefreshing(true);
    try {
      await loadAnalytics();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh analytics");
    } finally {
      setRefreshing(false);
    }
  }

  const totals = state?.overview.totals;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>Marketplace Analytics</CardTitle>
            <CardDescription>Track listing views, inquiries, and conversion over time.</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">From</label>
              <Input type="date" value={from} onChange={(event) => setFrom(event.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">To</label>
              <Input type="date" value={to} onChange={(event) => setTo(event.target.value)} />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Sort table by</label>
              <Select value={sort} onChange={(event) => setSort(event.target.value as SortMode)}>
                <option value="views">Views</option>
                <option value="inquiries">Inquiries</option>
                <option value="conversion">Conversion</option>
              </Select>
            </div>
            <Button type="button" variant="outline" onClick={() => void refresh()} disabled={refreshing || loading}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((preset) => {
            const next = buildPreset(preset.days);
            const active = next.from === from && next.to === to;
            return (
              <Button
                key={preset.label}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                onClick={() => {
                  setFrom(next.from);
                  setTo(next.to);
                }}
              >
                {preset.label}
              </Button>
            );
          })}
        </CardContent>
      </Card>

      {error ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Analytics failed to load</p>
          <p className="mt-1 text-muted-foreground">{error}</p>
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Views" value={formatCompactNumber(totals?.viewsTotal ?? 0)} detail="All detail page loads in the selected range" icon={Eye} loading={loading} />
        <StatCard label="Unique Views" value={formatCompactNumber(totals?.viewsUnique ?? 0)} detail="Deduped daily by authenticated user or visitor hash" icon={Users} loading={loading} />
        <StatCard label="Total Inquiries" value={formatCompactNumber(totals?.inquiriesTotal ?? 0)} detail="Inbound inquiries that started or reopened conversations" icon={MessageSquareText} loading={loading} />
        <StatCard label="Conversion Rate" value={formatPercent(totals?.conversionRate ?? 0)} detail="Inquiries divided by total views" icon={BarChart3} loading={loading} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Views vs. Inquiries</CardTitle>
          <CardDescription>Daily trend for the selected date range.</CardDescription>
        </CardHeader>
        <CardContent>
          <AnalyticsChart data={state?.overview.series ?? []} loading={loading} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Top Listings</CardTitle>
          <CardDescription>Ranked by the selected metric across the current date range.</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-full" />
              ))}
            </div>
          ) : state && state.listings.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Listing</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Views</TableHead>
                  <TableHead>Unique</TableHead>
                  <TableHead>Inquiries</TableHead>
                  <TableHead>Conversion</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.listings.map((item) => (
                  <TableRow key={item.listingId}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.title}</p>
                        <p className="text-xs text-muted-foreground">{item.type} • {item.region}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.status === "published" ? "success" : item.status === "draft" ? "warning" : "muted"}>
                        {item.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.viewsTotalSum.toLocaleString()}</TableCell>
                    <TableCell>{item.viewsUniqueSum.toLocaleString()}</TableCell>
                    <TableCell>{item.inquiriesTotalSum.toLocaleString()}</TableCell>
                    <TableCell>{formatPercent(item.conversionRate)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Link href={`/listings/${item.listingId}`}>
                          <Button type="button" variant="outline" size="sm">
                            <ArrowUpRight className="h-4 w-4" />
                            View
                          </Button>
                        </Link>
                        <Link href={`/admin/listings/${item.listingId}/edit`}>
                          <Button type="button" size="sm">Edit</Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="grid min-h-48 place-items-center rounded-xl border bg-muted/20 text-center text-sm text-muted-foreground">
              No analytics data has been recorded yet.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
