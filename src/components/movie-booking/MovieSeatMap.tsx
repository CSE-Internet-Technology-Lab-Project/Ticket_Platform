"use client";

import { Check, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Seat } from "./types";

const sections: Seat["section"][] = ["RECLINER", "PRIME", "CLASSIC"];

export function MovieSeatMap({ seats, selected, onToggle, onCheckout }: { seats: Seat[]; selected: string[]; onToggle: (seat: Seat) => void; onCheckout: () => void }) {
  const total = seats.filter((seat) => selected.includes(seat.id)).reduce((sum, seat) => sum + seat.price, 0);
  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-4"><div><p className="text-xs font-bold tracking-[.14em] text-rose-600">SELECT SEATS</p><h2 className="mt-1 text-lg font-bold">Grand Cinema · Screen 03</h2></div><span className="rounded-full bg-rose-50 px-3 py-1 text-sm font-semibold text-rose-700">{selected.length} / 6 selected</span></div>
      <div className="overflow-x-auto px-4 py-8 sm:px-8"><div className="min-w-[620px]"><svg viewBox="0 0 720 85" className="mx-auto h-16 w-[72%]" aria-label="Cinema screen"><path d="M45 56 Q360 5 675 56 L650 72 Q360 35 70 72Z" fill="#e0e7ff" /><text x="360" y="68" textAnchor="middle" fill="#475569" fontSize="12" fontWeight="700" letterSpacing="3">ALL EYES THIS WAY</text></svg>
        {sections.map((section) => { const sectionSeats = seats.filter((seat) => seat.section === section); const rows = [...new Set(sectionSeats.map((seat) => seat.row))]; return <div key={section} className="mt-9"><div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2"><span className="text-xs font-black tracking-[.15em] text-slate-500">{section} <span className="ml-2 text-rose-600">₹{sectionSeats[0]?.price}</span></span><span className="text-xs text-slate-400">{section === "RECLINER" ? "Premium comfort" : section === "PRIME" ? "Best view" : "Value seats"}</span></div>{rows.map((row) => <div className="mb-2 flex items-center gap-3" key={row}><span className="w-4 text-xs font-bold text-slate-400">{row}</span><div className="grid flex-1 grid-cols-[repeat(14,1fr)] gap-1.5">{sectionSeats.filter((seat) => seat.row === row).map((seat) => <button key={seat.id} onClick={() => seat.status === "available" && onToggle(seat)} disabled={seat.status === "sold"} aria-label={`${seat.label}, ${seat.status}`} className={`relative aspect-square rounded-[4px] border text-[9px] font-bold transition sm:text-[10px] ${seat.number === 8 ? "mr-6" : ""} ${seat.status === "sold" ? "cursor-not-allowed border-slate-100 bg-slate-100 text-slate-300" : selected.includes(seat.id) ? "border-rose-500 bg-rose-500 text-white shadow-sm" : "border-emerald-500 bg-white text-emerald-700 hover:bg-emerald-50"}`}>{selected.includes(seat.id) ? <Check className="mx-auto size-3" /> : seat.number}</button>)}</div></div>)}</div>; })}</div></div>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 border-t bg-slate-50 px-5 py-3 text-xs text-slate-500"><Legend className="border-emerald-500 bg-white" label="Available" /><Legend className="border-rose-500 bg-rose-500" label="Selected" /><Legend className="border-slate-100 bg-slate-200" label="Sold" /></div>
      <div className="flex items-center justify-between gap-4 border-t px-5 py-4"><div><p className="text-xs text-slate-500">{selected.length ? selected.join(", ") : "Choose your preferred seats"}</p><p className="mt-0.5 text-lg font-black">₹{total || 0}<span className="ml-1 text-xs font-medium text-slate-400">incl. taxes</span></p></div><Button disabled={!selected.length} onClick={onCheckout} className="h-10 bg-rose-600 px-5 hover:bg-rose-700">Proceed <Ticket /></Button></div>
    </div>
  );
}

function Legend({ className, label }: { className: string; label: string }) { return <span className="flex items-center gap-2"><i className={`size-3 rounded-sm border ${className}`} />{label}</span>; }
