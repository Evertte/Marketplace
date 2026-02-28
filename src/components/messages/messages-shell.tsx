"use client";

import Link from "next/link";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { ArrowLeft, MapPin, MessageCircle, MoreHorizontal, Pin, PinOff, RefreshCw, ShieldAlert, Trash2, UserRound } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { ConversationReportModal } from "@/src/components/messages/conversation-report-modal";
import { authApiJson, ClientApiError } from "@/src/lib/api/client";
import { useUserAuth } from "@/src/lib/auth/user-auth";
import {
  CONVERSATION_ACTIVITY_EVENT,
  CONVERSATION_TYPING_ACTIVITY_EVENT,
  USER_NOTIFICATION_EVENT,
  getUserNotificationRealtimeTopic,
  type ConversationActivityDetail,
  type ConversationTypingActivityDetail,
  type UserNotificationBroadcastPayload,
} from "@/src/lib/chat/realtime";
import type { ConversationsResponse } from "@/src/lib/client/types";
import { getSupabaseBrowser } from "@/src/lib/supabase/browser";
import { buildSellerWhatsAppLink } from "@/src/lib/utils";

type ConversationItem = ConversationsResponse["data"][number];

function formatRelativeActivity(item: ConversationItem): string {
  const stamp = item.conversation.lastMessageAt ?? item.conversation.createdAt;
  const target = new Date(stamp);
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Now";
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}m`;
  if (diffMs < day) return `${Math.max(1, Math.floor(diffMs / hour))}h`;

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (target.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  }

  const year = now.getFullYear() === target.getFullYear() ? undefined : "2-digit";
  return new Intl.DateTimeFormat(undefined, {
    month: "numeric",
    day: "numeric",
    year,
  }).format(target);
}

function getParticipantLabel(
  item: ConversationItem,
): string {
  return item.otherUser.name;
}

function formatUnreadCount(unreadCount: number): string {
  if (unreadCount > 99) return "99+";
  return String(unreadCount);
}

function WhatsAppGlyph() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 32 32"
      className="h-4 w-4 fill-current"
    >
      <path d="M19.11 17.16c-.28-.14-1.65-.81-1.9-.9-.26-.09-.45-.14-.64.14-.19.28-.74.9-.91 1.08-.17.19-.33.21-.61.07-.28-.14-1.19-.44-2.27-1.41-.84-.75-1.41-1.68-1.58-1.96-.17-.28-.02-.43.12-.57.13-.13.28-.33.42-.49.14-.17.19-.28.28-.47.09-.19.05-.35-.02-.49-.07-.14-.64-1.55-.88-2.12-.23-.55-.47-.47-.64-.48h-.54c-.19 0-.49.07-.75.35-.26.28-.98.96-.98 2.34s1 2.72 1.14 2.91c.14.19 1.95 2.98 4.73 4.18.66.28 1.18.45 1.58.58.66.21 1.27.18 1.75.11.53-.08 1.65-.67 1.88-1.32.23-.64.23-1.19.16-1.32-.06-.13-.25-.2-.53-.34Z" />
      <path d="M16.02 3.2c-6.97 0-12.64 5.67-12.64 12.64 0 2.23.58 4.4 1.68 6.32L3.2 28.8l6.8-1.79a12.6 12.6 0 0 0 6.02 1.53c6.97 0 12.64-5.67 12.64-12.64S22.99 3.2 16.02 3.2Zm0 22.94c-1.88 0-3.72-.51-5.32-1.48l-.38-.23-4.03 1.06 1.08-3.93-.25-.4a10.23 10.23 0 0 1-1.56-5.46c0-5.64 4.59-10.23 10.23-10.23S26 10.06 26 15.7s-4.59 10.44-9.98 10.44Z" />
    </svg>
  );
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
  const searchParams = useSearchParams();
  const { session, user, sessionLoading, userLoading } = useUserAuth();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ClientApiError | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [archivingConversationId, setArchivingConversationId] = useState<string | null>(null);
  const [openActionConversationId, setOpenActionConversationId] = useState<string | null>(null);
  const [reportModalOpen, setReportModalOpen] = useState(false);
  const [typingByConversation, setTypingByConversation] = useState<Record<string, boolean>>({});
  const archivedView = searchParams.get("archived") === "1";
  const hasSelectedConversation = Boolean(selectedConversationId);
  const typingTimeoutsRef = useRef<Map<string, number>>(new Map());

  function buildMessagesHref(conversationId?: string, nextArchived = archivedView): string {
    const basePath = conversationId ? `/messages/${conversationId}` : "/messages";
    return nextArchived ? `${basePath}?archived=1` : basePath;
  }

  async function loadConversations(cursor?: string, append = false) {
    const params = new URLSearchParams({ limit: "20" });
    if (archivedView) params.set("archived", "1");
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
  }, [archivedView, pathname, router, session, sessionLoading]);

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
  }, [archivedView, selectedConversationId, session?.access_token]);

  useEffect(() => {
    function handleTyping(event: Event) {
      const detail = (event as CustomEvent<ConversationTypingActivityDetail>).detail;
      if (!detail?.conversationId) return;

      if (detail.isTyping) {
        setTypingByConversation((current) => ({ ...current, [detail.conversationId]: true }));
        const existing = typingTimeoutsRef.current.get(detail.conversationId);
        if (existing) window.clearTimeout(existing);
        const timeout = window.setTimeout(() => {
          setTypingByConversation((current) => {
            const next = { ...current };
            delete next[detail.conversationId];
            return next;
          });
          typingTimeoutsRef.current.delete(detail.conversationId);
        }, 3000);
        typingTimeoutsRef.current.set(detail.conversationId, timeout);
        return;
      }

      const existing = typingTimeoutsRef.current.get(detail.conversationId);
      if (existing) window.clearTimeout(existing);
      typingTimeoutsRef.current.delete(detail.conversationId);
      setTypingByConversation((current) => {
        const next = { ...current };
        delete next[detail.conversationId];
        return next;
      });
    }

    window.addEventListener(CONVERSATION_TYPING_ACTIVITY_EVENT, handleTyping);
    return () => {
      window.removeEventListener(CONVERSATION_TYPING_ACTIVITY_EVENT, handleTyping);
      typingTimeoutsRef.current.forEach((timeout) => window.clearTimeout(timeout));
      typingTimeoutsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    const accessToken = session?.access_token;
    const currentUserId = user?.id;
    if (!accessToken || !currentUserId) return;
    const subscribedUserId: string = currentUserId;

    let active = true;
    const supabase = getSupabaseBrowser();
    let channel: RealtimeChannel | null = null;

    async function subscribe() {
      try {
        await supabase.realtime.setAuth(accessToken);
        if (!active) return;

        channel = supabase.channel(getUserNotificationRealtimeTopic(subscribedUserId), {
          config: { private: true },
        });
        channel.on("broadcast", { event: USER_NOTIFICATION_EVENT }, (payload) => {
          const notification = payload.payload as UserNotificationBroadcastPayload;
          if (notification.userId !== subscribedUserId) return;
          if (notification.type !== "NEW_MESSAGE") return;
          void loadConversations(undefined, false).catch(() => {});
        });
        channel.subscribe();
      } catch {
        // keep inbox usable without realtime notification fan-out
      }
    }

    void subscribe();
    return () => {
      active = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, [archivedView, session?.access_token, user?.id]);

  useEffect(() => {
    if (!autoSelectFirst) return;
    if (loading || error) return;
    if (selectedConversationId) return;
    if (items.length > 0) {
      router.replace(buildMessagesHref(items[0]!.conversation.id));
    }
  }, [archivedView, autoSelectFirst, error, items, loading, router, selectedConversationId]);

  const selectedItem = useMemo(
    () => items.find((item) => item.conversation.id === selectedConversationId) ?? null,
    [items, selectedConversationId],
  );
  const selectedWhatsAppUrl = useMemo(
    () =>
      selectedItem
        ? buildSellerWhatsAppLink({
            listingId: selectedItem.listing.id,
            listingTitle: selectedItem.listing.title,
          })
        : null,
    [selectedItem],
  );

  async function restoreConversation(conversationId: string) {
    await authApiJson<{ data: { conversationId: string; archivedAt: string | null } }>(
      `/api/v1/conversations/${conversationId}/unarchive`,
      { method: "POST" },
    );
    if (archivedView && selectedConversationId === conversationId) {
      router.replace(buildMessagesHref(conversationId, false));
      return;
    }
    await loadConversations(undefined, false);
  }

  async function archiveConversation(item: ConversationItem) {
    setArchivingConversationId(item.conversation.id);
    try {
      await authApiJson<{ data: { conversationId: string; archivedAt: string | null } }>(
        `/api/v1/conversations/${item.conversation.id}/archive`,
        { method: "POST" },
      );

      setItems((prev) =>
        prev.filter((conversation) => conversation.conversation.id !== item.conversation.id),
      );
      setOpenActionConversationId((current) =>
        current === item.conversation.id ? null : current,
      );

      if (selectedConversationId === item.conversation.id) {
        router.replace(buildMessagesHref(undefined, false));
      }

      toast.success("Chat deleted from your inbox", {
        action: {
          label: "Undo",
          onClick: () => {
            void restoreConversation(item.conversation.id).catch((error) => {
              toast.error(
                error instanceof Error ? error.message : "Failed to restore conversation",
              );
            });
          },
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete chat");
    } finally {
      setArchivingConversationId(null);
    }
  }

  async function purgeConversation(item: ConversationItem) {
    setArchivingConversationId(item.conversation.id);
    try {
      await authApiJson<{ data: { conversationId: string; purged: true } }>(
        `/api/v1/admin/conversations/${item.conversation.id}/purge`,
        { method: "DELETE" },
      );

      setItems((prev) =>
        prev.filter((conversation) => conversation.conversation.id !== item.conversation.id),
      );
      setOpenActionConversationId((current) =>
        current === item.conversation.id ? null : current,
      );

      if (selectedConversationId === item.conversation.id) {
        router.replace(buildMessagesHref(undefined, true));
      }

      toast.success("Chat permanently deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to permanently delete chat");
    } finally {
      setArchivingConversationId(null);
    }
  }

  async function pinConversation(item: ConversationItem) {
    try {
      await authApiJson<{ data: { conversationId: string; pinnedAt: string | null } }>(
        `/api/v1/conversations/${item.conversation.id}/pin`,
        { method: "POST" },
      );
      setOpenActionConversationId(null);
      await loadConversations(undefined, false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to pin conversation");
    }
  }

  async function unpinConversation(item: ConversationItem) {
    try {
      await authApiJson<{ data: { conversationId: string; pinnedAt: string | null } }>(
        `/api/v1/conversations/${item.conversation.id}/unpin`,
        { method: "POST" },
      );
      setOpenActionConversationId(null);
      await loadConversations(undefined, false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to unpin conversation");
    }
  }

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
      <Card className={`overflow-hidden ${hasSelectedConversation ? "hidden lg:block" : ""}`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-2">
            <div className="space-y-3">
              <div>
                <CardTitle className="text-lg">Conversations</CardTitle>
                <CardDescription>Manual refresh with realtime conversation updates</CardDescription>
              </div>
              <div className="inline-flex rounded-lg border bg-muted/20 p-1">
                <Button
                  type="button"
                  size="sm"
                  variant={archivedView ? "ghost" : "secondary"}
                  onClick={() => router.replace(buildMessagesHref(undefined, false))}
                >
                  Active
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={archivedView ? "secondary" : "ghost"}
                  onClick={() => router.replace(buildMessagesHref(undefined, true))}
                >
                  Archived
                </Button>
              </div>
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
                  {archivedView
                    ? "Archived chats will appear here."
                    : "Start by messaging a seller from a listing page."}
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="max-h-[60dvh] space-y-2 overflow-y-auto pr-1">
                {items.map((item) => {
                  const active = item.conversation.id === selectedConversationId;
                  const href = buildMessagesHref(item.conversation.id);
                  const participantLabel = getParticipantLabel(item);
                  const actionsOpen = openActionConversationId === item.conversation.id;
                  const archiving = archivingConversationId === item.conversation.id;
                  const previewText = typingByConversation[item.conversation.id]
                    ? "Typing..."
                    : item.lastMessagePreview ?? "No messages yet";
                  return (
                    <div
                      key={item.conversation.id}
                      className={`block rounded-xl border p-3 transition ${
                        active ? "border-primary bg-primary/5" : "hover:bg-muted/20"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <Link href={href} className="flex min-w-0 flex-1 items-start gap-3">
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
                              <div className="min-w-0 space-y-1">
                                <div className="flex items-center gap-2">
                                  <p
                                    className={`line-clamp-1 ${
                                      item.hasUnread ? "font-semibold text-foreground" : "font-medium"
                                    }`}
                                  >
                                    {participantLabel}
                                  </p>
                                  {item.isPinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
                                </div>
                                <p className="line-clamp-1 text-xs text-muted-foreground">
                                  {item.listing.title}
                                </p>
                                <p className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <UserRound className="h-3.5 w-3.5" />
                                  <span className="line-clamp-1">
                                    {item.listing.currency} {item.listing.price}
                                  </span>
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-col items-end gap-2">
                                <Badge variant="muted">{item.listing.type}</Badge>
                                <span className="text-[11px] text-muted-foreground">
                                  {formatRelativeActivity(item)}
                                </span>
                              </div>
                            </div>
                            <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                              <MapPin className="h-3.5 w-3.5" />
                              <span className="line-clamp-1">
                                {item.listing.locationCity}, {item.listing.locationRegion}
                              </span>
                            </p>
                            <p
                              className={`mt-2 line-clamp-1 text-sm ${
                                typingByConversation[item.conversation.id]
                                  ? "text-primary"
                                  : item.hasUnread
                                    ? "font-medium text-foreground"
                                    : "text-muted-foreground"
                              }`}
                            >
                              {previewText}
                            </p>
                            <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                              <span>{item.listing.locationCountry}</span>
                              {item.unreadCount > 0 ? (
                                <span className="inline-flex min-w-6 items-center justify-center rounded-full bg-primary px-1.5 py-0.5 text-[11px] font-medium text-primary-foreground">
                                  {formatUnreadCount(item.unreadCount)}
                                </span>
                              ) : null}
                            </div>
                          </div>
                        </Link>
                        <div className="relative shrink-0">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() =>
                              setOpenActionConversationId((current) =>
                                current === item.conversation.id ? null : item.conversation.id,
                              )
                            }
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                          {actionsOpen ? (
                            <div className="absolute right-0 top-10 z-10 w-40 rounded-lg border bg-background p-1 shadow-lg">
                              {!archivedView ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="w-full justify-start"
                                  onClick={() =>
                                    void (item.isPinned
                                      ? unpinConversation(item)
                                      : pinConversation(item))
                                  }
                                >
                                  {item.isPinned ? (
                                    <>
                                      <PinOff className="mr-2 h-4 w-4" />
                                      Unpin chat
                                    </>
                                  ) : (
                                    <>
                                      <Pin className="mr-2 h-4 w-4" />
                                      Pin chat
                                    </>
                                  )}
                                </Button>
                              ) : null}
                              {archivedView && user?.role === "admin" ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  className="w-full justify-start text-destructive hover:text-destructive"
                                  disabled={archiving}
                                  onClick={() => void purgeConversation(item)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                  {archiving ? "Deleting..." : "Permanently delete"}
                                </Button>
                              ) : null}
                              <Button
                                type="button"
                                variant="ghost"
                                className={`w-full justify-start ${
                                  archivedView
                                    ? ""
                                    : "text-destructive hover:text-destructive"
                                }`}
                                disabled={archiving}
                                onClick={() =>
                                  archivedView
                                    ? void restoreConversation(item.conversation.id)
                                    : void archiveConversation(item)
                                }
                              >
                                <Trash2 className="h-4 w-4" />
                                {archivedView
                                  ? "Restore chat"
                                  : archiving
                                    ? "Deleting..."
                                    : "Delete chat"}
                              </Button>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
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

      <Card className={`min-h-[70dvh] ${hasSelectedConversation ? "block" : "hidden lg:block"}`}>
        <CardHeader>
          {selectedItem ? (
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Link href={buildMessagesHref(undefined, archivedView)} className="lg:hidden">
                  <Button type="button" variant="ghost" size="icon" aria-label="Back to conversations">
                    <ArrowLeft className="h-4 w-4" />
                  </Button>
                </Link>
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
                    <span>{getParticipantLabel(selectedItem)}</span>
                  </CardDescription>
                  <CardDescription className="mt-1">
                    {selectedItem.listing.locationCity}, {selectedItem.listing.locationRegion} •{" "}
                    {selectedItem.listing.currency} {selectedItem.listing.price}
                  </CardDescription>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {selectedWhatsAppUrl ? (
                  <a href={selectedWhatsAppUrl} target="_blank" rel="noreferrer">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
                    >
                      <WhatsAppGlyph />
                      WhatsApp
                    </Button>
                  </a>
                ) : null}
                <Button type="button" variant="outline" size="sm" onClick={() => setReportModalOpen(true)}>
                  <ShieldAlert className="h-4 w-4" />
                  Report
                </Button>
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
      {selectedItem ? (
        <ConversationReportModal
          open={reportModalOpen}
          conversationId={selectedItem.conversation.id}
          listingTitle={selectedItem.listing.title}
          onClose={() => setReportModalOpen(false)}
        />
      ) : null}
    </div>
  );
}
