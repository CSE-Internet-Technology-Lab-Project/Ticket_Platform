import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin/AdminDashboard";
import { getOrganizer } from "@/lib/current-user";

export default async function AdminPage() {
  if (!await getOrganizer()) redirect("/");
  return <AdminDashboard />;
}
