"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, Save } from "lucide-react";
import type { SessionUser, UserSkill } from "@/lib/auth/types";

type ProfileFormProps = {
  user: SessionUser;
};

export function ProfileForm({ user }: ProfileFormProps) {
  const router = useRouter();
  const [fullName, setFullName] = useState(user.profile.fullName);
  const [profileImageUrl, setProfileImageUrl] = useState(user.profile.profileImageUrl ?? "");
  const [department, setDepartment] = useState(user.profile.department);
  const [year, setYear] = useState(user.profile.year);
  const [skillsInput, setSkillsInput] = useState(() =>
    (user.profile.skills ?? [])
      .map((skill) => skill.name)
      .filter(Boolean)
      .join(", ")
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const existingSkillsByName = useMemo(() => {
    const map = new Map<string, UserSkill>();
    for (const skill of user.profile.skills ?? []) {
      map.set(skill.name.trim().toLowerCase(), skill);
    }
    return map;
  }, [user.profile.skills]);

  const parsedSkills = useMemo(() => {
    const seen = new Set<string>();

    return skillsInput
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item.length > 0)
      .filter((item) => {
        const key = item.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .slice(0, 30)
      .map((name) => {
        const existing = existingSkillsByName.get(name.toLowerCase());

        return (
          existing ?? {
            id: typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${name}`,
            name,
            category: "General",
            level: 70,
          }
        );
      });
  }, [existingSkillsByName, skillsInput]);

  const onSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const response = await fetch("/api/profile", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fullName,
          profileImageUrl,
          department,
          year,
          skills: parsedSkills,
        }),
      });

      const data = (await response.json()) as { error?: string; message?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Could not update profile");
      }

      router.push("/profile");
      router.refresh();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Could not update profile");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={onSave} className="fade-slide-enter rounded-3xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
      <h2 className="text-xl font-semibold text-[var(--text-primary)]">Edit Profile</h2>
      <p className="mt-1 text-sm text-[var(--text-secondary)]">Update your identity, academics, and skills in one place.</p>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Profile Image URL</span>
          <input
            value={profileImageUrl}
            onChange={(event) => setProfileImageUrl(event.target.value)}
            className="auth-input"
            placeholder="https://images.example.com/profile.jpg"
          />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Full Name</span>
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="auth-input" required />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Department</span>
          <input value={department} onChange={(event) => setDepartment(event.target.value)} className="auth-input" required />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Year</span>
          <input value={year} onChange={(event) => setYear(event.target.value)} className="auth-input" required />
        </label>

        <label className="block md:col-span-2">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-[var(--text-secondary)]">Skills</span>
          <textarea
            value={skillsInput}
            onChange={(event) => setSkillsInput(event.target.value)}
            className="auth-input min-h-24 resize-y"
            placeholder="React, TypeScript, Data Structures, Public Speaking"
          />
          <p className="mt-1 text-xs text-[var(--text-secondary)]">Use comma-separated values. Existing skill levels are preserved when names match.</p>
        </label>
      </div>

      {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

      <div className="mt-5 flex items-center justify-end gap-3">
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-sm font-semibold text-[var(--text-primary)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSaving}
          className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:brightness-110 disabled:opacity-75"
        >
          {isSaving ? <LoaderCircle size={16} className="animate-spin" /> : <Save size={16} />}
          Save Profile
        </button>
      </div>
    </form>
  );
}
