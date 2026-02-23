"use client";

import { Loader2 } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
  ListingEditorForm,
  listingDetailToFormValues,
  type ListingWritePayload,
} from "@/src/components/admin/listing-form";
import { ListingMediaUploader } from "@/src/components/admin/media-uploader";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Separator } from "@/src/components/ui/separator";
import { apiJson } from "@/src/lib/admin/apiClient";
import type {
  AdminListingDetail,
  AdminListingDetailResponse,
  ListingMutationResponse,
} from "@/src/lib/admin/types";

function statusBadgeVariant(status: AdminListingDetail["status"]) {
  if (status === "published") return "success" as const;
  if (status === "draft") return "warning" as const;
  return "muted" as const;
}

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const listingId = params.id;

  const [detail, setDetail] = useState<AdminListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [transitioning, setTransitioning] = useState<string | null>(null);

  async function refreshDetail() {
    const response = await apiJson<AdminListingDetailResponse>(`/api/v1/admin/listings/${listingId}`);
    setDetail(response.data);
  }

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    apiJson<AdminListingDetailResponse>(`/api/v1/admin/listings/${listingId}`)
      .then((response) => {
        if (active) setDetail(response.data);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load listing");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [listingId]);

  async function handleSave(payload: ListingWritePayload) {
    setSaving(true);
    try {
      await apiJson<ListingMutationResponse>(`/api/v1/admin/listings/${listingId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      toast.success("Listing saved");
      await refreshDetail();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save listing");
    } finally {
      setSaving(false);
    }
  }

  async function runTransition(action: "publish" | "unpublish" | "archive") {
    if (!detail) return;
    const labels = {
      publish: "publish",
      unpublish: "unpublish",
      archive: "archive",
    } as const;

    if (action === "archive" && !window.confirm("Archive this listing?")) return;
    if (action === "unpublish" && !window.confirm("Move this listing back to draft?")) return;
    if (action === "publish" && !window.confirm("Publish this listing?")) return;

    setTransitioning(action);
    try {
      await apiJson<ListingMutationResponse>(`/api/v1/admin/listings/${listingId}/${action}`, {
        method: "POST",
      });
      toast.success(`Listing ${labels[action]}ed`);
      await refreshDetail();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : `Failed to ${action} listing`);
    } finally {
      setTransitioning(null);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-[540px] w-full" />
        <Skeleton className="h-[360px] w-full" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Listing not available</CardTitle>
          <CardDescription>
            {error ?? "The listing could not be loaded or may not exist."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex gap-2">
          <Button variant="outline" onClick={() => router.push("/admin/listings")}>
            Back to Listings
          </Button>
          <Button onClick={() => router.refresh()}>Retry</Button>
        </CardContent>
      </Card>
    );
  }

  const transitionBusy = Boolean(transitioning);
  const editDisabled = detail.status === "archived";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <CardTitle className="text-xl">{detail.title}</CardTitle>
            <Badge variant="muted">{detail.type}</Badge>
            <Badge variant={statusBadgeVariant(detail.status)}>{detail.status}</Badge>
          </div>
          <CardDescription>
            {detail.currency} {detail.price} • {detail.locationCity}, {detail.locationRegion},{" "}
            {detail.locationCountry}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <InfoItem label="Created" value={new Date(detail.createdAt).toLocaleString()} />
            <InfoItem label="Updated" value={new Date(detail.updatedAt).toLocaleString()} />
            <InfoItem
              label="Published"
              value={detail.publishedAt ? new Date(detail.publishedAt).toLocaleString() : "-"}
            />
          </div>
          <Separator />
          <div className="flex flex-wrap gap-2">
            <Button
              disabled={transitionBusy || detail.status !== "draft"}
              onClick={() => {
                void runTransition("publish");
              }}
            >
              {transitioning === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Publish
            </Button>
            <Button
              variant="outline"
              disabled={transitionBusy || detail.status !== "published"}
              onClick={() => {
                void runTransition("unpublish");
              }}
            >
              {transitioning === "unpublish" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : null}
              Unpublish
            </Button>
            <Button
              variant="destructive"
              disabled={transitionBusy || detail.status === "archived"}
              onClick={() => {
                void runTransition("archive");
              }}
            >
              {transitioning === "archive" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Archive
            </Button>
            <Button variant="ghost" onClick={() => router.push("/admin/listings")}>
              Back
            </Button>
          </div>
        </CardContent>
      </Card>

      <ListingEditorForm
        title="Edit Listing"
        description={
          editDisabled
            ? "Archived listings cannot be edited. You can still review attached media."
            : "Update the common listing fields and V1 typeFields JSON."
        }
        defaultValues={listingDetailToFormValues(detail)}
        submitLabel="Save Changes"
        submitting={saving}
        disabled={editDisabled}
        onSubmit={async (payload) => {
          await handleSave(payload);
        }}
      />

      <ListingMediaUploader
        listingId={listingId}
        media={detail.media}
        disabled={detail.status === "archived"}
        onChanged={refreshDetail}
      />
    </div>
  );
}

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
