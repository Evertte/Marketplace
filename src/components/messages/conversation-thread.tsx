"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/src/components/ui/button";
import { Card, CardContent } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { Textarea } from "@/src/components/ui/textarea";
import { authApiJson, ClientApiError } from "@/src/lib/api/client";
import { useUserAuth } from "@/src/lib/auth/user-auth";
import type { ConversationMessagesResponse, SendMessageResponse } from "@/src/lib/client/types";

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
  const { user } = useUserAuth();
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<ClientApiError | null>(null);
  const [olderCursor, setOlderCursor] = useState<string | null>(null);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const lastMessageCountRef = useRef(0);

  const form = useForm<MessageComposerValues>({
    resolver: zodResolver(messageComposerSchema),
    defaultValues: { text: "" },
  });

  async function fetchLatest() {
    const response = await authApiJson<ConversationMessagesResponse>(
      `/api/v1/conversations/${conversationId}/messages?limit=30`,
    );
    const latestAsc = sortMessagesAsc(response.data);
    setMessages((prev) => (prev.length === 0 ? latestAsc : mergeMessages(prev, latestAsc)));
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
    void initialLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (!document.hidden) {
        void fetchLatest().catch(() => {});
      }
    }, 4000);
    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, messages.length]);

  useEffect(() => {
    if (messages.length > lastMessageCountRef.current) {
      endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
    lastMessageCountRef.current = messages.length;
  }, [messages]);

  const prettyError = useMemo(() => {
    if (!error) return null;
    if (error.status === 403) return "You do not have access to this conversation.";
    if (error.status === 404) return "Conversation not found.";
    return error.message;
  }, [error]);

  async function loadOlder() {
    if (!olderCursor) return;
    setLoadingOlder(true);
    try {
      const response = await authApiJson<ConversationMessagesResponse>(
        `/api/v1/conversations/${conversationId}/messages?limit=30&cursor=${encodeURIComponent(olderCursor)}`,
      );
      setMessages((prev) => mergeMessages(prev, sortMessagesAsc(response.data)));
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
        {hasMoreOlder ? (
          <Button variant="outline" size="sm" onClick={() => void loadOlder()} disabled={loadingOlder}>
            {loadingOlder ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Load older
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">No older messages</span>
        )}
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

