import { ProfileForm } from "@/components/profile-form";
import { getCurrentUser } from "@/lib/auth/server";
import { redirect } from "next/navigation";

export default async function EditProfilePage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <section className="page-enter space-y-5">
      <div className="rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--text-secondary)]">Profile Settings</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-[var(--text-primary)]">Edit Your Profile</h1>
        <p className="mt-2 text-sm text-[var(--text-secondary)]">
          Make changes to your profile details and save to return to your public profile page.
        </p>
      </div>

      <ProfileForm user={user} />
    </section>
  );
}
