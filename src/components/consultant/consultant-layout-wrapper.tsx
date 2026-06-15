"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export function ConsultantLayoutWrapper({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLogin  = pathname.startsWith("/consultor/login");
  return <div className={isLogin ? "" : "pb-[68px]"}>{children}</div>;
}
