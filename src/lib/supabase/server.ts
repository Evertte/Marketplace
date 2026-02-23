import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import { ApiError } from "../http/errors";

let supabaseAdminClient: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (supabaseAdminClient) {
    return supabaseAdminClient;
  }

  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    throw new ApiError(
      500,
      "SERVER_MISCONFIG",
      "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  supabaseAdminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  return supabaseAdminClient;
}

export function getListingMediaBucketName(): string {
  return process.env.SUPABASE_LISTING_MEDIA_BUCKET?.trim() || "listing-media";
}

