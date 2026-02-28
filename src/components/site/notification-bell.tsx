"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { Bell, CheckCheck, Loader2, Volume2, VolumeX } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { authApiJson } from "@/src/lib/api/client";
import { USER_NOTIFICATION_EVENT, getUserNotificationRealtimeTopic, type UserNotificationBroadcastPayload } from "@/src/lib/chat/realtime";
import type {
  NotificationItem,
  NotificationsResponse,
  ReadAllNotificationsResponse,
  ReadNotificationResponse,
} from "@/src/lib/client/types";
import { useUserAuth } from "@/src/lib/auth/user-auth";
import { getSupabaseBrowser } from "@/src/lib/supabase/browser";

const SOUND_ENABLED_KEY = "notifications:sound-enabled";
const SOUND_UNLOCKED_KEY = "notifications:sound-unlocked";
const SOUND_THROTTLE_MS = 1500;

function formatCreatedAt(value: string): string {
  return new Date(value).toLocaleString();
}

export function NotificationBell() {
  const router = useRouter();
  const { session, user } = useUserAuth();
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [soundUnlocked, setSoundUnlocked] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const lastSoundAtRef = useRef(0);
  const initialTitleRef = useRef<string | null>(null);

  async function loadNotifications(cursor?: string, append = false) {
    const params = new URLSearchParams({ limit: "20" });
    if (cursor) params.set("cursor", cursor);
    const result = await authApiJson<NotificationsResponse>(`/api/v1/notifications?${params}`);
    setItems((prev) => (append ? [...prev, ...result.data] : result.data));
    setUnreadCount(result.unreadCount);
    setNextCursor(result.page.next_cursor);
    setHasMore(result.page.has_more);
  }

  useEffect(() => {
    if (!session?.access_token || !user) {
      setItems([]);
      setUnreadCount(0);
      setOpen(false);
      return;
    }

    let active = true;
    setLoading(true);
    loadNotifications()
      .catch((error) => {
        if (!active) return;
        toast.error(error instanceof Error ? error.message : "Failed to load notifications");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [session?.access_token, user?.id]);

  useEffect(() => {
    try {
      const storedEnabled = localStorage.getItem(SOUND_ENABLED_KEY);
      if (storedEnabled !== null) {
        setSoundEnabled(storedEnabled === "true");
      }
      const storedUnlocked = localStorage.getItem(SOUND_UNLOCKED_KEY);
      if (storedUnlocked === "true") {
        setSoundUnlocked(true);
      }
    } catch {
      // ignore storage errors
    }
  }, []);

  useEffect(() => {
    function handleGesture() {
      setSoundUnlocked(true);
      try {
        localStorage.setItem(SOUND_UNLOCKED_KEY, "true");
      } catch {
        // ignore storage errors
      }
      window.removeEventListener("pointerdown", handleGesture);
    }

    if (soundUnlocked) {
      window.removeEventListener("pointerdown", handleGesture);
      return;
    }

    window.addEventListener("pointerdown", handleGesture);
    return () => window.removeEventListener("pointerdown", handleGesture);
  }, [soundUnlocked]);

  useEffect(() => {
    const accessToken = session?.access_token;
    const currentUserId = user?.id ?? null;
    if (!accessToken || !currentUserId) return;
    const userId = currentUserId;

    let active = true;
    let channel: RealtimeChannel | null = null;
    const supabase = getSupabaseBrowser();

    async function subscribe() {
      try {
        await supabase.realtime.setAuth(accessToken);
        if (!active) return;

        channel = supabase.channel(getUserNotificationRealtimeTopic(userId), {
          config: { private: true },
        });

        channel.on("broadcast", { event: USER_NOTIFICATION_EVENT }, (payload) => {
          const notification = payload.payload as UserNotificationBroadcastPayload;
          if (notification.userId !== userId) return;

          setItems((current) => [notification, ...current].slice(0, 20));
          setUnreadCount((count) => count + 1);

          if (soundEnabled && soundUnlocked) {
            const now = Date.now();
            if (now - lastSoundAtRef.current >= SOUND_THROTTLE_MS) {
              lastSoundAtRef.current = now;
              const audio = new Audio("/sounds/notify.wav");
              audio.volume = 0.6;
              void audio.play().catch(() => {});
            }
          }
        });

        channel.subscribe();
      } catch {
        // keep notifications usable without realtime
      }
    }

    void subscribe();

    return () => {
      active = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
  }, [session?.access_token, soundEnabled, soundUnlocked, user?.id]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    if (!initialTitleRef.current) {
      initialTitleRef.current = document.title;
    }
    document.title = unreadCount > 0
      ? `(${unreadCount}) ${initialTitleRef.current}`
      : (initialTitleRef.current ?? document.title);
  }, [unreadCount]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (!open) return;
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const unreadBadge = useMemo(() => {
    if (unreadCount <= 0) return null;
    return unreadCount > 99 ? "99+" : String(unreadCount);
  }, [unreadCount]);

  if (!session || !user) return null;

  async function markRead(item: NotificationItem) {
    if (!item.readAt) {
      await authApiJson<ReadNotificationResponse>(`/api/v1/notifications/${item.id}/read`, {
        method: "POST",
      });
      setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, readAt: new Date().toISOString() } : entry));
      setUnreadCount((count) => Math.max(0, count - 1));
    }

    if (item.href) {
      router.push(item.href);
      setOpen(false);
    }
  }

  async function markAllRead() {
    setMarkingAll(true);
    try {
      const result = await authApiJson<ReadAllNotificationsResponse>("/api/v1/notifications/read-all", {
        method: "POST",
      });
      setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt ?? result.data.readAt })));
      setUnreadCount(0);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to mark notifications as read");
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="relative" ref={containerRef}>
      <Button type="button" variant="outline" size="icon" onClick={() => setOpen((value) => !value)} aria-label="Open notifications">
        <Bell className="h-4 w-4" />
      </Button>
      {unreadBadge ? (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-destructive px-1.5 py-0.5 text-center text-[10px] font-semibold text-destructive-foreground">
          {unreadBadge}
        </span>
      ) : null}

      {open ? (
        <div className="absolute right-0 top-12 z-40 w-[min(92vw,26rem)] rounded-2xl border bg-card shadow-2xl">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div>
              <p className="font-medium">Notifications</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={soundEnabled ? "Disable notification sound" : "Enable notification sound"}
                onClick={() => {
                  const next = !soundEnabled;
                  setSoundEnabled(next);
                  try {
                    localStorage.setItem(SOUND_ENABLED_KEY, String(next));
                  } catch {
                    // ignore storage errors
                  }
                }}
              >
                {soundEnabled ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
              </Button>
              <Button type="button" variant="ghost" size="sm" disabled={markingAll || unreadCount === 0} onClick={() => void markAllRead()}>
                {markingAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCheck className="h-4 w-4" />}
                Mark all read
              </Button>
            </div>
          </div>

          <div className="max-h-[70dvh] overflow-y-auto">
            {loading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-16 animate-pulse rounded-xl bg-muted/40" />
                ))}
              </div>
            ) : items.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted-foreground">No notifications yet.</div>
            ) : (
              <div className="divide-y">
                {items.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className={`block w-full px-4 py-3 text-left transition hover:bg-muted/30 ${item.readAt ? "bg-background" : "bg-primary/5"}`}
                    onClick={() => void markRead(item)}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium">{item.title}</p>
                        {item.body ? <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{item.body}</p> : null}
                        <p className="mt-2 text-xs text-muted-foreground">{formatCreatedAt(item.createdAt)}</p>
                      </div>
                      {!item.readAt ? <Badge variant="secondary">New</Badge> : null}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between border-t px-4 py-3 text-xs text-muted-foreground">
            <span>{soundEnabled ? `Sound on${soundUnlocked ? "" : " (tap anywhere to enable playback)"}` : "Sound off"}</span>
            {hasMore ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={loadingMore}
                onClick={() => {
                  if (!nextCursor) return;
                  setLoadingMore(true);
                  void loadNotifications(nextCursor, true)
                    .catch((error) => {
                      toast.error(error instanceof Error ? error.message : "Failed to load more notifications");
                    })
                    .finally(() => setLoadingMore(false));
                }}
              >
                {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Load more
              </Button>
            ) : (
              <span>No more notifications</span>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
