"use client";

import Link from "next/link";
import { MessageCircle, Phone, SendHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { PublicShell } from "@/src/components/site/public-shell";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { apiJson, authApiJson, ClientApiError } from "@/src/lib/api/client";
import { useUserAuth } from "@/src/lib/auth/user-auth";
import type {
  CreateInquiryResponse,
  PublicListingDetailResponse,
} from "@/src/lib/client/types";

type ListingDetail = PublicListingDetailResponse["data"];

function sellerWhatsappLink(listing: ListingDetail | null): string | null {
  if (!listing) return null;
  const raw = process.env.NEXT_PUBLIC_SELLER_WHATSAPP;
  if (!raw) return null;
  const phone = raw.replace(/[^\d]/g, "");
  if (!phone) return null;
  const message = `Hi, I'm interested in ${listing.title} (ID: ${listing.id})`;
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

export default function ListingDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const { session, sessionLoading } = useUserAuth();
  const [listing, setListing] = useState<ListingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClientApiError | null>(null);
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0);
  const [startingChat, setStartingChat] = useState(false);
  const trackedViewRef = useRef<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiJson<PublicListingDetailResponse>(`/api/v1/listings/${params.id}`)
      .then((response) => {
        if (!active) return;
        setListing(response.data);
        setSelectedMediaIndex(0);
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof ClientApiError ? err : null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [params.id]);

  useEffect(() => {
    if (sessionLoading) return;
    if (!listing) return;
    if (trackedViewRef.current === listing.id) return;
    trackedViewRef.current = listing.id;

    const controller = new AbortController();
    const headers = new Headers();
    if (session?.access_token) {
      headers.set("Authorization", `Bearer ${session.access_token}`);
    }

    void fetch(`/api/v1/listings/${listing.id}/view`, {
      method: "POST",
      headers,
      cache: "no-store",
      signal: controller.signal,
    }).catch(() => {
      // View tracking is best-effort only.
    });

    return () => controller.abort();
  }, [listing?.id, session?.access_token, sessionLoading]);

  const selectedMedia = listing?.media[selectedMediaIndex] ?? listing?.media[0] ?? null;
  const whatsappUrl = useMemo(() => sellerWhatsappLink(listing), [listing]);

  async function handleMessageSeller() {
    if (!listing) return;
    if (sessionLoading) return;
    if (!session?.access_token) {
      router.push(`/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`);
      return;
    }

    setStartingChat(true);
    try {
      const response = await authApiJson<CreateInquiryResponse>("/api/v1/inquiries", {
        method: "POST",
        body: JSON.stringify({
          listing_id: listing.id,
          message: "Hi, is this still available?",
          preferred_contact: "chat",
        }),
      });
      toast.success(response.data.created ? "Conversation started" : "Conversation opened");
      router.push(`/messages/${response.data.conversation_id}`);
    } catch (err) {
      if (err instanceof ClientApiError && err.status === 401) {
        router.push(`/login?next=${encodeURIComponent(`/listings/${listing.id}`)}`);
        return;
      }
      toast.error(err instanceof Error ? err.message : "Failed to start conversation");
    } finally {
      setStartingChat(false);
    }
  }

  const pageTitle = listing ? listing.title : "Listing";
  return (
    <PublicShell title={pageTitle} subtitle={listing ? listing.description : "Loading listing..."}>
      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-[420px] w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-72 w-full" />
        </div>
      ) : error || !listing ? (
        <Card>
          <CardContent className="p-6">
            <p className="font-medium">Listing not found</p>
            <p className="mt-1 text-sm text-muted-foreground">
              {error?.status === 404
                ? "This listing is unavailable or no longer published."
                : (error?.message ?? "Unable to load listing.")}
            </p>
            <Button className="mt-4" onClick={() => router.push("/browse")}>
              Back to Browse
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <Card className="overflow-hidden">
              <div className="aspect-[16/10] bg-muted">
                {selectedMedia ? (
                  selectedMedia.kind === "video" ? (
                    <video
                      src={selectedMedia.url}
                      controls
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={selectedMedia.url}
                      alt={listing.title}
                      className="h-full w-full object-cover"
                    />
                  )
                ) : (
                  <div className="grid h-full place-items-center text-sm text-muted-foreground">
                    No media attached
                  </div>
                )}
              </div>
              {listing.media.length > 1 ? (
                <CardContent className="p-4">
                  <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
                    {listing.media.map((media, index) => (
                      <button
                        key={media.mediaId}
                        type="button"
                        onClick={() => setSelectedMediaIndex(index)}
                        className={`overflow-hidden rounded-lg border ${
                          selectedMediaIndex === index ? "border-primary ring-2 ring-primary/20" : ""
                        }`}
                      >
                        {media.kind === "video" ? (
                          <div className="grid aspect-square place-items-center bg-muted text-xs text-muted-foreground">
                            Video
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={media.thumbUrl ?? media.url}
                            alt=""
                            className="aspect-square h-full w-full object-cover"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </CardContent>
              ) : null}
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Listing Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <DetailChip label="Type" value={listing.type} />
                  <DetailChip
                    label="Published"
                    value={listing.publishedAt ? new Date(listing.publishedAt).toLocaleString() : "-"}
                  />
                  <DetailChip label="Country" value={listing.locationCountry} />
                  <DetailChip label="Region" value={listing.locationRegion} />
                  <DetailChip label="City" value={listing.locationCity} />
                  <DetailChip
                    label="Coordinates"
                    value={
                      listing.lat && listing.lng ? `${listing.lat}, ${listing.lng}` : "Not provided"
                    }
                  />
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium">Description</h3>
                  <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                    {listing.description}
                  </p>
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-medium">typeFields (V1 JSON)</h3>
                  <pre className="overflow-x-auto rounded-xl border bg-muted/20 p-3 text-xs">
                    <code>{JSON.stringify(listing.typeFields ?? null, null, 2)}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="sticky top-24">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-2xl">
                    {listing.currency} {listing.price}
                  </CardTitle>
                  <Badge variant="muted">{listing.type}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {listing.locationCity}, {listing.locationRegion}, {listing.locationCountry}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button className="w-full" onClick={() => void handleMessageSeller()} disabled={startingChat}>
                  {startingChat ? <SendHorizontal className="h-4 w-4 animate-pulse" /> : <MessageCircle className="h-4 w-4" />}
                  Message Seller
                </Button>

                {whatsappUrl ? (
                  <a href={whatsappUrl} target="_blank" rel="noreferrer" className="block">
                    <Button variant="outline" className="w-full">
                      <Phone className="h-4 w-4" />
                      WhatsApp Seller
                    </Button>
                  </a>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    <Phone className="h-4 w-4" />
                    WhatsApp unavailable
                  </Button>
                )}

                <div className="rounded-xl border bg-muted/20 p-3 text-sm text-muted-foreground">
                  Signed-in users can start a chat instantly. If you are not signed in, you will
                  be redirected to login and returned to this listing.
                </div>
                <Link href="/browse" className="text-sm text-primary underline-offset-4 hover:underline">
                  Back to browse
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </PublicShell>
  );
}

function DetailChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
