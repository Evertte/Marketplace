"use client";

import type { RealtimeChannel } from "@supabase/supabase-js";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, RefreshCw, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Textarea } from "@/src/components/ui/textarea";
import { authApiJson, ClientApiError } from "@/src/lib/api/client";
import { useUserAuth } from "@/src/lib/auth/user-auth";
import {
  CONVERSATION_MESSAGE_NEW_EVENT,
  CONVERSATION_READ_UPDATED_EVENT,
  emitConversationActivity,
  getConversationRealtimeTopic,
  type ConversationMessageBroadcastPayload,
  type ConversationReadStateBroadcastPayload,
} from "@/src/lib/chat/realtime";
import type {
  ConversationMessagesResponse,
  ConversationReadState,
  MarkConversationReadResponse,
  SendMessageResponse,
} from "@/src/lib/client/types";
import { getSupabaseBrowser } from "@/src/lib/supabase/browser";

type MessageItem = ConversationMessagesResponse["data"][number];

const messageComposerSchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

type MessageComposerValues = z.infer<typeof messageComposerSchema>;

function sortMessagesAsc(messages: MessageItem[]): MessageItem[] {
  return [...messages].sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return a.id.localeCompare(b.id);
  });
}

function mergeMessages(existing: MessageItem[], incoming: MessageItem[]): MessageItem[] {
  const map = new Map<string, MessageItem>();
  for (const message of existing) map.set(message.id, message);
  for (const message of incoming) map.set(message.id, message);
  return sortMessagesAsc(Array.from(map.values()));
}

export function ConversationThread({
  conversationId,
}: {
  conversationId: string;
}) {
  const { session, user } = useUserAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ClientApiError | null>(null);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [connectionState, setConnectionState] = useState<"idle" | "connected" | "reconnecting" | "error">("idle");
  const [myReadState, setMyReadState] = useState<ConversationReadState | null>(null);
  const [otherReadState, setOtherReadState] = useState<ConversationReadState | null>(null);
  const [isDocumentVisible, setIsDocumentVisible] = useState(
    typeof document === "undefined" ? true : document.visibilityState === "visible",
  );
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastMessageCountRef = useRef(0);
  const readDebounceRef = useRef<number | null>(null);
  const lastRequestedReadMessageIdRef = useRef<string | null>(null);

  const form = useForm<MessageComposerValues>({
    resolver: zodResolver(messageComposerSchema),
    defaultValues: { text: "" },
  });

  function syncReadState(
    response: Pick<ConversationMessagesResponse, "readState">,
  ) {
    setMyReadState(response.readState.me);
    setOtherReadState(response.readState.other);
  }

  async function fetchLatest() {
    const response = await authApiJson<ConversationMessagesResponse>(
      `/api/v1/conversations/${conversationId}/messages?limit=30`,
    );
    const latestAsc = sortMessagesAsc(response.data);
    setMessages((prev) => (prev.length === 0 ? latestAsc : mergeMessages(prev, latestAsc)));
    syncReadState(response);
    setError(null);
    if (messages.length === 0) {
      setOlderCursor(response.page.next_cursor);
      setHasMoreOlder(response.page.has_more);
    }
  }

  async function initialLoad() {
    setLoading(true);
    try {
      const response = await authApiJson<ConversationMessagesResponse>(
        `/api/v1/conversations/${conversationId}/messages?limit=30`,
      );
      setMessages(sortMessagesAsc(response.data));
      syncReadState(response);
      setOlderCursor(response.page.next_cursor);
      setHasMoreOlder(response.page.has_more);
      setError(null);
    } catch (err) {
      setError(err instanceof ClientApiError ? err : null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setMessages([]);
    setOlderCursor(null);
    setHasMoreOlder(false);
    setError(null);
    setMyReadState(null);
    setOtherReadState(null);
    lastRequestedReadMessageIdRef.current = null;
    void initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    function handleVisibilityChange() {
      setIsDocumentVisible(document.visibilityState === "visible");
    }

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  useEffect(() => {
    const accessToken = session?.access_token;
    if (!accessToken) {
      setConnectionState("idle");
      return;
    }

    let active = true;
    const supabase = getSupabaseBrowser();
    let channel: RealtimeChannel | null = null;

    async function subscribe() {
      try {
        await supabase.realtime.setAuth(accessToken);
        if (!active) return;

        channel = supabase.channel(getConversationRealtimeTopic(conversationId), {
          config: { private: true },
        });

        channel.on(
          "broadcast",
          { event: CONVERSATION_MESSAGE_NEW_EVENT },
          (payload) => {
            const data = payload.payload as ConversationMessageBroadcastPayload;
            if (data.conversationId !== conversationId) return;

            emitConversationActivity(conversationId);
            void fetchLatest().catch(() => {});
          },
        );
        channel.on(
          "broadcast",
          { event: CONVERSATION_READ_UPDATED_EVENT },
          (payload) => {
            const data = payload.payload as ConversationReadStateBroadcastPayload;
            if (data.conversationId !== conversationId) return;

            if (data.userId === user?.id) {
              setMyReadState((current) => ({
                conversationId: data.conversationId,
                userId: data.userId,
                lastReadMessageId: data.lastReadMessageId,
                lastReadAt: data.lastReadAt,
                createdAt: current?.createdAt ?? data.lastReadAt ?? new Date().toISOString(),
                updatedAt: data.lastReadAt ?? new Date().toISOString(),
              }));
              lastRequestedReadMessageIdRef.current = data.lastReadMessageId;
            } else {
              setOtherReadState((current) => ({
                conversationId: data.conversationId,
                userId: data.userId,
                lastReadMessageId: data.lastReadMessageId,
                lastReadAt: data.lastReadAt,
                createdAt: current?.createdAt ?? data.lastReadAt ?? new Date().toISOString(),
                updatedAt: data.lastReadAt ?? new Date().toISOString(),
              }));
            }
          },
        );

        channel.subscribe((status) => {
          if (!active) return;

          if (status === "SUBSCRIBED") {
            setConnectionState("connected");
            return;
          }

          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            setConnectionState("reconnecting");
            return;
          }

          if (status === "CLOSED") {
            setConnectionState("error");
          }
        });
      } catch {
        if (active) {
          setConnectionState("error");
        }
      }
    }

    setConnectionState("reconnecting");
    void subscribe();

    return () => {
      active = false;
      if (channel) {
        void supabase.removeChannel(channel);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, session?.access_token, user?.id]);

  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    lastMessageCountRef.current = messages.length;
  }, [messages]);

  const latestMessage = useMemo(
    () => (messages.length > 0 ? messages[messages.length - 1]! : null),
    [messages],
  );
  const lastOutgoingMessageId = useMemo(() => {
    if (!user) return null;
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      if (messages[index]!.senderUserId === user.id) {
        return messages[index]!.id;
      }
    }
    return null;
  }, [messages, user]);

  const prettyError = useMemo(() => {
    if (!error) return null;
    if (error.status === 403) return "You do not have access to this conversation.";
    if (error.status === 404) return "Conversation not found.";
    return error.message;
  }, [error]);

  function hasOtherSeenMessage(message: MessageItem): boolean {
    if (!otherReadState) return false;
    if (otherReadState.lastReadMessageId === message.id) return true;
    if (otherReadState.lastReadAt && otherReadState.lastReadAt >= message.createdAt) return true;
    return false;
  }

  async function markConversationRead(targetMessageId: string) {
    if (lastRequestedReadMessageIdRef.current === targetMessageId) return;
    if (myReadState?.lastReadMessageId === targetMessageId) return;

    lastRequestedReadMessageIdRef.current = targetMessageId;

    try {
      const response = await authApiJson<MarkConversationReadResponse>(
        `/api/v1/conversations/${conversationId}/read`,
        { method: "POST" },
      );
      setMyReadState(response.data);
      lastRequestedReadMessageIdRef.current = response.data.lastReadMessageId;
      emitConversationActivity(conversationId);
    } catch (err) {
      lastRequestedReadMessageIdRef.current = null;
      if (err instanceof ClientApiError && (err.status === 403 || err.status === 404)) {
        return;
      }
      console.error("Failed to mark conversation as read", err);
    }
  }

  useEffect(() => {
    if (!isDocumentVisible) return;
    if (!latestMessage) return;
    if (myReadState?.lastReadMessageId === latestMessage.id) return;

    if (readDebounceRef.current) {
      window.clearTimeout(readDebounceRef.current);
    }

    readDebounceRef.current = window.setTimeout(() => {
      void markConversationRead(latestMessage.id);
    }, 1000);

    return () => {
      if (readDebounceRef.current) {
        window.clearTimeout(readDebounceRef.current);
        readDebounceRef.current = null;
      }
    };
  }, [conversationId, isDocumentVisible, latestMessage?.id, myReadState?.lastReadMessageId]);

  async function loadOlder() {
    if (!olderCursor) return;
    setLoadingOlder(true);
    try {
      const response = await authApiJson<ConversationMessagesResponse>(
        `/api/v1/conversations/${conversationId}/messages?limit=30&cursor=${encodeURIComponent(olderCursor)}`,
      );
      setMessages((prev) => mergeMessages(prev, sortMessagesAsc(response.data)));
      syncReadState(response);
      setOlderCursor(response.page.next_cursor);
      setHasMoreOlder(response.page.has_more);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load older messages");
    } finally {
      setLoadingOlder(false);
    }
  }

  async function sendMessage(values: MessageComposerValues) {
    if (!user) return;

    const tempId = `temp-${crypto.randomUUID()}`;
    const optimistic: MessageItem = {
      id: tempId,
      conversationId,
      senderUserId: user.id,
      kind: "text",
      text: values.text.trim(),
      media: null,
      createdAt: new Date().toISOString(),
    };

    setMessages((prev) => mergeMessages(prev, [optimistic]));
    form.reset({ text: "" });
    setSending(true);

    try {
      const result = await authApiJson<SendMessageResponse>(
        `/api/v1/conversations/${conversationId}/messages`,
        {
          method: "POST",
          body: JSON.stringify({ kind: "text", text: values.text }),
        },
      );

      setMessages((prev) =>
        prev.map((message) =>
          message.id === tempId
            ? {
                ...message,
                id: result.data.message_id,
                createdAt: result.data.createdAt,
              }
            : message,
        ),
      );

      emitConversationActivity(conversationId);
      void fetchLatest().catch(() => {});
    } catch (err) {
      setMessages((prev) => prev.filter((message) => message.id !== tempId));
      toast.error(err instanceof Error ? err.message : "Failed to send message");
      form.setValue("text", values.text, { shouldValidate: true });
    } finally {
      setSending(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-40" />
        <Skeleton className="h-24 w-3/4" />
        <Skeleton className="ml-auto h-24 w-3/4" />
        <Skeleton className="h-24 w-3/5" />
      </div>
    );
  }

  if (prettyError) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="font-medium">Unable to load messages</p>
          <p className="mt-1 text-sm text-muted-foreground">{prettyError}</p>
          <Button className="mt-4" onClick={() => void initialLoad()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {hasMoreOlder ? (
            <Button variant="outline" size="sm" onClick={() => void loadOlder()} disabled={loadingOlder}>
              {loadingOlder ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Load older
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">No older messages</span>
          )}
          <Button variant="ghost" size="sm" onClick={() => void fetchLatest()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
        <Badge variant={connectionState === "connected" ? "secondary" : "muted"}>
          {connectionState === "connected"
            ? "Connected"
            : connectionState === "reconnecting"
              ? "Reconnecting"
              : connectionState === "error"
                ? "Disconnected"
                : "Connecting"}
        </Badge>
      </div>

      <div className="flex-1 space-y-3 overflow-y-auto rounded-xl border bg-card p-4">
        {messages.length === 0 ? (
          <div className="grid h-full min-h-52 place-items-center text-center text-sm text-muted-foreground">
            No messages yet. Start the conversation.
          </div>
        ) : (
          messages.map((message) => {
            const mine = user ? message.senderUserId === user.id : false;
            return (
              <div
                key={message.id}
                className={`flex ${mine ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                    mine
                      ? "bg-primary text-primary-foreground"
                      : "border bg-background text-foreground"
                  }`}
                >
                  {message.text ? <p className="whitespace-pre-wrap">{message.text}</p> : null}
                  <p
                    className={`mt-1 text-[11px] ${
                      mine ? "text-primary-foreground/80" : "text-muted-foreground"
                    }`}
                  >
                    {new Date(message.createdAt).toLocaleString()}
                  </p>
                  {mine && message.id === lastOutgoingMessageId && hasOtherSeenMessage(message) ? (
                    <p className="mt-1 text-[11px] text-primary-foreground/80">
                      Seen
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={form.handleSubmit(async (values) => {
          await sendMessage(values);
        })}
      >
        <div className="flex-1">
          <Textarea
            rows={2}
            placeholder="Write a message..."
            disabled={sending}
            {...form.register("text")}
          />
          {form.formState.errors.text ? (
            <p className="mt-1 text-xs text-destructive">{form.formState.errors.text.message}</p>
          ) : null}
        </div>
        <Button type="submit" disabled={sending}>
          {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Send
        </Button>
      </form>
    </div>
  );
}
