"use client";

import type React from "react";
import { Toaster } from "sonner";

import { UserAuthProvider } from "@/src/lib/auth/user-auth";

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <UserAuthProvider>
      {children}
      <Toaster richColors position="top-right" />
    </UserAuthProvider>
  );
}

