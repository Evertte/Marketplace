"use client";

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/src/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/src/components/ui/tabs";
import { apiJson } from "@/src/lib/admin/apiClient";
import type { AdminReportsListResponse, ReportReason, ReportStatus } from "@/src/lib/admin/types";

const STATUS_OPTIONS: Array<{ value: ReportStatus | "all"; label: string }> = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "reviewing", label: "Reviewing" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  scam: "Scam",
  harassment: "Harassment",
  inappropriate: "Inappropriate",
  other: "Other",
};

function statusBadgeVariant(status: ReportStatus): "muted" | "warning" | "success" {
  if (status === "open" || status === "reviewing") return "warning";
  if (status === "resolved") return "success";
  return "muted";
}

export default function AdminReportsPage() {
  const [status, setStatus] = useState<ReportStatus | "all">("open");
  const [reports, setReports] = useState<AdminReportsListResponse["data"]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadReports(nextStatus: ReportStatus | "all") {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (nextStatus !== "all") params.set("status", nextStatus);
      const result = await apiJson<AdminReportsListResponse>(
        `/api/v1/admin/reports${params.toString() ? `?${params}` : ""}`,
      );
      setReports(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReports(status);
  }, [status]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Moderation Reports</CardTitle>
            <CardDescription>Review user-submitted chat reports and take account actions.</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => void loadReports(status)} disabled={loading}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={status} onValueChange={(value) => setStatus(value as ReportStatus | "all")}> 
            <TabsList>
              {STATUS_OPTIONS.map((option) => (
                <TabsTrigger key={option.value} value={option.value}>
                  {option.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Failed to load reports</p>
              <p className="mt-1 text-muted-foreground">{error}</p>
            </div>
          ) : reports.length === 0 ? (
            <div className="rounded-lg border bg-muted/20 p-8 text-center text-sm text-muted-foreground">
              No reports found for this status.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Created</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Reporter</TableHead>
                  <TableHead>Reported</TableHead>
                  <TableHead>Conversation</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {reports.map((item) => (
                  <TableRow key={item.report.id}>
                    <TableCell>{new Date(item.report.createdAt).toLocaleString()}</TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">{REASON_LABELS[item.report.reason]}</p>
                        <p className="line-clamp-1 text-xs text-muted-foreground">{item.messageSnippet ?? item.report.note ?? "Conversation-level report"}</p>
                      </div>
                    </TableCell>
                    <TableCell>{item.reporter.email}</TableCell>
                    <TableCell>{item.reported.email}</TableCell>
                    <TableCell className="max-w-xs">
                      <p className="line-clamp-1">{item.conversation.listingTitle}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusBadgeVariant(item.report.status)}>{item.report.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/admin/reports/${item.report.id}`}>
                        <Button type="button" variant="outline" size="sm">Open</Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
