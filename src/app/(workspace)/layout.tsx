import { AppShell } from "@/components/app-shell";
import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default function WorkspaceLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <WorkspaceLayoutContent>{children}</WorkspaceLayoutContent>;
}

async function WorkspaceLayoutContent({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return <AppShell user={user}>{children}</AppShell>;
}
