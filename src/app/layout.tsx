import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";
import { SiteShell } from "@/components/site/SiteShell";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });

export const metadata: Metadata = {
  title: "showtime — Book movie tickets",
  description: "Choose a film, showtime, and the seats that make movie night better.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geist.variable} h-full antialiased`}
    >
      <body className="min-h-full font-sans"><SiteShell>{children}</SiteShell></body>
    </html>
  );
}
