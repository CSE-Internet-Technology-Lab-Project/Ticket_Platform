"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Clapperboard, LogOut, Menu, Ticket, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuthDialog, type AuthenticatedUser } from "@/components/auth/AuthDialog";

export function AppHeader() {
  const pathname = usePathname(); const router = useRouter();
  const [user, setUser] = useState<AuthenticatedUser | null>(null);
  const [authOpen, setAuthOpen] = useState(false); const [menuOpen, setMenuOpen] = useState(false);
  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.ok ? response.json() : null).then((data) => setUser(data?.user ?? null)).catch(() => setUser(null));
    const openAuth = () => setAuthOpen(true); window.addEventListener("showtime:auth", openAuth); return () => window.removeEventListener("showtime:auth", openAuth);
  }, []);
  const nav = [{ href: "/", label: "Movies" }, { href: "/#how-it-works", label: "How it works" }];
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setUser(null); setMenuOpen(false); router.push("/"); router.refresh(); }
  function done(authenticated: AuthenticatedUser) { setUser(authenticated); setAuthOpen(false); setMenuOpen(false); router.refresh(); }
  return <header className="sticky top-0 z-40 border-b border-white/10 bg-[#111329]/90 text-white backdrop-blur-xl">
    <div className="mx-auto flex h-18 max-w-7xl items-center justify-between px-5 lg:px-8">
      <Link href="/" className="flex items-center gap-2 text-xl font-black tracking-[-.06em]"><span className="grid size-8 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 shadow-lg shadow-violet-500/30"><Clapperboard className="size-4" /></span>showtime</Link>
      <nav className="hidden items-center gap-6 text-sm font-medium text-slate-300 md:flex">{nav.map((item) => <Link key={item.href} href={item.href} className={pathname === item.href ? "text-white" : "hover:text-white"}>{item.label}</Link>)}</nav>
      <div className="hidden items-center gap-3 md:flex">{user ? <><Link href="/tickets" aria-label="Open my tickets" className="flex items-center gap-2 rounded-xl px-2 py-1.5 text-sm font-semibold text-slate-200 transition hover:bg-white/10 hover:text-white"><span className="grid size-8 place-items-center rounded-full bg-gradient-to-br from-violet-400 to-fuchsia-500 text-xs font-black text-white">{initials(user.name)}</span><span className="max-w-28 truncate">{user.name}</span><Ticket className="size-4 text-violet-300" /></Link>{user.role === "ORGANIZER" && <Link href="/admin" className="rounded-lg bg-white/10 px-3 py-2 text-sm font-bold hover:bg-white/15">Organizer</Link>}<button onClick={logout} aria-label="Sign out" className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white"><LogOut className="size-4" /></button></> : <Button onClick={() => setAuthOpen(true)} className="rounded-xl bg-white text-slate-950 hover:bg-violet-50"><UserRound />Sign in</Button>}</div>
      <button onClick={() => setMenuOpen(!menuOpen)} aria-label="Toggle menu" className="rounded-lg p-2 md:hidden"><Menu /></button>
    </div>
    {menuOpen && <div className="border-t border-white/10 px-5 py-4 md:hidden"><div className="flex flex-col gap-3 text-sm font-medium">{nav.map((item) => <Link key={item.href} onClick={() => setMenuOpen(false)} href={item.href}>{item.label}</Link>)}{user ? <><Link href="/tickets" onClick={() => setMenuOpen(false)} className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-violet-500 text-[10px] font-black">{initials(user.name)}</span>{user.name} · My tickets</Link>{user.role === "ORGANIZER" && <Link href="/admin" onClick={() => setMenuOpen(false)}>Organizer</Link>}<button onClick={logout} className="text-left text-slate-300">Sign out</button></> : <button onClick={() => setAuthOpen(true)} className="text-left font-bold text-violet-300">Sign in or create account</button>}</div></div>}
    {authOpen && <AuthDialog onClose={() => setAuthOpen(false)} onAuthenticated={done} />}
  </header>;
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U";
}
