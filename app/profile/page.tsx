"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { PublicShell } from "@/src/components/site/public-shell";
import { Badge } from "@/src/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Skeleton } from "@/src/components/ui/skeleton";
import { useUserAuth } from "@/src/lib/auth/user-auth";

export default function ProfilePage() {
  const router = useRouter();
  const { session, sessionLoading, user, userLoading } = useUserAuth();

  useEffect(() => {
    if (!sessionLoading && !session) {
      router.replace("/login?next=/profile");
    }
  }, [router, session, sessionLoading]);

  return (
    <PublicShell title="Profile" subtitle="Your marketplace account information and access level.">
      {sessionLoading || userLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-[1.75rem]" />
          <Skeleton className="h-64 w-full rounded-[1.75rem]" />
        </div>
      ) : !session || !user ? null : (
        <Card className="rounded-[1.75rem] border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle>{user.email}</CardTitle>
            <CardDescription>Managed through Supabase Auth and the marketplace user profile.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Role</p>
              <Badge variant={user.role === "admin" ? "default" : "muted"} className="mt-3 capitalize">{user.role}</Badge>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Status</p>
              <Badge variant={user.status === "active" ? "success" : "warning"} className="mt-3 capitalize">{user.status}</Badge>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Account</p>
              <p className="mt-3 text-sm font-medium text-slate-900">Authenticated and ready for messaging.</p>
            </div>
          </CardContent>
        </Card>
      )}
    </PublicShell>
  );
}
