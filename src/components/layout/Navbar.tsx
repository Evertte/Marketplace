"use client";

import Link from "next/link";
import { ChevronDown, Home, LayoutDashboard, LogOut, Menu, MessageSquare, Search, UserCircle2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { NotificationBell } from "@/src/components/site/notification-bell";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import { useUserAuth } from "@/src/lib/auth/user-auth";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/browse", label: "Browse" },
  { href: "/messages", label: "Messages" },
] as const;

function isActiveLink(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { session, user, sessionLoading, signOut } = useUserAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handlePointer(event: MouseEvent) {
      if (!profileRef.current?.contains(event.target as Node)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handlePointer);
    return () => document.removeEventListener("mousedown", handlePointer);
  }, []);

  async function handleSignOut() {
    await signOut();
    setMobileOpen(false);
    setProfileOpen(false);
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-6">
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30">
            <div className="grid h-11 w-11 place-items-center rounded-2xl bg-blue-600 text-white shadow-sm shadow-blue-900/15">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-[0.24em] text-slate-500">Classifieds</p>
              <p className="text-base font-semibold tracking-tight text-slate-950">Marketplace</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  buttonVariants({
                    variant: isActiveLink(pathname, link.href) ? "secondary" : "ghost",
                    size: "sm",
                  }),
                  "rounded-full px-4",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {session ? <NotificationBell /> : null}

          {sessionLoading ? (
            <div className="hidden h-10 w-28 animate-pulse rounded-full bg-slate-100 md:block" />
          ) : session && user ? (
            <div className="relative" ref={profileRef}>
              <Button
                type="button"
                variant="outline"
                className="rounded-full border-slate-200 px-3"
                onClick={() => setProfileOpen((open) => !open)}
                aria-expanded={profileOpen}
                aria-haspopup="menu"
              >
                <span className="grid h-8 w-8 place-items-center rounded-full bg-slate-100 text-slate-700">
                  <UserCircle2 className="h-5 w-5" />
                </span>
                <span className="hidden max-w-[140px] truncate text-sm md:inline">{user.email}</span>
                <ChevronDown className="h-4 w-4 text-slate-500" />
              </Button>

              {profileOpen ? (
                <div className="absolute right-0 top-14 z-50 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-2xl" role="menu">
                  <div className="border-b border-slate-100 px-3 py-3">
                    <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Signed in as</p>
                    <p className="mt-1 truncate text-sm font-medium text-slate-900">{user.email}</p>
                  </div>
                  <div className="py-2">
                    <Link href="/profile" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50" onClick={() => setProfileOpen(false)}>
                      <UserCircle2 className="h-4 w-4" />
                      Profile
                    </Link>
                    <Link href="/messages" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50" onClick={() => setProfileOpen(false)}>
                      <MessageSquare className="h-4 w-4" />
                      Messages
                    </Link>
                    {user.role === "admin" ? (
                      <Link href="/admin" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-slate-50" onClick={() => setProfileOpen(false)}>
                        <LayoutDashboard className="h-4 w-4" />
                        Admin Dashboard
                      </Link>
                    ) : null}
                    <button
                      type="button"
                      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                      onClick={() => void handleSignOut()}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`} className={cn(buttonVariants({ size: "sm" }), "rounded-full px-5")}>Sign in</Link>
          )}

          <Button
            type="button"
            variant="outline"
            size="icon"
            className="rounded-full md:hidden"
            onClick={() => setMobileOpen((open) => !open)}
            aria-label="Toggle navigation"
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-slate-200/80 bg-white px-4 py-4 md:hidden">
          <div className="grid gap-2">
            {NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(buttonVariants({ variant: isActiveLink(pathname, link.href) ? "secondary" : "ghost" }), "justify-start rounded-xl")}
                onClick={() => setMobileOpen(false)}
              >
                {link.href === "/" ? <Home className="h-4 w-4" /> : link.href === "/browse" ? <Search className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}
                {link.label}
              </Link>
            ))}
            {session && user ? (
              <>
                <Link href="/profile" className={cn(buttonVariants({ variant: "ghost" }), "justify-start rounded-xl")} onClick={() => setMobileOpen(false)}>
                  <UserCircle2 className="h-4 w-4" />
                  Profile
                </Link>
                {user.role === "admin" ? (
                  <Link href="/admin" className={cn(buttonVariants({ variant: "ghost" }), "justify-start rounded-xl")} onClick={() => setMobileOpen(false)}>
                    <LayoutDashboard className="h-4 w-4" />
                    Admin Dashboard
                  </Link>
                ) : null}
                <Button type="button" variant="outline" className="justify-start rounded-xl" onClick={() => void handleSignOut()}>
                  <LogOut className="h-4 w-4" />
                  Sign out
                </Button>
              </>
            ) : (
              <Link href={`/login?next=${encodeURIComponent(pathname || "/")}`} className={cn(buttonVariants({ variant: "default" }), "justify-start rounded-xl")} onClick={() => setMobileOpen(false)}>
                Sign in
              </Link>
            )}
          </div>
        </div>
      ) : null}
    </header>
  );
}
