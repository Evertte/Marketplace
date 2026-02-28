"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, ShieldAlert, X } from "lucide-react";
import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Label } from "@/src/components/ui/label";
import { Select } from "@/src/components/ui/select";
import { Textarea } from "@/src/components/ui/textarea";
import { authApiJson } from "@/src/lib/api/client";
import type { CreateReportResponse, ReportReason } from "@/src/lib/client/types";

const reportSchema = z.object({
  reason: z.enum(["spam", "scam", "harassment", "inappropriate", "other"]),
  note: z.string().trim().max(1000).optional(),
});

type ReportFormValues = z.infer<typeof reportSchema>;

const REASON_LABELS: Record<ReportReason, string> = {
  spam: "Spam",
  scam: "Scam or fraud",
  harassment: "Harassment",
  inappropriate: "Inappropriate content",
  other: "Other",
};

export function ConversationReportModal({
  open,
  conversationId,
  listingTitle,
  onClose,
}: {
  open: boolean;
  conversationId: string;
  listingTitle: string;
  onClose: () => void;
}) {
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      reason: "harassment",
      note: "",
    },
  });

  useEffect(() => {
    if (!open) {
      form.reset({ reason: "harassment", note: "" });
    }
  }, [form, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <Card className="w-full max-w-lg shadow-2xl">
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4" />
              Report conversation
            </CardTitle>
            <CardDescription>
              Submit a private moderation report for <span className="font-medium">{listingTitle}</span>.
            </CardDescription>
          </div>
          <Button type="button" variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </CardHeader>
        <CardContent>
          <form
            className="space-y-4"
            onSubmit={form.handleSubmit(async (values) => {
              try {
                await authApiJson<CreateReportResponse>("/api/v1/reports", {
                  method: "POST",
                  body: JSON.stringify({
                    conversationId,
                    reason: values.reason,
                    ...(values.note?.trim() ? { note: values.note.trim() } : {}),
                  }),
                });
                toast.success("Report submitted");
                onClose();
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Failed to submit report");
              }
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="report-reason">Reason</Label>
              <Select id="report-reason" {...form.register("reason")}>
                {Object.entries(REASON_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
              {form.formState.errors.reason ? (
                <p className="text-xs text-destructive">{form.formState.errors.reason.message}</p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="report-note">Note (optional)</Label>
              <Textarea
                id="report-note"
                rows={5}
                placeholder="Add any details that will help moderation review this conversation."
                {...form.register("note")}
              />
              {form.formState.errors.note ? (
                <p className="text-xs text-destructive">{form.formState.errors.note.message}</p>
              ) : null}
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Submit report
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
