"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { useRouter } from "next/navigation";

import { Button, buttonVariants } from "@/src/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/src/components/ui/card";
import { useAdminAuth } from "@/src/lib/admin/auth-context";
import { cn } from "@/src/lib/utils";

export default function AdminForbiddenPage() {
  const router = useRouter();
  const { signOut } = useAdminAuth();

  return (
    <main className="grid min-h-[100dvh] place-items-center bg-background p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <div className="mb-2 flex items-center gap-2 text-amber-700">
            <ShieldAlert className="h-5 w-5" />
            <span className="text-sm font-medium uppercase tracking-[0.14em]">
              Forbidden
            </span>
          </div>
          <CardTitle>You do not have admin access</CardTitle>
          <CardDescription>
            Your account is authenticated, but it is not authorized to access the admin console.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button onClick={() => router.push("/admin/login")}>
            Go to Login
          </Button>
          <Button
            variant="outline"
            onClick={async () => {
              await signOut();
              router.replace("/admin/login");
            }}
          >
            Sign out
          </Button>
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }))}>
            Back to site
          </Link>
        </CardContent>
      </Card>
    </main>
  );
}
