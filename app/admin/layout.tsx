import type { ReactNode } from "react";

import { AdminAuthProvider } from "@/src/lib/admin/auth-context";

export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <AdminAuthProvider>{children}</AdminAuthProvider>;
}
