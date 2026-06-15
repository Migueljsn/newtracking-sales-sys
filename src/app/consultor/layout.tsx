import type { ReactNode }        from "react";
import type { Metadata, Viewport } from "next";
import { QueryProvider }           from "@/providers/query-provider";
import { ConsultantBottomNav }     from "@/components/consultant/consultant-bottom-nav";

export const metadata: Metadata = {
  title: "Portal CRM",
  appleWebApp: {
    capable:        true,
    statusBarStyle: "black-translucent",
    title:          "Portal CRM",
  },
};

export const viewport: Viewport = {
  width:        "device-width",
  initialScale: 1,
  viewportFit:  "cover",
  themeColor:   "#0f1117",
};

export default function ConsultantLayout({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <div className="pb-[68px]">{children}</div>
      <ConsultantBottomNav />
    </QueryProvider>
  );
}
