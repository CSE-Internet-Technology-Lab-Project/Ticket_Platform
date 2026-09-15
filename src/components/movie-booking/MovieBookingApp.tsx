"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ArrowLeft, ArrowRight, CalendarDays, ChevronRight, Clapperboard, Clock3, MapPin, Search, Star, Ticket, UserRound, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { demoSeats, movies } from "./movie-data";
import { MovieSeatMap } from "./MovieSeatMap";
import type { Movie, Seat } from "./types";

type Step = "browse" | "seats" | "confirmation";

export function MovieBookingApp() {
  const [step, setStep] = useState<Step>("browse");
  const [activeMovie, setActiveMovie] = useState<Movie>(movies[0]);
  const [selected, setSelected] = useState<string[]>([]);
  const [seats, setSeats] = useState<Seat[]>(demoSeats);
  const [eventId, setEventId] = useState<string | null>(null);
  const [reservationId, setReservationId] = useState<string | null>(null);
  const [paid, setPaid] = useState(false);
  const [query, setQuery] = useState("");
  const [authOpen, setAuthOpen] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [error, setError] = useState("");
  const total = seats.filter((seat) => selected.includes(seat.id)).reduce((sum, seat) => sum + seat.price, 0);
  const visibleMovies = useMemo(() => movies.filter((movie) => `${movie.title} ${movie.genre}`.toLowerCase().includes(query.toLowerCase())), [query]);
  useEffect(() => {
    fetch("/api/auth/session").then((response) => response.ok ? response.json() : null).then((data) => setAuthenticated(Boolean(data?.user))).catch(() => undefined);
    fetch("/api/movies").then((response) => response.ok ? response.json() : null).then((data) => {
      const movie = data?.movies?.[0];
      if (!movie?.inventories?.length) return;
      setEventId(movie.id);
      setSeats(movie.inventories.map((inventory: { id: string; currentPrice: { toString(): string } | string | number; status: "AVAILABLE" | "HELD" | "SOLD" | "BLOCKED"; seat: { rowNumber: number; seatNumber: number; section: { name: Seat["section"] } } }) => {
        const section = inventory.seat.section.name;
        const row = section === "RECLINER" ? "J" : String.fromCharCode((section === "PRIME" ? 65 : 65) + inventory.seat.rowNumber);
        return { id: `${row}-${inventory.seat.seatNumber}`, label: `${row}${inventory.seat.seatNumber}`, row, number: inventory.seat.seatNumber, section, price: Number(inventory.currentPrice), inventoryId: inventory.id, status: inventory.status === "AVAILABLE" ? "available" : "sold" };
      }));
    }).catch(() => undefined);
  }, []);
  const startBooking = (movie: Movie) => { setActiveMovie(movie); setSelected([]); setReservationId(null); setPaid(false); setStep("seats"); };
  const checkout = async () => {
    if (!authenticated) { setAuthOpen(true); return; }
    const inventoryIds = seats.filter((seat) => selected.includes(seat.id)).map((seat) => seat.inventoryId).filter((id): id is string => Boolean(id));
    if (!eventId || inventoryIds.length !== selected.length) { setError("Movie inventory is still loading. Please try again in a moment."); return; }
    const response = await fetch("/api/reservations", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ eventId, inventoryIds }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error ?? "Those seats are no longer available."); return; }
    setReservationId(result.reservation.id); setStep("confirmation");
  };
  const pay = async () => {
    if (!reservationId) return;
    const response = await fetch("/api/payments/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reservationId }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) { setError(result.error ?? "Payment could not be completed."); return; }
    setPaid(true);
  };
  return <main className="min-h-screen bg-[#f8f8f8] text-slate-950">
    <Header authenticated={authenticated} onLogin={() => setAuthOpen(true)} onBrowse={() => setStep("browse")} />
    {step === "browse" && <Browse movies={visibleMovies} query={query} setQuery={setQuery} onBook={startBooking} />}
    {step === "seats" && <SeatBooking movie={activeMovie} seats={seats} selected={selected} setSelected={setSelected} onBack={() => setStep("browse")} onCheckout={checkout} />}
    {step === "confirmation" && <Confirmation movie={activeMovie} selected={selected} total={total} paid={paid} onPay={pay} onHome={() => setStep("browse")} />}
    {authOpen && <AuthDialog error={error} setError={setError} onClose={() => setAuthOpen(false)} onSuccess={() => { setAuthenticated(true); setAuthOpen(false); }} />}
  </main>;
}

function Header({ authenticated, onLogin, onBrowse }: { authenticated: boolean; onLogin: () => void; onBrowse: () => void }) { return <header className="sticky top-0 z-30 border-b border-white/10 bg-[#11101a]/95 text-white backdrop-blur"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 lg:px-8"><button onClick={onBrowse} className="flex items-center gap-2 text-xl font-black tracking-[-.06em]"><span className="grid size-8 place-items-center rounded-lg bg-rose-600"><Clapperboard className="size-4" /></span>showtime</button><nav className="hidden items-center gap-6 text-sm text-slate-300 md:flex"><button className="text-white">Movies</button><button>Coming soon</button><button>Offers</button><button>Cinemas</button></nav><div>{authenticated ? <span className="flex items-center gap-2 text-sm font-semibold"><UserRound className="size-4 text-rose-400" /> Your tickets</span> : <Button onClick={onLogin} className="bg-rose-600 hover:bg-rose-700">Sign in <ArrowRight /></Button>}</div></div></header>; }
function Browse({ movies: result, query, setQuery, onBook }: { movies: Movie[]; query: string; setQuery: (value: string) => void; onBook: (movie: Movie) => void }) {
  const featured = movies[0]; return <><section className="bg-[#11101a] text-white"><div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 lg:grid-cols-[1.25fr_.75fr] lg:px-8 lg:py-16"><div><p className="text-sm font-bold tracking-[.18em] text-rose-400">NOW SHOWING</p><h1 className="mt-3 max-w-2xl text-4xl font-black leading-[.95] tracking-[-.065em] sm:text-6xl">{featured.title}</h1><p className="mt-5 max-w-xl leading-7 text-slate-300">{featured.synopsis}</p><div className="mt-6 flex flex-wrap gap-3 text-sm text-slate-300"><span className="flex items-center gap-1"><Star className="size-4 fill-amber-400 text-amber-400" /> {featured.rating}/10</span><span>•</span><span>{featured.meta}</span><span>•</span><span>{featured.genre}</span></div><Button onClick={() => onBook(featured)} className="mt-8 h-11 bg-rose-600 px-5 hover:bg-rose-700">Book tickets <Ticket /></Button></div><div className={`relative min-h-56 overflow-hidden rounded-2xl bg-gradient-to-br ${featured.poster} shadow-2xl`}><div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_25%,rgba(255,255,255,.45),transparent_24%)]" /><span className="absolute bottom-5 left-5 text-7xl font-black italic text-white/25">MA</span><span className="absolute bottom-7 right-5 rounded-full bg-black/30 px-3 py-1 text-xs font-bold backdrop-blur">IMAX</span></div></div></section>
    <section className="mx-auto max-w-7xl px-5 py-12 lg:px-8"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><p className="text-sm font-bold tracking-[.16em] text-rose-600">IN CINEMAS</p><h2 className="mt-1 text-3xl font-black tracking-[-.05em]">Find your next story.</h2></div><div className="flex h-10 w-full max-w-xs items-center gap-2 rounded-lg border bg-white px-3"><Search className="size-4 text-slate-400" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search movies" className="h-auto border-0 p-0 shadow-none focus-visible:ring-0" /></div></div><div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{result.map((movie) => <MovieCard movie={movie} onBook={() => onBook(movie)} key={movie.id} />)}</div></section></>;
}
function MovieCard({ movie, onBook }: { movie: Movie; onBook: () => void }) { return <Card className="gap-0 overflow-hidden bg-white py-0 shadow-none transition hover:-translate-y-1 hover:shadow-xl"><div className={`relative h-64 bg-gradient-to-br ${movie.poster}`}><span className="absolute inset-x-0 bottom-0 h-2/3 bg-gradient-to-t from-black/55 to-transparent" /><span className="absolute bottom-4 left-4 text-4xl font-black italic text-white/60">{movie.title.split(" ").map((word) => word[0]).join("")}</span><span className="absolute right-3 top-3 rounded bg-black/30 px-2 py-1 text-xs font-bold text-white backdrop-blur">{movie.rating} ★</span></div><CardContent className="p-4"><h3 className="font-bold">{movie.title}</h3><p className="mt-1 text-xs text-slate-500">{movie.genre}</p><p className="mt-1 text-xs text-slate-500">{movie.meta}</p><Button onClick={onBook} variant="outline" className="mt-4 w-full text-rose-600 hover:bg-rose-50 hover:text-rose-700">Showtimes <ChevronRight /></Button></CardContent></Card>; }
function SeatBooking({ movie, seats, selected, setSelected, onBack, onCheckout }: { movie: Movie; seats: Seat[]; selected: string[]; setSelected: (seats: string[]) => void; onBack: () => void; onCheckout: () => void }) { const toggle = (seat: Seat) => setSelected(selected.includes(seat.id) ? selected.filter((id) => id !== seat.id) : selected.length < 6 ? [...selected, seat.id] : selected); return <section className="mx-auto max-w-6xl px-5 py-8 lg:px-8"><button onClick={onBack} className="mb-6 flex items-center gap-1 text-sm font-semibold text-slate-500 hover:text-slate-900"><ArrowLeft className="size-4" /> Back to movies</button><div className="mb-7 flex flex-col justify-between gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end"><div><p className="text-sm font-bold text-rose-600">BOOKING FOR</p><h1 className="mt-1 text-3xl font-black tracking-[-.05em]">{movie.title}</h1><p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500"><span className="flex items-center gap-1"><CalendarDays className="size-4" /> Today, 14 September</span><span className="flex items-center gap-1"><Clock3 className="size-4" /> 07:45 PM</span><span className="flex items-center gap-1"><MapPin className="size-4" /> Grand Cinema, Downtown</span></p></div><div className="flex gap-2"><button className="rounded-lg border border-rose-600 bg-rose-600 px-4 py-2 text-sm font-bold text-white">07:45 PM</button><button className="rounded-lg border px-4 py-2 text-sm font-bold text-slate-600">10:30 PM</button></div></div><MovieSeatMap seats={seats} selected={selected} onToggle={toggle} onCheckout={onCheckout} /></section>; }
function Confirmation({ movie, selected, total, paid, onPay, onHome }: { movie: Movie; selected: string[]; total: number; paid: boolean; onPay: () => void; onHome: () => void }) { return <section className="mx-auto max-w-xl px-5 py-16 text-center"><div className="mx-auto grid size-16 place-items-center rounded-full bg-emerald-100 text-emerald-600"><Ticket className="size-8" /></div><p className="mt-7 text-sm font-bold tracking-[.16em] text-rose-600">{paid ? "BOOKING CONFIRMED" : "SEATS HELD FOR 10 MINUTES"}</p><h1 className="mt-2 text-4xl font-black tracking-[-.06em]">{paid ? "Movie night is booked." : "Almost there."}</h1><p className="mx-auto mt-3 max-w-sm text-slate-500">{paid ? "Your tickets are ready in Your tickets. Enjoy the show." : "Complete payment to receive your QR-ready movie tickets."}</p><Card className="mt-8 bg-white text-left"><CardContent className="p-6"><p className="font-bold">{movie.title}</p><p className="mt-1 text-sm text-slate-500">Today · 07:45 PM · Grand Cinema</p><div className="my-5 border-t border-dashed" /><div className="flex justify-between text-sm"><span className="text-slate-500">Seats</span><span className="font-bold">{selected.join(", ")}</span></div><div className="mt-3 flex justify-between text-lg"><span className="font-bold">Total</span><span className="font-black">₹{total}</span></div></CardContent></Card>{paid ? <Button onClick={onHome} className="mt-6 bg-rose-600 hover:bg-rose-700">Browse more movies <ArrowRight /></Button> : <Button onClick={onPay} className="mt-6 bg-rose-600 hover:bg-rose-700">Pay ₹{total} securely <ArrowRight /></Button>}</section>; }
function AuthDialog({ error, setError, onClose, onSuccess }: { error: string; setError: (value: string) => void; onClose: () => void; onSuccess: () => void }) { const [signup, setSignup] = useState(false); const submit = async (event: FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(""); const data = Object.fromEntries(new FormData(event.currentTarget)); const response = await fetch(`/api/auth/${signup ? "register" : "login"}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }); const result = await response.json().catch(() => ({})); if (response.ok) onSuccess(); else setError(result.error ?? "Unable to continue. Please try again."); }; return <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4 backdrop-blur-sm"><Card className="relative w-full max-w-md bg-white py-0 shadow-2xl"><button onClick={onClose} className="absolute right-4 top-4 text-slate-400"><X className="size-5" /></button><CardContent className="p-7"><p className="text-sm font-bold tracking-[.15em] text-rose-600">SHOWTIME ACCOUNT</p><h2 className="mt-2 text-2xl font-black">{signup ? "Make booking easier." : "Sign in to continue."}</h2><form onSubmit={submit} className="mt-6 space-y-4">{signup && <Input required name="name" placeholder="Your name" className="h-10" />}<Input required name="email" type="email" placeholder="Email address" className="h-10" /><Input required name="password" type="password" minLength={8} placeholder="Password (8+ characters)" className="h-10" />{error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}<Button type="submit" className="h-10 w-full bg-rose-600 hover:bg-rose-700">{signup ? "Create account" : "Sign in"} <ArrowRight /></Button></form><p className="mt-5 text-center text-sm text-slate-500">{signup ? "Already have an account?" : "New here?"} <button onClick={() => setSignup(!signup)} className="font-bold text-rose-600">{signup ? "Sign in" : "Create account"}</button></p></CardContent></Card></div>; }
