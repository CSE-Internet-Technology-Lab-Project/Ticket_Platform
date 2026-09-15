"use client";

import { FormEvent, useState } from "react";
import { ArrowRight, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type AuthenticatedUser = { id: string; name: string; email: string; role: "USER" | "ORGANIZER" };

export function AuthDialog({ onClose, onAuthenticated }: { onClose: () => void; onAuthenticated: (user: AuthenticatedUser) => void }) {
  const [signup, setSignup] = useState(false);
  const [organizer, setOrganizer] = useState(false);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setPending(true);
    try {
      const values = Object.fromEntries(new FormData(event.currentTarget));
      const response = await fetch(`/api/auth/${signup ? "register" : "login"}`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...values, ...(signup ? { role: organizer ? "ORGANIZER" : "USER" } : {}) }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setError(result.error ?? "We could not complete that request."); return; }
      onAuthenticated(result.user);
    } catch {
      setError("We could not reach the server. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <div role="dialog" aria-modal="true" aria-label="Account access" className="fixed inset-0 z-50 grid place-items-center bg-slate-950/65 p-4 backdrop-blur-sm">
    <div className="relative w-full max-w-md rounded-3xl border border-white/15 bg-white p-7 shadow-2xl">
      <button onClick={onClose} aria-label="Close sign in" className="absolute right-5 top-5 rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-950"><X className="size-5" /></button>
      <p className="eyebrow">SHOWTIME ACCOUNT</p>
      <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-slate-950">{signup ? "Make every booking easy." : "Welcome back."}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-500">{signup ? "Create an attendee account, or set up your organizer workspace." : "Sign in to manage tickets, reservations, and shows."}</p>
      <form onSubmit={submit} className="mt-6 space-y-4">
        {signup && <Input required name="name" placeholder="Your name" className="h-11 rounded-xl" />}
        <Input required name="email" type="email" autoComplete="email" placeholder="Email address" className="h-11 rounded-xl" />
        <Input required name="password" type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} placeholder="Password (8+ characters)" className="h-11 rounded-xl" />
        {signup && <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-slate-200 p-4 transition hover:border-violet-300"><input type="checkbox" checked={organizer} onChange={(event) => setOrganizer(event.target.checked)} className="mt-1 size-4 accent-violet-600" /><span><span className="block text-sm font-bold text-slate-900">I’m an organizer</span><span className="mt-0.5 block text-xs leading-5 text-slate-500">Create and manage movie showtimes, inventory, and dynamic pricing.</span></span></label>}
        {error && <p role="alert" className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        <Button type="submit" disabled={pending} className="h-11 w-full rounded-xl bg-violet-600 text-white hover:bg-violet-700">{pending ? <LoaderCircle className="animate-spin" /> : null}{signup ? "Create account" : "Sign in"}<ArrowRight /></Button>
      </form>
      <p className="mt-5 text-center text-sm text-slate-500">{signup ? "Already have an account?" : "New to Showtime?"} <button type="button" onClick={() => { setSignup(!signup); setError(""); }} className="font-bold text-violet-700 hover:text-violet-900">{signup ? "Sign in" : "Create one"}</button></p>
    </div>
  </div>;
}
