"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Armchair,
  ArrowRight,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  CreditCard,
  ExternalLink,
  Film,
  MapPin,
  Play,
  QrCode,
  Search,
  ShieldCheck,
  Star,
  Ticket,
  X,
  Zap,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/format";

type Movie = {
  id: string;
  name: string;
  description: string | null;
  imageUrl?: string | null;
  trailerImageUrl?: string | null;
  trailerUrl?: string | null;
  startTime: string;
  endTime?: string;
  venue: { name: string; city: string };
  ticketTypes: { basePrice: string | number }[];
  inventories: { currentPrice: string | number; status: string }[];
};

function getYouTubeEmbedUrl(url?: string | null): string | null {
  if (!url) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return match && match[2].length === 11
    ? `https://www.youtube-nocookie.com/embed/${match[2]}?autoplay=1`
    : null;
}

function resolveMovieImage(movie: Movie): string | null {
  const img = movie.imageUrl || movie.trailerImageUrl;
  if (!img) return null;
  if (img.includes("imdb.com") && movie.name.toLowerCase().includes("jungle book")) {
    return "https://upload.wikimedia.org/wikipedia/en/a/a4/The_Jungle_Book_%282016%29.jpg";
  }
  return img;
}

export function HomePage() {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [query, setQuery] = useState("");
  const [selectedCity, setSelectedCity] = useState("ALL");
  const [loading, setLoading] = useState(true);
  const [spotlightIndex, setSpotlightIndex] = useState(0);
  const [activeTrailer, setActiveTrailer] = useState<{ title: string; url: string } | null>(null);

  useEffect(() => {
    fetch("/api/movies")
      .then((response) => (response.ok ? response.json() : { movies: [] }))
      .then((data) => setMovies(data.movies ?? []))
      .catch(() => setMovies([]))
      .finally(() => setLoading(false));
  }, []);

  const cities = useMemo(() => {
    const list = movies.map((m) => m.venue.city).filter(Boolean);
    return ["ALL", ...new Set(list)];
  }, [movies]);

  const visible = useMemo(() => {
    return movies.filter((movie) => {
      const matchesQuery = `${movie.name} ${movie.venue.name} ${movie.venue.city}`
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesCity = selectedCity === "ALL" || movie.venue.city === selectedCity;
      return matchesQuery && matchesCity;
    });
  }, [movies, query, selectedCity]);

  const featuredMovie = visible.length > 0 ? visible[spotlightIndex % visible.length] : movies[0];

  const nextSpotlight = () => {
    if (visible.length > 0) {
      setSpotlightIndex((prev) => (prev + 1) % visible.length);
    }
  };

  const prevSpotlight = () => {
    if (visible.length > 0) {
      setSpotlightIndex((prev) => (prev - 1 + visible.length) % visible.length);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      {/* ============================================================ */}
      {/* HERO SECTION                                                  */}
      {/* ============================================================ */}
      <section className="relative overflow-hidden border-b border-white/10 bg-[#0c0e20] pb-16 pt-10 lg:pb-24 lg:pt-14">
        {/* Theatrical Lighting FX */}
        <div className="pointer-events-none absolute -top-40 left-1/2 h-[500px] w-[800px] -translate-x-1/2 rounded-full bg-gradient-to-b from-violet-600/25 via-fuchsia-600/15 to-transparent blur-3xl" />
        <div className="pointer-events-none absolute -left-20 top-40 size-96 rounded-full bg-violet-600/15 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-10 size-96 rounded-full bg-fuchsia-600/15 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-12 px-5 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-14 lg:px-8">
          {/* Left Column: Headline & Hero Actions */}
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/20 bg-violet-500/10 px-3.5 py-1.5 text-xs font-semibold text-violet-300 backdrop-blur-md">
              <span className="relative flex size-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-400" />
              </span>
              <span>LIVE SHOWTIMES · INSTANT SEAT CONFIRMATION</span>
            </div>

            <h1 className="text-4xl font-black leading-[1.04] tracking-[-0.05em] sm:text-6xl lg:text-7xl">
              Experience the big screen.{" "}
              <span className="bg-gradient-to-r from-violet-300 via-fuchsia-300 to-amber-200 bg-clip-text text-transparent">
                Save your seat.
              </span>
            </h1>

            <p className="max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Curated cinema experiences with live interactive seat selection, dynamic fair pricing, and express QR entry at the door.
            </p>

            {/* Quick Search & Explore Bar */}
            <div className="flex flex-col gap-3 rounded-2xl border border-white/15 bg-white/5 p-2 backdrop-blur-xl sm:flex-row sm:items-center">
              <div className="relative flex flex-1 items-center">
                <Search className="absolute left-3.5 size-4 text-violet-300" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search a movie, cinema, or city..."
                  className="h-11 border-0 bg-transparent pl-10 text-sm text-white placeholder:text-slate-400 focus-visible:ring-0 shadow-none"
                />
              </div>
              <Link href="#shows">
                <Button className="h-11 w-full rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 font-bold text-white shadow-lg shadow-violet-600/30 transition hover:from-violet-500 hover:to-fuchsia-500 sm:w-auto">
                  Browse shows <ArrowRight className="size-4" />
                </Button>
              </Link>
            </div>

            {/* Trust Metrics Pill Bar */}
            <div className="grid grid-cols-3 gap-3 pt-2">
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center sm:text-left">
                <div className="flex items-center justify-center gap-1.5 text-violet-300 sm:justify-start">
                  <QrCode className="size-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Fast Pass</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">Direct QR door entry</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center sm:text-left">
                <div className="flex items-center justify-center gap-1.5 text-fuchsia-300 sm:justify-start">
                  <Armchair className="size-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Live Map</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">Real-time seat lock</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-center sm:text-left">
                <div className="flex items-center justify-center gap-1.5 text-emerald-300 sm:justify-start">
                  <ShieldCheck className="size-4" />
                  <span className="text-xs font-bold uppercase tracking-wider">Secured</span>
                </div>
                <p className="mt-1 text-xs text-slate-400">Razorpay protected</p>
              </div>
            </div>
          </div>

          {/* Right Column: Interactive Cinema Spotlight Card */}
          <div className="relative">
            {featuredMovie ? (
              <SpotlightCard
                movie={featuredMovie}
                allMovies={visible}
                activeIndex={spotlightIndex}
                onSelect={(idx) => setSpotlightIndex(idx)}
                onNext={nextSpotlight}
                onPrev={prevSpotlight}
                onPlayTrailer={(title, url) => setActiveTrailer({ title, url })}
              />
            ) : (
              <div className="relative min-h-[460px] overflow-hidden rounded-[2.5rem] border border-white/15 bg-gradient-to-br from-violet-900/60 via-slate-900 to-slate-950 p-8 shadow-2xl">
                <div className="flex h-full flex-col justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-violet-500/20 px-3 py-1 text-xs font-bold text-violet-300 backdrop-blur">
                      CINEMA SHOWCASE
                    </span>
                  </div>
                  <div>
                    <Clapperboard className="size-16 text-violet-400/80" />
                    <h2 className="mt-4 text-3xl font-black">Cinema lineup loading...</h2>
                    <p className="mt-2 text-sm text-slate-400">Browse all showtimes and book your seats below.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* IN CINEMAS / SHOWTIMES CATALOG                                */}
      {/* ============================================================ */}
      <section id="shows" className="mx-auto max-w-7xl px-5 py-16 lg:px-8 lg:py-24">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <div className="inline-flex items-center gap-2 text-xs font-black tracking-widest text-violet-400">
              <Film className="size-3.5" /> IN CINEMAS NOW
            </div>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">
              Pick a story. Choose your seat.
            </h2>
            <p className="mt-2 text-sm text-slate-400">
              Showing {visible.length} available {visible.length === 1 ? "screening" : "screenings"} across city venues.
            </p>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center gap-2">
            {cities.map((city) => (
              <button
                key={city}
                onClick={() => setSelectedCity(city)}
                className={`rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                  selectedCity === city
                    ? "bg-violet-600 text-white shadow-lg shadow-violet-600/30"
                    : "border border-white/10 bg-white/5 text-slate-300 hover:bg-white/10 hover:text-white"
                }`}
              >
                {city === "ALL" ? "All Locations" : city}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-96 animate-pulse rounded-3xl border border-white/10 bg-white/5" />
            ))}
          </div>
        ) : visible.length ? (
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((movie, index) => (
              <MovieCard
                key={movie.id}
                movie={movie}
                index={index}
                onPlayTrailer={(title, url) => setActiveTrailer({ title, url })}
              />
            ))}
          </div>
        ) : (
          <EmptyShows query={query} onReset={() => { setQuery(""); setSelectedCity("ALL"); }} />
        )}
      </section>

      {/* ============================================================ */}
      {/* CINEMA PERKS / THE SHOWTIME ADVANTAGE                          */}
      {/* ============================================================ */}
      <section className="border-t border-white/10 bg-[#0e1022] py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="text-center">
            <p className="text-xs font-black tracking-widest text-violet-400 uppercase">The Showtime Standard</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
              Engineered for cinema lovers
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-slate-400">
              Every detail is designed to make your cinema night effortless, from seat selection to the opening credits.
            </p>
          </div>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <FeatureCard
              icon={<Armchair className="size-6 text-violet-400" />}
              title="Interactive Seat Layout"
              description="Choose exact seats with tiered Classic, Prime, and VIP Recliner views before you pay."
            />
            <FeatureCard
              icon={<QrCode className="size-6 text-fuchsia-400" />}
              title="Instant QR Door Pass"
              description="Skip the box office counter. Walk straight into the theater with your verified digital pass."
            />
            <FeatureCard
              icon={<Zap className="size-6 text-amber-400" />}
              title="Dynamic Fair Pricing"
              description="Enjoy transparent ticket costs with early-bird savings and zero hidden booking fees."
            />
            <FeatureCard
              icon={<CreditCard className="size-6 text-emerald-400" />}
              title="Seamless Razorpay Pay"
              description="Pay securely using UPI, Credit/Debit cards, or NetBanking with instant receipt delivery."
            />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* HOW IT WORKS SECTION                                          */}
      {/* ============================================================ */}
      <section id="how-it-works" className="border-t border-white/10 bg-[#0b0c1b] py-20">
        <div className="mx-auto max-w-7xl px-5 lg:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <div>
              <p className="text-xs font-black tracking-widest text-violet-400 uppercase">Three Simple Steps</p>
              <h2 className="mt-1 text-3xl font-black tracking-tight sm:text-4xl">
                The shortest path to a great night
              </h2>
            </div>
            <Link href="#shows">
              <Button variant="outline" className="border-white/15 bg-white/5 text-xs text-white hover:bg-white/10">
                Browse movies now <ArrowRight className="size-3.5" />
              </Button>
            </Link>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            <StepCard
              number="01"
              title="Find your show"
              text="Choose a movie, venue, and time that work for your crew across your favorite local cinemas."
            />
            <StepCard
              number="02"
              title="Claim your seats"
              text="Explore the live seating map and hold up to six seats in real time while you complete checkout."
            />
            <StepCard
              number="03"
              title="Tickets ready"
              text="Pay securely and access your digital ticket with high-contrast QR entry pass immediately."
            />
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* FOOTER                                                        */}
      {/* ============================================================ */}
      <footer className="border-t border-white/10 bg-[#090a16] py-12 text-sm text-slate-400">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-6 px-5 sm:flex-row lg:px-8">
          <div className="flex items-center gap-2 text-lg font-black tracking-tight text-white">
            <span className="grid size-7 place-items-center rounded-lg bg-gradient-to-br from-violet-500 to-fuchsia-500 text-white shadow-md">
              <Clapperboard className="size-3.5" />
            </span>
            showtime
          </div>
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} Showtime Ticketing Platform. Built for cinema lovers.
          </p>
          <div className="flex items-center gap-6 text-xs font-medium">
            <Link href="#shows" className="hover:text-white transition">Movies</Link>
            <Link href="#how-it-works" className="hover:text-white transition">How it works</Link>
            <Link href="/admin" className="hover:text-white transition">Organizer Portal</Link>
          </div>
        </div>
      </footer>

      {/* ============================================================ */}
      {/* TRAILER MODAL                                                 */}
      {/* ============================================================ */}
      {activeTrailer && (
        <TrailerModal
          title={activeTrailer.title}
          url={activeTrailer.url}
          onClose={() => setActiveTrailer(null)}
        />
      )}
    </main>
  );
}

/* ================================================================== */
/* SUB-COMPONENTS                                                     */
/* ================================================================== */

function SpotlightCard({
  movie,
  allMovies,
  activeIndex,
  onSelect,
  onNext,
  onPrev,
  onPlayTrailer,
}: {
  movie: Movie;
  allMovies: Movie[];
  activeIndex: number;
  onSelect: (idx: number) => void;
  onNext: () => void;
  onPrev: () => void;
  onPlayTrailer: (title: string, url: string) => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const imageUrl = resolveMovieImage(movie);
  const showImage = Boolean(imageUrl) && !imgFailed;

  const prices = movie.inventories.filter((item) => item.status === "AVAILABLE").map((item) => Number(item.currentPrice));
  const lowest = prices.length ? Math.min(...prices) : Math.min(...movie.ticketTypes.map((item) => Number(item.basePrice)));

  return (
    <div className="group relative min-h-[490px] overflow-hidden rounded-[2.5rem] border border-white/20 bg-slate-900 shadow-2xl shadow-violet-950/50">
      {/* Backdrop Image or Gradient */}
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl!}
          alt={movie.name}
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-violet-800 via-fuchsia-800 to-indigo-950 p-8 flex items-center justify-center">
          <Clapperboard className="size-32 text-white/10" />
        </div>
      )}

      {/* Cinematic Vignette Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#090a16] via-[#090a16]/75 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#090a16]/80 via-transparent to-transparent" />

      {/* Card Content */}
      <div className="relative flex h-full min-h-[490px] flex-col justify-between p-6 sm:p-8">
        {/* Top Badges & Controls */}
        <div className="flex items-center justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/50 px-3 py-1 text-xs font-black tracking-wider text-amber-300 backdrop-blur-md">
              <Star className="size-3 fill-amber-300" /> SPOTLIGHT
            </span>
            <span className="rounded-full border border-white/15 bg-white/10 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
              DOLBY ATMOS · 4K
            </span>
          </div>

          {allMovies.length > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={onPrev}
                aria-label="Previous movie"
                className="grid size-8 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition hover:bg-white/20"
              >
                <ChevronLeft className="size-4" />
              </button>
              <button
                type="button"
                onClick={onNext}
                aria-label="Next movie"
                className="grid size-8 place-items-center rounded-full border border-white/20 bg-black/40 text-white backdrop-blur transition hover:bg-white/20"
              >
                <ChevronRight className="size-4" />
              </button>
            </div>
          )}
        </div>

        {/* Bottom Movie Details */}
        <div className="space-y-4">
          <div>
            <p className="text-xs font-black tracking-widest text-violet-300 uppercase">Featured Showtime</p>
            <h3 className="mt-1 text-3xl font-black text-white sm:text-4xl">{movie.name}</h3>
            <p className="mt-2 line-clamp-2 text-xs text-slate-300 sm:text-sm">
              {movie.description ?? "A big-screen cinematic journey waiting for your favorite seat."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-300">
            <span className="flex items-center gap-1.5">
              <CalendarDays className="size-3.5 text-violet-400" />
              {formatDate(movie.startTime)}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-violet-400" />
              {movie.venue.name}, {movie.venue.city}
            </span>
            <span className="rounded-lg bg-violet-600/30 px-2 py-0.5 text-violet-200">
              From {formatCurrency(lowest)}
            </span>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <Link href={`/movies/${movie.id}`} className="flex-1 sm:flex-none">
              <Button className="h-11 w-full rounded-xl bg-violet-600 px-6 font-bold text-white shadow-lg shadow-violet-600/40 hover:bg-violet-500 sm:w-auto">
                <Ticket className="size-4" /> Book tickets
              </Button>
            </Link>

            {movie.trailerUrl && (
              <Button
                variant="outline"
                onClick={() => onPlayTrailer(movie.name, movie.trailerUrl!)}
                className="h-11 rounded-xl border-white/20 bg-white/10 px-4 font-semibold text-white backdrop-blur hover:bg-white/20"
              >
                <Play className="size-4 fill-white" /> Watch trailer
              </Button>
            )}
          </div>

          {/* Lineup Switcher Mini Strip */}
          {allMovies.length > 1 && (
            <div className="flex items-center gap-2 border-t border-white/10 pt-3">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Lineup:</span>
              <div className="flex flex-wrap gap-1.5">
                {allMovies.slice(0, 5).map((m, idx) => (
                  <button
                    key={m.id}
                    onClick={() => onSelect(idx)}
                    className={`truncate rounded-lg px-2.5 py-1 text-xs font-semibold transition ${
                      activeIndex % allMovies.length === idx
                        ? "bg-white text-slate-950 font-bold"
                        : "bg-white/10 text-slate-300 hover:bg-white/20 hover:text-white"
                    }`}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MovieCard({
  movie,
  index,
  onPlayTrailer,
}: {
  movie: Movie;
  index: number;
  onPlayTrailer: (title: string, url: string) => void;
}) {
  const prices = movie.inventories.filter((item) => item.status === "AVAILABLE").map((item) => Number(item.currentPrice));
  const lowest = prices.length ? Math.min(...prices) : Math.min(...movie.ticketTypes.map((item) => Number(item.basePrice)));
  const gradients = [
    "from-violet-700 via-purple-800 to-indigo-950",
    "from-teal-700 via-cyan-800 to-slate-900",
    "from-rose-700 via-orange-800 to-slate-900",
    "from-indigo-700 via-blue-800 to-slate-900",
  ];
  const [imageFailed, setImageFailed] = useState(false);
  const displayImage = resolveMovieImage(movie);
  const showImage = Boolean(displayImage) && !imageFailed;

  return (
    <article className="group flex flex-col overflow-hidden rounded-[2rem] border border-white/10 bg-[#121429] shadow-xl transition-all duration-300 hover:-translate-y-1.5 hover:border-violet-500/40 hover:shadow-2xl hover:shadow-violet-950/40">
      {/* Poster Image Container */}
      <div className={`relative h-56 overflow-hidden bg-gradient-to-br ${gradients[index % gradients.length]}`}>
        {showImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={displayImage!}
            alt={movie.name}
            referrerPolicy="no-referrer"
            onError={() => setImageFailed(true)}
            className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-[#121429] via-[#121429]/40 to-black/30" />

        <div className="relative flex h-full flex-col justify-between p-4">
          <div className="flex items-center justify-between">
            <span className="rounded-full border border-white/20 bg-black/50 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
              NOW PLAYING
            </span>
            <span className="rounded-full bg-violet-600 px-2.5 py-1 text-xs font-black text-white shadow-md">
              From {formatCurrency(lowest)}
            </span>
          </div>

          {!showImage && (
            <p className="text-4xl font-black italic tracking-tighter text-white/40">
              {movie.name.split(" ").map((w) => w[0]).join("")}
            </p>
          )}

          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-300">
            <span className="rounded bg-black/40 px-1.5 py-0.5 backdrop-blur">DOLBY</span>
            <span className="rounded bg-black/40 px-1.5 py-0.5 backdrop-blur">4K</span>
          </div>
        </div>
      </div>

      {/* Card Body */}
      <div className="flex flex-1 flex-col justify-between p-5">
        <div>
          <h3 className="text-xl font-extrabold tracking-tight text-white group-hover:text-violet-300 transition">
            {movie.name}
          </h3>
          <p className="mt-2 line-clamp-2 min-h-10 text-xs leading-5 text-slate-400">
            {movie.description ?? "A big-screen story, waiting for your favorite seat."}
          </p>

          <div className="mt-4 space-y-1.5 text-xs text-slate-300">
            <p className="flex items-center gap-2">
              <CalendarDays className="size-3.5 text-violet-400" />
              {formatDate(movie.startTime)}
            </p>
            <p className="flex items-center gap-2">
              <MapPin className="size-3.5 text-violet-400" />
              {movie.venue.name}, {movie.venue.city}
            </p>
          </div>
        </div>

        {/* Card Action Footer */}
        <div className="mt-6 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
          {movie.trailerUrl ? (
            <button
              type="button"
              onClick={() => onPlayTrailer(movie.name, movie.trailerUrl!)}
              className="flex items-center gap-1.5 text-xs font-bold text-violet-300 hover:text-white transition"
            >
              <Play className="size-3.5 fill-violet-400" /> Trailer
            </button>
          ) : (
            <span className="text-[11px] font-medium text-slate-500">Fast QR Entry</span>
          )}

          <Link href={`/movies/${movie.id}`}>
            <Button className="rounded-xl bg-violet-600 px-4 text-xs font-bold text-white shadow-md hover:bg-violet-500">
              Book <ArrowRight className="size-3" />
            </Button>
          </Link>
        </div>
      </div>
    </article>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 transition hover:border-violet-500/30 hover:bg-white/[0.05]">
      <div className="grid size-12 place-items-center rounded-xl bg-white/5">{icon}</div>
      <h3 className="mt-4 text-lg font-bold text-white">{title}</h3>
      <p className="mt-2 text-xs leading-5 text-slate-400">{description}</p>
    </div>
  );
}

function StepCard({ number, title, text }: { number: string; title: string; text: string }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#121429] p-7 transition hover:border-violet-500/40">
      <span className="text-2xl font-black text-violet-400">{number}</span>
      <h3 className="mt-4 text-xl font-bold text-white">{title}</h3>
      <p className="mt-2 text-xs leading-relaxed text-slate-400">{text}</p>
    </div>
  );
}

function EmptyShows({ query, onReset }: { query: string; onReset: () => void }) {
  return (
    <div className="mt-10 rounded-3xl border border-dashed border-white/15 bg-white/5 p-12 text-center">
      <Clapperboard className="mx-auto size-12 text-slate-500" />
      <h3 className="mt-4 text-xl font-bold text-white">
        {query ? "No matching screenings found." : "No published showtimes right now."}
      </h3>
      <p className="mx-auto mt-2 max-w-sm text-xs text-slate-400">
        {query
          ? "Try a different movie title, cinema name, or clear your filters."
          : "Organizers can publish upcoming movies from the organizer dashboard."}
      </p>
      <div className="mt-6 flex justify-center gap-3">
        {query ? (
          <Button onClick={onReset} variant="outline" className="border-white/20 text-xs text-white">
            Reset filters
          </Button>
        ) : (
          <Link href="/admin">
            <Button variant="outline" className="border-white/20 text-xs text-white">
              Open organizer dashboard <ArrowRight className="size-3.5" />
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function TrailerModal({ title, url, onClose }: { title: string; url: string; onClose: () => void }) {
  const embedUrl = getYouTubeEmbedUrl(url);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 p-4 backdrop-blur-md">
      <div className="relative w-full max-w-3xl overflow-hidden rounded-3xl border border-white/20 bg-slate-950 p-4 shadow-2xl">
        <div className="mb-3 flex items-center justify-between px-2">
          <div className="flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-violet-600 text-white">
              <Play className="size-3 fill-white" />
            </span>
            <h3 className="text-sm font-bold text-white">{title} — Official Trailer</h3>
          </div>
          <button
            onClick={onClose}
            aria-label="Close trailer"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        <div className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black">
          {embedUrl ? (
            <iframe
              src={embedUrl}
              title={`${title} Trailer`}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="h-full w-full border-0"
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center p-6 text-center">
              <Film className="size-12 text-slate-600" />
              <p className="mt-3 text-sm text-slate-300">Watch the trailer on external video provider</p>
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-xs font-bold text-white hover:bg-violet-500"
              >
                Open trailer link <ExternalLink className="size-3.5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
