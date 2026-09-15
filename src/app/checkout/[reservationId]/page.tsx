import { CheckoutPage } from "@/components/checkout/CheckoutPage";

export default async function Checkout({ params }: { params: Promise<{ reservationId: string }> }) {
  const { reservationId } = await params;
  return <CheckoutPage reservationId={reservationId} />;
}
