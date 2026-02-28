"use client";

import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Label } from "@/src/components/ui/label";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Textarea } from "@/src/components/ui/textarea";
import { apiJson } from "@/src/lib/admin/apiClient";
import type { AdminReportDetailResponse, BanMutationResponse, ReportReason, ReportStatus, UpdateReportResponse } from "@/src/lib/admin/types";

const REPORT_REASON_LABELS: Record<ReportReason, string> = {
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

export default function AdminReportDetailPage({ params }: { params: { id: string } }) {
  const [state, setState] = useState<AdminReportDetailResponse["data"] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState<string | null>(null);

  async function loadReport() {
    setLoading(true);
    setError(null);
    try {
      const result = await apiJson<AdminReportDetailResponse>(`/api/v1/admin/reports/${params.id}`);
      setState(result.data);
      setAdminNote(result.data.report.adminNote ?? "");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load report");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadReport();
  }, [params.id]);

  async function updateStatus(status: "reviewing" | "resolved" | "dismissed") {
    setSubmitting(status);
    try {
      const result = await apiJson<UpdateReportResponse>(`/api/v1/admin/reports/${params.id}`, {
        method: "PATCH",
        body: JSON.stringify({ status, adminNote }),
      });
      setState((current) => current ? {
        ...current,
        report: {
          ...current.report,
          status: result.data.status,
          adminNote: result.data.adminNote,
          updatedAt: result.data.updatedAt,
        },
      } : current);
      toast.success(`Report marked ${status}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update report");
    } finally {
      setSubmitting(null);
    }
  }

  async function mutateBan(action: "ban" | "unban") {
    if (!state) return;
    setSubmitting(action);
    try {
      const result = await apiJson<BanMutationResponse>(`/api/v1/admin/users/${state.reported.id}/${action}`, {
        method: "POST",
        ...(action === "ban" ? { body: JSON.stringify({ reason: state.report.reason }) } : {}),
      });
      setState((current) => current ? {
        ...current,
        reported: {
          ...current.reported,
          status: result.data.status,
        },
      } : current);
      toast.success(action === "ban" ? "User banned" : "User unbanned");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action} user`);
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }

  if (error || !state) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-medium">Unable to load report</p>
          <p className="mt-1 text-sm text-muted-foreground">{error ?? "Report not found"}</p>
          <Button className="mt-4" variant="outline" onClick={() => void loadReport()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <Link href="/admin/reports">
          <Button type="button" variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
            Back to queue
          </Button>
        </Link>
        <Button type="button" variant="outline" size="sm" onClick={() => void loadReport()}>
          <RefreshCw className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <CardHeader>
            <CardTitle>Report Context</CardTitle>
            <CardDescription>
              {REPORT_REASON_LABELS[state.report.reason]} report for {state.conversation.listingTitle}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant={statusBadgeVariant(state.report.status)}>{state.report.status}</Badge>
              <Badge variant="muted">Created {new Date(state.report.createdAt).toLocaleString()}</Badge>
              {state.report.messageId ? <Badge variant="outline">Message-level report</Badge> : <Badge variant="outline">Conversation-level report</Badge>}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border bg-muted/10 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Reporter</p>
                <p className="mt-1 font-medium">{state.reporter.email}</p>
                <Badge className="mt-2" variant={state.reporter.status === "active" ? "success" : "warning"}>{state.reporter.status}</Badge>
              </div>
              <div className="rounded-xl border bg-muted/10 p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">Reported User</p>
                <p className="mt-1 font-medium">{state.reported.email}</p>
                <Badge className="mt-2" variant={state.reported.status === "active" ? "success" : "warning"}>{state.reported.status}</Badge>
              </div>
            </div>
            <div className="rounded-xl border bg-muted/10 p-4">
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Reporter Note</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{state.report.note?.trim() || "No note provided."}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="admin-note">Admin Note</Label>
              <Textarea
                id="admin-note"
                rows={4}
                value={adminNote}
                onChange={(event) => setAdminNote(event.target.value)}
                placeholder="Add internal moderation notes."
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" disabled={submitting !== null} onClick={() => void updateStatus("reviewing")}>
                {submitting === "reviewing" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Mark reviewing
              </Button>
              <Button type="button" variant="default" disabled={submitting !== null} onClick={() => void updateStatus("resolved")}>
                {submitting === "resolved" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Mark resolved
              </Button>
              <Button type="button" variant="ghost" disabled={submitting !== null} onClick={() => void updateStatus("dismissed")}>
                {submitting === "dismissed" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Dismiss
              </Button>
            </div>
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {state.reported.status === "banned" ? (
                <Button type="button" variant="outline" disabled={submitting !== null} onClick={() => void mutateBan("unban")}>
                  {submitting === "unban" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Unban user
                </Button>
              ) : (
                <Button type="button" variant="destructive" disabled={submitting !== null} onClick={() => void mutateBan("ban")}>
                  {submitting === "ban" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Ban user
                </Button>
              )}
              <Link href={`/messages/${state.conversation.id}`}>
                <Button type="button" variant="outline">Open conversation</Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Conversation Context</CardTitle>
            <CardDescription>
              Showing recent messages {state.report.messageId ? "around the reported message" : "from this conversation"}.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-[70dvh] space-y-3 overflow-y-auto rounded-xl border bg-muted/10 p-4">
              {state.messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No message history available.</p>
              ) : (
                state.messages.map((message) => {
                  const isReporter = message.senderUserId === state.reporter.id;
                  return (
                    <div key={message.id} className={`flex ${isReporter ? "justify-start" : "justify-end"}`}>
                      <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${isReporter ? "border bg-background" : "bg-primary text-primary-foreground"} ${message.isReportedTarget ? "ring-2 ring-destructive/50" : ""}`}>
                        <p className="mb-1 text-[11px] font-medium uppercase tracking-wide opacity-70">
                          {message.senderUserId === state.reporter.id ? state.reporter.email : state.reported.email}
                        </p>
                        <p className="whitespace-pre-wrap">{message.text || (message.kind === "media" ? "Media attachment" : "")}</p>
                        <p className={`mt-2 text-[11px] ${isReporter ? "text-muted-foreground" : "text-primary-foreground/80"}`}>
                          {new Date(message.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
