"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { PublicShell } from "@/src/components/site/public-shell";
import { Button } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { Label } from "@/src/components/ui/label";
import { useUserAuth } from "@/src/lib/auth/user-auth";
import { getSupabaseBrowser } from "@/src/lib/supabase/browser";

const loginSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, sessionLoading } = useUserAuth();
  const [submitting, setSubmitting] = useState(false);

  const nextPath = useMemo(() => {
    const next = searchParams.get("next");
    if (!next || !next.startsWith("/")) return "/";
    return next;
  }, [searchParams]);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  useEffect(() => {
    if (!sessionLoading && session?.access_token) {
      router.replace(nextPath);
    }
  }, [nextPath, router, session, sessionLoading]);

  return (
    <PublicShell
      title="Sign in"
      subtitle="Use your Supabase email and password to message sellers and manage your conversations."
    >
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="hidden lg:block">
          <CardHeader>
            <CardTitle className="text-2xl">Sign in to contact sellers</CardTitle>
            <CardDescription>
              Start chats from listing pages, continue conversations in one inbox, and come back
              to where you left off.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>After login, you will be redirected to your requested page.</p>
            <p>Example flows: listing detail → inquiry → conversation thread.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LogIn className="h-5 w-5" />
            </div>
            <CardTitle>Login</CardTitle>
            <CardDescription>Enter your email and password.</CardDescription>
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
                  router.replace(nextPath);
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Login failed");
                } finally {
                  setSubmitting(false);
                }
              })}
            >
              <div className="space-y-2">
                <Label htmlFor="login-email">Email</Label>
                <Input
                  id="login-email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  disabled={submitting}
                  {...form.register("email")}
                />
                {form.formState.errors.email ? (
                  <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">Password</Label>
                <Input
                  id="login-password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
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
            </form>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
