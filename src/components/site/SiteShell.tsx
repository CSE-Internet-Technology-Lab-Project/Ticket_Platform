import type { ReactNode } from "react";
import { AppHeader } from "@/components/site/AppHeader";
import { SiteFooter } from "@/components/site/SiteFooter";

export function SiteShell({ children }: { children: ReactNode }) {
  return <div className="min-h-screen bg-[#f8f8fc] text-slate-950"><AppHeader />{children}<SiteFooter /></div>;
}
