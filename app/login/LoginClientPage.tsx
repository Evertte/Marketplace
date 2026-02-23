"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, LogIn, UserPlus } from "lucide-react";
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
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { session, sessionLoading } = useUserAuth();
  const [submitting, setSubmitting] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signupMessage, setSignupMessage] = useState<string | null>(null);

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

  const isSignup = mode === "signup";

  return (
    <PublicShell
      title={isSignup ? "Create account" : "Sign in"}
      subtitle={
        isSignup
          ? "Create a Supabase account to message sellers and keep your conversations in one place."
          : "Use your Supabase email and password to message sellers and manage your conversations."
      }
    >
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[1.05fr_0.95fr]">
        <Card className="hidden lg:block">
          <CardHeader>
            <CardTitle className="text-2xl">
              {isSignup ? "Create an account to start chatting" : "Sign in to contact sellers"}
            </CardTitle>
            <CardDescription>
              Start chats from listing pages, continue conversations in one inbox, and come back
              to where you left off.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>
              After {isSignup ? "signup" : "login"}, you will be redirected to your requested
              page.
            </p>
            <p>Example flows: listing detail → inquiry → conversation thread.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              {isSignup ? <UserPlus className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            </div>
            <CardTitle>{isSignup ? "Create Account" : "Login"}</CardTitle>
            <CardDescription>
              {isSignup
                ? "Enter your email and a password (minimum 8 characters)."
                : "Enter your email and password."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {signupMessage ? (
              <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                {signupMessage}
              </div>
            ) : null}
            <form
              className="space-y-4"
              onSubmit={form.handleSubmit(async (values) => {
                setSubmitting(true);
                setSignupMessage(null);
                try {
                  const supabase = getSupabaseBrowser();
                  if (isSignup) {
                    const { data, error } = await supabase.auth.signUp({
                      email: values.email.trim(),
                      password: values.password,
                    });

                    if (error) {
                      toast.error(error.message);
                      return;
                    }

                    if (data.session?.access_token) {
                      toast.success("Account created");
                      router.replace(nextPath);
                      return;
                    }

                    setSignupMessage("Check your email to confirm your account.");
                    toast.success("Account created. Check your email to confirm your account.");
                    form.reset({ email: values.email.trim(), password: "" });
                    return;
                  }

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
                  toast.error(
                    err instanceof Error
                      ? err.message
                      : isSignup
                        ? "Signup failed"
                        : "Login failed",
                  );
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
                  autoComplete={isSignup ? "new-password" : "current-password"}
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
                {isSignup ? "Create Account" : "Sign In"}
              </Button>

              <div className="text-center text-sm text-muted-foreground">
                {isSignup ? "Already have an account?" : "Need an account?"}{" "}
                <button
                  type="button"
                  className="font-medium text-primary underline-offset-4 hover:underline"
                  onClick={() => {
                    setMode((prev) => (prev === "signin" ? "signup" : "signin"));
                    setSignupMessage(null);
                    form.clearErrors();
                  }}
                  disabled={submitting}
                >
                  {isSignup ? "Sign in" : "Create account"}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </PublicShell>
  );
}
