"use client";

import { Image as ImageIcon, Loader2, MoveDown, MoveUp, Trash2, UploadCloud, Video } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { apiJson, apiVoid } from "@/src/lib/admin/apiClient";
import { getSupabaseBrowser } from "@/src/lib/admin/supabase-browser";
import type {
  AdminListingDetail,
  ListingAttachMediaResponse,
  MediaConfirmResponse,
  MediaPresignResponse,
} from "@/src/lib/admin/types";
import { cn } from "@/src/lib/utils";

type ListingMediaItem = AdminListingDetail["media"][number];

type Props = {
  listingId: string;
  media: ListingMediaItem[];
  disabled?: boolean;
  onChanged: () => Promise<void>;
};

type UploadJob = {
  id: string;
  filename: string;
  status: "pending" | "uploading" | "confirming" | "attaching" | "done" | "failed";
  error?: string;
};

function inferKind(file: File): "image" | "video" | null {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";

  const lower = file.name.toLowerCase();
  if (/\.(png|jpe?g|webp|gif|avif)$/i.test(lower)) return "image";
  if (/\.(mp4|mov|webm|m4v|avi)$/i.test(lower)) return "video";
  return null;
}

function getBucketFromPublicUrl(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const match = url.pathname.match(/\/storage\/v1\/object\/public\/([^/]+)\//);
    return match?.[1] ?? null;
  } catch {
    return null;
  }
}

function normalizeSignedUrl(signedUrl: string): string {
  if (/^https?:\/\//i.test(signedUrl)) return signedUrl;
  if (signedUrl.startsWith("/")) {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base) return signedUrl;
    return `${base.replace(/\/+$/, "")}${signedUrl}`;
  }
  return signedUrl;
}

async function uploadWithSupabaseSignedPayload(
  file: File,
  presign: MediaPresignResponse["data"],
): Promise<void> {
  const { upload } = presign;
  const bucket = getBucketFromPublicUrl(presign.public_url);

  if (bucket && upload.token && upload.path) {
    const supabase = getSupabaseBrowser();
    const { error } = await supabase.storage
      .from(bucket)
      .uploadToSignedUrl(upload.path, upload.token, file);

    if (error) {
      throw new Error(error.message);
    }
    return;
  }

  if (upload.signedUrl) {
    const response = await fetch(normalizeSignedUrl(upload.signedUrl), {
      method: "PUT",
      headers: {
        "Content-Type": file.type || "application/octet-stream",
        "x-upsert": "false",
      },
      body: file,
    });

    if (!response.ok) {
      throw new Error(`Upload failed (${response.status})`);
    }
    return;
  }

  throw new Error("Unsupported upload payload from presign endpoint");
}

export function ListingMediaUploader({ listingId, media, disabled = false, onChanged }: Props) {
  const [isDragging, setIsDragging] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [jobs, setJobs] = useState<UploadJob[]>([]);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function updateJob(id: string, patch: Partial<UploadJob>) {
    setJobs((prev) => prev.map((job) => (job.id === id ? { ...job, ...patch } : job)));
  }

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0 || disabled) return;
    const files = Array.from(fileList);

    const createdJobs: UploadJob[] = files.map((file) => ({
      id: crypto.randomUUID(),
      filename: file.name,
      status: "pending",
    }));
    setJobs((prev) => [...createdJobs, ...prev].slice(0, 8));

    let currentSortOrder =
      media.length === 0 ? 0 : Math.max(...media.map((item) => item.sortOrder)) + 1;

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index]!;
      const job = createdJobs[index]!;
      const kind = inferKind(file);

      if (!kind) {
        updateJob(job.id, {
          status: "failed",
          error: "Unsupported file type",
        });
        continue;
      }

      try {
        updateJob(job.id, { status: "uploading" });
        const presign = await apiJson<MediaPresignResponse>("/api/v1/media/presign", {
          method: "POST",
          body: JSON.stringify({
            purpose: "listing",
            kind,
            filename: file.name,
            mime: file.type || (kind === "image" ? "image/jpeg" : "video/mp4"),
            size_bytes: file.size,
          }),
        });

        await uploadWithSupabaseSignedPayload(file, presign.data);

        updateJob(job.id, { status: "confirming" });
        await apiJson<MediaConfirmResponse>("/api/v1/media/confirm", {
          method: "POST",
          body: JSON.stringify({ media_id: presign.data.media_id }),
        });

        updateJob(job.id, { status: "attaching" });
        await apiJson<ListingAttachMediaResponse>(`/api/v1/admin/listings/${listingId}/media`, {
          method: "POST",
          body: JSON.stringify({
            media_id: presign.data.media_id,
            sort_order: currentSortOrder,
          }),
        });

        currentSortOrder += 1;
        updateJob(job.id, { status: "done" });
      } catch (error) {
        const message = error instanceof Error ? error.message : "Upload failed";
        updateJob(job.id, { status: "failed", error: message });
      }
    }

    await onChanged();
    toast.success("Media upload pipeline completed");
    if (inputRef.current) inputRef.current.value = "";
  }

  async function removeItem(item: ListingMediaItem) {
    setBusyAction(`remove:${item.mediaId}`);
    try {
      await apiVoid(`/api/v1/admin/listings/${listingId}/media/${item.mediaId}`, {
        method: "DELETE",
      });
      toast.success("Media detached from listing");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to detach media");
    } finally {
      setBusyAction(null);
    }
  }

  async function reorder(next: ListingMediaItem[]) {
    setBusyAction("reorder");
    try {
      for (const item of media) {
        await apiVoid(`/api/v1/admin/listings/${listingId}/media/${item.mediaId}`, {
          method: "DELETE",
        });
      }

      for (let index = 0; index < next.length; index += 1) {
        const item = next[index]!;
        await apiJson<ListingAttachMediaResponse>(`/api/v1/admin/listings/${listingId}/media`, {
          method: "POST",
          body: JSON.stringify({
            media_id: item.mediaId,
            sort_order: index,
          }),
        });
      }

      toast.success("Media order updated");
      await onChanged();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to reorder media");
      await onChanged().catch(() => {});
    } finally {
      setBusyAction(null);
    }
  }

  function moveItem(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= media.length) return;
    const next = media.slice();
    const [moved] = next.splice(index, 1);
    next.splice(nextIndex, 0, moved);
    void reorder(next);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Listing Media</CardTitle>
        <CardDescription>
          Upload images or videos for this listing. Files are uploaded directly to Supabase
          Storage and then attached to the listing.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div
          role="button"
          tabIndex={0}
          onClick={() => !disabled && inputRef.current?.click()}
          onKeyDown={(event) => {
            if ((event.key === "Enter" || event.key === " ") && !disabled) {
              event.preventDefault();
              inputRef.current?.click();
            }
          }}
          onDragOver={(event) => {
            event.preventDefault();
            if (!disabled) setIsDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setIsDragging(false);
            void handleFiles(event.dataTransfer.files);
          }}
          className={cn(
            "grid min-h-32 place-items-center rounded-xl border border-dashed p-6 text-center transition-colors",
            isDragging ? "border-primary bg-primary/5" : "border-border",
            disabled && "cursor-not-allowed opacity-60",
          )}
        >
          <div>
            <UploadCloud className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
            <p className="font-medium">Drop files here or click to upload</p>
            <p className="text-sm text-muted-foreground">
              Images up to 10MB, videos up to 100MB
            </p>
          </div>
          <input
            ref={inputRef}
            type="file"
            hidden
            multiple
            accept="image/*,video/*"
            onChange={(event) => {
              void handleFiles(event.target.files);
            }}
          />
        </div>

        {jobs.length > 0 ? (
          <div className="space-y-2 rounded-xl border bg-muted/30 p-3">
            <p className="text-sm font-medium">Recent upload jobs</p>
            {jobs.map((job) => (
              <div key={job.id} className="flex items-center justify-between gap-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate">{job.filename}</p>
                  {job.error ? (
                    <p className="truncate text-xs text-destructive">{job.error}</p>
                  ) : null}
                </div>
                <Badge variant={job.status === "failed" ? "warning" : "muted"}>
                  {job.status}
                </Badge>
              </div>
            ))}
          </div>
        ) : null}

        {media.length === 0 ? (
          <div className="rounded-xl border bg-muted/20 p-6 text-center text-sm text-muted-foreground">
            No media attached yet.
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {media.map((item, index) => {
              const itemBusy =
                disabled ||
                busyAction === "reorder" ||
                busyAction === `remove:${item.mediaId}`;
              const previewUrl = item.thumbUrl ?? item.url;
              const isVideo = item.kind === "video";

              return (
                <div key={item.mediaId} className="rounded-xl border bg-card p-3">
                  <div className="mb-3 overflow-hidden rounded-lg border bg-black/5">
                    {isVideo ? (
                      <video
                        src={previewUrl}
                        className="h-40 w-full object-cover"
                        controls={false}
                        muted
                        playsInline
                      />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt=""
                        className="h-40 w-full object-cover"
                      />
                    )}
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        {isVideo ? (
                          <Video className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        )}
                        <p className="truncate text-sm font-medium">{item.mediaId}</p>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <Badge variant="muted">sort {item.sortOrder}</Badge>
                        <Badge variant={item.status === "ready" ? "success" : "warning"}>
                          {item.status}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={itemBusy || index === 0}
                        onClick={() => moveItem(index, -1)}
                      >
                        <MoveUp className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        disabled={itemBusy || index === media.length - 1}
                        onClick={() => moveItem(index, 1)}
                      >
                        <MoveDown className="h-4 w-4" />
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        disabled={itemBusy}
                        onClick={() => {
                          void removeItem(item);
                        }}
                      >
                        {busyAction === `remove:${item.mediaId}` ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
