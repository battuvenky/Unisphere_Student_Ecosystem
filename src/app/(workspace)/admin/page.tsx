import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { AdminDashboard } from "@/components/admin/admin-dashboard";

export default async function AdminPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "admin") {
    redirect("/dashboard?denied=admin");
  }

  return <AdminDashboard />;
}
