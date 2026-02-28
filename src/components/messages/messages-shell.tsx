"use client";

import Link from "next/link";
import { MapPin, MessageCircle, RefreshCw, UserRound } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { authApiJson, ClientApiError } from "@/src/lib/api/client";
import { useUserAuth } from "@/src/lib/auth/user-auth";
import { CONVERSATION_ACTIVITY_EVENT, type ConversationActivityDetail } from "@/src/lib/chat/realtime";
import type { ConversationsResponse } from "@/src/lib/client/types";

type ConversationItem = ConversationsResponse["data"][number];

function formatActivity(item: ConversationItem): string {
  const stamp = item.conversation.lastMessageAt ?? item.conversation.createdAt;
  return new Date(stamp).toLocaleString();
}

function getParticipantLabel(
  item: ConversationItem,
  role: "admin" | "user" | undefined,
): string {
  if (role === "admin") {
    return item.buyer.email;
  }

  return "Marketplace Admin";
}

export function MessagesShell({
  selectedConversationId,
  autoSelectFirst = false,
  children,
}: {
  selectedConversationId?: string;
  autoSelectFirst?: boolean;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, user, sessionLoading, userLoading } = useUserAuth();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClientApiError | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  async function loadConversations(cursor?: string, append = false) {
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) params.set("cursor", cursor);
    const response = await authApiJson<ConversationsResponse>(`/api/v1/conversations?${params}`);

    setItems((prev) => (append ? [...prev, ...response.data] : response.data));
    setNextCursor(response.page.next_cursor);
    setHasMore(response.page.has_more);
    setError(null);
  }

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.replace(`/login?next=${encodeURIComponent(pathname || "/messages")}`);
      return;
    }

    let active = true;
    setLoading(true);
    loadConversations()
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
  }, [pathname, router, session, sessionLoading]);

  useEffect(() => {
    if (!session?.access_token) return;

    function handleActivity(event: Event) {
      const detail = (event as CustomEvent<ConversationActivityDetail>).detail;
      if (selectedConversationId && detail?.conversationId !== selectedConversationId) {
        return;
      }

      void loadConversations(undefined, false).catch(() => {});
    }

    window.addEventListener(CONVERSATION_ACTIVITY_EVENT, handleActivity);
    return () => window.removeEventListener(CONVERSATION_ACTIVITY_EVENT, handleActivity);
  }, [selectedConversationId, session?.access_token]);

  useEffect(() => {
    if (!autoSelectFirst) return;
    if (loading || error) return;
    if (selectedConversationId) return;
    if (items.length > 0) {
      router.replace(`/messages/${items[0]!.conversation.id}`);
    }
  }, [autoSelectFirst, error, items, loading, router, selectedConversationId]);

  const selectedItem = useMemo(
    () => items.find((item) => item.conversation.id === selectedConversationId) ?? null,
    [items, selectedConversationId],
  );

  if (sessionLoading || (session && userLoading && !user)) {
    return (
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <Skeleton className="h-[70dvh]" />
        <Skeleton className="h-[70dvh]" />
      </div>
    );
  }

  if (!session) {
    return (
      <Card>
        <CardContent className="p-6">Redirecting to login...</CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg">Conversations</CardTitle>
              <CardDescription>Manual refresh with realtime conversation updates</CardDescription>
            </div>
            <Button
              variant="outline"
              size="icon"
              onClick={() => void loadConversations()}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-4 text-sm">
              <p className="font-medium text-destructive">Failed to load conversations</p>
              <p className="mt-1 text-muted-foreground">{error.message}</p>
              <Button className="mt-3" size="sm" onClick={() => void loadConversations()}>
                Retry
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="grid min-h-48 place-items-center rounded-lg border bg-muted/20 text-center">
              <div className="p-4">
                <MessageCircle className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="font-medium">No conversations yet</p>
                <p className="text-sm text-muted-foreground">
                  Start by messaging a seller from a listing page.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-[60dvh] space-y-2 overflow-y-auto pr-1">
                {items.map((item) => {
                  const active = item.conversation.id === selectedConversationId;
                  const href = `/messages/${item.conversation.id}`;
                  const participantLabel = getParticipantLabel(item, user?.role);
                  return (
                    <Link
                      key={item.conversation.id}
                      href={href}
                      className={`block rounded-xl border p-3 transition ${
                        active ? "border-primary bg-primary/5" : "hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg border bg-muted">
                          {item.listing.coverImageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={item.listing.coverImageUrl}
                              alt={item.listing.title}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="grid h-full place-items-center text-[11px] text-muted-foreground">
                              No image
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="line-clamp-1 font-medium">{item.listing.title}</p>
                                {item.hasUnread ? (
                                  <span
                                    className="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-primary"
                                    aria-label="Unread conversation"
                                    title="Unread conversation"
                                  />
                                ) : null}
                              </div>
                              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                                <UserRound className="h-3.5 w-3.5" />
                                <span className="line-clamp-1">{participantLabel}</span>
                              </p>
                            </div>
                            <Badge variant="muted">{item.listing.type}</Badge>
                          </div>
                          <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="line-clamp-1">
                              {item.listing.locationCity}, {item.listing.locationRegion}
                            </span>
                          </p>
                          <p className="mt-2 line-clamp-1 text-sm text-muted-foreground">
                            {item.lastMessagePreview ?? "No messages yet"}
                          </p>
                          <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                            <span>
                              {item.listing.currency} {item.listing.price}
                            </span>
                            <span>{formatActivity(item)}</span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
              <div className="flex justify-center">
                {hasMore ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={loadingMore}
                    onClick={() => {
                      if (!nextCursor) return;
                      setLoadingMore(true);
                      void loadConversations(nextCursor, true)
                        .catch((err) => {
                          toast.error(
                            err instanceof Error ? err.message : "Failed to load more conversations",
                          );
                        })
                        .finally(() => setLoadingMore(false));
                    }}
                  >
                    {loadingMore ? "Loading..." : "Load more"}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">No more conversations</span>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Card className="min-h-[70dvh]">
        <CardHeader>
          {selectedItem ? (
            <div className="flex items-start gap-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg border bg-muted">
                {selectedItem.listing.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={selectedItem.listing.coverImageUrl}
                    alt={selectedItem.listing.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full place-items-center text-[11px] text-muted-foreground">
                    No image
                  </div>
                )}
              </div>
              <div className="min-w-0">
                <CardTitle className="line-clamp-1">{selectedItem.listing.title}</CardTitle>
                <CardDescription className="mt-1 flex items-center gap-1">
                  <UserRound className="h-3.5 w-3.5" />
                  <span>{getParticipantLabel(selectedItem, user?.role)}</span>
                </CardDescription>
                <CardDescription className="mt-1">
                  {selectedItem.listing.locationCity}, {selectedItem.listing.locationRegion} •{" "}
                  {selectedItem.listing.currency} {selectedItem.listing.price}
                </CardDescription>
              </div>
            </div>
          ) : (
            <>
              <CardTitle>Select a conversation</CardTitle>
              <CardDescription>
                Pick a conversation from the list to view and send messages.
              </CardDescription>
            </>
          )}
        </CardHeader>
        <CardContent className="h-[calc(70dvh-6rem)]">
          {children ?? (
            <div className="grid h-full place-items-center rounded-xl border bg-muted/20 text-center text-sm text-muted-foreground">
              <div>
                <p className="font-medium">No conversation selected</p>
                <p>Choose one from the left panel.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
