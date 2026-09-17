import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getOrganizer } from "@/lib/current-user";

export default async function AdminPage() {
  const organizer = await getOrganizer();
  if (!organizer) {
    redirect("/?admin=access-denied");
  }
  return <AdminDashboard />;
}
