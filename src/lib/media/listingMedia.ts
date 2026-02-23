import type { Media, MediaKind, Prisma, User } from "@prisma/client";
import { Prisma as PrismaNamespace } from "@prisma/client";

import { prisma } from "../db/prisma";
import { ApiError } from "../http/errors";
import { getListingMediaBucketName, getSupabaseAdmin } from "../supabase/server";

type AdminActor = Pick<User, "id">;

type PresignListingMediaInput = {
  purpose: "listing";
  kind: MediaKind;
  filename: string;
  mime: string;
  sizeBytes: number;
};

type CreateListingMediaUploadResult = {
  media_id: string;
  path: string;
  upload: {
    signedUrl: string;
    token: string;
    path: string;
  };
  public_url: string;
};

const IMAGE_MAX_BYTES = 10 * 1024 * 1024;
const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isUuidLike(value: string): boolean {
  return UUID_RE.test(value);
}

function requireNonEmptyString(payload: Record<string, unknown>, key: string): string {
  const value = payload[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new ApiError(400, "INVALID_INPUT", `Invalid ${key}`);
  }
  return value.trim();
}

function parsePositiveInt(payload: Record<string, unknown>, key: string): number {
  const value = payload[key];
  const num =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseInt(value, 10)
        : Number.NaN;

  if (!Number.isSafeInteger(num) || num <= 0) {
    throw new ApiError(400, "INVALID_INPUT", `Invalid ${key}`);
  }

  return num;
}

function sanitizeFilename(filename: string): string {
  const base = filename.split(/[\\/]/).pop() ?? filename;
  const sanitized = base
    .normalize("NFKD")
    .replace(/[^\w.\-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^\.+/, "")
    .replace(/^\-+|\-+$/g, "");

  const finalName = sanitized || "file";
  return finalName.slice(0, 180);
}

function getMediaSizeLimit(kind: MediaKind): number {
  return kind === "image" ? IMAGE_MAX_BYTES : VIDEO_MAX_BYTES;
}

function validateMimeForKind(kind: MediaKind, mime: string): void {
  if (kind === "image" && !mime.toLowerCase().startsWith("image/")) {
    throw new ApiError(400, "INVALID_INPUT", "mime must be an image/* type");
  }

  if (kind === "video" && !mime.toLowerCase().startsWith("video/")) {
    throw new ApiError(400, "INVALID_INPUT", "mime must be a video/* type");
  }
}

export function parseMediaPresignInput(payload: Record<string, unknown>): PresignListingMediaInput {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid request body");
  }

  const purpose = requireNonEmptyString(payload, "purpose");
  if (purpose !== "listing") {
    throw new ApiError(400, "INVALID_INPUT", "Only listing media is supported");
  }

  const kindRaw = requireNonEmptyString(payload, "kind");
  if (kindRaw !== "image" && kindRaw !== "video") {
    throw new ApiError(400, "INVALID_INPUT", "Invalid kind");
  }
  const kind = kindRaw as MediaKind;

  const filename = sanitizeFilename(requireNonEmptyString(payload, "filename"));
  const mime = requireNonEmptyString(payload, "mime");
  const sizeBytes = parsePositiveInt(payload, "size_bytes");

  validateMimeForKind(kind, mime);

  if (sizeBytes > getMediaSizeLimit(kind)) {
    throw new ApiError(400, "FILE_TOO_LARGE", "File exceeds allowed size limit");
  }

  return {
    purpose: "listing",
    kind,
    filename,
    mime,
    sizeBytes,
  };
}

export function parseMediaConfirmInput(payload: Record<string, unknown>): { mediaId: string } {
  if (!isPlainObject(payload)) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid request body");
  }

  const mediaId = requireNonEmptyString(payload, "media_id");
  if (!isUuidLike(mediaId)) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid media_id");
  }

  return { mediaId };
}

function getPublicUrlForPath(bucket: string, objectPath: string): string {
  const supabase = getSupabaseAdmin();
  const { data } = supabase.storage.from(bucket).getPublicUrl(objectPath);
  return data.publicUrl;
}

function parseObjectPathFromPublicUrl(publicUrl: string, bucket: string): string {
  let url: URL;
  try {
    url = new URL(publicUrl);
  } catch {
    throw new ApiError(400, "INVALID_INPUT", "Stored media URL is invalid");
  }

  const expectedPrefix = `/storage/v1/object/public/${bucket}/`;
  const { pathname } = url;
  if (!pathname.startsWith(expectedPrefix)) {
    throw new ApiError(400, "INVALID_INPUT", "Stored media URL does not match listing media bucket");
  }

  const encodedPath = pathname.slice(expectedPrefix.length);
  if (!encodedPath) {
    throw new ApiError(400, "INVALID_INPUT", "Stored media URL is missing object path");
  }

  return decodeURIComponent(encodedPath);
}

function splitPath(path: string): { dir: string; filename: string } {
  const idx = path.lastIndexOf("/");
  if (idx === -1) {
    return { dir: "", filename: path };
  }
  return {
    dir: path.slice(0, idx),
    filename: path.slice(idx + 1),
  };
}

export async function createListingMediaUpload(
  actor: AdminActor,
  input: PresignListingMediaInput,
): Promise<CreateListingMediaUploadResult> {
  const bucket = getListingMediaBucketName();
  const mediaId = crypto.randomUUID();
  const objectPath = `${mediaId}/${input.filename}`;
  const publicUrl = getPublicUrlForPath(bucket, objectPath);

  await prisma.media.create({
    data: {
      id: mediaId,
      ownerUserId: actor.id,
      purpose: "listing",
      kind: input.kind,
      url: publicUrl,
      mime: input.mime,
      sizeBytes: BigInt(input.sizeBytes),
      durationSec: null,
      status: "uploading",
    },
  });

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUploadUrl(objectPath, { upsert: false });

    if (error || !data) {
      throw new ApiError(
        400,
        "INVALID_INPUT",
        error?.message || "Failed to create signed upload URL",
      );
    }

    return {
      media_id: mediaId,
      path: data.path,
      upload: data,
      public_url: publicUrl,
    };
  } catch (error) {
    await prisma.media
      .update({
        where: { id: mediaId },
        data: { status: "failed" },
      })
      .catch(() => {});
    throw error;
  }
}

async function getListingMediaById(mediaId: string): Promise<Pick<Media, "id" | "purpose" | "status" | "url">> {
  const media = await prisma.media.findUnique({
    where: { id: mediaId },
    select: {
      id: true,
      purpose: true,
      status: true,
      url: true,
    },
  });

  if (!media) {
    throw new ApiError(404, "NOT_FOUND", "Media not found");
  }

  if (media.purpose !== "listing") {
    throw new ApiError(400, "INVALID_INPUT", "Only listing media is supported");
  }

  return media;
}

async function storageObjectExists(bucket: string, objectPath: string): Promise<boolean> {
  const supabase = getSupabaseAdmin();
  const { dir, filename } = splitPath(objectPath);

  const { data, error } = await supabase.storage.from(bucket).list(dir, {
    limit: 100,
    search: filename,
  });

  if (error) {
    throw new ApiError(400, "UPLOAD_NOT_FOUND", "Uploaded object was not found");
  }

  return (data ?? []).some((file) => file.name === filename);
}

export async function confirmListingMediaUpload(mediaId: string): Promise<{ media_id: string; status: "ready" }> {
  if (!isUuidLike(mediaId)) {
    throw new ApiError(400, "INVALID_INPUT", "Invalid media_id");
  }

  const media = await getListingMediaById(mediaId);
  const bucket = getListingMediaBucketName();
  const objectPath = parseObjectPathFromPublicUrl(media.url, bucket);

  const exists = await storageObjectExists(bucket, objectPath);
  if (!exists) {
    throw new ApiError(400, "UPLOAD_NOT_FOUND", "Uploaded object was not found");
  }

  await prisma.media.update({
    where: { id: media.id },
    data: { status: "ready" },
  });

  return { media_id: media.id, status: "ready" };
}

