import type { ReactNode } from "react";
import { QueryProvider } from "@/providers/query-provider";

export default function ConsultantLayout({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
