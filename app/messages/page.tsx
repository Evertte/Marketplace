"use client";

import { MessagesShell } from "@/src/components/messages/messages-shell";
import { PublicShell } from "@/src/components/site/public-shell";

export default function MessagesIndexPage() {
  return (
    <PublicShell
      title="Messages"
      subtitle="All your buyer/seller conversations live here. New messages are polled every 4 seconds."
    >
      <MessagesShell autoSelectFirst />
    </PublicShell>
  );
}

