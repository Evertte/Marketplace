"use client";

import { Suspense } from "react";

import { MessagesShell } from "@/src/components/messages/messages-shell";
import { PublicShell } from "@/src/components/site/public-shell";

export default function MessagesIndexPage() {
  return (
    <PublicShell
      title="Messages"
      subtitle="All your buyer/seller conversations live here. Open one to receive realtime updates."
    >
      <Suspense fallback={<div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Loading conversations...</div>}>
        <MessagesShell />
      </Suspense>
    </PublicShell>
  );
}
