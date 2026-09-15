import Link from "next/link";

export function SiteFooter() {
  return <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between lg:px-8"><p><span className="font-black text-slate-900">showtime</span> · Better nights, one seat at a time.</p><div className="flex gap-5"><Link href="/" className="hover:text-slate-950">Movies</Link><Link href="/tickets" className="hover:text-slate-950">Tickets</Link><Link href="/admin" className="hover:text-slate-950">Organizer</Link></div></div></footer>;
}
