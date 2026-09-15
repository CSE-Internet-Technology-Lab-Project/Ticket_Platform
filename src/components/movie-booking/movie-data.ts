import type { Movie, Seat } from "./types";

export const movies: Movie[] = [
  { id: "midnight-archive", title: "The Midnight Archive", meta: "UA · 2h 18m · English", genre: "Mystery · Drama", rating: "8.7", duration: "2h 18m", poster: "from-indigo-950 via-indigo-700 to-fuchsia-500", synopsis: "A brilliant archivist discovers a vanished film reel that rewrites the city’s past." },
  { id: "afterlight", title: "Afterlight", meta: "U · 1h 54m · English", genre: "Romance · Sci-fi", rating: "8.1", duration: "1h 54m", poster: "from-orange-400 via-rose-500 to-purple-700", synopsis: "Two strangers chase the last sunrise on a world that never stops glowing." },
  { id: "rust-and-rain", title: "Rust & Rain", meta: "A · 2h 06m · Hindi", genre: "Action · Thriller", rating: "7.9", duration: "2h 06m", poster: "from-amber-700 via-red-700 to-slate-950", synopsis: "A reluctant fixer has one rain-soaked night to undo an impossible deal." },
  { id: "paper-planets", title: "Paper Planets", meta: "U · 1h 42m · English", genre: "Animation · Family", rating: "8.4", duration: "1h 42m", poster: "from-sky-400 via-cyan-400 to-violet-500", synopsis: "A tiny paper astronaut makes a huge friend beyond the clouds." },
];

const sectionConfig = [
  { section: "RECLINER" as const, rows: ["J"], seats: 8, price: 570 },
  { section: "PRIME" as const, rows: ["H", "G", "F", "E", "D"], seats: 12, price: 350 },
  { section: "CLASSIC" as const, rows: ["C", "B", "A"], seats: 14, price: 220 },
];

export const demoSeats: Seat[] = sectionConfig.flatMap(({ section, rows, seats, price }) =>
  rows.flatMap((row) => Array.from({ length: seats }, (_, index) => {
    const number = index + 1;
    return {
      id: `${row}-${number}`,
      label: `${row}${number}`,
      row, number, section, price,
      status: ["G-6", "G-7", "F-3", "J-4", "C-11", "B-6"].includes(`${row}-${number}`) ? "sold" as const : "available" as const,
    };
  }))
);
