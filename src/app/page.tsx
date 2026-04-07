import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/server";
import { UniSphereLanding } from "@/components/landing/unisphere-landing";

export default async function Home() {
  const user = await getCurrentUser();

  if (user) {
    redirect(user.role === "admin" ? "/admin" : "/dashboard");
  }

  return <UniSphereLanding />;
}
