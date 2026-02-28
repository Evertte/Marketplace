"use client";

import type React from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart3,
  ExternalLink,
  LayoutDashboard,
  ListChecks,
  Loader2,
  LogOut,
  MessageSquare,
  PlusSquare,
  ShieldAlert,
} from "lucide-react";
import { useEffect } from "react";

import { Badge } from "@/src/components/ui/badge";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { NotificationBell } from "@/src/components/site/notification-bell";
import { Separator } from "@/src/components/ui/separator";
import { Skeleton } from "@/src/components/ui/skeleton";
import { cn } from "@/src/lib/utils";

import { useAdminAuth } from "@/src/lib/admin/auth-context";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const NAV_ITEMS: NavItem[] = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/admin/listings", label: "Listings", icon: ListChecks },
  { href: "/admin/listings/new", label: "New Listing", icon: PlusSquare },
  { href: "/admin/reports", label: "Reports", icon: ShieldAlert },
];

function FullScreenLoading() {
  return (
    <div className="min-h-[100dvh] bg-background p-6">
      <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[260px_1fr]">
        <Skeleton className="hidden h-[70dvh] lg:block" />
        <div className="space-y-4">
          <Skeleton className="h-16" />
          <Skeleton className="h-40" />
          <Skeleton className="h-64" />
        </div>
      </div>
    </div>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { session, profile, sessionLoading, profileLoading, signOut } = useAdminAuth();

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      router.replace("/admin/login");
      return;
    }
    if (!profileLoading && profile && profile.role !== "admin") {
      router.replace("/admin/forbidden");
    }
  }, [profile, profileLoading, router, session, sessionLoading]);

  if (sessionLoading || (session && profileLoading && !profile)) {
    return <FullScreenLoading />;
  }

  if (!session) {
    return <FullScreenLoading />;
  }

  if (!profile) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6">
        <div className="w-full max-w-md rounded-xl border bg-card p-6 shadow-panel">
          <div className="mb-3 flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-4 w-4" />
            <p className="font-medium">Unable to load admin profile</p>
          </div>
          <p className="text-sm text-muted-foreground">
            Your session may be expired or the API is unavailable.
          </p>
          <div className="mt-4 flex gap-2">
            <Button onClick={() => router.refresh()}>Retry</Button>
            <Button
              variant="outline"
              onClick={async () => {
                await signOut();
                router.replace("/admin/login");
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (profile.role !== "admin") {
    return <FullScreenLoading />;
  }

  return (
    <div className="min-h-[100dvh] bg-background">
      <div className="mx-auto grid max-w-7xl gap-6 p-4 md:p-6 lg:grid-cols-[260px_1fr]">
        <aside className="rounded-2xl border bg-card p-4 shadow-panel lg:sticky lg:top-6 lg:h-[calc(100dvh-3rem)]">
          <div className="mb-4">
            <Link
              href="/"
              className="group flex items-center gap-3 rounded-xl border bg-muted/20 px-3 py-3 transition hover:bg-muted/40"
              title="Go to public homepage"
            >
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                <MessageSquare className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                  Admin
                </p>
                <div className="flex items-center gap-1">
                  <h1 className="truncate text-lg font-semibold">Marketplace Console</h1>
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
                </div>
              </div>
            </Link>
          </div>
          <nav className="space-y-2">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/admin"
                  ? pathname === "/admin"
                  : pathname === item.href || pathname.startsWith(`${item.href}/`);

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    buttonVariants({ variant: active ? "default" : "ghost" }),
                    "w-full justify-start",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <Separator className="my-4" />
          <div className="space-y-2 text-sm">
            <p className="truncate font-medium">{profile.email}</p>
            <div className="flex items-center gap-2">
              <Badge variant={profile.status === "active" ? "success" : "warning"}>
                {profile.role}
              </Badge>
              <Badge variant="muted">{profile.status}</Badge>
            </div>
          </div>
          <div className="mt-4">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={async () => {
                await signOut();
                router.replace("/admin/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </div>
        </aside>

        <div className="min-w-0">
          <header className="mb-4 flex items-center justify-between rounded-2xl border bg-card px-4 py-3 shadow-panel">
            <div>
              <p className="text-sm text-muted-foreground">Admin Console</p>
              <p className="font-medium">Manage listings, moderation, and media</p>
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <NotificationBell />
              <Link
                href="/"
                className={cn(
                  buttonVariants({ variant: "outline", size: "sm" }),
                  "hidden sm:inline-flex",
                )}
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View Site
              </Link>
              {profileLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              <span className="hidden sm:inline">{profileLoading ? "Refreshing profile..." : "Ready"}</span>
            </div>
          </header>
          {children}
        </div>
      </div>
    </div>
  );
}
