"use client";

import Link from "next/link";
import { Menu, MessageSquare, Shield, User } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type React from "react";
import { useState } from "react";

import { Badge } from "@/src/components/ui/badge";
import { Button, buttonVariants } from "@/src/components/ui/button";
import { cn } from "@/src/lib/utils";
import { useUserAuth } from "@/src/lib/auth/user-auth";

export function PublicShell({
  children,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, user, sessionLoading, signOut } = useUserAuth();
  const [menuOpen, setMenuOpen] = useState(false);

  const nextForLogin = pathname || "/";

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/browse", label: "Browse" },
    { href: "/messages", label: "Messages" },
    { href: "/admin", label: "Admin" },
  ];

  return (
    <div className="min-h-[100dvh] bg-background">
      <header className="sticky top-0 z-30 border-b bg-background/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
              <MessageSquare className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                Classifieds
              </p>
              <p className="text-sm font-semibold">Marketplace</p>
            </div>
          </Link>

          <nav className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  buttonVariants({
                    variant: pathname === link.href || pathname.startsWith(`${link.href}/`)
                      ? "secondary"
                      : "ghost",
                    size: "sm",
                  }),
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden items-center gap-2 md:flex">
            {sessionLoading ? (
              <Badge variant="muted">Loading session...</Badge>
            ) : session && user ? (
              <>
                <Badge variant="muted" className="max-w-[220px] truncate">
                  <User className="mr-1 h-3 w-3" />
                  {user.email}
                </Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={async () => {
                    await signOut();
                    router.push("/");
                  }}
                >
                  Sign out
                </Button>
              </>
            ) : (
              <Link
                href={`/login?next=${encodeURIComponent(nextForLogin)}`}
                className={cn(buttonVariants({ size: "sm" }))}
              >
                Sign in
              </Link>
            )}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="md:hidden"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <Menu className="h-4 w-4" />
          </Button>
        </div>

        {menuOpen ? (
          <div className="border-t px-4 py-3 md:hidden">
            <div className="grid gap-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(buttonVariants({ variant: "ghost" }), "justify-start")}
                  onClick={() => setMenuOpen(false)}
                >
                  {link.href === "/admin" ? <Shield className="h-4 w-4" /> : null}
                  {link.label}
                </Link>
              ))}
              {session && user ? (
                <Button
                  variant="outline"
                  className="justify-start"
                  onClick={async () => {
                    await signOut();
                    setMenuOpen(false);
                    router.push("/");
                  }}
                >
                  Sign out ({user.email})
                </Button>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(nextForLogin)}`}
                  className={cn(buttonVariants({ variant: "default" }), "justify-start")}
                  onClick={() => setMenuOpen(false)}
                >
                  Sign in
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        {title ? (
          <section className="mb-6 rounded-2xl border bg-card p-5 shadow-panel">
            <h1 className="text-2xl font-semibold md:text-3xl">{title}</h1>
            {subtitle ? (
              <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                {subtitle}
              </p>
            ) : null}
          </section>
        ) : null}
        {children}
      </main>
    </div>
  );
}

