"use client";

import type { ReactNode } from "react";

import { AdminShell } from "@/src/components/admin/admin-shell";

export default function AdminAppLayout({ children }: { children: ReactNode }) {
  return <AdminShell>{children}</AdminShell>;
}
