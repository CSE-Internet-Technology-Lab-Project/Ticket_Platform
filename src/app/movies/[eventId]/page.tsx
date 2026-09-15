import { MovieBookingPage } from "@/components/movies/MovieBookingPage";

export default async function MoviePage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  return <MovieBookingPage eventId={eventId} />;
}
