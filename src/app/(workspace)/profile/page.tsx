import { ProfilePortfolio } from "@/components/profile-portfolio";
import { getCurrentUser } from "@/lib/auth/server";
import { listProfileActivity } from "@/lib/profile-activity";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  const activities = await listProfileActivity(user.id);

  return <ProfilePortfolio user={user} activities={activities} />;
}
