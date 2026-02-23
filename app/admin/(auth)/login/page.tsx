"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LockKeyhole } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { useAdminAuth } from "@/src/lib/admin/auth-context";
import { getSupabaseBrowser } from "@/src/lib/admin/supabase-browser";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function AdminLoginPage() {
  const router = useRouter();
  const { session, profile, sessionLoading, profileLoading } = useAdminAuth();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) return;
    if (profileLoading) return;

    if (profile?.role === "admin") {
      router.replace("/admin");
      return;
    }

    if (profile) {
      router.replace("/admin/forbidden");
    }
  }, [profile, profileLoading, router, session, sessionLoading]);

  return (
    <main className="min-h-[100dvh] bg-background px-4 py-10">
      <div className="mx-auto grid min-h-[calc(100dvh-5rem)] max-w-5xl items-center gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden rounded-2xl border bg-card p-8 shadow-panel lg:block">
          <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
            Classifieds Admin
          </p>
          <h1 className="mt-3 text-3xl font-semibold leading-tight">
            Manage marketplace listings with a secure admin console
          </h1>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">
            Sign in with your Supabase email/password account. API requests are authorized with
            your access token and admin-only routes are enforced server-side.
          </p>
          <div className="mt-6 rounded-xl border bg-muted/20 p-4">
            <p className="text-sm font-medium">Included in this V1 admin UI</p>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>Dashboard and listing management</li>
              <li>Draft/publish/archive workflows</li>
              <li>Supabase Storage media upload + attach flow</li>
            </ul>
          </div>
        </section>

        <Card className="w-full">
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LockKeyhole className="h-5 w-5" />
            </div>
            <CardTitle>Admin Login</CardTitle>
            <CardDescription>Use your Supabase email and password.</CardDescription>
          </CardHeader>
          <CardContent>
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                setSubmitting(true);
                try {
                  const supabase = getSupabaseBrowser();
                  const { error } = await supabase.auth.signInWithPassword({
                    email: values.email.trim(),
                    password: values.password,
                  });

                  if (error) {
                    toast.error(error.message);
                    return;
                  }

                  toast.success("Signed in");
                  router.replace("/admin");
                } catch (error) {
                  toast.error(error instanceof Error ? error.message : "Login failed");
                } finally {
                  setSubmitting(false);
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="admin-email">Email</Label>
                <Input
                  id="admin-email"
                  type="email"
                  placeholder="admin@example.com"
                  autoComplete="email"
                  disabled={submitting}
                  {...form.register("email")}
                />
                {form.formState.errors.email ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.email.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="admin-password">Password</Label>
                <Input
                  id="admin-password"
                  type="password"
                  placeholder="••••••••"
                  autoComplete="current-password"
                  disabled={submitting}
                  {...form.register("password")}
                />
                {form.formState.errors.password ? (
                  <p className="text-xs text-destructive">
                    {form.formState.errors.password.message}
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Sign In
              </Button>

              {(sessionLoading || (session && profileLoading)) && !submitting ? (
                <p className="text-center text-xs text-muted-foreground">
                  Checking existing session...
                </p>
              ) : null}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
